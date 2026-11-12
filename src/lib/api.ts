import { createHash } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db, databaseUrlHint } from "@/db";
import { ensureSchema, isMissingSchemaError } from "@/db/bootstrap";
import { DB_SCHEMA, categories, plans, sessions, tasks, users, workLogs, type PublicUser } from "@/db/schema";
import { hashPassword, startSession, toPublicUser, userFromRequest, verifyPassword } from "@/lib/auth";
import {
  addDays,
  currentMonth,
  monthDates,
  monthOf,
  pad2,
  planMatchesDate,
  toISO,
  type Priority,
  type Recurrence,
  type TaskStatus,
} from "@/lib/utils";

/* ------------------------------- helpers -------------------------------- */

type Body = Record<string, unknown>;

class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const str = (b: Body, key: string, max = 200) => {
  const v = b[key];
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};
const num = (b: Body, key: string, fallback: number | null = null) => {
  const v = b[key];
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};
const bool = (b: Body, key: string, fallback = false) => {
  const v = b[key];
  return typeof v === "boolean" ? v : fallback;
};
const dateStr = (b: Body, key: string) => {
  const v = str(b, key, 10);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
const timeStr = (b: Body, key: string) => {
  const v = str(b, key, 5);
  return v && /^\d{2}:\d{2}$/.test(v) ? v : null;
};
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const STATUSES: TaskStatus[] = ["pending", "progress", "done", "skipped"];
const RECURRENCES: Recurrence[] = ["daily", "weekdays", "weekend", "weekly", "monthly"];

const taskSelect = {
  id: tasks.id,
  userId: tasks.userId,
  planId: tasks.planId,
  categoryId: tasks.categoryId,
  title: tasks.title,
  description: tasks.description,
  priority: tasks.priority,
  dueDate: tasks.dueDate,
  dueTime: tasks.dueTime,
  status: tasks.status,
  source: tasks.source,
  notes: tasks.notes,
  timeSpentMins: tasks.timeSpentMins,
  snoozeUntil: tasks.snoozeUntil,
  completedAt: tasks.completedAt,
  categoryName: categories.name,
  categoryColor: categories.color,
};

/** only columns that live on the tasks table (safe for UPDATE ... RETURNING) */
const { categoryName: _cn, categoryColor: _cc, ...taskOwnSelect } = taskSelect;

const withCategory = db
  .select(taskSelect)
  .from(tasks)
  .leftJoin(categories, eq(categories.id, tasks.categoryId));

function normalizePriority(value: string | null): Priority {
  return (PRIORITIES as string[]).includes(value ?? "") ? (value as Priority) : "medium";
}
function normalizeStatus(value: string | null): TaskStatus {
  return (STATUSES as string[]).includes(value ?? "") ? (value as TaskStatus) : "pending";
}
function normalizeRecurrence(value: string | null): Recurrence {
  return (RECURRENCES as string[]).includes(value ?? "") ? (value as Recurrence) : "weekdays";
}

/* ------------------------------- auth api -------------------------------- */

function readSessionCookie(req?: Request) {
  if (!req) return null;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(/;\s*/)
    .map((pair) => pair.split("="))
    .find(([key]) => (key ?? "").trim() === "kh_sid");
  return match?.[1]?.trim() ?? null;
}

async function handleAuth(action: string, body: Body, req?: Request) {
  if (action === "login") {
    const email = str(body, "email", 190)?.toLowerCase();
    const password = str(body, "password", 200);
    if (!email || !password) throw new ApiError("ইমেইল ও পাসওয়ার্ড দুটোই দরকার");
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new ApiError("ইমেইল বা পাসওয়ার্ড ভুল হয়েছে", 401);
    }
    if (!user.active) throw new ApiError("আপনার অ্যাকাউন্ট বন্ধ করা আছে — অ্যাডমিনকে জানান", 403);
    const { token } = await startSession(user.id);
    return { data: toPublicUser(user), token, maxAge: 60 * 60 * 24 * 30 };
  }

  if (action === "register") {
    const name = str(body, "name", 80);
    const email = str(body, "email", 190)?.toLowerCase();
    const password = str(body, "password", 200);
    if (!name || !email || !password) throw new ApiError("নাম, ইমেইল ও পাসওয়ার্ড — সব পূরণ করুন");
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) throw new ApiError("সঠিক ইমেইল দিন");
    if (password.length < 6) throw new ApiError("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    const clash = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (clash.length) throw new ApiError("এই ইমেইলে আগেই একাউন্ট খোলা হয়েছে", 409);
    const count = await db.select({ c: sql<number>`count(*)::int` }).from(users);
    const isFirst = (count[0]?.c ?? 0) === 0;
    const palette = ["#007bff", "#28a745", "#dc3545", "#17a2b8", "#6f42c1", "#e83e8c"];
    const [created] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: hashPassword(password),
        role: isFirst ? "admin" : "user",
        color: palette[(count[0]?.c ?? 0) % palette.length],
      })
      .returning();
    await defaultCategories(created.id);
    const { token } = await startSession(created.id);
    return { data: toPublicUser(created), token, maxAge: 60 * 60 * 24 * 30 };
  }

  if (action === "logout") {
    const token = readSessionCookie(req);
    if (token) await db.delete(sessions).where(eq(sessions.tokenHash, createHash("sha256").update(token).digest("hex")));
    return { data: { ok: true }, logout: true };
  }

  throw new ApiError("অপরিচিত রিকোয়েস্ট", 404);
}

