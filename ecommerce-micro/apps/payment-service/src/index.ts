import express from "express";
import { Server, ServerCredentials } from "@grpc/grpc-js";
import { createLogger } from "@ecommerce/common";
import { loadServiceDefinition } from "@ecommerce/contracts";
import { checkDb, pool } from "./db.js";
import { authorizePayment, refundPayment } from "./payment-handlers.js";

const log = createLogger("payment-service");

const grpcServer = new Server();
const def = loadServiceDefinition("payment");
grpcServer.addService(def.service, { authorizePayment, refundPayment });
const grpcPort = process.env.GRPC_PORT ?? "50051";
grpcServer.bindAsync(`0.0.0.0:${grpcPort}`, ServerCredentials.createInsecure(), (err, port) => {
  if (err) throw err;
  log.info({ port }, "payment gRPC listening");
});

const app = express();

app.get("/health", async (_req, res) => {
  const db = await checkDb();
  res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db, grpc: grpcPort });
});

// Debug: list payments (no auth — dev only, replaced by admin auth later).
app.get("/api/v1/payments", async (_req, res) => {
  const r = await pool.query("SELECT payment_id, order_id, amount_cents, status, failure_reason FROM payments ORDER BY created_at DESC LIMIT 20");
  res.json({ items: r.rows });
});

const port = Number(process.env.PORT ?? 3006);
app.listen(port, () => log.info(`payment health/debug listening on :${port}`));
