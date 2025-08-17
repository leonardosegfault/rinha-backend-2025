import path from "node:path";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";

const WORKER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "worker.js"
);

/** @type {Worker[]} */
const pool = [];
let lastIndex = 0;

export function newWorker() {
  const worker = new Worker(WORKER_PATH);
  worker.on("online", () =>
    console.log(`[WORKER ${worker.threadId}] inicializado.`)
  );
  worker.on("error", (e) =>
    console.error(`[WORKER ${worker.threadId}] teve um erro:\n.`, e)
  );

  pool.push(worker);
}

/**
 * @param {ArrayBuffer} data 
 */
export function postMessage(data) {
  lastIndex = (lastIndex + 1) % pool.length;
  pool[lastIndex].postMessage(data, [data]);
}