async function defaultCategories(userId: number) {
  const defaults = [
    ["অফিসের কাজ", "#007bff"],
    ["পার্সোনাল", "#28a745"],
    ["পড়াশোনা", "#6f42c1"],
    ["ঘরের কাজ", "#fd7e14"],
    ["স্বাস্থ্য", "#17a2b8"],
  ] as const;
  for (const [name, color] of defaults) {
    await db.insert(categories).values({ userId, name, color }).onConflictDoNothing();
  }
}

/* ------------------------------- task api -------------------------------- */

async function listTasks(user: PublicUser, sp: URLSearchParams) {
  const conds = [eq(tasks.userId, user.id)];
  const date = sp.get("date");
  const month = sp.get("month");
  const from = sp.get("from");
  const to = sp.get("to");
  const status = sp.get("status");
  const priority = sp.get("priority");
  const category = sp.get("categoryId");
  const q = sp.get("q");
  const view = sp.get("view");
  const today = sp.get("today") ?? toISO(new Date());

  if (date) conds.push(eq(tasks.dueDate, date));
  if (month) conds.push(likeMonth(month));
  if (from) conds.push(gte(tasks.dueDate, from));
  if (to) conds.push(lte(tasks.dueDate, to));
  if (status && status !== "all") conds.push(eq(tasks.status, normalizeStatus(status)));
  if (priority && priority !== "all") conds.push(eq(tasks.priority, normalizePriority(priority)));
  if (category && category !== "all") conds.push(eq(tasks.categoryId, Number(category)));
  const openOnly = sql`${tasks.status} in ('pending', 'progress')`;
  if (view === "open") conds.push(openOnly);
  if (view === "overdue") {
    conds.push(openOnly, sql`${tasks.dueDate} < ${today}`);
  }
  if (view === "today") conds.push(eq(tasks.dueDate, today));
  if (view === "upcoming") {
    conds.push(openOnly, gte(tasks.dueDate, addDays(today, 1)), lte(tasks.dueDate, addDays(today, 14)));
  }
  if (q) conds.push(sql`(${tasks.title} ilike ${`%${q}%`} or ${tasks.description} ilike ${`%${q}%`})`);

  const rows = await withCategory
    .where(and(...conds))
    .orderBy(asc(tasks.dueDate), asc(tasks.dueTime), desc(tasks.priority), asc(tasks.id))
    .limit(600);
  return { data: rows };
}

function likeMonth(month: string) {
  return sql`to_char(${tasks.dueDate}, 'YYYY-MM') = ${month}`;
}

async function createTask(user: PublicUser, body: Body) {
  const title = str(body, "title", 200);
  if (!title) throw new ApiError("কাজের নাম লিখুন");
  const dueDate = dateStr(body, "dueDate") ?? toISO(new Date());
  const [row] = await db
    .insert(tasks)
    .values({
      userId: user.id,
      title,
      description: str(body, "description", 2000),
      priority: normalizePriority(str(body, "priority", 12)),
      dueDate,
      dueTime: timeStr(body, "dueTime"),
      categoryId: num(body, "categoryId"),
      status: normalizeStatus(str(body, "status", 12)),
      source: str(body, "source", 8) === "plan" ? "plan" : "manual",
      notes: str(body, "notes", 4000),
      timeSpentMins: Math.max(0, num(body, "timeSpentMins", 0) ?? 0),
    })
    .returning();
  return { data: row };
}

