import { NextResponse } from "next/server";
import { databaseUrlHint } from "@/db";
import { handleApi } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ resource: string[] }> };

async function run(req: Request, ctx: Ctx) {
  const { resource } = await ctx.params;
  const url = new URL(req.url);
  try {
    const result = await handleApi(req, resource, url);
    const res = NextResponse.json(result.data ?? null, { status: 200 });
    if (result.token) {
      res.cookies.set(SESSION_COOKIE, result.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: result.maxAge ?? 60 * 60 * 24 * 30,
      });
    }
    if (result.logout) {
      res.cookies.delete(SESSION_COOKIE);
    }
    return res;
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err ?? "");

    // Drizzle wraps driver failures as `Failed query: select ... params: ...`.
    // Showing that to the user was the confusing part of the reported bug:
    // it looks like a bug in the app instead of "the database is not reachable".
    const isDriverError = /^Failed query:/i.test(raw) || Boolean((err as { code?: string } | null)?.code);
    if (isDriverError) {
      console.error("[api] database error:", raw);
    }

    const status =
      err && typeof err === "object" && "status" in err
        ? Number((err as { status?: unknown }).status) || 400
        : isDriverError
          ? 503
          : 400;

    let message: string;
    if (isDriverError) {
      message = `ডেটাবেসে সংযোগ করা যায়নি — ${databaseUrlHint(err)}`;
    } else if (err instanceof Error && err.message !== "UNAUTHENTICATED") {
      message = err.message;
    } else {
      message = "অনুরোধটি সম্পন্ন করা যায়নি";
    }
    return NextResponse.json({ error: message }, { status });
  }
}

export const GET = run;
export const POST = run;
export const PATCH = run;
export const PUT = run;
export const DELETE = run;
