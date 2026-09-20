import { randomUUID } from "node:crypto";
import { createLogger } from "@ecommerce/common";
import type {
  AuthorizePaymentRequest,
  AuthorizePaymentResponse,
  RefundPaymentRequest,
  RefundPaymentResponse,
} from "@ecommerce/contracts";
import { pool } from "./db.js";

const log = createLogger("payment-service");

/**
 * Mock PSP (payment service provider). Mimics Stripe semantics:
 * - "pm_card_declined" always declines  -> lets us demo the saga's compensation path
 * - anything else authorizes
 * A real PSP would be an HTTPS call out; the DB write + event shape stay identical.
 */
function chargePsp(amountCents: number, paymentMethodId: string): {
  status: "AUTHORIZED" | "DECLINED";
  failureReason: "" | "CARD_DECLINED" | "INVALID_METHOD";
  pspReference: string;
} {
  if (paymentMethodId === "pm_card_declined") {
    return { status: "DECLINED", failureReason: "CARD_DECLINED", pspReference: `psp_declined_${randomUUID().slice(0, 8)}` };
  }
  if (!paymentMethodId.startsWith("pm_")) {
    return { status: "DECLINED", failureReason: "INVALID_METHOD", pspReference: `psp_invalid_${randomUUID().slice(0, 8)}` };
  }
  return { status: "AUTHORIZED", failureReason: "", pspReference: `psp_${randomUUID().slice(0, 12)}` };
}

/** AuthorizePayment — deterministic for a given order (idempotent-ish): one payment row per order. */
export async function authorizePayment(
  call: { request: AuthorizePaymentRequest },
  callback: (err: null, res: AuthorizePaymentResponse) => void,
): Promise<void> {
  const req = call.request;
  try {
    // Double-charge guard: if this order already has a payment, replay its result.
    const existing = await pool.query<{ payment_id: string; status: string; failure_reason: string }>(
      "SELECT payment_id, status, failure_reason FROM payments WHERE order_id = $1",
      [req.orderId],
    );
    if (existing.rowCount) {
      const row = existing.rows[0];
      log.warn({ orderId: req.orderId }, "duplicate authorize attempt — replaying stored result");
      callback(null, {
        ok: row.status === "AUTHORIZED",
        paymentId: row.payment_id,
        status: row.status as AuthorizePaymentResponse["status"],
        failureReason: row.failure_reason as AuthorizePaymentResponse["failureReason"],
      });
      return;
    }

    const psp = chargePsp(req.amountCents, req.paymentMethodId);
    const paymentId = `pay_${randomUUID().slice(0, 12)}`;
    await pool.query(
      "INSERT INTO payments (payment_id, order_id, user_id, amount_cents, currency, status, failure_reason, psp_reference) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [paymentId, req.orderId, req.userId, req.amountCents, req.currency, psp.status, psp.failureReason, psp.pspReference],
    );
    log.info({ orderId: req.orderId, status: psp.status, amountCents: req.amountCents }, "payment processed");
    callback(null, { ok: psp.status === "AUTHORIZED", paymentId, status: psp.status, failureReason: psp.failureReason });
  } catch (err) {
    log.error({ err, orderId: req.orderId }, "authorizePayment failed");
    callback(null, { ok: false, paymentId: "", status: "ERROR", failureReason: "PSP_ERROR" });
  }
}

export async function refundPayment(
  call: { request: RefundPaymentRequest },
  callback: (err: null, res: RefundPaymentResponse) => void,
): Promise<void> {
  const req = call.request;
  try {
    const found = await pool.query<{ status: string }>(
      "SELECT status FROM payments WHERE payment_id = $1 AND order_id = $2",
      [req.paymentId, req.orderId],
    );
    if (!found.rowCount || found.rows[0].status !== "AUTHORIZED") {
      callback(null, { ok: false, refundId: "", status: "ERROR" });
      return;
    }
    const refundId = `ref_${randomUUID().slice(0, 12)}`;
    await pool.query(
      "INSERT INTO refunds (refund_id, payment_id, order_id, amount_cents) VALUES ($1,$2,$3,$4)",
      [refundId, req.paymentId, req.orderId, req.amountCents],
    );
    await pool.query("UPDATE payments SET status = 'REFUNDED' WHERE payment_id = $1", [req.paymentId]);
    log.info({ refundId, orderId: req.orderId }, "payment refunded");
    callback(null, { ok: true, refundId, status: "REFUNDED" });
  } catch (err) {
    log.error({ err, orderId: req.orderId }, "refundPayment failed");
    callback(null, { ok: false, refundId: "", status: "ERROR" });
  }
}
