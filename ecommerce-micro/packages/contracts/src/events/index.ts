import { z } from "zod";
import { eventEnvelopeSchema, TOPICS, type EventEnvelope, type TopicName } from "./envelope.js";
import {
  productEventPayload,
  productEventType,
  productTopic,
} from "./product-events.js";
import {
  orderEventPayload,
  orderEventType,
  orderTopic,
} from "./order-events.js";
import {
  paymentEventPayload,
  paymentEventType,
  paymentTopic,
} from "./payment-events.js";
import {
  inventoryEventPayload,
  inventoryEventType,
  inventoryTopic,
} from "./inventory-events.js";
import {
  userEventPayload,
  userEventType,
  userTopic,
} from "./user-events.js";

export const eventType = z.union([
  userEventType,
  productEventType,
  orderEventType,
  paymentEventType,
  inventoryEventType,
]);
export type EventType = z.infer<typeof eventType>;

/** Map of event type -> payload schema, for generic consumer-side validation. */
export const eventPayloadSchemas = {
  ...userEventPayload,
  ...productEventPayload,
  ...orderEventPayload,
  ...paymentEventPayload,
  ...inventoryEventPayload,
} as const;

export { eventEnvelopeSchema, TOPICS };
export type { EventEnvelope, TopicName };
export { productTopic, orderTopic, paymentTopic, inventoryTopic, userTopic };
