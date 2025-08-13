import { ServerResponse } from "node:http";
import { EventEmitter } from "node:events";
import { client, getPubSubClient, fetchSummary } from "../services/redis.js";

// let listenerCount = 0;
// const ackEmitter = new EventEmitter();

// const pubsub = getPubSubClient();
// await pubsub.subscribe("summary:ack");

// pubsub.on("message", (channel, event) => {
//   console.log(`[PUBSUB] recebeu evento "${event}" (${channel})`);

//   if (event == "paused") {
//     listenerCount--;

//     if (listenerCount <= 0) {
//       ackEmitter.emit("done");
//     }
//   }
// });

async function publishPauseAndWait() {
  const receivedAmount = await client.publish("summary:ctrl", "pause");
  console.log(`[PUBSUB] publicado pausa para ${receivedAmount}`);

  // listenerCount = receivedAmount;

  // return new Promise((resolve) => 
  //   ackEmitter.once("done", () => resolve())
  // );
}

/**
 * @param {ServerResponse} ctx
 * @param {URL} url
 */
export default async function handlePaymentsSummaryRoute(ctx, url) {
  let from = url.searchParams.get("from");
  if (from) from = new Date(from).getTime();

  let to = url.searchParams.get("to");
  if (to) to = new Date(to).getTime();

  publishPauseAndWait();

  const [def, fall] = await Promise.all([
    fetchSummary("default", from, to),
    fetchSummary("fallback", from, to)
  ]);
  
  ctx.write(
    JSON.stringify({
      default: {
        totalRequests: def.total,
        totalAmount: def.amount
      },
      fallback: {
        totalRequests: fall.total,
        totalAmount: fall.amount
      }
    })
  );

  const receivedAmount = await client.publish("summary:ctrl", "resume");
  console.log(`[PUBSUB] publicado retomada para ${receivedAmount}.`);
}