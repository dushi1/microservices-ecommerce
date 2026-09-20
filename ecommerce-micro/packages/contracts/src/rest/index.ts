export * from "./auth-schemas.js";
export * from "./product-schemas.js";
export * from "./order-schemas.js";
export * from "../openapi.js";

/** Standard error body every service returns on failure. */
export interface ApiError {
  error: {
    code: string; // VALIDATION_ERROR | UNAUTHORIZED | NOT_FOUND | CONFLICT | INTERNAL
    message: string;
    details?: unknown;
  };
}
