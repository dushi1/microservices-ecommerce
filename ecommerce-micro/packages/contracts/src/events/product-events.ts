import { z } from "zod";
import { TOPICS } from "./envelope.js";

export const productCreatedSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  category: z.string(),
  imageUrl: z.string().url().nullable(),
  stock: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type ProductCreated = z.infer<typeof productCreatedSchema>;

export const productUpdatedSchema = productCreatedSchema.omit({ createdAt: true }).extend({
  updatedAt: z.string().datetime(),
});
export type ProductUpdated = z.infer<typeof productUpdatedSchema>;

export const productDeletedSchema = z.object({
  productId: z.string().uuid(),
  deletedAt: z.string().datetime(),
});
export type ProductDeleted = z.infer<typeof productDeletedSchema>;

export const productStockUpdatedSchema = z.object({
  productId: z.string().uuid(),
  available: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
});
export type ProductStockUpdated = z.infer<typeof productStockUpdatedSchema>;

export const productEventType = z.enum([
  "product.created",
  "product.updated",
  "product.deleted",
  "product.stock-updated",
]);

export const productEventPayload = {
  "product.created": productCreatedSchema,
  "product.updated": productUpdatedSchema,
  "product.deleted": productDeletedSchema,
  "product.stock-updated": productStockUpdatedSchema,
} as const;

export const productTopic = TOPICS.productEvents;
