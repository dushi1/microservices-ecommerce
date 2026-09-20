# Project Phases — Complete Ranking

> Every known task mapped against the ARCHITECTURE.md build phases, with TOOLS.md items slotted at their logical points. Status reflects the state as of 2026-09-19. When asked "what's next?", "rank the phases", or "project roadmap", return this list.

---

### Phase 1 — Contracts (DONE) ✅

All contract packages built and verified across all workspaces:

| Package | What it contains |
|---------|-----------------|
| `@ecommerce/contracts/rest` | Zod schemas for auth/product/order REST endpoints, route path constants |
| `@ecommerce/contracts/events` | Kafka event schemas + envelope + topic map (14 events) |
| `@ecommerce/contracts/proto` | `inventory.proto` (3 RPCs) + `payment.proto` (2 RPCs) |
| `@ecommerce/contracts` (grpc.ts) | Typed gRPC helpers — dynamic proto loading, client factories, server loaders |
| `@ecommerce/common` | Pino logger, AppError, traceId utilities |
| `@ecommerce/events` | EventPublisher wrapper around KafkaJS |

Verified: `tsc --noEmit` clean on all 4 packages.

---

### Phase 2 — Dev Stack (IN PROGRESS) 🟡

Docker Compose dev stack + all 7 services.

#### Docker / Infra
| Item | Status |
|------|--------|
| Postgres 16 (5 databases: auth_db, product_db, order_db, payment_db, inventory_db) | ✅ Running, seeded with 12 products |
| Redis 7 (`:6379`) | ✅ Running, healthy |
| Redpanda (Kafka broker) | ❌ Not in docker-compose |
| Floci UI + service | ✅ Running (separate from dev stack) |

#### Services
| Service | Port | Protocol | Status |
|---------|------|----------|--------|
| api-gateway | :3000 | REST proxy | ✅ Live, JWT verify, rate limit, tracing |
| auth-service | :3001 | REST | ✅ register/login/refresh/me |
| product-service | :3002 | REST + gRPC client | ✅ catalog, Redis cache, **GetStock via gRPC** |
| order-service | :3003 | REST + gRPC client | ✅ cart CRUD, checkout saga, cancel, SSE tracking |
| inventory-service | :50052 | gRPC (+ debug :3005) | ✅ ReserveStock, ReleaseReservation, GetStock |
| payment-service | :50051 | gRPC (+ debug :3006) | ✅ AuthorizePayment, RefundPayment, mock PSP |
| storefront | :5173 | Vite React | ✅ Full UI, cross-tab auth sync, Lavish theme |
| notification-service | — | Unbuilt | ❌ No broker to consume from |

#### Remaining in Phase 2
| Priority | Item | Why now |
|----------|------|---------|
| **1** | Vitest + Supertest + Testcontainers | Zero tests exist; protects all existing code |
| **2** | ESLint + Prettier + husky | No lint rules across 11 workspaces |
| **3** | Add `InsertStock` RPC to inventory.proto | Product creates catalog items but skips stock row until this exists |
| **4** | Redpanda (Kafka broker) in docker-compose | Brokerless → no events fire, Notification has nothing to watch |
| **5** | Notification service (Kafka consumer) | 7th service; consumes `order.*`, `payment.*`, `user.created` → emails/log |
| **6** | Flip guarded emitters on (`KAFKA_BROKERS` env var set) | All emitters have `if (KAFKA_BROKERS)` guard — skipped until broker exists |
| **7** | Order→Product cart enrichment → gRPC | Low priority; untyped fetch works for simple request/response |

*Phase 2 isn't finished until Kafka runs end-to-end. Tests + lint are blockers for anything else because there's zero safety net.*

---

### Phase 3 — Floci Hosting (NOT STARTED) ⬜

Provision real AWS-shaped infrastructure on Floci (local emulator) via Terraform.

