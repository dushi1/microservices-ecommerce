import express from "express";
import { ROUTES } from "@ecommerce/contracts";
import { createLogger } from "@ecommerce/common";
import { checkDb } from "./db.js";
import { redis } from "./cache.js";
import { asyncHandler, errorHandler, requireAuth } from "./middleware.js";
import { listProducts, getProduct, createProduct } from "./handlers.js";

const log = createLogger("product-service");
const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  const db = await checkDb();
  const redisOk = (await redis.ping().catch(() => null)) === "PONG";
  res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db, redis: redisOk });
});

app.get(ROUTES.products.list, asyncHandler(listProducts));
app.get(ROUTES.products.detail(":productId"), asyncHandler(getProduct));
app.post(ROUTES.products.list, requireAuth, asyncHandler(createProduct));

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3002);
app.listen(port, () => log.info(`product-service listening on :${port}`));