async function patchTask(user: PublicUser, id: number, body: Body) {
  const patch: Record<string, unknown> = {};
  const title = str(body, "title", 200);
  if ("title" in body) patch.title = title ?? "কাজ";
  if ("description" in body) patch.description = str(body, "description", 2000);
  if ("priority" in body) patch.priority = normalizePriority(str(body, "priority", 12));
  if ("status" in body) {
    const status = normalizeStatus(str(body, "status", 12));
    patch.status = status;
    patch.completedAt = status === "done" ? new Date() : null;
  }
  if ("notes" in body) patch.notes = str(body, "notes", 4000);
  if ("timeSpentMins" in body) patch.timeSpentMins = Math.max(0, num(body, "timeSpentMins", 0) ?? 0);
  if ("dueDate" in body) patch.dueDate = dateStr(body, "dueDate") ?? toISO(new Date());
  if ("dueTime" in body) patch.dueTime = timeStr(body, "dueTime");
  if ("categoryId" in body) patch.categoryId = num(body, "categoryId");
  if ("snoozeUntil" in body) patch.snoozeUntil = str(body, "snoozeUntil", 40) ? new Date(String(body.snoozeUntil)) : null;
  if ("planId" in body) patch.planId = num(body, "planId");
  patch.updatedAt = new Date();

  let row: typeof tasks.$inferSelect | undefined;
  try {
    [row] = await db
      .update(tasks)
      .set(patch)
      .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
      .returning();
  } catch (err) {
    if (err && typeof err === "object" && (err as { code?: string }).code === "23505") {
      throw new ApiError("এই তারিখে ওই প্ল্যানের কাজ আগেই তৈরি আছে — ডুপ্লিকেট যোগ করা হলো না", 409);
    }
    throw err;
  }
  if (!row) throw new ApiError("কাজ খুঁজে পাওয়া যায়নি", 404);
  return { data: row };
}

async function completeTask(user: PublicUser, body: Body) {
  const id = num(body, "id", 0) ?? 0;
  const status = normalizeStatus(str(body, "status", 12));
  const now = new Date();
  const patch: Record<string, unknown> = { status, updatedAt: now };
  if (status === "done") patch.completedAt = now;
  else patch.completedAt = null;
  const note = "notes" in body ? str(body, "notes", 4000) : undefined;
  if (note !== undefined) patch.notes = note;
  if ("timeSpentMins" in body) patch.timeSpentMins = Math.max(0, num(body, "timeSpentMins", 0) ?? 0);

  const [row] = await db
    .update(tasks)
    .set(patch)
    .where(and(eq(tasks.id, id), eq(tasks.userId, user.id)))
    .returning(taskOwnSelect);
  if (!row) throw new ApiError("কাজ খুঁজে পাওয়া যায়নি", 404);

  // auto journal entry in the daily work log
  if (status === "done") {
    const note = typeof row.notes === "string" ? row.notes.trim() : "";
    const content = note ? `${row.title} — ${note}` : row.title;
    await db.insert(workLogs).values({
      userId: user.id,
      logDate: row.dueDate,
      content,
      minutes: Math.max(0, num(body, "timeSpentMins", 0) ?? 0),
    });
  }
  return { data: row };
}

async function bulkTasks(user: PublicUser, body: Body) {
  const ids = Array.isArray(body.ids) ? (body.ids as unknown[]).map((v) => Number(v)).filter(Number.isFinite) : [];
  if (!ids.length) throw new ApiError("কোনো কাজ সিলেক্ট করা হয়নি");
  const action = str(body, "action", 20) ?? "delete";
  const where = and(inArray(tasks.id, ids), eq(tasks.userId, user.id));
  if (action === "delete") {
    await db.delete(tasks).where(where);
  } else if (action === "done") {
    await db.update(tasks).set({ status: "done", completedAt: new Date(), updatedAt: new Date() }).where(where);
  } else if (action === "reopen") {
    await db.update(tasks).set({ status: "pending", completedAt: null, updatedAt: new Date() }).where(where);
  } else if (action === "reschedule") {
    const toDate = dateStr(body, "toDate") ?? toISO(new Date());
    const rows = await db.select({ id: tasks.id, planId: tasks.planId }).from(tasks).where(where);
    let moved = 0;
    let skipped = 0;
    for (const row of rows) {
      if (row.planId !== null) {
        const clash = await db
          .select({ id: tasks.id })
          .from(tasks)
          .where(and(eq(tasks.userId, user.id), eq(tasks.planId, row.planId), eq(tasks.dueDate, toDate)))
          .limit(1);
        if (clash.length) {
          skipped += 1;
          continue;
        }
      }
      await db.update(tasks).set({ dueDate: toDate, snoozeUntil: null, updatedAt: new Date() }).where(eq(tasks.id, row.id));
      moved += 1;
    }
    return { data: { ok: true, count: moved, skipped } };
  }
  return { data: { ok: true, count: ids.length } };
}

/* ------------------------------- plan api -------------------------------- */

