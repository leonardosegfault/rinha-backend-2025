import { postMessage } from "../services/workers.js";

/**
 * @param {string} body
 */
export default async function handlePaymentsRoute(body) {
  let { correlationId, amount } = JSON.parse(body);
  correlationId = correlationId.replace(/\-/g, "");

  const buffer = new ArrayBuffer(16 * 2);
  const uint8 = new Uint8Array(buffer);
  uint8.set(Buffer.from(correlationId, "hex"), 0);

  new Float64Array(buffer, 16)[0] = amount;

  postMessage(buffer);
}