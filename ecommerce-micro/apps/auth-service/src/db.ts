import pg from "pg";

/**
 * One pool per service, one database per service (see ARCHITECTURE.md §4).
 * In dev this points at the Docker Postgres; in phase 3 it becomes an Floci RDS URL.
 */
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? "postgres://dev:dev@localhost:5432/auth_db",
  max: 10,
});

export async function checkDb(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