async function listPlans(user: PublicUser, sp: URLSearchParams) {
  const month = sp.get("month") ?? currentMonth();
  const rows = await db
    .select({
      id: plans.id,
      title: plans.title,
      description: plans.description,
      categoryId: plans.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      recurrence: plans.recurrence,
      weekdays: plans.weekdays,
      monthDays: plans.monthDays,
      dueTime: plans.dueTime,
      month: plans.month,
      estimatedMins: plans.estimatedMins,
      priority: plans.priority,
      active: plans.active,
    })
    .from(plans)
    .leftJoin(categories, eq(categories.id, plans.categoryId))
    .where(and(eq(plans.userId, user.id), eq(plans.month, month)))
    .orderBy(desc(plans.id));

  const taskRows = await db
    .select({ planId: tasks.planId, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), isNotNull(tasks.planId), likeMonth(month)));

  const statsMap = new Map<number, { total: number; done: number }>();
  for (const row of taskRows) {
    if (row.planId === null) continue;
    const cur = statsMap.get(row.planId) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (row.status === "done") cur.done += 1;
    statsMap.set(row.planId, cur);
  }

  const dates = monthDates(month);
  const data = rows.map((row) => ({
    ...row,
    hitsThisMonth: dates.filter((d) => planMatchesDate(row, d)).length,
    doneThisMonth: statsMap.get(row.id)?.done ?? 0,
  }));
  return { data, month };
}

async function createPlan(user: PublicUser, body: Body) {
  const title = str(body, "title", 160);
  if (!title) throw new ApiError("প্ল্যানের নাম লিখুন");
  const month = str(body, "month", 7) ?? currentMonth();
  const row = await db
    .insert(plans)
    .values({
      userId: user.id,
      title,
      description: str(body, "description", 2000),
      categoryId: num(body, "categoryId"),
      recurrence: normalizeRecurrence(str(body, "recurrence", 16)),
      weekdays: str(body, "weekdays", 32) ?? "1,2,3,4,5",
      monthDays: str(body, "monthDays", 96) ?? "1",
      dueTime: timeStr(body, "dueTime"),
      month: /^\d{4}-\d{2}$/.test(month) ? month : currentMonth(),
      estimatedMins: Math.max(0, num(body, "estimatedMins", 30) ?? 30),
      priority: normalizePriority(str(body, "priority", 12)),
      active: bool(body, "active", true),
    })
    .returning();
  return { data: row[0] };
}

async function patchPlan(user: PublicUser, id: number, body: Body) {
  const patch: Record<string, unknown> = {};
  const title = str(body, "title", 160);
  if (title) patch.title = title;
  if ("description" in body) patch.description = str(body, "description", 2000);
  if ("categoryId" in body) patch.categoryId = num(body, "categoryId");
  if ("recurrence" in body) patch.recurrence = normalizeRecurrence(str(body, "recurrence", 16));
  if ("weekdays" in body) patch.weekdays = str(body, "weekdays", 32) ?? "";
  if ("monthDays" in body) patch.monthDays = str(body, "monthDays", 96) ?? "";
  if ("dueTime" in body) patch.dueTime = timeStr(body, "dueTime");
  if ("month" in body) {
    const month = str(body, "month", 7);
    if (month && /^\d{4}-\d{2}$/.test(month)) patch.month = month;
  }
  if ("estimatedMins" in body) patch.estimatedMins = Math.max(0, num(body, "estimatedMins", 30) ?? 30);
  if ("priority" in body) patch.priority = normalizePriority(str(body, "priority", 12));
  if ("active" in body) patch.active = bool(body, "active", true);
  const [row] = await db.update(plans).set(patch).where(and(eq(plans.id, id), eq(plans.userId, user.id))).returning();
  if (!row) throw new ApiError("প্ল্যান খুঁজে পাওয়া যায়নি", 404);
  return { data: row };
}

/* --------------------------- task generation ------------------------------ */

async function generate(user: PublicUser, body: Body) {
  const fromDate = dateStr(body, "fromDate") ?? toISO(new Date());
  const toDate = dateStr(body, "toDate") ?? fromDate;
  if (toDate < fromDate) throw new ApiError("শেষ তারিখ শুরুর আগে হতে পারে না");

  const allPlans = await db.select().from(plans).where(and(eq(plans.userId, user.id), eq(plans.active, true)));
  const existing = await db
    .select({ planId: tasks.planId, dueDate: tasks.dueDate })
    .from(tasks)
    .where(and(eq(tasks.userId, user.id), isNotNull(tasks.planId), gte(tasks.dueDate, fromDate), lte(tasks.dueDate, toDate)));
  const seen = new Set(existing.map((r) => `${r.planId}|${r.dueDate}`));

  const values: (typeof tasks.$inferInsert)[] = [];
  let cursor = fromDate;
  let guard = 0;
  while (cursor <= toDate && guard < 370) {
    const month = monthOf(cursor);
    for (const p of allPlans) {
      if (p.month !== month) continue;
      if (!planMatchesDate({ recurrence: p.recurrence, weekdays: p.weekdays, monthDays: p.monthDays }, cursor)) continue;
      const key = `${p.id}|${cursor}`;
      if (seen.has(key)) continue;
      seen.add(key);
      values.push({
        userId: user.id,
        planId: p.id,
        categoryId: p.categoryId,
        title: p.title,
        description: p.description,
        priority: p.priority,
        dueDate: cursor,
        dueTime: p.dueTime,
        status: "pending",
        source: "plan",
      });
    }
    cursor = addDays(cursor, 1);
    guard += 1;
  }

  let created: { id: number; title: string; dueDate: string }[] = [];
  if (values.length) {
    created = await db
      .insert(tasks)
      .values(values)
      .onConflictDoNothing()
      .returning({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate });
  }
  return { data: { requested: values.length, created: created.length, tasks: created } };
}

