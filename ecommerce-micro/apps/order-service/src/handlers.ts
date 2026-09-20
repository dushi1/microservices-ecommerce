import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import {
  addToCartRequestSchema,
  updateCartItemRequestSchema,
  checkoutRequestSchema,
  cartSchema,
  orderSchema,
  orderListResponseSchema,
  type Cart,
  type Order,
  type OrderListResponse,
  type OrderStatus,
  createInventoryClient,
  createPaymentClient,
} from "@ecommerce/contracts";
import { AppError, createLogger } from "@ecommerce/common";
import { pool } from "./db.js";

const log = createLogger("order-service");

const INVENTORY_ADDRESS = process.env.INVENTORY_URL ?? "localhost:50052";
const PAYMENT_ADDRESS = process.env.PAYMENT_URL ?? "localhost:50051";
const PRODUCT_BASE = process.env.PRODUCT_URL ?? "http://localhost:3002";
const CURRENCY = "USD";

interface CartRow {
  product_id: string;
  quantity: number;
}
interface OrderRow {
  order_id: string;
  user_id: string;
  status: OrderStatus;
  total_cents: number;
  currency: string;
  payment_id: string | null;
  reservation_id: string | null;
  created_at: Date;
  confirmed_at: Date | null;
}

/** Best-effort Kafka publish; guarded until MSK (Floci) is running. */
async function publish(type: "order.created" | "order.confirmed" | "order.cancelled", correlationId: string, payload: unknown) {
  if (!process.env.KAFKA_BROKERS) return;
  try {
    const { EventPublisher } = await import("@ecommerce/events");
    const { Kafka } = await import("kafkajs");
    const kafka = new Kafka({ clientId: "order-service", brokers: [process.env.KAFKA_BROKERS] });
    const publisher = new EventPublisher(kafka);
    await publisher.publish(type, correlationId, payload);
  } catch (err) {
    log.warn({ err, type }, "failed to publish event");
  }
}

async function fetchProduct(productId: string, traceId: string) {
  const res = await fetch(`${PRODUCT_BASE}/api/v1/products/${productId}`, {
    headers: { "x-trace-id": traceId },
  });
  if (!res.ok) throw new AppError("NOT_FOUND", `Product ${productId} not found`);
  return (await res.json()) as {
    productId: string;
    name: string;
    priceCents: number;
    currency: string;
    imageUrl: string | null;
    available: number;
  };
}

async function ensureCart(userId: string) {
  await pool.query("INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", [userId]);
}

function rowToOrder(row: OrderRow, items: { product_id: string; name: string; quantity: number; unit_price_cents: number; image_url: string | null }[]): Order {
  return {
    orderId: row.order_id,
    items: items.map((i) => ({
      productId: i.product_id,
      name: i.name,
      quantity: i.quantity,
      unitPriceCents: i.unit_price_cents,
      imageUrl: i.image_url,
    })),
    totalCents: row.total_cents,
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    confirmedAt: row.confirmed_at?.toISOString() ?? null,
  };
}

async function loadOrder(orderId: string, userId: string): Promise<{ order: Order; raw: OrderRow }> {
  const res = await pool.query<OrderRow>(
    "SELECT * FROM orders WHERE order_id = $1 AND user_id = $2",
    [orderId, userId],
  );
  if (!res.rowCount) throw new AppError("NOT_FOUND", "Order not found");
  const items = await pool.query<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price_cents: number;
    image_url: string | null;
  }>("SELECT product_id, name, quantity, unit_price_cents, image_url FROM order_items WHERE order_id = $1", [
    orderId,
  ]);
  return { order: rowToOrder(res.rows[0], items.rows), raw: res.rows[0] };
}

// ── Cart ────────────────────────────────────────────────────────────────────

/** Core cart assembly: reads cart rows, enriches with live product data. */
async function buildCart(userId: string, traceId: string): Promise<Cart> {
  await ensureCart(userId);
  const cartId = (await pool.query<{ cart_id: string }>("SELECT cart_id FROM carts WHERE user_id = $1", [userId])).rows[0].cart_id;
  const items = await pool.query<CartRow>("SELECT product_id, quantity FROM cart_items WHERE cart_id = $1 ORDER BY product_id", [cartId]);
  const detailed = await Promise.all(
    items.rows.map(async (i) => ({ ...i, product: await fetchProduct(i.product_id, traceId) })),
  );
  return {
    items: detailed.map((d) => ({
      productId: d.product_id,
      name: d.product.name,
      quantity: d.quantity,
      unitPriceCents: d.product.priceCents,
      imageUrl: d.product.imageUrl,
    })),
    totalCents: detailed.reduce((sum, d) => sum + d.product.priceCents * d.quantity, 0),
    currency: CURRENCY,
  };
}

