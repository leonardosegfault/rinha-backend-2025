import fs from "node:fs";
import http from "node:http";
import handlePaymentsRoute from "./routes/payments.js";
import handlePaymentsSummaryRoute from "./routes/payments-summary.js";
import handlePaymentsPurgeRoute from "./routes/payments-purge.js";
import { newWorker } from "./services/workers.js";

const app = http.createServer((req, res) => {
  let data = "";

  req.on("data", (chunk) => {
    data += chunk;
  });
  req.on("end", async () => {
    if (req.url == "/payments") {
      handlePaymentsRoute(data);
      res.statusCode = 201;
    } else if (req.url.startsWith("/payments-summary")) {
      const url = new URL("http://" + req.headers.host + req.url);
      await handlePaymentsSummaryRoute(res, url);
    } else if (req.url == "/purge-payments") {
      await handlePaymentsPurgeRoute(res);
    }

    res.end();
  });
});

const WORKERS = process.env.WORKERS ?? 1;
for (let i = 0; i < WORKERS; i++) {
  newWorker();
}

const backlog = 2048;
const UNIX_SOCK = process.env.UNIX_SOCK;
if (UNIX_SOCK) {
  if (fs.existsSync(UNIX_SOCK)) {
    fs.unlinkSync(UNIX_SOCK);
  }

  app.listen(UNIX_SOCK, () => {
    console.log("[SERVIDOR] rodando no socket " + UNIX_SOCK)
  });
} else {
  const PORT = process.env.PORT ?? 9999;
  app.listen(PORT, backlog, () => console.log("[SERVIDOR] rodando na porta " + PORT));
}