import { NextResponse } from "next/server";
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
    const status =
      err && typeof err === "object" && "status" in err ? Number((err as { status?: unknown }).status) || 400 : 400;
    const message =
      err instanceof Error && err.message !== "UNAUTHENTICATED" ? err.message : "অনুরোধটি সম্পন্ন করা যায়নি";
    return NextResponse.json({ error: message }, { status });
  }
}

export const GET = run;
export const POST = run;
export const PATCH = run;
export const PUT = run;
export const DELETE = run;
