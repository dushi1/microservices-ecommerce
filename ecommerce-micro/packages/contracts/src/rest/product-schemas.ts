import { z } from "zod";

export const productListQuerySchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
  minPriceCents: z.coerce.number().int().nonnegative().optional(),
  maxPriceCents: z.coerce.number().int().nonnegative().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(["price_asc", "price_desc", "newest"]).default("newest"),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

export const productSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  category: z.string(),
  imageUrl: z.string().url().nullable(),
  available: z.number().int().nonnegative(),
});
export type Product = z.infer<typeof productSchema>;

export const productListResponseSchema = z.object({
  items: z.array(productSchema),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().nonnegative(),
});
export type ProductListResponse = z.infer<typeof productListResponseSchema>;

export const createProductRequestSchema = productSchema
  .omit({ productId: true, available: true, imageUrl: true })
  .extend({ stock: z.number().int().nonnegative() });
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
