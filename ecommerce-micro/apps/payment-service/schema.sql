-- Payment service schema (payment_db). Idempotency: one payment row per order.
CREATE TABLE IF NOT EXISTS payments (
  payment_id     TEXT PRIMARY KEY,
  order_id       UUID NOT NULL UNIQUE,
  user_id        UUID NOT NULL,
  amount_cents   INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency       CHAR(3) NOT NULL DEFAULT 'USD',
  status         TEXT NOT NULL CHECK (status IN ('AUTHORIZED', 'DECLINED', 'ERROR', 'REFUNDED')),
  failure_reason TEXT NOT NULL DEFAULT '',
  psp_reference  TEXT NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refunds (
  refund_id    TEXT PRIMARY KEY,
  payment_id   TEXT NOT NULL REFERENCES payments (payment_id),
  order_id     UUID NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