| Priority | Item | Current state | Why after Phase 2 |
|----------|------|---------------|-------------------|
| **1** | Terraform: RDS Postgres, MSK (Redpanda), ElastiCache, S3, SES | All raw SQL / localhost / local Docker | Replace disposable Docker infra with provisioned services |
| **2** | ECR images for every service | Not Dockerized yet | Each service needs a Dockerfile + pushed to ECR |
| **3** | ECS task definitions + services per app | All running via `npm run dev` in terminals | Task definitions define resource limits, networking, health checks |
| **4** | ALB routing to gateway (:3000) | Direct localhost access | Public entry point behind load balancer |
| **5** | Secrets Manager (DB URLs, JWT secrets) | Plain env vars | Never bake secrets into images or config |
| **6** | Gateway Redis rate limits + circuit breaker | In-memory counters only | Breaks with >1 replica; need Redis-backed store |
| **7** | Prometheus `/metrics` endpoint | None | First observability layer before K8s adds more |

*This keeps the same services running the same way — just hosted differently instead of in Docker Compose.*

---

### Phase 4 — Kubernetes on Floci (NOT STARTED) ⬜

Same ECR images from Phase 3, deployed to EKS (real k3s on Floci) instead of ECS.

| Priority | Item | Status |
|----------|------|--------|
| **1** | Helm / Kustomize templates (one per service) | Nothing templated yet |
| **2** | ConfigMaps + Secrets per namespace | None |
| **3** | Ingress resource → public entry point | Direct localhost |
| **4** | HPA config (CPU/memory scaling targets) | Static counts |
| **5** | k9s terminal UI for K8s learning | Installable anytime |
| **6** | Skaffold auto-redeploy on git push | Deferred |
| **7** | ArgoCD GitOps pipeline | Stretch |

*Architecture doesn't change — just the hosting model moves from ECS to EKS.*

---

### Phase 5 — Production Touches (NOT STARTED) ⬜

Polish everything that's live. Code works, infra works — make it resilient.

| Priority | Item | Status |
|----------|------|--------|
| **1** | Health/readiness probes on every service | Liveness (/health) exists; no readiness probe |
| **2** | Graceful shutdown handling (drain connections, flush logs) | None |
| **3** | CloudWatch logging with trace IDs | Raw console logs only |
| **4** | OpenTelemetry + Jaeger distributed tracing | Deferred in TOOLS.md |
| **5** | gRPC circuit breakers on upstream calls | Deferred gateway hardening |
| **6** | httpOnly Secure cookie for refresh tokens | localStorage = XSS risk; deferred |
| **7** | RS256 asymmetric JWT signing | HMAC symmetric keys today; one compromised service can forge tokens |

---

### Phase 6 — Stretch (NOT STARTED) ⬜

Advanced patterns beyond the core platform.

| Priority | Item | Status |
|----------|------|--------|
| **1** | OpenSearch for product search | Currently uses PostgreSQL `to_tsvector` |
| **2** | Transactional outbox pattern | Currently sync in-process saga |
| **3** | Step Functions saga variant (AWS-native choreography) | Currently in-memory orchestrator in Order service |
| **4** | CloudWatch dashboards + alerting | Raw logs only |
| **5** | Compare hand-rolled gateway vs Kong/Envoy/Traefik | Research stretch — deploy one in Floci, port 2 features |

---

## Quick Reference: Where Things Stand

```
Phase 1 (Contracts)    ████████████████████  Done
Phase 2 (Dev Stack)    ███████████░░░░░░░░░  Mostly done, Kafka pending
Phase 3 (Floci)        ░░░░░░░░░░░░░░░░░░░░  Not started
Phase 4 (Kubernetes)   ░░░░░░░░░░░░░░░░░░░░  Not started
Phase 5 (Production)   ░░░░░░░░░░░░░░░░░░░░  Not started
Phase 6 (Stretch)      ░░░░░░░░░░░░░░░░░░░░  Not started
```

### Next immediate step
Tests → Linting → Kafka broker → Notification → Floci Terraform. Everything else depends on this sequence.
