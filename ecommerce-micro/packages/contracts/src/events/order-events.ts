import { z } from "zod";
import { TOPICS } from "./envelope.js";

export const orderItemSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
});
export type OrderItem = z.infer<typeof orderItemSchema>;

export const orderCreatedSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  items: z.array(orderItemSchema).min(1),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: z.literal("PENDING"),
  createdAt: z.string().datetime(),
});
export type OrderCreated = z.infer<typeof orderCreatedSchema>;

export const orderConfirmedSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  paymentId: z.string(),
  reservationId: z.string(),
  confirmedAt: z.string().datetime(),
});
export type OrderConfirmed = z.infer<typeof orderConfirmedSchema>;

export const orderCancelledSchema = z.object({
  orderId: z.string().uuid(),
  userId: z.string().uuid(),
  reason: z.enum(["PAYMENT_FAILED", "INVENTORY_REJECTED", "USER_CANCELLED", "TIMEOUT"]),
  cancelledAt: z.string().datetime(),
});
export type OrderCancelled = z.infer<typeof orderCancelledSchema>;

export const orderEventType = z.enum([
  "order.created",
  "order.confirmed",
  "order.cancelled",
]);

export const orderEventPayload = {
  "order.created": orderCreatedSchema,
  "order.confirmed": orderConfirmedSchema,
  "order.cancelled": orderCancelledSchema,
} as const;

export const orderTopic = TOPICS.orderEvents;
