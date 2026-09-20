import type { Request, Response } from "express";
import {
  productListQuerySchema,
  createProductRequestSchema,
  type Product,
  type ProductListResponse,
} from "@ecommerce/contracts";
import { AppError } from "@ecommerce/common";
import { productPool } from "./db.js";
import { inventoryClient } from "./grpc-client.js";
import {
  getCached,
  setCached,
  listCacheKey,
  DETAIL_KEY,
  invalidateProductCaches,
  TTLS,
} from "./cache.js";

interface ProductRow {
  product_id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  category: string;
  image_url: string | null;
}

/** Fetch availability for many products via Inventory gRPC (GetStock). */
async function getAvailability(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();
  const results = await Promise.all(
    productIds.map((id) => inventoryClient.getStock({ productId: id })),
  );
  return new Map(results.map((r) => [r.productId, r.available]));
}

function toProduct(row: ProductRow, available: number): Product {
  return {
    productId: row.product_id,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    currency: row.currency,
    category: row.category,
    imageUrl: row.image_url,
    available,
  };
}

/** GET /api/v1/products — filters + full-text search + sort + pagination, Redis-cached. */
export async function listProducts(req: Request, res: Response) {
  const query = productListQuerySchema.parse(req.query);
  const cacheKey = listCacheKey(query);

  const cached = await getCached<ProductListResponse>(cacheKey);
  if (cached) {
    res.set("X-Cache", "HIT");
    res.json(cached);
    return;
  }

  const conditions: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  const add = (fragment: string, value: unknown) => {
    params.push(value);
    conditions.push(fragment.replace("?", `$${params.length}`));
  };

  if (query.category) add("category = ?", query.category);
  if (query.search) add("to_tsvector('english', name) @@ plainto_tsquery('english', ?)", query.search);
  if (query.minPriceCents !== undefined) add("price_cents >= ?", query.minPriceCents);
  if (query.maxPriceCents !== undefined) add("price_cents <= ?", query.maxPriceCents);

  const orderBy = {
    price_asc: "price_cents ASC",
    price_desc: "price_cents DESC",
    newest: "created_at DESC",
  }[query.sort];

  const countRes = await productPool.query<{ count: string }>(
    `SELECT count(*) FROM products WHERE ${conditions.join(" AND ")}`,
    params,
  );
  const total = Number(countRes.rows[0].count);

  const limitParam = params.push(query.pageSize);
  const offsetParam = params.push((query.page - 1) * query.pageSize);

  const rows = await productPool.query<ProductRow>(
    `SELECT product_id, name, description, price_cents, currency, category, image_url
     FROM products
     WHERE ${conditions.join(" AND ")}
     ORDER BY ${orderBy}
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    params,
  );

  const availability = await getAvailability(rows.rows.map((r) => r.product_id));
  const payload: ProductListResponse = {
    items: rows.rows.map((r) => toProduct(r, availability.get(r.product_id) ?? 0)),
    page: query.page,
    pageSize: query.pageSize,
    total,
  };

  await setCached(cacheKey, payload, TTLS.LIST_TTL_SECONDS);
  res.set("X-Cache", "MISS");
  res.json(payload);
}

/** GET /api/v1/products/{productId} */
export async function getProduct(req: Request, res: Response) {
  const productId = req.params.productId;
  const key = DETAIL_KEY(productId);

  const cached = await getCached<Product>(key);
  if (cached) {
    res.set("X-Cache", "HIT");
    res.json(cached);
    return;
  }

  const found = await productPool.query<ProductRow>(
    "SELECT product_id, name, description, price_cents, currency, category, image_url FROM products WHERE product_id = $1 AND deleted_at IS NULL",
    [productId],
  );
  if (!found.rowCount) {
    throw new AppError("NOT_FOUND", "Product not found");
  }
  const availability = await getAvailability([productId]);
  const product = toProduct(found.rows[0], availability.get(productId) ?? 0);

  await setCached(key, product, TTLS.DETAIL_TTL_SECONDS);
  res.set("X-Cache", "MISS");
  res.json(product);
}

/** POST /api/v1/products (auth) — creates catalog row + stock row, invalidates caches, emits product.created. */
export async function createProduct(req: Request, res: Response) {
  const body = createProductRequestSchema.parse(req.body);

  const inserted = await productPool.query<ProductRow>(
    "INSERT INTO products (name, description, price_cents, currency, category) VALUES ($1, $2, $3, $4, $5) RETURNING product_id, name, description, price_cents, currency, category, image_url",
    [body.name, body.description, body.priceCents, body.currency, body.category],
  );
  const row = inserted.rows[0];

  // Stock row insert becomes an Inventory.InsertStock RPC once that endpoint is added.
  // For now, skip stock creation here (created rows show available=0 until stock arrives).
  // TODO(6): Replace direct DB write with gRPC Inventory.InsertStock.

  await invalidateProductCaches();

  // Event emission is best-effort until Kafka (Floci MSK) is running.
  if (process.env.KAFKA_BROKERS) {
    try {
      const { EventPublisher } = await import("@ecommerce/events");
      const { Kafka } = await import("kafkajs");
      const kafka = new Kafka({ clientId: "product-service", brokers: [process.env.KAFKA_BROKERS] });
      const publisher = new EventPublisher(kafka);
      await publisher.publish("product.created", crypto.randomUUID(), {
        productId: row.product_id,
        name: row.name,
        description: row.description,
        priceCents: row.price_cents,
        currency: row.currency,
        category: row.category,
        imageUrl: row.image_url,
        stock: body.stock,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn({ err }, "failed to emit product.created");
    }
  }

  res.status(201).json(toProduct(row, body.stock));
}
