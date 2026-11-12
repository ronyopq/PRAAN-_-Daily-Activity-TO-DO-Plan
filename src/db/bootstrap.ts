import { assertDatabaseConfigured, pool } from "@/db";
import { DB_SCHEMA } from "@/db/schema";

/**
 * Make the database ready for first use.
 *
 * Two things used to break login/register with a raw
 * `Failed query: select ... from "users"` driver error:
 *
 *  1. The tables were never created. They only appeared if somebody ran
 *     `npm run db:push` by hand against a machine that could reach Supabase.
 *  2. This Supabase project is shared with another application that also owns a
 *     `users` table in `public`; an unqualified `"users"` can resolve to the
 *     wrong table (or fail) depending on the connection's `search_path`.
 *
 * So the app now owns its own schema (default `praantodo`) and creates its
 * tables itself, idempotently, on the first request after a cold start.
 *
 * Statements run one by one inside savepoints: a table that already exists but
 * belongs to another role raises `42501 must be owner of table ...` when the
 * index is added — that must not take the whole app down, because the table and
 * its data are perfectly usable.
 */
let ready: Promise<void> | null = null;

type Stmt = { sql: string; optional?: boolean };

const statements = (schema: string): Stmt[] => [
  { sql: `create schema if not exists "${schema}"`, optional: true },
  {
    sql: `create table if not exists "${schema}".users (
       id serial primary key,
       name varchar(80) not null,
       email varchar(190) not null unique,
       password_hash text not null,
       role varchar(16) not null default 'user',
       active boolean not null default true,
       color varchar(16) not null default '#007bff',
       notify_before_mins integer not null default 60,
       browser_notifications boolean not null default false,
       auto_generate boolean not null default true,
       created_at timestamptz not null default now()
     )`,
    optional: true,
  },
  {
    sql: `create table if not exists "${schema}".sessions (
       id serial primary key,
       token_hash varchar(80) not null unique,
       user_id integer not null references "${schema}".users(id) on delete cascade,
       expires_at timestamptz not null,
       created_at timestamptz not null default now()
     )`,
    optional: true,
  },
  {
    sql: `create table if not exists "${schema}".categories (
       id serial primary key,
       user_id integer not null references "${schema}".users(id) on delete cascade,
       name varchar(60) not null,
       color varchar(16) not null default '#007bff',
       created_at timestamptz not null default now()
     )`,
    optional: true,
  },
  {
    sql: `create table if not exists "${schema}".plans (
       id serial primary key,
       user_id integer not null references "${schema}".users(id) on delete cascade,
       title varchar(160) not null,
       description text,
       category_id integer references "${schema}".categories(id) on delete set null,
       recurrence varchar(16) not null default 'weekdays',
       weekdays varchar(32) not null default '1,2,3,4,5',
       month_days varchar(96) not null default '1',
       due_time varchar(5),
       month varchar(7) not null,
       estimated_mins integer not null default 30,
       priority varchar(12) not null default 'medium',
       active boolean not null default true,
       created_at timestamptz not null default now()
     )`,
    optional: true,
  },
  {
    sql: `create table if not exists "${schema}".tasks (
       id serial primary key,
       user_id integer not null references "${schema}".users(id) on delete cascade,
       plan_id integer references "${schema}".plans(id) on delete cascade,
       category_id integer references "${schema}".categories(id) on delete set null,
       title varchar(200) not null,
       description text,
       priority varchar(12) not null default 'medium',
       due_date date not null,
       due_time varchar(5),
       status varchar(12) not null default 'pending',
       source varchar(8) not null default 'manual',
       notes text,
       time_spent_mins integer not null default 0,
       snooze_until timestamptz,
       completed_at timestamptz,
       created_at timestamptz not null default now(),
       updated_at timestamptz not null default now()
     )`,
    optional: true,
  },
  {
    sql: `create table if not exists "${schema}".work_logs (
       id serial primary key,
       user_id integer not null references "${schema}".users(id) on delete cascade,
       log_date date not null,
       content text not null,
       minutes integer not null default 0,
       created_at timestamptz not null default now()
     )`,
    optional: true,
  },
  {
    sql: `create unique index if not exists sessions_token_idx on "${schema}".sessions (token_hash)`,
    optional: true,
  },
  {
    sql: `create unique index if not exists categories_user_name_idx on "${schema}".categories (user_id, name)`,
    optional: true,
  },
  {
    sql: `create unique index if not exists tasks_user_plan_due_idx on "${schema}".tasks (user_id, plan_id, due_date)`,
    optional: true,
  },
];

