import { z } from "zod";

export const cartItemSchema = z.object({
  productId: z.string().uuid(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  imageUrl: z.string().url().nullable(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  items: z.array(cartItemSchema),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type Cart = z.infer<typeof cartSchema>;

export const addToCartRequestSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});
export type AddToCartRequest = z.infer<typeof addToCartRequestSchema>;

export const updateCartItemRequestSchema = z.object({
  quantity: z.number().int().nonnegative(),
});
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>;

export const checkoutRequestSchema = z.object({
  paymentMethodId: z.string().min(1),
});
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;

export const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "CANCELLED",
  "PAYMENT_FAILED",
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSchema = z.object({
  orderId: z.string().uuid(),
  items: z.array(cartItemSchema),
  totalCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  status: orderStatusSchema,
  createdAt: z.string().datetime(),
  confirmedAt: z.string().datetime().nullable(),
});
export type Order = z.infer<typeof orderSchema>;

export const orderListResponseSchema = z.object({
  items: z.array(orderSchema),
  total: z.number().int().nonnegative(),
});
export type OrderListResponse = z.infer<typeof orderListResponseSchema>;
