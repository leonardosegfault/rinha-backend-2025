import { parentPort, threadId } from "node:worker_threads";
import PQueue from "p-queue";
import { Agent, fetch } from "undici";
import { client, getPubSubClient, addSummary, pushQueue, popQueue } from "./redis.js";
import {
  DEFAULT_PROCESSOR,
  getAltProcessor,
  getBestProcessor,
  setProcessor,
  monitorDefaultProcessor
} from "./payment-processor.js";

const LOG_PREFIX = `[WORKER ${threadId}]`;

const concurrency = 20;
const queue = new PQueue({ concurrency, autoStart: false });
queue.start();

const pubsub = getPubSubClient();
await pubsub.subscribe("summary:ctrl");

/** @type {Agent.Options} */
const agentConfig = {
  keepAliveTimeout: 60000,
  connections: concurrency
};
const defaultAgent = new Agent(agentConfig);
const fallbackAgent = new Agent(agentConfig); 

/**
 * @param {string} processor 
 * @param {number} amount 
 * @param {number} timestamp 
 */
async function updateSummary(processor, amount, timestamp) {
  processor = processor == DEFAULT_PROCESSOR ? "default" : "fallback";

  await addSummary(processor, amount, timestamp);
}

pubsub.on("message", async (channel, event) => {
  const MSG_LOG_PREFIX = `[PUBSUB - WORKER ${threadId}]`;
  console.log(MSG_LOG_PREFIX, `recebeu evento "${event}" (${channel})`)

  if (event == "pause") {
    console.log(LOG_PREFIX, "pausando tarefas.");
    queue.pause();

    const listenersCount = await client.publish("summary:ack", "paused");
    console.log(MSG_LOG_PREFIX, `ack enviado para ${listenersCount}.`);
  } else if (event == "resume") {
    console.log(LOG_PREFIX, "iniciando tarefas.");
    queue.start();
  }
});

parentPort.on("message", async (
  /** @type {ArrayBuffer} */
  data
) => {
  const hex = Buffer.from(data.slice(0, 16)).toString("hex");
  const correlationId =
    hex.slice(0, 8)  + "-" +
    hex.slice(8, 12) + "-" +
    hex.slice(12, 16)+ "-" +
    hex.slice(16, 20)+ "-" +
    hex.slice(20);
  const amount = new Float64Array(data, 16)[0];

  try {
    await pushQueue(correlationId, amount);
  } catch(e) {
    console.error(LOG_PREFIX, "falha ao enfileirar um pagamento:\n", e);
  }
});

async function processExternalQueue() {
  let amount = null;
  let correlationId = null;
  
  try {
    const payment = await popQueue();

    amount = payment.amount;
    correlationId = payment.correlationId;
  } catch(e) {
    console.error(LOG_PREFIX, "falha ao obter primeiro item da fila:\n", e);
    return processExternalQueue();
  }

  async function processPayment() {
    let processor = getBestProcessor();
    /** @type {RequestInit} */
    const payload = {
      method: "POST",
      headers: {
        "content-type": "application/json",
      }
    };

    try {
      let requestedAt = new Date();
      payload.dispatcher = processor == DEFAULT_PROCESSOR ? defaultAgent : fallbackAgent;
      payload.body = JSON.stringify({
        correlationId,
        amount,
        requestedAt: requestedAt.toISOString()
      });

      let paymentRes = await fetch(processor + "/payments", payload);
      if (paymentRes.status == 200) {
        await updateSummary(processor, amount, requestedAt.getTime());

        if (queue.pending <= queue.concurrency) {
          processExternalQueue();
        }
      } else {
        processor = getAltProcessor();
        setProcessor(processor);
        monitorDefaultProcessor(0);
        
        requestedAt = new Date();
        payload.dispatcher = processor == DEFAULT_PROCESSOR ? defaultAgent : fallbackAgent;
        payload.body = JSON.stringify({
          correlationId,
          amount,
          requestedAt: requestedAt.toISOString()
        });

        paymentRes = await fetch(processor + "/payments", payload);
        if (paymentRes.status == 200) {
          await updateSummary(processor, amount, requestedAt.getTime());

          if (queue.pending <= queue.concurrency) {
            processExternalQueue();
          }
        } else {
          queue.add(processPayment);
        }
      }
    } catch(e) {
      queue.add(processPayment);

      console.error(LOG_PREFIX, "falha ao processar pagamento:\n", e);
    }
  }

  queue.add(processPayment);
}

for (let i = 0; i < queue.concurrency; i++) {
  processExternalQueue();
}