/* ---------------------------- reminder center ---------------------------- */

async function reminders(user: PublicUser, sp: URLSearchParams) {
  const today = sp.get("today") ?? toISO(new Date());
  const now = new Date();
  const nowHM = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const rows = await withCategory
    .where(
      and(
        eq(tasks.userId, user.id),
        sql`${tasks.status} in ('pending', 'progress')`,
        lte(tasks.dueDate, addDays(today, 14)),
      ),
    )
    .orderBy(asc(tasks.dueDate), asc(tasks.dueTime))
    .limit(300);

  const overdue: typeof rows = [];
  const dueToday: typeof rows = [];
  const upcoming: typeof rows = [];
  for (const row of rows) {
    if (row.dueDate < today) overdue.push(row);
    else if (row.dueDate === today) dueToday.push(row);
    else upcoming.push(row);
  }

  const dueNow = dueToday.filter(
    (r) => !r.dueTime || r.dueTime <= nowHM,
  );

  // today's plans that are scheduled but not generated yet
  const todaysPlans = (await db.select().from(plans).where(and(eq(plans.userId, user.id), eq(plans.active, true))))
    .filter((p) => monthOf(today) === p.month && planMatchesDate({ recurrence: p.recurrence, weekdays: p.weekdays, monthDays: p.monthDays }, today))
    .map((p) => ({ id: p.id, title: p.title, dueTime: p.dueTime, month: p.month }));

  const generatedForToday = new Set(rows.filter((r) => r.dueDate === today && r.planId).map((r) => r.planId));
  const missingPlanTasks = todaysPlans.filter((p) => !generatedForToday.has(p.id));

  return {
    data: {
      overdue: overdue.slice(0, 40),
      dueToday,
      dueNow,
      upcoming: upcoming.slice(0, 40),
      missingPlans: missingPlanTasks,
      counts: {
        overdue: overdue.length,
        dueToday: dueToday.length,
        upcoming: upcoming.length,
        alert: overdue.length + dueNow.length,
      },
    },
  };
}

/* --------------------------------- logs ---------------------------------- */

async function listLogs(user: PublicUser, sp: URLSearchParams) {
  const date = sp.get("date");
  const month = sp.get("month");
  const conds = [eq(workLogs.userId, user.id)];
  if (date) conds.push(eq(workLogs.logDate, date));
  if (month) conds.push(sql`to_char(${workLogs.logDate}, 'YYYY-MM') = ${month}`);
  const rows = await db.select().from(workLogs).where(and(...conds)).orderBy(desc(workLogs.logDate), desc(workLogs.id)).limit(400);
  return { data: rows };
}

/* ------------------------------- reports --------------------------------- */

