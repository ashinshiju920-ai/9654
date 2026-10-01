import "server-only";

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://aylem:aylem@localhost:5432/aylem";

if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL environment variable is required in production.");
}

/**
 * Connection pool shared across the lifetime of the Next.js server process.
 * `pg.Pool` manages idle connections automatically; max is set conservatively
 * for a single-VPS deployment.
 */
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/**
 * Drizzle ORM client.  Import this wherever server-side database access is
 * needed.  The `schema` import gives typed access to every table and relation.
 */
export const db = drizzle(pool, { schema });

export { pool };
