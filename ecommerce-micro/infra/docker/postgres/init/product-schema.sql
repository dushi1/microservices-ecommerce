-- Product service owns the catalog. Stock lives in inventory_db (Inventory service).
CREATE TABLE IF NOT EXISTS products (
  product_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency    CHAR(3) NOT NULL DEFAULT 'USD',
  category    TEXT NOT NULL,
  image_url   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products (category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin (to_tsvector('english', name));
