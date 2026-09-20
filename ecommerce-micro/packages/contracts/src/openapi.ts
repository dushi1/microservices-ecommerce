/** Canonical API route paths, shared by gateway, services and the storefront client. */
export const ROUTES = {
  auth: {
    register: "/api/v1/auth/register",
    login: "/api/v1/auth/login",
    refresh: "/api/v1/auth/refresh",
    me: "/api/v1/auth/me",
  },
  products: {
    list: "/api/v1/products",
    detail: (productId: string) => `/api/v1/products/${productId}`,
  },
  cart: {
    get: "/api/v1/cart",
    add: "/api/v1/cart",
    item: (productId: string) => `/api/v1/cart/items/${productId}`,
  },
  orders: {
    list: "/api/v1/orders",
    checkout: "/api/v1/orders",
    detail: (orderId: string) => `/api/v1/orders/${orderId}`,
    cancel: (orderId: string) => `/api/v1/orders/${orderId}/cancel`,
    stream: (orderId: string) => `/api/v1/orders/${orderId}/stream`,
  },
} as const;