async function reports(user: PublicUser, sp: URLSearchParams) {
  const month = sp.get("month") ?? currentMonth();
  const rows = await db
    .select(taskSelect)
    .from(tasks)
    .leftJoin(categories, eq(categories.id, tasks.categoryId))
    .where(and(eq(tasks.userId, user.id), likeMonth(month)));
  const logs = await db
    .select()
    .from(workLogs)
    .where(and(eq(workLogs.userId, user.id), sql`to_char(${workLogs.logDate}, 'YYYY-MM') = ${month}`));

  const dates = monthDates(month);
  const perDay = dates.map((d) => {
    const dayRows = rows.filter((r) => r.dueDate === d);
    return {
      date: d,
      total: dayRows.length,
      done: dayRows.filter((r) => r.status === "done").length,
      overdue: dayRows.filter((r) => r.status !== "done" && d < toISO(new Date())).length,
      minutes: dayRows.reduce((acc, r) => acc + (r.timeSpentMins || 0), 0),
    };
  });

  const byCat = new Map<string, { name: string; color: string; total: number; done: number; minutes: number }>();
  for (const r of rows) {
    const key = String(r.categoryId ?? 0);
    const entry = byCat.get(key) ?? {
      name: r.categoryName ?? "শ্রেণিবিহীন",
      color: r.categoryColor ?? "#6c757d",
      total: 0,
      done: 0,
      minutes: 0,
    };
    entry.total += 1;
    if (r.status === "done") entry.done += 1;
    entry.minutes += r.timeSpentMins || 0;
    byCat.set(key, entry);
  }

  const total = rows.length;
  const done = rows.filter((r) => r.status === "done").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;
  const minutes = rows.reduce((acc, r) => acc + (r.timeSpentMins || 0), 0);

  return {
    data: {
      month,
      totals: {
        total,
        done,
        skipped,
        pending: total - done - skipped,
        minutes,
        rate: total ? Math.round((done / total) * 100) : 0,
        logEntries: logs.length,
        logMinutes: logs.reduce((acc, l) => acc + (l.minutes || 0), 0),
      },
      perDay,
      perCategory: [...byCat.values()].sort((a, b) => b.total - a.total),
      recentLogs: logs.slice(0, 30),
    },
  };
}

/* ------------------------------ categories -------------------------------- */

async function saveCategory(user: PublicUser, body: Body, id?: number) {
  const name = str(body, "name", 60);
  const color = str(body, "color", 16) ?? "#007bff";
  if (!name) throw new ApiError("শ্রেণির নাম লিখুন");
  if (id) {
    const [row] = await db
      .update(categories)
      .set({ name, color })
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .returning();
    if (!row) throw new ApiError("শ্রেণি খুঁজে পাওয়া যায়নি", 404);
    return { data: row };
  }
  const [row] = await db.insert(categories).values({ userId: user.id, name, color }).onConflictDoNothing().returning();
  return { data: row };
}

/* -------------------------------- profile -------------------------------- */

async function updateProfile(user: PublicUser, body: Body) {
  const patch: Record<string, unknown> = {};
  const name = str(body, "name", 80);
  if (name) patch.name = name;
  const email = str(body, "email", 190)?.toLowerCase();
  if (email) patch.email = email;
  if ("notifyBeforeMins" in body) patch.notifyBeforeMins = Math.max(0, Math.min(1440, num(body, "notifyBeforeMins", 60) ?? 60));
  if ("browserNotifications" in body) patch.browserNotifications = bool(body, "browserNotifications");
  if ("autoGenerate" in body) patch.autoGenerate = bool(body, "autoGenerate");
  if ("color" in body) patch.color = str(body, "color", 16) ?? "#007bff";
  if (Object.keys(patch).length === 0) return { data: user };
  const [row] = await db.update(users).set(patch).where(eq(users.id, user.id)).returning();
  return { data: toPublicUser(row) };
}

async function changePassword(user: PublicUser, body: Body) {
  const current = str(body, "current", 200);
  const next = str(body, "next", 200);
  if (!next || next.length < 6) throw new ApiError("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের দিন");
  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !current || !verifyPassword(current, row.passwordHash)) throw new ApiError("বর্তমান পাসওয়ার্ড ভুল", 403);
  await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, user.id));
  return { data: { ok: true } };
}

/* ----------------------------- admin / users ------------------------------ */

async function aggregateStats(date?: string) {
  const conds = date ? [eq(tasks.dueDate, date)] : [];
  const rows = await db
    .select({
      userId: tasks.userId,
      total: sql<number>`count(*)::int`,
      done: sql<number>`sum(case when ${tasks.status} = 'done' then 1 else 0 end)::int`,
      minutes: sql<number>`coalesce(sum(${tasks.timeSpentMins}), 0)::int`,
      today: sql<number>`sum(case when ${tasks.dueDate} = current_date then 1 else 0 end)::int`,
    })
    .from(tasks)
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(tasks.userId);
  return new Map(rows.map((r) => [r.userId, { total: r.total, done: r.done, minutes: r.minutes, today: r.today }]));
}

async function listUsers() {
  const [rows, stats] = await Promise.all([
    db.select().from(users).orderBy(asc(users.id)),
    aggregateStats(),
  ]);
  return {
    data: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      active: row.active,
      color: row.color,
      createdAt: row.createdAt,
      stats: stats.get(row.id) ?? { total: 0, done: 0, minutes: 0, today: 0 },
    })),
  };
}