export async function getCart(req: Request, res: Response) {
  const traceId = (req.headers["x-trace-id"] as string) ?? randomUUID();
  res.json(cartSchema.parse(await buildCart(req.userId!, traceId)));
}

export async function addCartItem(req: Request, res: Response) {
  const userId = req.userId!;
  const traceId = (req.headers["x-trace-id"] as string) ?? randomUUID();
  const body = addToCartRequestSchema.parse(req.body);
  await ensureCart(userId);
  const cartId = (await pool.query<{ cart_id: string }>("SELECT cart_id FROM carts WHERE user_id = $1", [userId])).rows[0].cart_id;

  // Merge with existing line for the same product.
  await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = cart_items.quantity + $3`,
    [cartId, body.productId, body.quantity],
  );
  res.status(200).json(cartSchema.parse(await buildCart(userId, traceId)));
}

export async function updateCartItem(req: Request, res: Response) {
  const userId = req.userId!;
  const traceId = (req.headers["x-trace-id"] as string) ?? randomUUID();
  const body = updateCartItemRequestSchema.parse(req.body);
  const productId = req.params.productId;
  const cartId = (await pool.query<{ cart_id: string }>("SELECT cart_id FROM carts WHERE user_id = $1", [userId])).rows[0]?.cart_id;
  if (!cartId) throw new AppError("NOT_FOUND", "Cart not found");

  if (body.quantity === 0) {
    await pool.query("DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2", [cartId, productId]);
  } else {
    const updated = await pool.query(
      "UPDATE cart_items SET quantity = $3 WHERE cart_id = $1 AND product_id = $2",
      [cartId, productId, body.quantity],
    );
    if (!updated.rowCount) throw new AppError("NOT_FOUND", "Item not in cart");
  }
  res.json(cartSchema.parse(await buildCart(userId, traceId)));
}

export async function removeCartItem(req: Request, res: Response) {
  const userId = req.userId!;
  const traceId = (req.headers["x-trace-id"] as string) ?? randomUUID();
  const cartId = (await pool.query<{ cart_id: string }>("SELECT cart_id FROM carts WHERE user_id = $1", [userId])).rows[0]?.cart_id;
  if (cartId) {
    await pool.query("DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2", [cartId, req.params.productId]);
  }
  res.json(cartSchema.parse(await buildCart(userId, traceId)));
}

// ── Checkout saga (the orchestrator) ────────────────────────────────────────

/**
 * Checkout — synchronous saga, version 1.
 *
 *   1. Load cart (empty -> 409). Create order PENDING, emit order.created.
 *   2. gRPC ReserveStock (inventory).          reject -> CANCELLED (INVENTORY_REJECTED)
 *   3. gRPC AuthorizePayment (payment).        decline -> PAYMENT_FAILED
 *                                              + compensate: ReleaseReservation
 *   4. Success -> CONFIRMED, clear cart, emit order.confirmed.
 *
 * NOTE (architecture): production-grade sagas are event-driven (Kafka) so steps
 * survive crashes mid-saga. This sync version is the teaching skeleton: the
 * same steps, same compensation, one process. The Kafka phase (MSK on Floci)
 * upgrades it to choreography.
 */
export async function checkout(req: Request, res: Response) {
  const userId = req.userId!;
  const traceId = (req.headers["x-trace-id"] as string) ?? randomUUID();
  const body = checkoutRequestSchema.parse(req.body);

  const cartId = (await pool.query<{ cart_id: string }>("SELECT cart_id FROM carts WHERE user_id = $1", [userId])).rows[0]?.cart_id;
  const cartRows = cartId
    ? (await pool.query<CartRow>("SELECT product_id, quantity FROM cart_items WHERE cart_id = $1 ORDER BY product_id", [cartId])).rows
    : [];
  if (cartRows.length === 0) {
    throw new AppError("CONFLICT", "Cart is empty");
  }

  // Enrich cart with current product data (price could have changed since add-to-cart).
  const detailed = await Promise.all(
    cartRows.map(async (i) => ({ ...i, product: await fetchProduct(i.product_id, traceId) })),
  );
  const totalCents = detailed.reduce((sum, d) => sum + d.product.priceCents * d.quantity, 0);

  const orderRes = await pool.query<OrderRow>(
    "INSERT INTO orders (user_id, status, total_cents, currency) VALUES ($1, 'PENDING', $2, $3) RETURNING *",
    [userId, totalCents, CURRENCY],
  );
  const order = orderRes.rows[0];
  for (const d of detailed) {
    await pool.query(
      "INSERT INTO order_items (order_id, product_id, name, quantity, unit_price_cents, image_url) VALUES ($1,$2,$3,$4,$5,$6)",
      [order.order_id, d.product_id, d.product.name, d.quantity, d.product.priceCents, d.product.imageUrl],
    );
  }
  await publish("order.created", traceId, {
    orderId: order.order_id,
    userId,
    items: detailed.map((d) => ({ productId: d.product_id, name: d.product.name, quantity: d.quantity, unitPriceCents: d.product.priceCents })),
    totalCents,
    currency: CURRENCY,
    status: "PENDING",
    createdAt: order.created_at.toISOString(),
  });

  const inventory = createInventoryClient(INVENTORY_ADDRESS);
  const paymentClient = createPaymentClient(PAYMENT_ADDRESS);

  // ── Step 2: reserve stock ──
  const reservation = await inventory.reserveStock({
    orderId: order.order_id,
    items: detailed.map((d) => ({ productId: d.product_id, quantity: d.quantity })),
  });
  if (!reservation.ok) {
    const cancelled = await pool.query<OrderRow>(
      "UPDATE orders SET status = 'CANCELLED' WHERE order_id = $1 RETURNING *",
      [order.order_id],
    );
    const items = await pool.query("SELECT product_id, name, quantity, unit_price_cents, image_url FROM order_items WHERE order_id = $1", [order.order_id]);
    await publish("order.cancelled", traceId, {
      orderId: order.order_id,
      userId,
      reason: "INVENTORY_REJECTED",
      cancelledAt: new Date().toISOString(),
    });
    log.warn({ orderId: order.order_id, reason: reservation.reason }, "saga: inventory rejected");
    res.json(rowToOrder(cancelled.rows[0], items.rows)); // 200 with terminal CANCELLED state
    return;
  }
  await pool.query("UPDATE orders SET reservation_id = $2 WHERE order_id = $1", [order.order_id, reservation.reservationId]);

  // ── Step 3: authorize payment ──
  const payment = await paymentClient.authorizePayment({
    orderId: order.order_id,
    userId,
    amountCents: totalCents,
    currency: CURRENCY,
    paymentMethodId: body.paymentMethodId,
  });
  if (!payment.ok) {
    // ── COMPENSATION: give the reserved stock back ──
    await inventory.releaseReservation({ reservationId: reservation.reservationId, orderId: order.order_id });
    const failed = await pool.query<OrderRow>(
      "UPDATE orders SET status = 'PAYMENT_FAILED', payment_id = $2 WHERE order_id = $1 RETURNING *",
      [order.order_id, payment.paymentId],
    );
    const items = await pool.query("SELECT product_id, name, quantity, unit_price_cents, image_url FROM order_items WHERE order_id = $1", [order.order_id]);
    await publish("order.cancelled", traceId, {
      orderId: order.order_id,
      userId,
      reason: "PAYMENT_FAILED",
      cancelledAt: new Date().toISOString(),
    });
    log.warn({ orderId: order.order_id, reason: payment.failureReason }, "saga: payment failed, compensated");
    res.json(rowToOrder(failed.rows[0], items.rows));
    return;
  }

  // ── Step 4: confirm ──
  const confirmed = await pool.query<OrderRow>(
    "UPDATE orders SET status = 'CONFIRMED', payment_id = $2, confirmed_at = now() WHERE order_id = $1 RETURNING *",
    [order.order_id, payment.paymentId],
  );
  await pool.query("DELETE FROM cart_items WHERE cart_id = $1", [cartId]);
  const items = await pool.query("SELECT product_id, name, quantity, unit_price_cents, image_url FROM order_items WHERE order_id = $1", [order.order_id]);
  await publish("order.confirmed", traceId, {
    orderId: order.order_id,
    userId,
    paymentId: payment.paymentId,
    reservationId: reservation.reservationId,
    confirmedAt: (confirmed.rows[0].confirmed_at ?? new Date()).toISOString(),
  });
  log.info({ orderId: order.order_id, totalCents }, "saga: confirmed");
  res.json(rowToOrder(confirmed.rows[0], items.rows));
}

// ── Cancel (user-initiated compensation) ─────────────────────────────────────

/**
 * Cancel an order — the user-facing twin of the checkout saga's compensation.
 *
 * Compensation logic mirrors checkout but in reverse:
 *   PENDING      : nothing reserved or paid -> just mark CANCELLED
 *   CONFIRMED    : release the reservation AND refund the authorized payment
 *   PAYMENT_FAILED: reservation was already released by the saga -> mark CANCELLED
 *   CANCELLED    : idempotent-but-409 (already in terminal state)
 *
 * Returns the updated order (always CANCELLED on success). User-scoped.
 */
export async function cancelOrder(req: Request, res: Response) {
  const userId = req.userId!;
  const traceId = (req.headers["x-trace-id"] as string) ?? randomUUID();
  const { order, raw } = await loadOrder(req.params.orderId, userId);

  if (order.status === "CANCELLED") {
    throw new AppError("CONFLICT", "Order already cancelled");
  }

  const inventory = createInventoryClient(INVENTORY_ADDRESS);
  const payment = createPaymentClient(PAYMENT_ADDRESS);

  // Release reserved stock if a reservation exists (CONFIRMED orders have one;
  // PENDING orders have none; PAYMENT_FAILED orders had it released in-saga).
  if (raw.reservation_id) {
    await inventory.releaseReservation({ reservationId: raw.reservation_id, orderId: order.orderId });
  }

  // Refund the payment if it was authorized (CONFIRMED orders only).
  // We refund the order's total — the order service never reads payment_db directly.
  if (raw.payment_id && order.status === "CONFIRMED") {
    await payment.refundPayment({ paymentId: raw.payment_id, orderId: order.orderId, amountCents: order.totalCents });
  }

  const cancelled = await pool.query<OrderRow>(
    "UPDATE orders SET status = 'CANCELLED' WHERE order_id = $1 RETURNING *",
    [order.orderId],
  );
  const items = await pool.query(
    "SELECT product_id, name, quantity, unit_price_cents, image_url FROM order_items WHERE order_id = $1",
    [order.orderId],
  );
  await publish("order.cancelled", traceId, {
    orderId: order.orderId,
    userId,
    reason: "USER_CANCELLED",
    cancelledAt: new Date().toISOString(),
  });
  log.info({ orderId: order.orderId, wasStatus: order.status }, "order cancelled by user");
  res.json(rowToOrder(cancelled.rows[0], items.rows));
}

// ── Order reads ─────────────────────────────────────────────────────────────

export async function listOrders(req: Request, res: Response) {
  const userId = req.userId!;
  const orders = await pool.query<OrderRow>(
    "SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC",
    [userId],
  );
  const items: Order[] = [];
  for (const row of orders.rows) {
    const oi = await pool.query(
      "SELECT product_id, name, quantity, unit_price_cents, image_url FROM order_items WHERE order_id = $1",
      [row.order_id],
    );
    items.push(rowToOrder(row, oi.rows));
  }
  const payload: OrderListResponse = { items, total: items.length };
  res.json(orderListResponseSchema.parse(payload));
}

export async function getOrder(req: Request, res: Response) {
  const { order } = await loadOrder(req.params.orderId, req.userId!);
  res.json(orderSchema.parse(order));
}

/**
 * SSE stream of order status. With the sync saga the order is already terminal
 * when the client gets here, so the stream sends the current state once and
 * closes. The event-driven saga (Kafka phase) makes this endpoint come alive.
 */
export async function streamOrder(req: Request, res: Response) {
  const { order } = await loadOrder(req.params.orderId, req.userId!);
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(`data: ${JSON.stringify(order)}\n\n`);
  if (order.status !== "PENDING") {
    res.end();
  }
}
