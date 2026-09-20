-- Inventory service owns stock. Rows reference products seeded in product_db (fixed UUIDs).
CREATE TABLE IF NOT EXISTS stock (
  product_id UUID PRIMARY KEY,
  available  INTEGER NOT NULL DEFAULT 0 CHECK (available >= 0),
  reserved   INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservations (
  reservation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL UNIQUE,
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RELEASED', 'CONSUMED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reservation_items (
  reservation_id UUID REFERENCES reservations (reservation_id) ON DELETE CASCADE,
  product_id     UUID REFERENCES stock (product_id),
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (reservation_id, product_id)
);
