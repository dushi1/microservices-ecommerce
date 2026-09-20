import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError, createLogger } from "@ecommerce/common";

const log = createLogger("api-gateway");
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * The edge check. The gateway is the ONLY public entry point, so this is where
 * tokens are verified. Two hardening rules:
 * 1. Strip any inbound X-User-Id — a client must never be able to spoof the
 *    identity we forward to internal services.
 * 2. On success, set X-User-Id from the verified `sub`. Services will
 *    eventually trust this header instead of re-verifying (defense in depth
 *    keeps their requireAuth for now).
 */
export function edgeAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Missing bearer token");
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    delete req.headers["x-user-id"];
    req.userId = (payload as { sub: string }).sub;
    req.headers["x-user-id"] = req.userId;
    next();
  } catch (err) {
    const expired = err instanceof jwt.TokenExpiredError;
    log.warn({ path: req.path, expired }, "edge auth rejected");
    throw new AppError("UNAUTHORIZED", expired ? "Access token expired" : "Invalid access token");
  }
}
