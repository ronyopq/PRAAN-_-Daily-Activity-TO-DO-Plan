import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { DB_SCHEMA } from "@/db/schema";

/**
 * Resolve the connection string.
 *
 * Order matters: DATABASE_URL → POSTGRES_URL → POSTGRES_PRISMA_URL →
 * POSTGRES_URL_NON_POOLING. Vercel/Supabase integrations sometimes only set the
 * POSTGRES_* variants, and a build made before DATABASE_URL existed fell back to
 * `postgresql://postgres:postgres@127.0.0.1:5432/app_db` — a localhost database
 * that does not exist inside a serverless function. That is the failure mode
 * behind `Failed query: select ... from "users"` on login and register.
 */
function resolveDatabaseUrl(): string | undefined {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
  ];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    // strip quotes people copy from the dashboard by accident
    if (value) return value.replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const rawDatabaseUrl = resolveDatabaseUrl();

/**
 * `pg` 8.20 treats `sslmode=require` as an alias for `verify-full`, which fails
 * in runtimes that do not ship the Supabase CA bundle. SSL is passed explicitly
 * below instead, so the flag is removed from the URL.
 */
function stripSslMode(url: string) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    return url.replace(/[?&]sslmode=[^&]*/g, "");
  }
}

const databaseUrl = rawDatabaseUrl ? stripSslMode(rawDatabaseUrl) : undefined;

/** true when we point at a hosted database (Supabase, Neon, RDS …) */
function isRemote(url: string) {
  return (
    url.includes("supabase.co") ||
    url.includes("supabase.com") ||
    url.includes("pooler") ||
    (process.env.NODE_ENV === "production" &&
      !url.includes("localhost") &&
      !url.includes("127.0.0.1"))
  );
}

/**
 * Placeholder used only when no connection string is configured.
 *
 * `new Pool()` never opens a socket — connection happens on the first query —
 * so building the pool at module scope is safe during `next build`. Keeping a
 * real Pool instance here (instead of a lazy proxy) matters because Next imports
 * every route to collect page data and touches these exports.
 */
const PLACEHOLDER_URL = "postgresql://missing:missing@127.0.0.1:5432/missing";

const globalForDb = globalThis as typeof globalThis & {
  __praantodoPool?: Pool;
};

function createPool(): Pool {
  const url = databaseUrl ?? PLACEHOLDER_URL;
  const pool = new Pool({
    connectionString: url,
    ssl: databaseUrl && isRemote(url) ? { rejectUnauthorized: false } : undefined,
    // Serverless functions are short lived and the pooler already multiplexes,
    // so keep the client pool tiny.
    max: process.env.VERCEL ? 3 : 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 15_000,
    maxLifetimeSeconds: 300,
    keepAlive: true,
    application_name: "praantodo",
  });

  // Surface pool level errors instead of letting them crash the function.
  pool.on("error", (err) => {
    console.error("[db] idle client error:", err.message);
  });

  return pool;
}

export const pool: Pool = globalForDb.__praantodoPool ?? createPool();

// Reuse the pool across hot reloads / warm lambda invocations.
globalForDb.__praantodoPool = pool;

// Table objects from `@/db/schema` are bound to the app schema, so Drizzle emits
// fully qualified names (`"praantodo"."users"`) with no search_path dependency.
export const db = drizzle(pool);

/** Throws a readable error when the app has no database configured. */
export function assertDatabaseConfigured() {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL সেট করা নেই — Vercel → Settings → Environment Variables-এ Supabase-এর connection string যোগ করে আবার deploy করুন",
    );
  }
}

/** Lightweight probe used by /api/health — never throws. */
export async function databaseHealth() {
  if (!databaseUrl) {
    return {
      ok: false as const,
      error: "DATABASE_URL is not set",
      expectedSchema: DB_SCHEMA,
      hasUrl: false,
      hint: databaseUrlHint(new Error("missing url")),
    };
  }
  try {
    const res = await pool.query(
      "select current_schema() as schema, current_database() as db, version() as version",
    );
    return {
      ok: true as const,
      schema: String(res.rows[0]?.schema ?? "—"),
      database: String(res.rows[0]?.db ?? "—"),
      version: String(res.rows[0]?.version ?? "").split(",")[0],
      expectedSchema: DB_SCHEMA,
      hasUrl: true,
    };
  } catch (err) {
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : String(err),
      code: (err as { code?: string } | null)?.code ?? null,
      expectedSchema: DB_SCHEMA,
      hasUrl: true,
      hint: databaseUrlHint(err),
    };
  }
}

/** Turns a low level pg error into something a human can act on. */
export function databaseUrlHint(err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const code = (err as { code?: string } | null)?.code ?? "";
  if (!rawDatabaseUrl) {
    return "DATABASE_URL নেই — Vercel → Settings → Environment Variables-এ যোগ করে আবার deploy করুন";
  }
  if (rawDatabaseUrl.includes("[YOUR-PASSWORD]") || rawDatabaseUrl.includes("[PROJECT-REF]")) {
    return "DATABASE_URL-এ এখনো placeholder আছে — আসল পাসওয়ার্ড ও project-ref বসান";
  }
  if (/password authentication failed/i.test(message) || code === "28P01") {
    return "ডেটাবেসের পাসওয়ার্ড ভুল — Supabase → Settings → Database থেকে নতুন connection string নিন";
  }
  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return "ডেটাবেসের হোস্ট পাওয়া যাচ্ছে না — connection string-এর হোস্ট ঠিক করুন";
  }
  if (/timeout|ETIMEDOUT|ECONNREFUSED|ECONNRESET|terminated unexpectedly/i.test(message)) {
    return "ডেটাবেসে পৌঁছানো যাচ্ছে না — Supabase প্রজেক্ট চালু আছে কিনা এবং pooler হোস্ট:6543 ঠিক আছে কিনা দেখুন";
  }
  if (/self.signed|certificate|SSL/i.test(message)) {
    return "TLS সমস্যা — connection string-এ sslmode=require রাখুন";
  }
  if (/does not exist/i.test(message)) {
    return "টেবিল/স্কিমা পাওয়া যাচ্ছে না — অ্যাপ নিজে স্কিমা বানাতে পারছে না, DB_SCHEMA ও DATABASE_URL যাচাই করুন";
  }
  return "DATABASE_URL যাচাই করে Vercel-এ আবার deploy করুন";
}
