# Architecture — E-Commerce Microservices Learning Platform

> Reference document for the whole system. For the original plan see `~/.commandcode/plans/ecommerce-microservices-learning.md`; for session progress see `../AGENT_SESSION_LOG.md`.

## 1. Goal

Learn production-style Node.js microservices end to end — **Docker, Kubernetes, Kafka, gRPC, REST** — by building a real e-commerce platform. Backend is developer-owned; the React storefront is agent-owned. Everything is hosted on **Floci** (local AWS emulator), so the full AWS deployment lifecycle runs on this machine with zero cloud cost.

## 2. Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 22+, TypeScript (strict) everywhere |
| REST services | Express (gateway, auth, product, order, notification) |
| Sync inter-service | gRPC (`@grpc/grpc-js`) — payment, inventory |
| Async events | Kafka via KafkaJS (MSK on Floci = real Redpanda broker) |
| Databases | PostgreSQL 16 — one database per service |
| Cache | Redis 7 (product cache, sessions) |
| Frontend | Vite + React 18 + React Query + Tailwind v4 + React Router |
| IaC | Terraform (standard AWS provider pointed at Floci) |
| Hosting | Floci: ECS (containers), EKS/k3s (Kubernetes), RDS, MSK, ElastiCache, SES, S3, ECR, ELB v2, CloudWatch |

## 3. System Overview

```
                         ┌──────────────────┐
    Browser ───────────► │   API Gateway     │ :3000  REST · JWT verify · rate limit · proxy
                         └────────┬─────────┘
               REST (HTTP)        │         gRPC (sync, internal)
         ┌───────────┬────────────┼────────────┬──────────────┐
         ▼           ▼            ▼            ▼              ▼
    ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
    │  Auth   │ │ Product │ │  Order  │ │ Payment  │ │ Notification │
    │  :3001  │ │  :3002  │ │  :3003  │ │ gRPC     │ │  :3004       │
    │         │ │         │ │         │ │ :50051   │ │  (consumer)  │
    └────┬────┘ └────┬────┘ └────┬────┘ └────┬─────┘ └──────┬───────┘
         │           │       │  Inventory (gRPC :50052) │        │
         │           │       └──────────┬───────────────┘        │
     auth_db     product_db       order_db               order.*/payment.*
                 inventory_db   payment_db                  (Kafka)
                 └────────────────┬────────┘──────────────────────┘
                                  ▼
                          ┌────────────┐   ┌─────────┐
                          │   Kafka    │   │  Redis  │
                          │ (5 topics) │   │  :6379  │
                          └────────────┘   └─────────┘
```

### Communication rules
- **Browser → anything:** only via the API Gateway (REST). Services are never exposed directly.
- **Service → service, synchronous:** gRPC only (Order → Inventory, Order → Payment). Used when the caller needs an immediate answer to proceed.
- **Service → service, asynchronous:** Kafka events. Used when fire-and-forget works: notifications, cache invalidation, audit. Every message follows the envelope in `packages/contracts`.

## 4. Services

| Service | Protocol | Owns | Database | Emits | Consumes |
|---|---|---|---|---|---|
| **API Gateway** | REST :3000 | routing, JWT verify, rate limiting | — | — | — |
| **Auth** | REST :3001 | users, JWT issue/refresh | `auth_db` | `user.created`, `user.updated` | — |
| **Product** | REST :3002 | catalog, categories, search, images → S3 | `product_db` + Redis | `product.created/updated/deleted`, `product.stock-updated` | — |
| **Order** | REST :3003 | carts, orders, **checkout saga orchestrator** | `order_db` | `order.created/confirmed/cancelled` | `payment.succeeded/failed`, `inventory.reserved/rejected` |
| **Payment** | gRPC :50051 | payments, refunds, mock PSP | `payment_db` | `payment.succeeded/failed/refunded` | — |
| **Inventory** | gRPC :50052 | stock, reservations | `inventory_db` | `inventory.reserved/rejected/released` | `order.created`, `order.cancelled`, `payment.failed` |
| **Notification** | REST :3004 (health) | email via SES, in-app log | — | — | `order.*`, `payment.*`, `user.created` |

### Ports & connections (dev)
| Resource | Value |
|---|---|
| Gateway / Auth / Product / Order / Notification | `:3000` / `:3001` / `:3002` / `:3003` / `:3004` |
| Payment / Inventory gRPC | `:50051` / `:50052` |
| Postgres | `postgres://dev:dev@localhost:5432/{auth_db,product_db,order_db,payment_db,inventory_db}` |
| Redis | `redis://localhost:6379` |
| Kafka | provisioned via Floci MSK (Redpanda) in phase 3 |
| Floci endpoint | `http://localhost:4566` (`eval $(floci env)`), console at `/_floci/ui` |

## 5. Checkout Saga (the centerpiece)

Choreographed with the Order service as orchestrator:

```
POST /orders (cart + paymentMethodId)
   │
   ▼
Order: create order (PENDING) ──► emit order.created ──┐
   │                                                   ▼
   │  gRPC ReserveStock(order_id, items) ────► Inventory
   │                                          │ ok? reserve stock
   │            ◄─────────────────────────────┘
   │      reservation_id            or rejected (INSUFFICIENT_STOCK…)
   ▼
Order: gRPC AuthorizePayment(order_id, amount) ──► Payment
   │                                    │
   │ AUTHORIZED                         │ DECLINED / ERROR
   ▼                                    ▼
emit order.confirmed              emit order.cancelled (PAYMENT_FAILED)
emit payment.succeeded (Payment)  emit inventory.released  ← compensating action
   │                                    │
   ▼                                    ▼
Notification: SES email           Order → CANCELLED, stock released
```

