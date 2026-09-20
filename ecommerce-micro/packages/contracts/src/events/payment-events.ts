import { z } from "zod";
import { TOPICS } from "./envelope.js";

export const paymentSucceededSchema = z.object({
  paymentId: z.string(),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  amountCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  succeededAt: z.string().datetime(),
});
export type PaymentSucceeded = z.infer<typeof paymentSucceededSchema>;

export const paymentFailedSchema = z.object({
  paymentId: z.string().nullable(),
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  failureReason: z.enum(["CARD_DECLINED", "INVALID_METHOD", "PSP_ERROR"]),
  failedAt: z.string().datetime(),
});
export type PaymentFailed = z.infer<typeof paymentFailedSchema>;

export const paymentRefundedSchema = z.object({
  refundId: z.string(),
  paymentId: z.string(),
  orderId: z.string().uuid(),
  amountCents: z.number().int().nonnegative(),
  refundedAt: z.string().datetime(),
});
export type PaymentRefunded = z.infer<typeof paymentRefundedSchema>;

export const paymentEventType = z.enum([
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
]);

export const paymentEventPayload = {
  "payment.succeeded": paymentSucceededSchema,
  "payment.failed": paymentFailedSchema,
  "payment.refunded": paymentRefundedSchema,
} as const;

export const paymentTopic = TOPICS.paymentEvents;
