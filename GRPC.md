# gRPC in Our App — What's Built, What's Missing, and Why It Matters

> A plain-language reference for everything gRPC in this project.
> What this file **is**: the full map of service-to-service gRPC communication, an honest implemented/not-implemented ledger, and the reasoning behind each gap.
> What this file is **NOT**: a gRPC tutorial or a spec for future services — those live in [ARCHITECTURE.md](./ARCHITECTURE.md). Session history lives in [AGENT_SESSION_LOG.md](./AGENT_SESSION_LOG.md).

---

## 1. What gRPC is, in plain language

REST is how two strangers talk: one sends a letter (HTTP request with JSON), the other reads it, figures out what it means, and sends a letter back. Flexible, but every letter has to be written out by hand, and neither side is sure the other understood the address correctly.

gRPC is how two coworkers who work together every day talk. They agree **once** on a shared vocabulary — a contract — and from then on they just talk. Fast, no guessing, and if you use a word that isn't in the vocabulary, the conversation refuses to start.

That agreed vocabulary is the **`.proto` file**. Ours live in `ecommerce-micro/packages/contracts/proto/`:

- `inventory.proto` — the vocabulary for talking to the Inventory service
- `payment.proto` — the vocabulary for talking to the Payment service

Each `.proto` file defines **RPCs** ("remote procedure calls") — things you can *ask the other service to do* — and the exact shape of what you send and get back. Both sides generate their code from the same file, so:

- The caller **cannot call a method that doesn't exist** (it's not in the vocabulary).
- The caller **cannot send a wrong-shaped message** (the types are generated from the contract).
- The response is **binary, not JSON** — smaller and faster to parse.

---

## 2. Why gRPC at all, when we already have REST?

Fair question — the honest answer is that we don't use gRPC *instead* of REST. We use each where it wins. Our architecture gives every kind of conversation its own protocol:

| Conversation | Protocol | Why |
|---|---|---|
| Browser → anything | REST via the gateway | Browsers speak HTTP/JSON natively; the gateway is our public contract |
| Service → service, **need answer now** | **gRPC** | Typed, fast, contract-enforced — used exactly where the caller is blocked until the reply arrives |
| Service → service, fire-and-forget | Kafka events | Nobody's waiting on the reply, so no connection should be held open |

