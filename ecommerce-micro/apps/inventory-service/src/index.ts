import express from "express";
import { Server, ServerCredentials } from "@grpc/grpc-js";
import { createLogger } from "@ecommerce/common";
import { loadServiceDefinition } from "@ecommerce/contracts";
import { checkDb, pool } from "./db.js";
import { reserveStock, releaseReservation, getStock } from "./inventory-handlers.js";

const log = createLogger("inventory-service");

// ── gRPC server (the service's real interface) ─────────────────────────────
const grpcServer = new Server();
const def = loadServiceDefinition("inventory");
grpcServer.addService(def.service, {
  reserveStock,
  releaseReservation,
  getStock,
});
const grpcPort = process.env.GRPC_PORT ?? "50052";
grpcServer.bindAsync(`0.0.0.0:${grpcPort}`, ServerCredentials.createInsecure(), (err, port) => {
  if (err) throw err;
  log.info({ port }, "inventory gRPC listening");
});

// ── REST: health + debugging only. Real clients speak gRPC. ────────────────
const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  const db = await checkDb();
  res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db, grpc: grpcPort });
});

// Debug mirror of GetStock (uses the same SQL via gRPC handler logic).
app.get("/api/v1/stock/:productId", async (req, res) => {
  const r = await pool.query<{ available: number; reserved: number }>(
    "SELECT available, reserved FROM stock WHERE product_id = $1",
    [req.params.productId],
  );
  res.json({
    productId: req.params.productId,
    available: r.rows[0]?.available ?? 0,
    reserved: r.rows[0]?.reserved ?? 0,
  });
});

const port = Number(process.env.PORT ?? 3005);
app.listen(port, () => log.info(`inventory health/debug listening on :${port}`));
