"use client";

import { useCallback } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { Badge, Btn, Checkbox, useToast } from "@/components/ui";
import { useShell } from "@/components/Shell";
import { api } from "@/lib/client";
import {
  addDays,
  cn,
  fmtClock,
  fmtDate,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  todayISO,
  type TaskRow,
} from "@/lib/utils";

export function useTaskActions(refetch?: () => void | Promise<void>) {
  const { push } = useToast();
  const { refreshReminders } = useShell();

  const finish = useCallback(
    async (task: TaskRow, done: boolean, extra: { notes?: string | null; timeSpentMins?: number } = {}) => {
      try {
        await api("tasks/complete", {
          method: "POST",
          body: { id: task.id, status: done ? "done" : "pending", ...extra },
        });
        push(done ? `"${task.title}" সম্পন্ন হয়েছে — লগে যোগ হয়েছে` : "আবার পেন্ডিং করে দেওয়া হয়েছে", done ? "success" : "info");
      } catch (err) {
        push(err instanceof Error ? err.message : "সম্পন্ন করা যায়নি", "danger");
      } finally {
        void refetch?.();
        void refreshReminders();
      }
    },
    [push, refetch, refreshReminders],
  );

  const update = useCallback(
    async (id: number, patch: Record<string, unknown>, message = "সেভ হয়েছে") => {
      try {
        await api(`tasks/${id}`, { method: "PATCH", body: patch });
        push(message, "success");
      } catch (err) {
        push(err instanceof Error ? err.message : "সেভ করা যায়নি", "danger");
      } finally {
        void refetch?.();
        void refreshReminders();
      }
    },
    [push, refetch, refreshReminders],
  );

  const remove = useCallback(
    async (id: number) => {
      try {
        await api(`tasks/${id}`, { method: "DELETE" });
        push("কাজটি মুছে ফেলা হয়েছে", "info");
      } catch (err) {
        push(err instanceof Error ? err.message : "মোছা যায়নি", "danger");
      } finally {
        void refetch?.();
        void refreshReminders();
      }
    },
    [push, refetch, refreshReminders],
  );

  const postpone = useCallback(
    async (task: TaskRow, days: number) => {
      await update(task.id, { dueDate: addDays(task.dueDate, days), snoozeUntil: null }, `${days} দিন পিছিয়ে দেওয়া হলো`);
    },
    [update],
  );

  const snooze = useCallback(
    async (task: TaskRow, mins: number) => {
      const until = new Date(Date.now() + mins * 60_000).toISOString();
      await update(task.id, { snoozeUntil: until }, `${mins} মিনিটের জন্য স্নুজ`);
    },
    [update],
  );

  const bulk = useCallback(
    async (action: "done" | "delete" | "reopen" | "reschedule", ids: number[], toDate?: string) => {
      try {
        await api("tasks/bulk", { method: "POST", body: { action, ids, toDate } });
        push("বাল্ক কাজ সম্পন্ন হয়েছে", "success");
      } catch (err) {
        push(err instanceof Error ? err.message : "ব্যর্থ", "danger");
      } finally {
        void refetch?.();
        void refreshReminders();
      }
    },
    [push, refetch, refreshReminders],
  );

  return { finish, update, remove, postpone, snooze, bulk };
}

