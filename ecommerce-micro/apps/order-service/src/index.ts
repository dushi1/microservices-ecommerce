import express from "express";
import { ROUTES } from "@ecommerce/contracts";
import { createLogger } from "@ecommerce/common";
import { checkDb } from "./db.js";
import { asyncHandler, errorHandler, requireAuth } from "./middleware.js";
import {
  getCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  checkout,
  cancelOrder,
  listOrders,
  getOrder,
  streamOrder,
} from "./handlers.js";

const log = createLogger("order-service");
const app = express();
app.use(express.json());

app.get("/health", async (_req, res) => {
  const db = await checkDb();
  res.status(db ? 200 : 503).json({ status: db ? "ok" : "degraded", db });
});

// Cart (all user-scoped)
app.get(ROUTES.cart.get, requireAuth, asyncHandler(getCart));
app.post(ROUTES.cart.add, requireAuth, asyncHandler(addCartItem));
app.patch(ROUTES.cart.item(":productId"), requireAuth, asyncHandler(updateCartItem));
app.delete(ROUTES.cart.item(":productId"), requireAuth, asyncHandler(removeCartItem));

// Orders + checkout saga
app.get(ROUTES.orders.list, requireAuth, asyncHandler(listOrders));
app.post(ROUTES.orders.checkout, requireAuth, asyncHandler(checkout));
app.post(ROUTES.orders.cancel(":orderId"), requireAuth, asyncHandler(cancelOrder));
app.get(ROUTES.orders.detail(":orderId"), requireAuth, asyncHandler(getOrder));
app.get(ROUTES.orders.stream(":orderId"), requireAuth, asyncHandler(streamOrder));

app.use(errorHandler);

const port = Number(process.env.PORT ?? 3003);
app.listen(port, () => log.info(`order-service listening on :${port}`));
