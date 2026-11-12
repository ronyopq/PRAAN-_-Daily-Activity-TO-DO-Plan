import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

const isRemoteDb =
  !!databaseUrl &&
  (databaseUrl.includes("supabase.co") ||
    databaseUrl.includes("pooler.supabase.com") ||
    databaseUrl.includes("sslmode=require") ||
    (process.env.NODE_ENV === "production" &&
      !databaseUrl.includes("localhost") &&
      !databaseUrl.includes("127.0.0.1")));

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ??
  new Pool({
    connectionString: databaseUrl || "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
    ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);
