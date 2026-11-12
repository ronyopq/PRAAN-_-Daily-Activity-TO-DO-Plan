import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { ensureSchema } from "@/db/bootstrap";
import { sessions, users, type PublicUser, type User } from "@/db/schema";

export const SESSION_COOKIE = "kh_sid";
const SESSION_DAYS = 30;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  try {
    const [scheme, salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  store.delete(SESSION_COOKIE);
}

export async function getSessionUser(): Promise<PublicUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Server components can render before any API call, so make sure the tables
  // exist here too — otherwise the first page load after a deploy fails.
  await ensureSchema();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || !row.user.active) return null;
  return toPublicUser(row.user);
}

export async function requireUser(): Promise<PublicUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

/** Read the session directly from a request (used by API routes). */
export async function userFromRequest(req: Request): Promise<PublicUser | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(/;\s*/)
    .map((pair) => pair.split("="))
    .find(([key]) => (key ?? "").trim() === SESSION_COOKIE);
  const token = match?.[1]?.trim();
  if (!token) return null;
  await ensureSchema();
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || !row.user.active) return null;
  return toPublicUser(row.user);
}
