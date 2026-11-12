import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = [
  "/dashboard",
  "/plan",
  "/tasks",
  "/reminders",
  "/log",
  "/reports",
  "/users",
  "/settings",
];

/** Fast guard: no session cookie → login page (the layout re-validates it). */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) return NextResponse.next();

  if (!req.cookies.get("kh_sid")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/plan/:path*", "/tasks/:path*", "/reminders/:path*", "/log/:path*", "/reports/:path*", "/users/:path*", "/settings/:path*"],
};
