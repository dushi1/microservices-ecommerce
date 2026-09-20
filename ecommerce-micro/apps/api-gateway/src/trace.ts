import type { NextFunction, Request, Response } from "express";
import { createLogger } from "@ecommerce/common";

const log = createLogger("api-gateway");

/**
 * Per-request observability: mint or forward a trace id and log the outcome
 * with duration. This is the header that becomes the correlationId on Kafka
 * events and joins requests together across services (phase 5: OpenTelemetry).
 */
export function traceMiddleware(req: Request, res: Response, next: NextFunction) {
  const traceId = (req.headers["x-trace-id"] as string) || crypto.randomUUID();
  req.headers["x-trace-id"] = traceId;
  res.setHeader("X-Trace-Id", traceId);
  const start = Date.now();
  res.on("finish", () => {
    log.info(
      { traceId, method: req.method, path: req.originalUrl, status: res.statusCode, ms: Date.now() - start },
      "request",
    );
  });
  next();
}
