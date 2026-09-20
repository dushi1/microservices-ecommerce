import { Redis } from "ioredis";

/**
 * Cache-aside layer. Read path: check Redis -> miss -> Postgres -> populate.
 * Write path: mutate Postgres -> invalidate affected keys.
 * In phase 3 this endpoint becomes Floci ElastiCache (real Valkey) via env.
 */
export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on("error", (err: Error) => console.warn({ err }, "redis error (serving uncached)"));

const LIST_TTL_SECONDS = 60;
const DETAIL_TTL_SECONDS = 300;

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null; // cache is best-effort; never fail a request because of it
  }
}

export async function setCached(key: string, value: unknown, ttl: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttl);
  } catch {
    // ignore
  }
}

export function listCacheKey(query: Record<string, unknown>): string {
  const normalized = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `products:list:${normalized || "all"}`;
}

export const DETAIL_KEY = (id: string) => `products:detail:${id}`;

export async function invalidateProductCaches(): Promise<void> {
  try {
    const keys = await redis.keys("products:list:*");
    keys.push(...(await redis.keys("products:detail:*")));
    if (keys.length) await redis.del(...keys);
  } catch {
    // ignore
  }
}

export const TTLS = { LIST_TTL_SECONDS, DETAIL_TTL_SECONDS };
