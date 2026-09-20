-- Order service schema (order_db): carts, orders, order items.
CREATE TABLE IF NOT EXISTS carts (
  cart_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL UNIQUE,
  currency CHAR(3) NOT NULL DEFAULT 'USD'
);

CREATE TABLE IF NOT EXISTS cart_items (
  cart_id   UUID NOT NULL REFERENCES carts (cart_id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  quantity  INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
  order_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL,
  status       TEXT NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'PAYMENT_FAILED')),
  total_cents  INTEGER NOT NULL CHECK (total_cents >= 0),
  currency     CHAR(3) NOT NULL DEFAULT 'USD',
  payment_id   TEXT,
  reservation_id TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id        UUID NOT NULL REFERENCES orders (order_id) ON DELETE CASCADE,
  product_id      UUID NOT NULL,
  name            TEXT NOT NULL,
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  image_url       TEXT,
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, created_at DESC);