export function TaskRowItem({
  task,
  onComplete,
  onEdit,
  onDelete,
  onPostpone,
  onSnooze,
  showDate,
  selected,
  onSelect,
}: {
  task: TaskRow;
  onComplete: (done: boolean) => void;
  onEdit?: (task: TaskRow) => void;
  onDelete?: (task: TaskRow) => void;
  onPostpone?: (task: TaskRow) => void;
  onSnooze?: (task: TaskRow) => void;
  showDate?: boolean;
  selected?: boolean;
  onSelect?: (id: number) => void;
}) {
  const today = todayISO();
  const done = task.status === "done";
  const overdue = !done && task.dueDate < today;
  const isToday = task.dueDate === today;
  const dueSoon = isToday && !done && task.dueTime;

  return (
    <li className={cn("priority-" + task.priority, done && "is-done", selected && "!bg-[#f0f7ff]")}>
      {onSelect ? (
        <span className="mt-0.5">
          <Checkbox checked={!!selected} onChange={() => onSelect(task.id)} />
        </span>
      ) : null}
      <span className="mt-0.5">
        <Checkbox checked={done} onChange={(v) => onComplete(v)} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {onEdit ? (
            <button
              type="button"
              className="task-title !bg-transparent !p-0 text-left text-[14.5px] font-semibold text-[#343a40] hover:!text-[#007bff] hover:underline"
              onClick={() => onEdit(task)}
            >
              {task.title}
            </button>
          ) : (
            <span className="task-title text-[14.5px] font-semibold text-[#343a40]">{task.title}</span>
          )}
          {task.source === "plan" ? (
            <span title="মাসিক প্ল্যান থেকে এসেছে" className="text-[#17a2b8]">
              <Icon name="repeat" className="h-3.5 w-3.5" />
            </span>
          ) : null}
          {task.status === "progress" ? <Badge tone="info">চলছে</Badge> : null}
          {overdue ? <Badge tone="danger">ওভারডিউ</Badge> : null}
          {dueSoon ? <Badge tone={task.dueTime && task.dueTime <= new Date().toTimeString().slice(0, 5) ? "warning" : "secondary"}>
            {fmtClock(task.dueTime)}
          </Badge> : null}
          {task.snoozeUntil && new Date(task.snoozeUntil).getTime() > Date.now() ? (
            <Badge tone="secondary">স্নুজ • {new Date(task.snoozeUntil).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</Badge>
          ) : null}
        </div>
        {task.description ? <p className="m-0 mt-0.5 line-clamp-2 text-[12.5px] text-[#6c757d]">{task.description}</p> : null}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#868e96]">
          <span className="inline-flex items-center gap-1">
            <Icon name="calendar" className="h-3.5 w-3.5" />
            {showDate || isToday || overdue ? fmtDate(task.dueDate, { weekday: true }) : fmtDate(task.dueDate)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="flag" className="h-3.5 w-3.5" />
            {PRIORITY_LABEL[task.priority as keyof typeof PRIORITY_LABEL]}
          </span>
          {task.categoryName ? (
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: task.categoryColor ?? "#adb5bd" }} />
              {task.categoryName}
            </span>
          ) : null}
          {task.timeSpentMins ? (
            <span className="inline-flex items-center gap-1">
              <Icon name="clock" className="h-3.5 w-3.5" />
              {task.timeSpentMins} মি
            </span>
          ) : null}
          {task.notes ? (
            <span className="inline-flex items-center gap-1" title={task.notes}>
              <Icon name="book" className="h-3.5 w-3.5" />
              নোট আছে
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <span className={cn("lte-badge", PRIORITY_BADGE[task.priority as keyof typeof PRIORITY_BADGE])}>
          {done ? "✅" : overdue ? "!" : ""}
        </span>
        {onSnooze && !done ? (
          <Btn size="sm" variant="link" icon="clock" onClick={() => onSnooze(task)} title="১ ঘণ্টা স্নুজ">
            <span className="hidden sm:inline">স্নুজ</span>
          </Btn>
        ) : null}
        {onPostpone && !done ? (
          <Btn size="sm" variant="link" icon="arrow-right" onClick={() => onPostpone(task)} title="কালকে">
            <span className="hidden sm:inline">কালকে</span>
          </Btn>
        ) : null}
        {onEdit ? <Btn size="sm" variant="link" icon="edit" onClick={() => onEdit(task)} title="সম্পাদনা" /> : null}
        {onDelete ? <Btn size="sm" variant="link" icon="trash" onClick={() => onDelete(task)} title="মুছুন" className="!text-[#dc3545]" /> : null}
      </div>
    </li>
  );
}

export function TaskList({
  tasks,
  actions,
  onEdit,
  showDate,
  emptyTitle = "এখানে দেখার মতো কিছু নেই",
  emptyText,
  emptyAction,
  selection,
}: {
  tasks: TaskRow[];
  actions: ReturnType<typeof useTaskActions>;
  onEdit?: (t: TaskRow) => void;
  showDate?: boolean;
  emptyTitle?: string;
  emptyText?: string;
  emptyAction?: React.ReactNode;
  selection?: { selected: number[]; toggle: (id: number) => void };
}) {
  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[#eef6ff] text-[#007bff]">
          <Icon name="check" className="h-6 w-6" />
        </span>
        <p className="m-0 text-[15px] font-semibold text-[#495057]">{emptyTitle}</p>
        {emptyText ? <p className="m-0 max-w-md text-[13px] text-[#6c757d]">{emptyText}</p> : null}
        {emptyAction}
      </div>
    );
  }
  return (
    <ul className="lte-todo">
      {tasks.map((t) => (
        <TaskRowItem
          key={t.id}
          task={t}
          showDate={showDate}
          onComplete={(done) => void actions.finish(t, done)}
          onEdit={onEdit}
          onDelete={(task) => void actions.remove(task.id)}
          onPostpone={(task) => void actions.postpone(task, 1)}
          onSnooze={(task) => void actions.snooze(task, 60)}
          selected={selection ? selection.selected.includes(t.id) : undefined}
          onSelect={selection?.toggle}
        />
      ))}
    </ul>
  );
}

export function MiniReminderLink({ label = "সব রিমাইন্ডার দেখুন", href = "/reminders" }: { label?: string; href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#007bff] hover:underline">
      {label}
      <Icon name="chevron-right" className="h-4 w-4" />
    </Link>
  );
}
