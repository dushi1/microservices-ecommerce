/**
 * Route table — the single place mapping public paths to internal services.
 * Adding Order/Inventory/Notification later = one entry here, nothing else.
 */
export interface ServiceRoute {
  /** Mounted prefix, e.g. "/api/v1/auth". */
  prefix: string;
  /** Internal service base URL (Floci/ECS service names replace these in phase 3). */
  target: string;
  /** Public = reachable WITHOUT a valid token. Everything else needs one. */
  isPublic: (method: string, path: string) => boolean;
  /** Stricter rate limit for auth endpoints (brute-force defense). */
  strictLimit: boolean;
}

const isPost = (p: string) => (m: string, path: string) => m === "POST" && p.includes(path);

export const SERVICES: ServiceRoute[] = [
  {
    prefix: "/api/v1/auth",
    target: process.env.AUTH_URL ?? "http://localhost:3001",
    isPublic: (m, path) => isPost(["/login", "/register", "/refresh"].find((p) => path === p) ?? "\u0000")(m, path),
    strictLimit: true,
  },
  {
    prefix: "/api/v1/products",
    target: process.env.PRODUCT_URL ?? "http://localhost:3002",
    // Browsing is public; creating (POST) requires a token.
    isPublic: (m) => m === "GET",
    strictLimit: false,
  },
  {
    prefix: "/api/v1",
    target: process.env.ORDER_URL ?? "http://localhost:3003",
    isPublic: () => false,
    strictLimit: false,
  },
];
