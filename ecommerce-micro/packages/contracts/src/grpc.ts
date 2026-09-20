/**
 * Typed gRPC helpers for the two internal service contracts.
 *
 * Uses dynamic proto loading (@grpc/proto-loader) instead of static codegen:
 * no protoc toolchain, and the .proto files in packages/contracts/proto remain
 * the single source of truth. The message interfaces below are hand-written to
 * match them 1:1 — a mismatch is a code review bug, same as generated drift.
 */
import path from "node:path";
import util from "node:util";
import { fileURLToPath } from "node:url";
import { credentials, loadPackageDefinition } from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const here = path.dirname(fileURLToPath(import.meta.url));
const loadOptions: protoLoader.Options = {
  keepCase: false,
  defaults: true,
  oneofs: true,
  longs: Number, // int64 fields as JS numbers (amounts here never exceed 2^53)
};

// ── inventory.v1 ────────────────────────────────────────────────────────────
export interface StockItem {
  productId: string;
  quantity: number;
}
export interface ReserveStockRequest {
  orderId: string;
  items: StockItem[];
}
export interface ReserveStockResponse {
  ok: boolean;
  reservationId: string;
  rejectedProductId: string;
  reason: "" | "INSUFFICIENT_STOCK" | "PRODUCT_NOT_FOUND" | "RESERVATION_EXISTS";
}
export interface ReleaseReservationRequest {
  reservationId: string;
  orderId: string;
}
export interface ReleaseReservationResponse {
  ok: boolean;
  reason: "" | "RELEASED" | "ALREADY_RELEASED" | "NOT_FOUND";
}
export interface GetStockRequest {
  productId: string;
}
export interface GetStockResponse {
  productId: string;
  available: number;
  reserved: number;
}

export interface InventoryClient {
  reserveStock(req: ReserveStockRequest): Promise<ReserveStockResponse>;
  releaseReservation(req: ReleaseReservationRequest): Promise<ReleaseReservationResponse>;
  getStock(req: GetStockRequest): Promise<GetStockResponse>;
}

// ── payment.v1 ──────────────────────────────────────────────────────────────
export interface AuthorizePaymentRequest {
  orderId: string;
  userId: string;
  amountCents: number;
  currency: string;
  paymentMethodId: string;
}
export interface AuthorizePaymentResponse {
  ok: boolean;
  paymentId: string;
  status: "AUTHORIZED" | "DECLINED" | "ERROR";
  failureReason: "" | "CARD_DECLINED" | "INVALID_METHOD" | "PSP_ERROR";
}
export interface RefundPaymentRequest {
  paymentId: string;
  orderId: string;
  amountCents: number;
}
export interface RefundPaymentResponse {
  ok: boolean;
  refundId: string;
  status: "REFUNDED" | "ERROR";
}

export interface PaymentClient {
  authorizePayment(req: AuthorizePaymentRequest): Promise<AuthorizePaymentResponse>;
  refundPayment(req: RefundPaymentRequest): Promise<RefundPaymentResponse>;
}

// ── factories ───────────────────────────────────────────────────────────────
function promisify<TReq, TRes>(fn: (req: TReq, cb: (err: unknown, res: TRes) => void) => void) {
  return util.promisify(fn) as (req: TReq) => Promise<TRes>;
}

export function createInventoryClient(address: string): InventoryClient {
  const def = loadPackageDefinition(
    protoLoader.loadSync(path.join(here, "../proto/inventory.proto"), loadOptions),
  ) as any;
  const client = new def.inventory.v1.InventoryService(address, credentials.createInsecure());
  return {
    reserveStock: promisify(client.reserveStock.bind(client)),
    releaseReservation: promisify(client.releaseReservation.bind(client)),
    getStock: promisify(client.getStock.bind(client)),
  };
}

export function createPaymentClient(address: string): PaymentClient {
  const def = loadPackageDefinition(
    protoLoader.loadSync(path.join(here, "../proto/payment.proto"), loadOptions),
  ) as any;
  const client = new def.payment.v1.PaymentService(address, credentials.createInsecure());
  return {
    authorizePayment: promisify(client.authorizePayment.bind(client)),
    refundPayment: promisify(client.refundPayment.bind(client)),
  };
}

/** Server-side helper: register handlers on a gRPC server from the same .proto. */
export function loadServiceDefinition(name: "inventory" | "payment"): any {
  const def = loadPackageDefinition(
    protoLoader.loadSync(path.join(here, `../proto/${name}.proto`), loadOptions),
  ) as any;
  return name === "inventory" ? def.inventory.v1.InventoryService : def.payment.v1.PaymentService;
}
