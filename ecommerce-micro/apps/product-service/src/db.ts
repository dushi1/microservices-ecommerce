import pg from "pg";

/** Product service owns the catalog (product_db). */
export const productPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://dev:dev@localhost:5432/product_db",
  max: 10,
});

export async function checkDb(): Promise<boolean> {
  try {
    await productPool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