- **Invariant:** stock is never left reserved on failure; orders are never CONFIRMED without an authorized payment.
- Frontend follows the saga live via `GET /orders/{id}/stream` (SSE).
- The storefront's checkout page includes a payment method that always declines — use it to watch the compensation path.
- Testing hooks: product `88888888-8888-4888-8888-888888888888` is seeded with **0 stock** (tests `inventory.rejected`).

## 6. Kafka Topology

| Topic | Producers | Consumers |
|---|---|---|
| `user-events` | Auth | Notification |
| `product-events` | Product | (cache invalidation) |
| `order-events` | Order | Notification |
| `payment-events` | Payment | Order, Notification |
| `inventory-events` | Inventory | Order |

Every message: envelope `{ id, type, topic, version: 1, occurredAt, correlationId, payload }`, payloads validated by the zod schemas in `@ecommerce/contracts`. Consumers must be **idempotent** (replay-safe) — keyed by `orderId`/`userId`/`productId` where possible.

## 7. Monorepo Layout

```
ecommerce-micro/
├── apps/                          # runnable services
│   ├── api-gateway/               # USER — Express :3000
│   ├── auth-service/              # USER — Express :3001
│   ├── product-service/           # USER — Express :3002
│   ├── order-service/             # USER — Express :3003, saga orchestrator
│   ├── payment-service/           # USER — gRPC :50051
│   ├── inventory-service/         # USER — gRPC :50052
│   ├── notification-service/      # USER — Kafka consumer :3004
│   └── storefront/                # AGENT — React app (done: catalog, cart, checkout, SSE tracking, auth)
├── packages/                      # shared, no business logic
│   ├── contracts/                 # SINGLE SOURCE OF TRUTH
│   │   ├── openapi.yaml           #   every REST route, request/response, status codes
│   │   ├── proto/                 #   inventory.proto, payment.proto (gRPC)
│   │   └── src/
│   │       ├── rest/              #   zod schemas + TS types for all REST bodies
│   │       ├── events/            #   5 topics, 14 event types, envelope, topic map
│   │       └── openapi.ts         #   ROUTES path constants
│   ├── common/                    # pino logger, AppError, traceId
│   └── events/                    # typed EventPublisher (validates + publishes to Kafka)
├── infra/
│   ├── docker/                    # docker-compose.dev.yml (PG + Redis) — running
│   │   └── postgres/init/         # schemas + dummy seed (12 products, stock incl. 1 zero-stock)
│   ├── terraform/                 # (phase 3) Floci resources: RDS, MSK, ElastiCache, S3, SES, ECR, ECS, ALB
│   ├── ecs/                       # (phase 3) task definitions
│   ├── k8s/                       # (phase 4) manifests for EKS/k3s on Floci
│   └── bootstrap/                 # (phase 3) floci start + repo/topic/bucket setup
└── ARCHITECTURE.md                # this file
```

## 8. Frontend (`apps/storefront`) — agent-owned

- **Pages:** catalog (`/`), product detail, cart, checkout, order tracking (live via SSE), order history, login, register
- **Server state:** React Query — one query key per resource (`products`, `product/:id`, `cart`, `orders`), mutations invalidate precisely
- **Auth:** access token in memory, auto-refresh on 401 via `POST /auth/refresh`, `AuthProvider` context
- **API layer:** `src/api/` thin clients typed by contracts; dev proxy `/api` → `localhost:3000`
- Serves empty states gracefully until the corresponding service exists

## 9. Floci Hosting Model (phases 3–4)

| Component | Floci service | Notes |
|---|---|---|
| Service containers | ECS (real Docker) | one task definition + service per app; images from ECR |
| Kubernetes | EKS = real k3s | same images via `infra/k8s` manifests; HPA, Ingress |
| Kafka | MSK → real Redpanda broker | KafkaJS connects as usual |
| Postgres ×5 | RDS → real postgres:16 | replaces the compose container |
| Redis | ElastiCache → real Valkey | |
| Email | SES | inspect sent mail in Floci console |
| Images/files | S3 | product images, pre-signed URLs |
| LB | ELB v2 (ALB) | fronts the gateway / ingress |
| Secrets | Secrets Manager + SSM | DB URLs, JWT secrets — never baked into images |
| Observability | CloudWatch Logs/Metrics | pino logs + request counters |
| Provisioning | Terraform, `AWS_ENDPOINT_URL=http://localhost:4566` | one `terraform apply` |

## 10. Build Phases

1. **Contracts** ✅ — done (openapi.yaml, protos, event schemas)
2. **Docker Compose dev stack** — PG + Redis ✅ running & seeded; next: the 7 services
3. **Floci hosting** — Terraform → RDS/MSK/ElastiCache/S3/SES/ECR, deploy as ECS services behind ALB
4. **Kubernetes on Floci** — same images to EKS (k3s): Deployments, Services, ConfigMaps/Secrets, Ingress, HPA
5. **Production touches** — CI (test → build → push ECR → redeploy), health/readiness probes, graceful shutdown, CloudWatch logging with trace IDs, gRPC circuit breakers
6. **Stretch** — OpenSearch product search, transactional outbox, Step Functions saga variant, CloudWatch dashboards

## 11. Conventions

- All request/response shapes and event payloads come from `@ecommerce/contracts` — never redefine them locally
- Error body is always `{ error: { code, message, details? } }` with the 5 canonical codes from `@ecommerce/common`
- Every service exposes `GET /health` (liveness + readiness)
- Structured logs only (pino), `correlationId` propagated through HTTP headers and Kafka headers
- Order of work per service: contracts → schema → handlers → events → Dockerfile
