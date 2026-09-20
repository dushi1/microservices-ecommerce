import express from "express";
import { ServerResponse } from "node:http";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { Request, Response } from "express";
import { ROUTES } from "@ecommerce/contracts";
import { createLogger } from "@ecommerce/common";
import { SERVICES } from "./routes.js";
import { edgeAuth } from "./auth.js";
import { traceMiddleware } from "./trace.js";

const log = createLogger("api-gateway");
const app = express();

/**
 * IMPORTANT: no express.json() here. The gateway forwards bodies untouched —
 * parsing-and-re-serializing every request it will never read is wasted work,
 * and body passthrough avoids subtle proxy breakage (content-length mismatches).
 */

// Observability first, so every request (including errors) gets a trace id.
app.use(traceMiddleware);

// ── Rate limiting ─────────────────────────────────────────────────────────
// Two tiers: strict on /auth (credential stuffing + brute force), generous
// everywhere else (accidents and chatty frontends, not attackers).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT ?? 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts, try later" } },
});
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.GENERAL_RATE_LIMIT ?? 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
});

// ── Health ─────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok", service: "api-gateway" }));

// ── Public landing (helps humans poking at :3000) ──────────────────────────
app.get(ROUTES.products.list.replace("/products", ""), (_req, res) =>
  res.json({ service: "ecommerce-api", version: 1 }),
);

// ── One protected proxy per service from the route table ───────────────────
for (const service of SERVICES) {
  const proxy = createProxyMiddleware({
    target: service.target,
    changeOrigin: false,
    // Express strips the app.use() mount prefix from req.url, so the proxy
    // would forward "/" instead of the full path. Restore it: the services
    // route on the same public paths the gateway exposes.
    pathRewrite: (path: string) => service.prefix + path,
    timeout: 10_000, // socket connect timeout
    proxyTimeout: 10_000, // upstream response timeout
    on: {
      error: (err, _req, res) => {
        // A dead upstream must be a clean 502 in our error contract,
        // never a hung socket or an HTML stack trace.
        log.error({ err: err.message, target: service.target }, "upstream failure");
        if (res instanceof ServerResponse && !res.headersSent) {
          (res as unknown as Response).status(502).json({
            error: { code: "SERVICE_UNAVAILABLE", message: "Upstream service unavailable" },
          });
        } else if (!(res instanceof ServerResponse)) {
          res.destroy();
        }
      },
    },
  });

  app.use(service.prefix, service.strictLimit ? authLimiter : generalLimiter, (req, res, next) => {
    if (!service.isPublic(req.method, req.path)) {
      edgeAuth(req, res, next);
      return;
    }
    next();
  }, proxy);

  log.info({ prefix: service.prefix, target: service.target }, "route mounted");
}

// ── Unknown API paths ──────────────────────────────────────────────────────
app.use("/api", (_req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Unknown API route" } });
});

// ── Edge errors (AppError from edgeAuth, rate limiter JSON) ────────────────
app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: unknown) => {
  const status = err.status ?? (err.message.includes("token") ? 401 : 500);
  res.status(status).json({
    error: {
      code: status === 401 ? "UNAUTHORIZED" : "INTERNAL",
      message: err.message || "Internal error",
    },
  });
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => log.info(`api-gateway listening on :${port}`));