async function saveUser(body: Body, id?: number) {
  const name = str(body, "name", 80);
  const email = str(body, "email", 190)?.toLowerCase();
  const password = str(body, "password", 200);
  const role = str(body, "role", 16) === "admin" ? "admin" : "user";
  if (id) {
    const patch: Record<string, unknown> = { role };
    if (name) patch.name = name;
    if (email) patch.email = email;
    if ("active" in body) patch.active = bool(body, "active", true);
    if (password && password.length >= 6) patch.passwordHash = hashPassword(password);
    const [row] = await db.update(users).set(patch).where(eq(users.id, id)).returning();
    if (!row) throw new ApiError("ইউজার খুঁজে পাওয়া যায়নি", 404);
    return { data: toPublicUser(row) };
  }
  if (!name || !email || !password) throw new ApiError("নাম, ইমেইল ও পাসওয়ার্ড লাগবে");
  const [row] = await db
    .insert(users)
    .values({ name, email, role, passwordHash: hashPassword(password) })
    .returning();
  await defaultCategories(row.id);
  return { data: toPublicUser(row) };
}

async function teamStatus(sp: URLSearchParams) {
  const date = sp.get("date") ?? toISO(new Date());
  const [members, stats] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, color: users.color })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(asc(users.name)),
    aggregateStats(date),
  ]);
  return {
    data: members.map((m) => {
      const s = stats.get(m.id) ?? { total: 0, done: 0, minutes: 0, today: 0 };
      return { id: m.id, name: m.name, color: m.color, total: s.total, done: s.done, minutes: s.minutes };
    }),
    date,
  };
}

/* ------------------------------ db info ---------------------------------- */

