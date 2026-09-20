import { z } from "zod";
import { TOPICS } from "./envelope.js";

export const inventoryReservedSchema = z.object({
  reservationId: z.string(),
  orderId: z.string().uuid(),
  reservedAt: z.string().datetime(),
});
export type InventoryReserved = z.infer<typeof inventoryReservedSchema>;

export const inventoryRejectedSchema = z.object({
  orderId: z.string().uuid(),
  productId: z.string().uuid().nullable(),
  reason: z.enum(["INSUFFICIENT_STOCK", "PRODUCT_NOT_FOUND", "RESERVATION_EXISTS"]),
  rejectedAt: z.string().datetime(),
});
export type InventoryRejected = z.infer<typeof inventoryRejectedSchema>;

export const inventoryReleasedSchema = z.object({
  reservationId: z.string().nullable(),
  orderId: z.string().uuid(),
  releasedAt: z.string().datetime(),
});
export type InventoryReleased = z.infer<typeof inventoryReleasedSchema>;

export const inventoryEventType = z.enum([
  "inventory.reserved",
  "inventory.rejected",
  "inventory.released",
]);

export const inventoryEventPayload = {
  "inventory.reserved": inventoryReservedSchema,
  "inventory.rejected": inventoryRejectedSchema,
  "inventory.released": inventoryReleasedSchema,
} as const;

export const inventoryTopic = TOPICS.inventoryEvents;
