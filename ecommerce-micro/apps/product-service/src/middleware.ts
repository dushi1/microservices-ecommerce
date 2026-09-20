import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AppError, createLogger } from "@ecommerce/common";
import type { ApiError } from "@ecommerce/contracts";
import { ZodError } from "zod";

const log = createLogger("product-service");

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    const body: ApiError = {
      error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: err.issues },
    };
    res.status(422).json(body);
    return;
  }
  if (err instanceof AppError) {
    const status =
      { VALIDATION_ERROR: 422, UNAUTHORIZED: 401, NOT_FOUND: 404, CONFLICT: 409, INTERNAL: 500 }[err.code];
    res.status(status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  log.error({ err }, "unhandled error");
  res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" } });
}

/**
 * Requires a valid access token (same JWT_SECRET as the auth service — shared
 * secret verification is the dev pattern; the gateway will own this check
 * exclusively once it exists, and services will trust the gateway).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(new AppError("UNAUTHORIZED", "Missing bearer token"));
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET ?? "dev-only-change-me");
    (req as Request & { userId?: string }).userId = (payload as { sub: string }).sub;
    next();
  } catch {
    next(new AppError("UNAUTHORIZED", "Invalid or expired access token"));
  }
}
