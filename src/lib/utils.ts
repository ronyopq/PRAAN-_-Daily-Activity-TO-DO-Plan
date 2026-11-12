/* Shared client/server safe helpers: dates, labels, formatting */

export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "progress" | "done" | "skipped";
export type Recurrence = "daily" | "weekdays" | "weekend" | "weekly" | "monthly";

export type CategoryRow = {
  id: number;
  name: string;
  color: string;
};

export type TaskRow = {
  id: number;
  userId: number;
  planId: number | null;
  categoryId: number | null;
  title: string;
  description: string | null;
  priority: Priority;
  dueDate: string;
  dueTime: string | null;
  status: TaskStatus;
  source: "manual" | "plan";
  notes: string | null;
  timeSpentMins: number;
  snoozeUntil: string | null;
  completedAt: string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  planTitle?: string | null;
  userName?: string | null;
};

export type PlanRow = {
  id: number;
  title: string;
  description: string | null;
  categoryId: number | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  recurrence: Recurrence;
  weekdays: string;
  monthDays: string;
  dueTime: string | null;
  month: string;
  estimatedMins: number;
  priority: Priority;
  active: boolean;
  hitsThisMonth?: number;
  doneThisMonth?: number;
};

export type LogRow = {
  id: number;
  logDate: string;
  content: string;
  minutes: number;
  createdAt: string;
  userName?: string | null;
  userId?: number;
};

export const WEEKDAYS_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"];
export const WEEKDAYS_FULL_BN = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার",
];
export const MONTHS_BN = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  low: "কম জরুরি",
  medium: "স্বাভাবিক",
  high: "জরুরি",
  urgent: "অতি জরুরি",
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  low: "badge-info",
  medium: "badge-soft-warning",
  high: "badge-warning",
  urgent: "badge-danger",
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "পেন্ডিং",
  progress: "চলছে",
  done: "সম্পন্ন",
  skipped: "বাদ পড়েছে",
};

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  daily: "প্রতিদিন",
  weekdays: "সপ্তাহের কাজি দিনে (শনি ছাড়া)",
  weekend: "শুধু ছুটির দিনে (শনি)",
  weekly: "সপ্তাহে নির্দিষ্ট দিনে",
  monthly: "মাসের নির্দিষ্ট তারিখে",
};

export const pad2 = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromISO(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO() {
  return toISO(new Date());
}

export function addDays(iso: string, n: number) {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function dow(iso: string) {
  return fromISO(iso).getDay();
}

export function monthOf(iso: string) {
  return iso.slice(0, 7);
}

export function currentMonth() {
  return monthOf(todayISO());
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function monthStart(month: string) {
  return `${month}-01`;
}

export function daysInMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthDates(month: string) {
  const total = daysInMonth(month);
  return Array.from({ length: total }, (_, i) => `${month}-${pad2(i + 1)}`);
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_BN[(m ?? 1) - 1]} ${y}`;
}

export function fmtDate(iso: string | null | undefined, opts: { weekday?: boolean; year?: boolean } = {}) {
  if (!iso) return "—";
  const d = fromISO(iso);
  const parts = `${d.getDate()} ${MONTHS_BN[d.getMonth()]}`;
  const year = opts.year === false ? "" : ` ${d.getFullYear()}`;
  const wd = opts.weekday ? `${WEEKDAYS_BN[d.getDay()]} • ` : "";
  return `${wd}${parts}${year}`;
}

export function fmtDateShort(iso: string) {
  const d = fromISO(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
}

export function hmToMin(hm: string | null | undefined) {
  if (!hm) return null;
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minToHm(mins: number) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtClock(hm: string | null | undefined) {
  if (!hm) return "";
  const [h, m] = hm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad2(m || 0)} ${period}`;
}

export function fmtMins(mins: number) {
  if (!mins) return "0 মিনিট";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m} মিনিট`;
  if (!m) return `${h} ঘণ্টা`;
  return `${h} ঘ ${m} মি`;
}

export function relTime(iso: string | null) {
  if (!iso) return "";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const unit =
    mins < 60 ? `${mins} মিনিট` : mins < 60 * 48 ? `${Math.round(mins / 60)} ঘণ্টা` : `${Math.round(mins / 1440)} দিন`;
  return diff >= 0 ? `${unit} পরে` : `${unit} আগে`;
}

export function isPast(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export function parseCsvList(value: string | null | undefined): number[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v));
}

export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const v = cell === null || cell === undefined ? "" : String(cell);
          return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(","),
    )
    .join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** does a plan (recurrence rules) apply on the given date? */
export function planMatchesDate(plan: { recurrence: string; weekdays: string; monthDays: string }, iso: string) {
  const day = dow(iso);
  const dateNum = fromISO(iso).getDate();
  switch (plan.recurrence) {
    case "daily":
      return true;
    case "weekend":
      return day === 6;
    case "weekdays":
      return day >= 0 && day <= 5;
    case "weekly":
      return parseCsvList(plan.weekdays).includes(day);
    case "monthly":
      return parseCsvList(plan.monthDays).includes(dateNum);
    default:
      return false;
  }
}

export function dayProgress(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
