import { databaseHealth } from "@/db";
import { schemaStatus } from "@/db/bootstrap";

export const dynamic = "force-dynamic";

/**
 * Deployment health probe.
 *
 * `ok: false` used to be a single opaque flag, so a broken connection string and
 * a missing table looked exactly the same. Now it reports both layers plus a
 * human readable hint that says what to fix.
 */
export async function GET() {
  const database = await databaseHealth();
  const schema = await schemaStatus();
  const ok = database.ok && schema.ready;

  return Response.json(
    {
      ok,
      database,
      schema,
      ...(ok ? {} : { hint: database.ok ? schema.error : database.error }),
    },
    { status: ok ? 200 : 500 },
  );
}
