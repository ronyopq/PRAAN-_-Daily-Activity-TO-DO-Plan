import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* ---------------------------------- users --------------------------------- */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  email: varchar("email", { length: 190 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 16 }).notNull().default("user"),
  active: boolean("active").notNull().default(true),
  color: varchar("color", { length: 16 }).notNull().default("#007bff"),
  notifyBeforeMins: integer("notify_before_mins").notNull().default(60),
  browserNotifications: boolean("browser_notifications").notNull().default(false),
  autoGenerate: boolean("auto_generate").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    tokenHash: varchar("token_hash", { length: 80 }).notNull().unique(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("sessions_token_idx").on(table.tokenHash)],
);

/* -------------------------------- categories ------------------------------- */

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 60 }).notNull(),
    color: varchar("color", { length: 16 }).notNull().default("#007bff"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("categories_user_name_idx").on(table.userId, table.name)],
);

/* -------------------------- monthly work plan (plans) ---------------------- */

export const plans = pgTable("plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 160 }).notNull(),
  description: text("description"),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  /** daily | weekdays | weekend | weekly | monthly */
  recurrence: varchar("recurrence", { length: 16 }).notNull().default("weekdays"),
  /** csv of 0..6 (0 = Sunday) used when recurrence = weekly */
  weekdays: varchar("weekdays", { length: 32 }).notNull().default("1,2,3,4,5"),
  /** csv of 1..31 used when recurrence = monthly */
  monthDays: varchar("month_days", { length: 96 }).notNull().default("1"),
  /** HH:MM local reminder / due time */
  dueTime: varchar("due_time", { length: 5 }),
  /** plan applies to this month, format YYYY-MM */
  month: varchar("month", { length: 7 }).notNull(),
  estimatedMins: integer("estimated_mins").notNull().default(30),
  priority: varchar("priority", { length: 12 }).notNull().default("medium"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------------------------------- tasks ---------------------------------- */

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    planId: integer("plan_id").references(() => plans.id, { onDelete: "cascade" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    priority: varchar("priority", { length: 12 }).notNull().default("medium"),
    dueDate: date("due_date").notNull(),
    dueTime: varchar("due_time", { length: 5 }),
    /** pending | progress | done | skipped */
    status: varchar("status", { length: 12 }).notNull().default("pending"),
    /** manual | plan */
    source: varchar("source", { length: 8 }).notNull().default("manual"),
    notes: text("notes"),
    timeSpentMins: integer("time_spent_mins").notNull().default(0),
    snoozeUntil: timestamp("snooze_until", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("tasks_user_plan_due_idx").on(table.userId, table.planId, table.dueDate)],
);

/* ------------------------- daily work log (journal) ------------------------ */

export const workLogs = pgTable("work_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  logDate: date("log_date").notNull(),
  content: text("content").notNull(),
  minutes: integer("minutes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ---------------------------------- types ---------------------------------- */

export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "passwordHash">;
export type Category = typeof categories.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type WorkLog = typeof workLogs.$inferSelect;
