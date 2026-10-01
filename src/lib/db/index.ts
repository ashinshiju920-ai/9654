import "server-only";

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { getCloudflareEnv } from "@/lib/cloudflare/runtime";
import * as schema from "./schema";

type AppDatabase = NodePgDatabase<typeof schema>;

let cachedPool: Pool | null = null;
let cachedDb: AppDatabase | null = null;
let cachedConnectionString: string | null = null;

/**
 * Return a Drizzle client for the current runtime.
 *
 * Local Node/VPS development uses DATABASE_URL. Cloudflare Workers use the
 * Hyperdrive binding's connection string when available. The pool is cached per
 * Node process or Worker isolate; Hyperdrive performs the production connection
 * pooling in front of the external PostgreSQL database.
 */
export async function getDb(): Promise<AppDatabase> {
  const connectionString = await getDatabaseConnectionString();

  if (cachedDb && cachedConnectionString === connectionString) {
    return cachedDb;
  }

  cachedPool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  cachedDb = drizzle(cachedPool, { schema });
  cachedConnectionString = connectionString;

  return cachedDb;
}

export async function getPool(): Promise<Pool> {
  await getDb();

  if (!cachedPool) {
    throw new Error("Database pool failed to initialize.");
  }

  return cachedPool;
}

async function getDatabaseConnectionString() {
  const cloudflareEnv = await getCloudflareEnv();
  const hyperdriveConnectionString = cloudflareEnv?.HYPERDRIVE?.connectionString;

  if (hyperdriveConnectionString) {
    return hyperdriveConnectionString;
  }

  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL or HYPERDRIVE binding is required in production.");
  }

  return "postgresql://aylem:aylem@localhost:5432/aylem";
}