The **"need answer now"** case in our app is the checkout. When you press "Place order", the Order service cannot proceed until it knows: *is the stock reserved? did the payment authorize?* Those are blocking, transaction-path questions — that's gRPC's home turf. Sending an email after checkout is *not* blocking — nobody stares at the screen waiting for it — so that's Kafka's job (and Kafka isn't built yet; see section 6).

---

## 3. The gRPC map of our app

Five RPCs exist in the contracts, served by two services. Three services call them: Order and Product are active callers.

| # | RPC | Contract | Provider | Caller | When it fires |
|---|---|---|---|---|---|
| 1 | `ReserveStock` | `inventory.proto` | Inventory `:50052` | Order | Checkout — hold stock for the order |
| 2 | `ReleaseReservation` | `inventory.proto` | Inventory `:50052` | Order | Payment failed, or order cancelled — put stock back |
| 3 | `GetStock` | `inventory.proto` | Inventory `:50052` | Product (list + detail) ✅ | Reads product availability for storefront display |
| 4 | `AuthorizePayment` | `payment.proto` | Payment `:50051` | Order | Checkout — charge the card (mock PSP) |
| 5 | `RefundPayment` | `payment.proto` | Payment `:50051` | Order | Cancel a confirmed order — money back |

**Connections that are NOT gRPC** (for context, not gRPC bugs):

- Browser → api-gateway → auth/product/order: REST (HTTP proxy) — by design, browsers don't speak gRPC
- Order → Product (cart line enrichment): plain HTTP `fetch` — untyped sync call, safe for now, can be gRPC later
- Product → Inventory write path: skips stock insert on create until `InsertStock` RPC exists (TODO(6)) — READ path uses gRPC GetStock ✅
- Every service → Notification: Kafka events (dormant broker, see phased items above)

---

## 4. The implemented slice, end to end

Here's what actually happens when you place an order, in execution order (code: `apps/order-service/src/handlers.ts`):

```
You press "Place order"
        │
        ▼
Order creates the order row          (status: PENDING)
        │
        ▼
① Order ──gRPC──► Inventory.ReserveStock(items)
        │
        ├── rejected (no stock / product missing)
        │       └─► order → CANCELLED, reason: INVENTORY_REJECTED. Done.
        │
        ▼ ok — stock is now HELD for this order
② Order ──gRPC──► Payment.AuthorizePayment(order_id, amount_cents, method)
        │
        ├── DECLINED (try payment method "pm_card_declined" — always declines)
        │       └─► ②a Order ──gRPC──► Inventory.ReleaseReservation   ← compensation!
        │             stock goes back, order → PAYMENT_FAILED
        │
        ▼ AUTHORIZED
Order → CONFIRMED, cart cleared, "order.confirmed" event emitted (skipped — no Kafka yet)
```

Three things worth noticing in this flow, because they're the reason the gRPC slice exists at all:

1. **`ReserveStock` is atomic inside Inventory.** It reserves every item with a single `UPDATE ... WHERE available >= qty` per item, inside **one database transaction**. There is no "check stock, then reduce stock" two-step — two people buying the last item cannot both win, because the database arbitrates in one statement. (Same lesson as the auth register race: check-then-act is never the guard; the constraint is.)

2. **The compensation step is a gRPC call too.** When payment fails *after* stock was reserved, Order must *undo* step ① — that's `ReleaseReservation`. We verified this in the browser: pay with `pm_card_declined` → order shows PAYMENT_FAILED → stock is exactly where it started. Distributed systems fail in the middle; compensation is how you clean up.

3. **Cancelling a confirmed order also walks the gRPC path backwards** — `ReleaseReservation` + `RefundPayment`. Double-cancel is rejected with a 409.

**The supporting cast (also implemented):**

- **Typed helpers** in `packages/contracts/src/grpc.ts` — one function loads a `.proto` and hands back a fully-typed, promise-based client/server. `longs: Number` is set, because gRPC's 64-bit integers otherwise arrive as a `Long` object that Postgres rejects (a real bug we hit and fixed).
- **Address config via env vars**: `INVENTORY_URL` / `PAYMENT_URL` in Order, defaulting to `localhost:50052` / `localhost:50051` in dev.
- **Debug REST endpoints** on both gRPC services (Inventory `:3005`, Payment `:3006`) so you can poke stock and payment state with curl — gRPC itself isn't curl-able without special tooling.
- **Mock PSP** in Payment: payment method `pm_card_declined` always declines, everything else authorizes. That's what makes the failure path testable. Payment also replays the stored result if asked to authorize the same order twice — safe retries.

---

## 5. Ledger: done ✅ vs phased-for-later 🔜

### Done — everything the design specified for this phase

Both `.proto` contracts (inventory 3 RPCs + payment 2 RPCs). Both servers live on their gRPC ports and serve all defined methods. Three clients drive calls: Order makes 4 calls during checkout/cancel; Product makes 1 per-product-detail lookup. The supporting cast is in place — typed helpers (`packages/contracts/src/grpc.ts`) load protos dynamically, env-tuned addresses (`INVENTORY_URL` / `PAYMENT_URL`), debug REST endpoints (`:3005` / `:3006`), mock PSP replay-safe autorize. Verified end-to-end through the real UI: success path, declined-card compensation, cancel+refund, double-cancel 409. **Sync side is to spec. All 5 RPCs work.**

### Phased for later — not bugs, not gaps, intentionally deferred

These items exist in other parts of the project roadmap (TOOLS.md entries). They are scoped additions, not incompleteness in the current gRPC build:

**`InsertStock` / `ReleaseStock` (inventory.proto extension)** — When Product creates a catalog item, it currently skips stock insertion (TODO(6)). That works for testing but means newly created products show 0 available. Adding these two RPCs would give Product a proper service-to-service write path. Low effort: one proto addition, two handlers, wire into server. High value: full product create flow without raw SQL. Trigger: next time someone touches product creation.

**Order → Product via gRPC (new proto)** — Cart line enrichment calls Product over untyped HTTP `fetch`. The architecture pattern says sync calls should be gRPC, but Product→Order cart enrichment is a simple request/response with no transactional consequence. Can stay HTTP longer than most. Trigger: when we need strong typing between these two or want consistent observability.

**Kafka + Notification (entirely separate system)** — Zero events fire because there's no broker. The emitters exist but are guarded by `if (KAFKA_BROKERS)`. This is the next big milestone after Floci deployment. Consequences: no emails, stuck `PENDING` orders on mid-checkout crash (no async recovery). Separate proto files, separate services, separate infra.

---

## 7. The toy-shop version (ELI5)

Imagine the shop is a toy shop with separate rooms that can't shout at each other.

- The **Order room** is the shop clerk taking your purchase.
- The **Inventory room** is the stockroom with a walkie-talkie. The clerk presses the button: *"hold two robots for me!"* — and the stockroom answers *"held!"* or *"sorry, only one left."* The clerk can't finish your sale until the answer comes back. That walkie-talkie with fixed button-press phrases is **gRPC** — and the phrasebook both rooms agreed to memorize is the **`.proto` file**.
- The **Payment room** has the cash register on the same walkie-talkie channel: *"charge this card $51.99"* → *"approved"* / *"card declined."*
- If the register says **declined**, the clerk presses the walkie-talkie again: *"un-hold those robots."* That's the **compensation** — the shop never keeps stock held for an unpaid order.
- The **flyers and letters** (order confirmed! new toy in stock!) are **Kafka** — the mailroom. Problem: **we built every department's outgoing mail slot, but never hired the mailroom** — so no letter has ever actually been sent. That's the missing Kafka phase.
- The **Product room** once sneaked into the stockroom to read shelves directly (raw SQL across service boundaries). Now it uses the walkie-talkie ✅ — but still can't *add* new products through it because `InsertStock` RPC doesn't exist on the proto yet. That's a future extension, not a current gap.

### Translation table

| Toy shop | Real thing |
|---|---|
| Clerk (Order room) | Order service `:3003` |
| Stockroom (Inventory room) | Inventory service, gRPC `:50052` |
| Cash register (Payment room) | Payment service, gRPC `:50051` |
| Walkie-talkie | gRPC client/server over HTTP/2 |
| Phrasebook both rooms memorized | `.proto` files in `packages/contracts/proto/` |
| "Hold two robots" | `ReserveStock` RPC |
| "Un-hold them" | `ReleaseReservation` RPC (compensation) |
| "Charge the card" | `AuthorizePayment` RPC |
| "How many on the shelf?" | `GetStock` RPC — Product calls it via gRPC ✅ |
| Clerk who can't write stock directly | Product's create flow skips stock insert until `InsertStock` RPC exists (TODO(6)) |
| The mailroom | Kafka — not built yet |
| Letters that were never sent | All guarded event emitters (`if (KAFKA_BROKERS)`) |

---

## 8. The one-paragraph mental model

**gRPC in this app is the private walkie-talkie network between services that need an answer *right now* — and right now means exactly one place: the checkout saga.** REST is the shop's front door (browser → gateway), gRPC is the back office (Order ↔ Inventory via ReserveStock/ReleaseReservation, Product ↔ Inventory via GetStock, Payment ↔ Order via AuthorizePayment/RefundPayment). **All five RPCs defined by the design are wired and called.** What remains are write-side extensions (`InsertStock`/`ReleaseStock` so Product can create full products) plus retiring the last off-spec shortcut (Order calling Product over raw HTTP) and building the async half so the events our services already emit finally have somewhere to go.

---

*Cross-links: [ARCHITECTURE.md](./ARCHITECTURE.md) · [ARCHITECTURE-ELI5.md](./ARCHITECTURE-ELI5.md) · [TOOLS.md](./TOOLS.md) · [AGENT_SESSION_LOG.md](./AGENT_SESSION_LOG.md)*
