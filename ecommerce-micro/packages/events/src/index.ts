import { randomUUID } from "node:crypto";
import type { Kafka, Producer } from "kafkajs";
import {
  eventPayloadSchemas,
  TOPICS,
  type EventEnvelope,
  type EventType,
  type TopicName,
} from "@ecommerce/contracts";

/** Builds a contract-valid envelope. Throws if the payload does not match its event schema. */
export function buildEvent<T extends EventType>(
  type: T,
  correlationId: string,
  payload: unknown,
): EventEnvelope {
  const schema = eventPayloadSchemas[type];
  const parsed = schema.parse(payload);
  const topic = topicFor(type);
  return {
    id: randomUUID(),
    type,
    topic,
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId,
    payload: parsed,
  };
}

function topicFor(type: EventType): TopicName {
  const prefix = type.split(".")[0];
  switch (prefix) {
    case "user":
      return TOPICS.userEvents;
    case "product":
      return TOPICS.productEvents;
    case "order":
      return TOPICS.orderEvents;
    case "payment":
      return TOPICS.paymentEvents;
    case "inventory":
      return TOPICS.inventoryEvents;
  }
  throw new Error(`Unknown event type: ${type}`);
}

export class EventPublisher {
  private producer: Producer | null = null;

  constructor(private readonly kafka: Kafka) {}

  async publish(type: EventType, correlationId: string, payload: unknown): Promise<void> {
    if (!this.producer) {
      this.producer = this.kafka.producer();
      await this.producer.connect();
    }
    const envelope = buildEvent(type, correlationId, payload);
    await this.producer.send({
      topic: envelope.topic,
      messages: [
        {
          key: (envelope.payload as { orderId?: string; userId?: string; productId?: string }).orderId
            ?? (envelope.payload as { userId?: string }).userId
            ?? (envelope.payload as { productId?: string }).productId
            ?? envelope.id,
          value: JSON.stringify(envelope),
          headers: {
            "event-type": envelope.type,
            "correlation-id": envelope.correlationId,
            traceId: envelope.correlationId,
          },
        },
      ],
    });
  }
}
