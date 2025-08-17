import Redis from "ioredis";

export const client = newInstance();
/** @type {Redis} */

let queueClient = null;
/** @type {Redis} */
let pubsubClient = null;

const addSHA = await client.script("LOAD",
  `
    local id = redis.call("INCR", KEYS[1])
    return redis.call("ZADD", KEYS[2], ARGV[1], ARGV[2] .. " " .. id)
  `
);

/**
 * @returns {Redis}
 */
function newInstance() {
  return new Redis(process.env.REDIS || "redis://localhost:6379");
}

/**
 * @returns {Redis}
 */
export function getPubSubClient() {
  if (!pubsubClient) {
    return pubsubClient = newInstance();
  }

  return pubsubClient;
}

/**
 * @returns {Redis}
 */
export function getQueueClient() {
  if (!queueClient) {
    queueClient = newInstance();

    return queueClient;
  }

  return queueClient;
}

/**
 * @param {string} correlationId 
 * @param {number} amount 
 */
export async function pushQueue(correlationId, amount) {
  await client.rpush("queue", `${correlationId} ${amount}`);
}

export async function popQueue() {
  const queueClient = getQueueClient();
  const [_, item] = await queueClient.blpop("queue", 0);
  const values = item.split(" ");

  return {
    correlationId: values[0],
    amount: Number(values[1])
  }
}

/**
 * @param {"default" | "fallback"} processor 
 * @param {number} amount 
 * @param {number} timestamp 
 */
export async function addSummary(processor, amount, timestamp) {
  await client.evalsha(
    addSHA,
    2, "uniqueid", processor,
    timestamp, amount
  );
}

/**
 * @param {"default" | "fallback"} processor 
 * @param {number?} from  
 * @param {number?} to 
 */
export async function fetchSummary(processor, from, to) {
  if (!from) from = -Infinity;
  if (!to)   to   = +Infinity;

  const values = await client.zrangebyscore(processor, from, to);

  return {
    total: values.length,
    amount: values.reduce((p, c) => p + Number(c.split(" ")[0]), 0)
  };
}

export async function clearSummary() {
  await client.set("uniqueid", 0);
  await client.del("queue");
  await client.del("default");
  await client.del("fallback");
}