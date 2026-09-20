import { z } from "zod";

/**
 * Kafka event envelope. Every message on every topic uses this shape.
 * `id` + `occurredAt` support idempotent consumption and out-of-order detection.
 */
export const eventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  topic: z.string(),
  version: z.literal(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string().uuid(),
  payload: z.unknown(),
});
export type EventEnvelope<T = unknown> = {
  id: string;
  type: string;
  topic: string;
  version: 1;
  occurredAt: string;
  correlationId: string;
  payload: T;
};

export const TOPICS = {
  userEvents: "user-events",
  productEvents: "product-events",
  orderEvents: "order-events",
  paymentEvents: "payment-events",
  inventoryEvents: "inventory-events",
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
