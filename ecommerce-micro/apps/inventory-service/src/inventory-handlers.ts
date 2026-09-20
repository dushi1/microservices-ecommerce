import { createLogger } from "@ecommerce/common";
import type {
  ReserveStockRequest,
  ReserveStockResponse,
  ReleaseReservationRequest,
  ReleaseReservationResponse,
  GetStockRequest,
  GetStockResponse,
} from "@ecommerce/contracts";
import { pool } from "./db.js";

const log = createLogger("inventory-service");

/**
 * ReserveStock — the concurrency-critical write (see ARCHITECTURE.md §5).
 *
 * The atomic guard: `UPDATE stock SET available = available - q, reserved = reserved + q
 * WHERE product_id = $1 AND available >= q` — rowcount 0 means lost the race
 * (or no stock). No SELECT-then-UPDATE, so two concurrent checkouts of the
 * last item cannot both succeed. All items reserve in ONE transaction:
 * partial reservations would strand stock on a later item's failure.
 */
export async function reserveStock(
  call: { request: ReserveStockRequest },
  callback: (err: null, res: ReserveStockResponse) => void,
): Promise<void> {
  const { orderId, items } = call.request;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const duplicate = await client.query("SELECT 1 FROM reservations WHERE order_id = $1", [orderId]);
    if (duplicate.rowCount) {
      await client.query("ROLLBACK");
      callback(null, { ok: false, reservationId: "", rejectedProductId: "", reason: "RESERVATION_EXISTS" });
      return;
    }

    for (const item of items) {
      const updated = await client.query(
        `UPDATE stock SET available = available - $1, reserved = reserved + $1, updated_at = now()
         WHERE product_id = $2 AND available >= $1`,
        [item.quantity, item.productId],
      );
      if (!updated.rowCount) {
        // Product may not exist at all vs exists with too little stock.
        const exists = await client.query("SELECT 1 FROM stock WHERE product_id = $1", [item.productId]);
        await client.query("ROLLBACK");
        callback(null, {
          ok: false,
          reservationId: "",
          rejectedProductId: item.productId,
          reason: exists.rowCount ? "INSUFFICIENT_STOCK" : "PRODUCT_NOT_FOUND",
        });
        return;
      }
    }

    const reservation = await client.query<{ reservation_id: string }>(
      "INSERT INTO reservations (order_id) VALUES ($1) RETURNING reservation_id",
      [orderId],
    );
    for (const item of items) {
      await client.query(
        "INSERT INTO reservation_items (reservation_id, product_id, quantity) VALUES ($1, $2, $3)",
        [reservation.rows[0].reservation_id, item.productId, item.quantity],
      );
    }
    await client.query("COMMIT");
    log.info({ orderId, reservationId: reservation.rows[0].reservation_id }, "stock reserved");
    callback(null, { ok: true, reservationId: reservation.rows[0].reservation_id, rejectedProductId: "", reason: "" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log.error({ err, orderId }, "reserveStock failed");
    callback(null, { ok: false, reservationId: "", rejectedProductId: "", reason: "PRODUCT_NOT_FOUND" });
  } finally {
    client.release();
  }
}

/** ReleaseReservation — the saga's compensating action. */
export async function releaseReservation(
  call: { request: ReleaseReservationRequest },
  callback: (err: null, res: ReleaseReservationResponse) => void,
): Promise<void> {
  const { reservationId } = call.request;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<{ user_id?: string; order_id: string }>(
      "SELECT order_id FROM reservations WHERE reservation_id = $1 AND status = 'ACTIVE'",
      [reservationId],
    );
    if (!found.rowCount) {
      await client.query("ROLLBACK");
      const exists = await client.query("SELECT 1 FROM reservations WHERE reservation_id = $1", [reservationId]);
      callback(null, { ok: false, reason: exists.rowCount ? "ALREADY_RELEASED" : "NOT_FOUND" });
      return;
    }
    const items = await client.query<{ product_id: string; quantity: number }>(
      "SELECT product_id, quantity FROM reservation_items WHERE reservation_id = $1",
      [reservationId],
    );
    for (const item of items.rows) {
      await client.query(
        `UPDATE stock SET available = available + $1, reserved = reserved - $1, updated_at = now()
         WHERE product_id = $2`,
        [item.quantity, item.product_id],
      );
    }
    await client.query("UPDATE reservations SET status = 'RELEASED' WHERE reservation_id = $1", [reservationId]);
    await client.query("COMMIT");
    log.info({ reservationId }, "reservation released");
    callback(null, { ok: true, reason: "RELEASED" });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    log.error({ err, reservationId }, "releaseReservation failed");
    callback(null, { ok: false, reason: "NOT_FOUND" });
  } finally {
    client.release();
  }
}

export async function getStock(
  call: { request: GetStockRequest },
  callback: (err: null, res: GetStockResponse) => void,
): Promise<void> {
  const res = await pool.query<{ available: number; reserved: number }>(
    "SELECT available, reserved FROM stock WHERE product_id = $1",
    [call.request.productId],
  );
  callback(null, {
    productId: call.request.productId,
    available: res.rows[0]?.available ?? 0,
    reserved: res.rows[0]?.reserved ?? 0,
  });
}
