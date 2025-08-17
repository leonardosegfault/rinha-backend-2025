import { ServerResponse } from "node:http";
import { clearSummary } from "../services/redis.js";

/**
 * @param {ServerResponse} ctx
 */
export default async function handlePaymentsPurgeRoute(ctx, next) {
  await clearSummary();

  ctx.statusCode = 200;
}