import type { NextFunction, Request, Response } from "express";
import { AppError } from "@ecommerce/common";
import type { ApiError } from "@ecommerce/contracts";
import { ZodError } from "zod";

/** Wraps async handlers so thrown AppErrors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

/** Translates every error into the contract's ApiError JSON shape. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    const body: ApiError = {
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: err.issues,
      },
    };
    res.status(422).json(body);
    return;
  }
  if (err instanceof AppError) {
    const status = {
      VALIDATION_ERROR: 422,
      UNAUTHORIZED: 401,
      NOT_FOUND: 404,
      CONFLICT: 409,
      INTERNAL: 500,
    }[err.code];
    res
      .status(status)
      .json({
        error: { code: err.code, message: err.message, details: err.details },
      });
    return;
  }
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Internal server error" } });
}
