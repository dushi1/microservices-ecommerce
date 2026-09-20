# Tooling Roadmap — to adopt in later phases

> Deferred from the main plan. Pick these up when the relevant phase arrives; recommended priorities at the bottom. Pairs with [ARCHITECTURE.md](./ARCHITECTURE.md).

## Gateway hardening — capstone phase (after Floci/K8s)
The custom gateway (apps/api-gateway) is a learning skeleton. Production-grade checklist, in order:
1. Redis-backed rate limiting (`rate-limit-redis`) — in-memory counters break with >1 replica
2. `keepAlive` HTTP agent + circuit breaker on upstream calls (fail fast on dead services)
3. Body size limit (`content-length` cap) + per-route method allowlists (DoS surface)
4. Prometheus `/metrics` endpoint + Grafana dashboards (p99 latency, upstream errors, RPS)
5. Multiple gateway replicas behind the Floci ALB + health checks
6. RS256 asymmetric JWTs (auth signs with private key; edge verifies with public key — a compromised service can no longer forge tokens)
7. Hot-reloadable route table (JSON file watcher or admin endpoint) — no restarts to add a route
8. httpOnly Secure cookie for refresh token (kills XSS token theft; needs CSRF protection)
Stretch: compare against Kong/Envoy/Traefik — deploy one in Floci and port two of the above as its plugins/config to see what "buy vs build" really costs.

## Testing — biggest gap, nothing planned yet
- **Vitest** — unit tests across all packages; pairs with zod contracts
- **Supertest** — HTTP-level integration tests per service
- **Testcontainers** — real per-test dependencies; Floci ships `@floci/testcontainers` so tests can hit real AWS-shaped services
- **Playwright** — browser E2E: register → buy → track, full saga from the UI
- **k6** — load testing; watch the HPA scale during phase 4

## Developer experience
- **ESLint + Prettier + husky + lint-staged** — one style across 11 workspaces, enforced pre-commit
- **Turborepo** — task runner; builds only what changed
- **grpcurl / Postman gRPC** — poke gRPC services without writing a client
- **Swagger UI / Scalar** — serve `openapi.yaml` as live docs at `:3000/docs`
- **Kafdrop / Kafka UI** — browse topics and messages in a web UI

## Data layer — decision needed before first service schema
- **Migration tool** — `node-pg-migrate`, `drizzle-kit`, or Prisma Migrate (decide: raw pg + node-pg-migrate vs Drizzle)
- **Query builder** — raw `pg` (max learning) vs Kysely/Drizzle (typed SQL)

## Observability — phase 5
- **OpenTelemetry + Jaeger** — distributed tracing: gateway → order → gRPC → Kafka. Top demo of the project
- **Prometheus + Grafana** — dashboards beyond CloudWatch

## Kubernetes — phase 4
- **Helm or Kustomize** — template the 7 near-identical deployments
- **k9s** — terminal UI for K8s, easier learning curve than raw kubectl
- **Skaffold** (already in plan) — save-to-redeploy into EKS on Floci
- **ArgoCD** — GitOps stretch: push to Git → cluster converges

## Security & ops
- **Helmet + express-rate-limit** — gateway basics
- **Trivy** — Docker image scanning in CI
- **dotenvx / env schema validation** — fail fast on missing env

## Recommended adoption order
1. Vitest + Supertest + Testcontainers — before services grow
2. ESLint + Prettier + husky — before the codebase grows
3. Migration tool — before the first real service schema
4. OpenTelemetry + Jaeger — phase 5
5. Helm + k9s — phase 4
