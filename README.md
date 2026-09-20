# Microservices E-Commerce — Learning Platform

> A full-stack Node.js microservices platform built end-to-end for learning Docker, Kubernetes, Kafka, gRPC, REST, and cloud infrastructure (via [Floci](https://floci.com)). Everything runs locally with zero cloud cost.

---

## Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 22+, TypeScript (strict) everywhere |
| Monorepo | npm workspaces → `ecommerce-micro/` |
| Frontend | Vite + React 18 + React Query + Tailwind v4 + React Router |
| REST services | Express (gateway, auth, product, order, notification) |
| Sync inter-service | **gRPC** (`@grpc/grpc-js`) — inventory, payment |
| Async events | **Kafka** via KafkaJS — notification service |
| Databases | PostgreSQL 16 — one database per service |
| Cache | Redis 7 (product cache, sessions) |
| Hosting | **Floci** (local AWS emulator) — ECS/EKS/RDS/MSK/S3/SES |

---

## Architecture Overview

```
Browser ──────────► api-gateway :3000 ◄── storefront :5173
                  (REST proxy · JWT · rate-limit)
              │                    │
          REST (HTTP)       gRPC (sync, internal)
    ┌───────┴──────┐     ┌──────┴───────┬──────────┐
    ▼              ▼     ▼              ▼          ▼
auth :3001      product :3002   order :3003    payment :50051 (gRPC)
(auth_db)       (product_db)    (order_db)     (payment_db)
                                         ▲
                              inventory :50052 (gRPC)
                                 (inventory_db)
```

### Services

| Service | Port | Role | Database |
|---------|------|------|----------|
| **api-gateway** | :3000 | Single public entry point, JWT verify, rate limit, proxy routing | — |
| **auth-service** | :3001 | User registration, login, JWT issue/refresh, profile | auth_db |
| **product-service** | :3002 | Catalog list/detail/create, category filters, search, Redis cache | product_db (+ Redis) |
| **order-service** | :3003 | Cart CRUD, checkout saga orchestrator, order tracking (SSE), cancel | order_db |
| **inventory-service** | :50052 | Stock reservation/release/get (gRPC) | inventory_db |
| **payment-service** | :50051 | Authorization/refund (gRPC), mock PSP | payment_db |
| **notification-service** | Unbuilt | Kafka consumer → emails/logs | — |

### Inter-service Communication

| Pattern | Protocol | When used | Examples |
|---------|----------|-----------|----------|
| **Sync request/response** | gRPC | Caller needs immediate answer | Order→Inventory ReserveStock, Order→Payment AuthorizePayment, Product→Inventory GetStock |
| **Async fire-and-forget** | Kafka | No one waiting on reply | order.confirmed → email, product.stock-updated → cache invalidation |
| **Public API** | REST / HTTP | Browser-facing endpoints | GET /products, POST /auth/login, all via gateway |

#### gRPC Details

All gRPC uses dynamic proto loading (`@grpc/proto-loader`) — no `protoc` toolchain. Contract lives in `packages/contracts/proto/`:

- `inventory.proto` — ReserveStock, ReleaseReservation, GetStock
- `payment.proto` — AuthorizePayment, RefundPayment

Typed client/server helpers auto-generate from these protos via `packages/contracts/src/grpc.ts`. The Checkout Saga flow (Order→Inventory→Payment) is fully verified through the browser UI, including declined-card compensation paths.

---

## Project Structure

```
Nodejs/                          # Workspace root
├── .gitignore
├── AGENTS.md                    # Session conventions & preferences
├── AGENT_SESSION_LOG.md         # Working memory across chat sessions
├── ARCHITECTURE.md              # Full system reference
├── ARCHITECTURE-ELI5.md         # Same architecture explained simply
├── GRPC.md                      # gRPC communication map
├── PHASES.md                    # Phase-by-phase project roadmap
├── TOOLS.md                     # Deferred tooling + hardening checklist
│
└── ecommerce-micro/             # Monorepo (npm workspaces)
    ├── package.json             # Root: workspaces + shared scripts
    ├── package-lock.json        # Dependency resolution lockfile
    ├── tsconfig.base.json       # Shared TypeScript config
    │
    ├── apps/
    │   ├── api-gateway/         # :3000 — reverse proxy + JWT edge
    │   ├── auth-service/        # :3001 — register, login, refresh, me
    │   ├── inventory-service/   # :50052 — gRPC stock operations
    │   ├── order-service/       # :3003 — carts, checkout saga, SSE tracking
    │   ├── payment-service/     # :50051 — gRPC payment mock PSP
    │   ├── product-service/     # :3002 — catalog + Redis cache + gRPC client
    │   └── storefront/          # :5173 — Vite React frontend
    │
    ├── packages/
    │   ├── common/              # Pino logger, AppError, traceId
    │   ├── contracts/           # Zod schemas, OpenAPI yaml, protos, gRPC helpers
    │   └── events/              # EventPublisher wrapper for KafkaJS
    │
    └── infra/docker/
        └── postgres/init/       # DB creation + seed data (auto-executed on first boot)
```

---

## How to Run the Project

### Prerequisites

- **Node.js 22+** (`node --version` ≥ 22)
- **Docker Desktop** or **podman** (for Postgres + Redis containers)
- **pnpm** or **npm** (any works, pnpm recommended)

### Step 1: Start Infrastructure

```bash
cd ecommerce-micro/infra/docker
docker compose -f docker-compose.dev.yml up -d
```

This starts:
- **PostgreSQL 16** on `localhost:5432` — five databases (`auth_db`, `product_db`, `order_db`, `payment_db`, `inventory_db`) automatically created and seeded with 12 products + stock data
- **Redis 7** on `localhost:6379`

Verify:
```bash
docker ps          # Should show ecommerce-micro-postgres and ecommerce-micro-redis
curl http://localhost:5432  # PostgreSQL
# or use PGPASSWORD=dev psql -U dev -h localhost -c "SELECT 1"
redis-cli ping  # Returns PONG
```

### Step 2: Install Dependencies

From the monorepo root:

```bash
cd ../..                   # Back to ecommerce-micro/
npm install                # Resolves all workspaces
```

Or if you prefer pnpm:
```bash
pnpm install
```

### Step 3: Start Services (in separate terminals)

Each service runs via `tsx watch` (hot-reload). Run them in different terminal windows:

```bash
# Terminal 1 — Auth Service
npm run dev:auth

# Terminal 2 — Product Service
npm run dev --workspace @ecommerce/product-service
# Or: cd apps/product-service && npx tsx watch src/index.ts

# Terminal 3 — Order Service
npm run dev --workspace @ecommerce/order-service

# Terminal 4 — API Gateway
npm run dev:gateway

# Terminal 5 — Storefront (React dev server)
npm run dev:storefront
# Or: cd apps/storefront && npx vite
```

Alternatively, run each manually:
```bash
# All backend services (Express)
npx tsx watch apps/auth-service/src/index.ts &
npx tsx watch apps/inventory-service/src/index.ts &
npx tsx watch apps/order-service/src/index.ts &
npx tsx watch apps/payment-service/src/index.ts &
npx tsx watch apps/api-gateway/src/index.ts &
npx tsx watch apps/product-service/src/index.ts &

# Frontend
cd apps/storefront && npx vite
```

### Step 4: Open the Storefront

Open your browser to **http://localhost:5173**.

The Vite proxy routes `/api/*` → gateway `:3000` → correct service by prefix.

### Verification Commands

Check each service is alive:
```bash
curl http://localhost:3000/health  # gateway
curl http://localhost:3001/health  # auth
curl http://localhost:3002/health  # product
curl http://localhost:3003/health  # order
```

Test the checkout flow end-to-end:
```bash
# Register a user
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"password123"}' \
  -w '\n%{http_code}\n'

# List products (cached)
curl http://localhost:3000/products -H 'Accept-Encoding: gzip'

# Browse the UI instead — it's faster
open http://localhost:5173
```

### Stopping Everything

Stop containers (keeps volumes intact):
```bash
cd ecommerce-micro/infra/docker
docker compose -f docker-compose.dev.yml down
```

Kill service processes: Ctrl+C in each terminal, or kill by port:
```bash
lsof -tiTCP:3001,3002,3003,3000,5173 | xargs kill
```

---

## Running Tests

```bash
cd ecommerce-micro
npx tsc --build            # Typecheck all workspaces
```

Service-specific typecheck:
```bash
npx tsc --noEmit -p apps/auth-service/tsconfig.json
npx tsc --noEmit -p apps/storefront/tsconfig.json
```

---

## Development Workflow

### Adding a New Service

1. Create folder under `apps/<service-name>/`
2. Add `package.json` with dependencies on `@ecommerce/common` and `@ecommerce/contracts`
3. Add `tsconfig.json` inheriting from `tsconfig.base.json`
4. Create `src/index.ts` — Express app with health endpoint
5. Add route constants from `@ecommerce/contracts`
6. Add an entry to the gateway route table in `apps/api-gateway/src/routes.ts`
7. Add `dev:<name>` script to root `package.json`

### Environment Variables

Each service reads its own env. Common variables:

| Variable | Default | Where |
|----------|---------|-------|
| `DATABASE_URL` | `postgres://dev:dev@localhost:5432/<service>_db` | All services |
| `JWT_SECRET` | `"dev-secret"` (fallback) | auth-service, gateway |
| `INVENTORY_URL` | `localhost:50052` | order-service, product-service |
| `PAYMENT_URL` | `localhost:50051` | order-service |
| `PORT` | 3000–3004 per service | All services |
| `REDIS_URL` | `redis://localhost:6379` | product-service |
| `KAFKA_BROKERS` | _(empty = disabled)_ | All services that emit events |
| `VITE_API_URL` | `http://localhost:3000` | storefront (Vite proxy target) |

Production/Floci phase: replace defaults with RDS URLs, Secrets Manager values, and MSK broker endpoints.

---

## Current Status

| Area | Status |
|------|--------|
| Contracts (schemas, protos, openapi) | ✅ Done |
| Docker Compose (Postgres + Redis + seed) | ✅ Running |
| Auth Service | ✅ register/login/refresh/me |
| Product Service | ✅ catalog, search, Redis cache, gRPC client |
| API Gateway | ✅ JWT edge verify, rate limit, proxy routing |
| Order Service | ✅ cart CRUD, checkout saga, cancel, SSE tracking |
| Inventory (gRPC) | ✅ ReserveStock (atomic), ReleaseReservation, GetStock |
| Payment (gRPC) | ✅ AuthorizePayment, RefundPayment, mock PSP |
| Storefront | ✅ Full UI, cross-tab auth sync, Lavish theme |
| Notification Service | ❌ Unbuilt (needs Kafka broker) |
| Tests | ❌ None yet |
| Kafka Broker | ❌ Not deployed |
| Floci Hosting | ❌ Terraform not started |

See [PHASES.md](./PHASES.md) for the complete ranked roadmap.

---

## Documentation

| File | What it covers |
|------|----------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Full system reference — services, ports, saga pattern, Kafka topology, Floci model |
| [ARCHITECTURE-ELI5.md](./ARCHITECTURE-ELI5.md) | Same architecture explained via a toy-shop analogy |
| [GRPC.md](./GRPC.md) | gRPC communication map — what's wired, what's phased out, why |
| [PHASES.md](./PHASES.md) | Ranked project phases from contracts through K8s |
| [TOOLS.md](./TOOLS.md) | Deferred tooling + gateway hardening checklist |
| [AGENT_SESSION_LOG.md](./AGENT_SESSION_LOG.md) | Session-by-session progress log |
