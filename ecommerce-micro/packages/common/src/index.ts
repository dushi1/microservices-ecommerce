import pino from "pino";

export function createLogger(service: string) {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { service },
  });
}

/** Extracts an incoming trace id or mints a new one. Use as `correlationId` on outgoing events. */
export function traceId(headers: Record<string, string | undefined>): string {
  return headers["x-trace-id"] ?? crypto.randomUUID();
}

export class AppError extends Error {
  constructor(
    public readonly code:
      | "VALIDATION_ERROR"
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "CONFLICT"
      | "INTERNAL",
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