function maskConnection(raw: string | undefined) {
  if (!raw) return { host: "—", port: "—", database: "—", user: "—", url: "—" };
  try {
    const parsed = new URL(raw);
    return {
      host: parsed.hostname || "লোকাল হোস্ট",
      port: parsed.port || "5432",
      database: parsed.pathname.replace(/^\//, "") || "app_db",
      user: parsed.username || "postgres",
      url: raw.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:••••••@"),
    };
  } catch {
    return { host: "—", port: "—", database: "—", user: "—", url: "লুকানো" };
  }
}

async function databaseInfo() {
  const tables = await db.execute<{ table_name: string; rows: number; size: string }>(sql`
    select c.relname as table_name,
           coalesce(c.reltuples, 0)::int as rows,
           pg_size_pretty(pg_total_relation_size(c.oid)) as size
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `);
  const counts = await Promise.all(
    [
      { key: "users", table: users },
      { key: "sessions", table: sessions },
      { key: "categories", table: categories },
      { key: "plans", table: plans },
      { key: "tasks", table: tasks },
      { key: "workLogs", table: workLogs },
    ].map(async (entry) => {
      const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(entry.table);
      return { table: entry.key, rows: row?.c ?? 0 };
    }),
  );
  const [size] = await db.execute<{ size: string; version: string }>(sql`
    select pg_size_pretty(pg_database_size(current_database())) as size, version() as version
  `).then((res) => res.rows);
  const connection = maskConnection(process.env.DATABASE_URL);
  return {
    data: {
      engine: "PostgreSQL (Drizzle ORM দিয়ে সংযুক্ত)",
      ...connection,
      dataDirectory: "সার্ভারের PostgreSQL ডেটা ডিরেক্টরি (কন্টেইনারের ভেতরে)",
      databaseSize: size?.size ?? "—",
      version: (size?.version ?? "").split(",")[0] || "PostgreSQL",
      tables: counts,
      schemaFile: "src/db/schema.ts",
      tablesOnServer: tables.rows,
      envFile: ".env → DATABASE_URL",
      backupHint: "pg_dump postgresql://user:pass@host:5432/app_db > backup.sql",
      persistent: true,
    },
  };
}

/* ------------------------------- dispatcher ------------------------------- */

/**
 * Bootstrap the schema once per process and translate low level driver errors
 * into messages a normal user can act on.
 */
async function ensureSetup() {
  try {
    await ensureSchema();
  } catch (err) {
    console.error("[db] schema bootstrap failed:", err);
    throw new ApiError(
      `ডেটাবেস প্রস্তুত করা যায়নি (${databaseUrlHint(err)})`,
      503,
    );
  }
}

export type ApiResult = { data?: unknown; token?: string; maxAge?: number; logout?: boolean };

export async function handleApi(req: Request, segments: string[], url: URL): Promise<ApiResult> {
  const [root, second] = segments;
  const method = req.method ?? "GET";
  const body: Body = method === "GET" || method === "DELETE" ? {} : await readBody(req);

  // Make sure this app's schema/tables exist before touching them. Without
  // this, a fresh Supabase project answered login/register with a raw
  // `Failed query: select ... from "users"` driver error.
  await ensureSetup();

  // public endpoints
  if (root === "auth") {
    if (second === "status") {
      const [row] = await db.select({ c: sql<number>`count(*)::int` }).from(users);
      return { data: { needsSetup: (row?.c ?? 0) === 0, hasUsers: (row?.c ?? 0) > 0 } };
    }
    return handleAuth(second ?? "", body, req);
  }

  // Everything below this line needs a real session (admin or member).
  const user = await userFromRequest(req);
  if (!user) throw new ApiError("লগইন প্রয়োজন", 401);

  switch (root) {
    case "tasks":
      if (method === "GET") return listTasks(user, url.searchParams);
      if (method === "POST" && !second) return createTask(user, body);
      if (second === "bulk") return bulkTasks(user, body);
      if (second === "complete") return completeTask(user, body);
      if (second) {
        const id = Number(second);
        if (method === "PATCH" || method === "PUT") return patchTask(user, id, body);
        if (method === "DELETE") {
          await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, user.id)));
          return { data: { ok: true } };
        }
      }
      break;
    case "plans":
      if (method === "GET") return listPlans(user, url.searchParams);
      if (method === "POST" && !second) return createPlan(user, body);
      if (second) {
        const id = Number(second);
        if (method === "PATCH" || method === "PUT") return patchPlan(user, id, body);
        if (method === "DELETE") {
          await db.delete(plans).where(and(eq(plans.id, id), eq(plans.userId, user.id)));
          return { data: { ok: true } };
        }
      }
      break;
    case "categories":
      if (method === "GET") {
        const rows = await db.select().from(categories).where(eq(categories.userId, user.id)).orderBy(asc(categories.name));
        return { data: rows };
      }
      if (method === "POST") return saveCategory(user, body, second ? Number(second) : undefined);
      if (method === "PATCH" && second) return saveCategory(user, body, Number(second));
      if (method === "DELETE" && second) {
        await db.delete(categories).where(and(eq(categories.id, Number(second)), eq(categories.userId, user.id)));
        return { data: { ok: true } };
      }
      break;
    case "logs":
      if (method === "GET") return listLogs(user, url.searchParams);
      if (method === "POST" && !second) {
        const content = str(body, "content", 4000);
        if (!content) throw new ApiError("কী করেছেন লিখুন");
        const [row] = await db
          .insert(workLogs)
          .values({
            userId: user.id,
            logDate: dateStr(body, "logDate") ?? toISO(new Date()),
            content,
            minutes: Math.max(0, num(body, "minutes", 0) ?? 0),
          })
          .returning();
        return { data: row };
      }
      if (second && method === "PATCH") {
        const [row] = await db
          .update(workLogs)
          .set({ content: str(body, "content", 4000) ?? "", minutes: Math.max(0, num(body, "minutes", 0) ?? 0) })
          .where(and(eq(workLogs.id, Number(second)), eq(workLogs.userId, user.id)))
          .returning();
        if (!row) throw new ApiError("এন্ট্রি পাওয়া যায়নি", 404);
        return { data: row };
      }
      if (second && method === "DELETE") {
        await db.delete(workLogs).where(and(eq(workLogs.id, Number(second)), eq(workLogs.userId, user.id)));
        return { data: { ok: true } };
      }
      break;
    case "generate":
      if (method === "POST") return generate(user, body);
      break;
    case "reminders":
      if (method === "GET") return reminders(user, url.searchParams);
      break;
    case "reports":
      if (method === "GET") return reports(user, url.searchParams);
      break;
    case "profile":
      if (method === "POST") return updateProfile(user, body);
      break;
    case "password":
      if (method === "POST") return changePassword(user, body);
      break;
    case "team":
      if (method === "GET") return teamStatus(url.searchParams);
      break;
    case "db-info":
      if (user.role !== "admin") throw new ApiError("শুধু অ্যাডমিনের জন্য", 403);
      if (method === "GET") return databaseInfo();
      break;
    case "users":
      if (user.role !== "admin") throw new ApiError("শুধু অ্যাডমিনের জন্য", 403);
      if (method === "GET") return listUsers();
      if (method === "POST" && !second) return saveUser(body);
      if (second && (method === "PATCH" || method === "PUT")) return saveUser(body, Number(second));
      if (second && method === "DELETE") {
        const id = Number(second);
        if (id === user.id) throw new ApiError("নিজের অ্যাকাউন্ট মুছে দেওয়া যাবে না");
        await db.delete(users).where(eq(users.id, id));
        return { data: { ok: true } };
      }
      break;
    default:
      throw new ApiError("এই ঠিকানায় কিছু নেই", 404);
  }
  throw new ApiError(`এই কাজটি ${method} মেথডে হয় না`, 405);
}

async function readBody(req: Request): Promise<Body> {
  try {
    const raw = await req.json();
    return raw && typeof raw === "object" ? (raw as Body) : {};
  } catch {
    return {};
  }
}
