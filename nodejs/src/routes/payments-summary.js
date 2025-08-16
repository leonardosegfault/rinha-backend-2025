import { ServerResponse } from "node:http";
import { client, fetchSummary } from "../services/redis.js";

/**
 * @param {ServerResponse} ctx
 * @param {URL} url
 */
export default async function handlePaymentsSummaryRoute(ctx, url) {
  let from = url.searchParams.get("from");
  if (from) from = new Date(from).getTime();

  let to = url.searchParams.get("to");
  if (to) to = new Date(to).getTime();

  let receivedAmount = await client.publish("summary:ctrl", "pause");
  console.log(`[PUBSUB] publicado pausa para ${receivedAmount}.`);

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

  receivedAmount = await client.publish("summary:ctrl", "resume");
  console.log(`[PUBSUB] publicado retomada para ${receivedAmount}.`);
}