import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * Schema lives in its own PostgreSQL namespace (`DB_SCHEMA`, default
 * `praantodo`) so it never collides with the `public` tables of other apps that
 * share this Supabase project.
 *
 *   npm run db:push     → creates/updates the app tables
 */
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  schemaFilter: [process.env.DB_SCHEMA?.trim() || "praantodo"],
  dbCredentials: {
    url:
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  },
});
