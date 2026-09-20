import { ROUTES, type Cart, type Order, type OrderListResponse } from "@ecommerce/contracts/rest";
import { api } from "./client";

export function fetchCart() {
  return api<Cart>(ROUTES.cart.get);
}

export function addToCart(input: { productId: string; quantity: number }) {
  return api<Cart>(ROUTES.cart.add, { method: "POST", body: JSON.stringify(input) });
}

export function updateCartItem(productId: string, quantity: number) {
  return api<Cart>(ROUTES.cart.item(productId), {
    method: "PATCH",
    body: JSON.stringify({ quantity }),
  });
}

export function removeCartItem(productId: string) {
  return api<Cart>(ROUTES.cart.item(productId), { method: "DELETE" });
}

export function checkout(paymentMethodId: string) {
  return api<Order>(ROUTES.orders.checkout, {
    method: "POST",
    body: JSON.stringify({ paymentMethodId }),
  });
}

export function listOrders() {
  return api<OrderListResponse>(ROUTES.orders.list);
}

export function getOrder(orderId: string) {
  return api<Order>(ROUTES.orders.detail(orderId));
}

export function cancelOrder(orderId: string) {
  return api<Order>(ROUTES.orders.cancel(orderId), { method: "POST" });
}

/** Subscribes to the SSE stream of an order's status changes. Returns an unsubscribe fn. */
export function streamOrder(
  orderId: string,
  onOrder: (order: Order) => void,
  onDone?: () => void,
): () => void {
  const es = new EventSource(ROUTES.orders.stream(orderId));
  es.onmessage = (e) => {
    if (e.data) onOrder(JSON.parse(e.data) as Order);
  };
  es.onerror = () => {
    es.close();
    onDone?.();
  };
  return () => es.close();
}