/** Errors that just mean "somebody else already created this object". */
const TOLERATED = new Set([
  "42P07", // duplicate_table / duplicate index
  "42710", // duplicate_object
  "42501", // insufficient_privilege — table exists but belongs to another role
  "23505", // unique_violation while building an index over existing duplicates
  "42P16", // invalid_table_definition
  "23514", // check_violation
]);

async function run() {
  assertDatabaseConfigured();

  // Each DDL step is its own transaction. One statement failing (a table that
  // already exists but belongs to another role, an index that cannot be built)
  // must not roll back the tables that were just created, and PostgreSQL allows
  // `create schema/table/index if not exists` to be safely retried this way.
  const skipped: string[] = [];
  for (const { sql, optional } of statements(DB_SCHEMA)) {
    try {
      await pool.query(sql);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code ?? "";
      if (optional && (TOLERATED.has(code) || code === "3F000" || code === "42P01")) {
        skipped.push(code);
        continue;
      }
      throw err;
    }
  }
  if (skipped.length) {
    console.warn(`[db] schema bootstrap skipped ${skipped.length} optional step(s):`, skipped.join(", "));
  }

  // Hard requirement: the app tables must be readable. If they are not, fail
  // loudly with a message that points at the real cause, plus the exact SQL a
  // project admin can paste into the Supabase SQL editor to fix it.
  try {
    await pool.query(`select 1 from "${DB_SCHEMA}".users limit 1`);
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code === "3F000") {
      throw new Error(
        `"${DB_SCHEMA}" স্কিমা এখনো তৈরি হয়নি এবং ডেটাবেস ইউজার নিজে স্কিমা বানাতে পারছে না — Supabase SQL editor-এ চালান: create schema if not exists "${DB_SCHEMA}";`,
      );
    }
    if (e.code === "42501") {
      throw new Error(
        `"${DB_SCHEMA}".users টেবিলে SELECT অনুমতি নেই — Supabase SQL editor-এ চালান: grant usage on schema "${DB_SCHEMA}" to ${
          (await currentRole()) ?? "<db_user>"
        }; grant select, insert, update, delete on all tables in schema "${DB_SCHEMA}" to ${
          (await currentRole()) ?? "<db_user>"
        };`,
      );
    }
    throw new Error(
      `ডেটাবেসের "${DB_SCHEMA}".users টেবিলে ঢোকা যাচ্ছে না (${e.message ?? "unknown error"})`,
    );
  }
}

/** Name of the role the app connects as, if the server lets us read it. */
async function currentRole(): Promise<string | null> {
  try {
    const { rows } = await pool.query<{ role: string }>("select current_user as role");
    return rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

/** Resolves once the schema exists; retries on the next call after a failure. */
export function ensureSchema(): Promise<void> {
  if (!ready) {
    ready = run().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

/** True when the error looks like "the app tables are not there yet". */
export function isMissingSchemaError(err: unknown) {
  const code = (err as { code?: string } | null)?.code;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return (
    code === "42P01" || // undefined_table
    code === "3F000" || // invalid_schema_name
    code === "42703" || // undefined_column
    /relation .* does not exist/i.test(message) ||
    /schema .* does not exist/i.test(message)
  );
}

/** Retries a query once after (re)building the schema. */
export async function withSchema<T>(query: () => Promise<T>): Promise<T> {
  await ensureSchema();
  try {
    return await query();
  } catch (err) {
    if (!isMissingSchemaError(err)) throw err;
    ready = null;
    await ensureSchema();
    return query();
  }
}

/** Used by /api/health — never throws. */
export async function schemaStatus() {
  try {
    await ensureSchema();
    const { rows } = await pool.query(
      `select count(*)::int as count from information_schema.tables where table_schema = $1`,
      [DB_SCHEMA],
    );
    return { ready: true as const, schema: DB_SCHEMA, tables: Number(rows[0]?.count ?? 0) };
  } catch (err) {
    return {
      ready: false as const,
      schema: DB_SCHEMA,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
