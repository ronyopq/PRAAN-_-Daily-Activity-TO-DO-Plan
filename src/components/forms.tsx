"use client";

import { useEffect, useMemo, useState } from "react";
import { Btn, Field, Modal, useToast } from "@/components/ui";
import { api } from "@/lib/client";
import {
  cn,
  currentMonth,
  monthDates,
  monthLabel,
  PRIORITY_LABEL,
  planMatchesDate,
  RECURRENCE_LABEL,
  todayISO,
  WEEKDAYS_BN,
  type CategoryRow,
  type PlanRow,
  type Priority,
  type TaskRow,
} from "@/lib/utils";

type TaskForm = {
  title: string;
  description: string;
  categoryId: number | "";
  priority: Priority;
  dueDate: string;
  dueTime: string;
  status: TaskRow["status"];
  timeSpentMins: number;
  notes: string;
};

const emptyTask = (date: string): TaskForm => ({
  title: "",
  description: "",
  categoryId: "",
  priority: "medium",
  dueDate: date,
  dueTime: "",
  status: "pending",
  timeSpentMins: 0,
  notes: "",
});

export function TaskModal({
  open,
  onClose,
  categories,
  initial,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryRow[];
  initial?: TaskRow | null;
  defaultDate?: string;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [form, setForm] = useState<TaskForm>(emptyTask(defaultDate ?? todayISO()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            title: initial.title,
            description: initial.description ?? "",
            categoryId: initial.categoryId ?? "",
            priority: initial.priority,
            dueDate: initial.dueDate,
            dueTime: initial.dueTime ?? "",
            status: initial.status,
            timeSpentMins: initial.timeSpentMins ?? 0,
            notes: initial.notes ?? "",
          }
        : emptyTask(defaultDate ?? todayISO()),
    );
    setError(null);
  }, [open, initial, defaultDate]);

  const set = <K extends keyof TaskForm>(key: K, value: TaskForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    if (!form.title.trim()) {
      setError("কাজের একটি নাম লিখুন");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        categoryId: form.categoryId === "" ? null : form.categoryId,
        priority: form.priority,
        dueDate: form.dueDate,
        dueTime: form.dueTime || null,
        status: form.status,
        timeSpentMins: Number(form.timeSpentMins) || 0,
        notes: form.notes || null,
      };
      if (initial?.id) await api(`tasks/${initial.id}`, { method: "PATCH", body });
      else await api("tasks", { method: "POST", body });
      push(initial ? "কাজ আপডেট হয়েছে" : "নতুন কাজ যোগ হয়েছে", "success");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেভ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "কাজ সম্পাদনা" : "নতুন কাজ / টুডু"}
      icon={initial ? "edit" : "plus"}
      size="lg"
      footer={
        <>
          {initial ? <span className="mr-auto text-[12px] text-[#6c757d]">ডিউ: {monthLabel(initial.dueDate.slice(0, 7))}</span> : null}
          <Btn variant="outline" onClick={onClose}>
            বাতিল
          </Btn>
          <Btn variant="primary" onClick={save} disabled={busy} icon="check">
            {busy ? "সেভ হচ্ছে…" : "সেভ করুন"}
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        {error ? <div className="lte-alert lte-alert-danger">{error}</div> : null}
        <Field label="কাজের নাম *">
          <input className="lte-form-control" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="যেমন: মাসিক রিপোর্ট জমা দেওয়া" autoFocus />
        </Field>
        <Field label="বিস্তারিত / নোট" help="কীভাবে করবেন, কী লাগবে — এখানে লিখে রাখুন">
          <textarea className="lte-form-control min-h-[70px]" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="তারিখ">
            <input type="date" className="lte-form-control" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} />
          </Field>
          <Field label="সময় (রিমাইন্ডার)">
            <input type="time" className="lte-form-control" value={form.dueTime} onChange={(e) => set("dueTime", e.target.value)} />
          </Field>
          <Field label="সময় লেগেছে (মিনিট)">
            <input type="number" min={0} step={5} className="lte-form-control" value={form.timeSpentMins} onChange={(e) => set("timeSpentMins", Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="শ্রেণি">
            <select className="lte-form-control" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : "")}>
              <option value="">— শ্রেণি নেই —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="অগ্রাধিকার">
            <select className="lte-form-control" value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="অবস্থা">
            <select className="lte-form-control" value={form.status} onChange={(e) => set("status", e.target.value as TaskRow["status"])}>
              <option value="pending">পেন্ডিং</option>
              <option value="progress">চলছে</option>
              <option value="done">সম্পন্ন</option>
              <option value="skipped">বাদ পড়েছে</option>
            </select>
          </Field>
        </div>
        <Field label="যা করেছি (দৈনিক লগে যোগ হবে)">
          <textarea className="lte-form-control min-h-[60px]" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="সংক্ষেপে ফলাফল লিখুন" />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------- plan modal -------------------------------- */

type PlanForm = {
  title: string;
  description: string;
  categoryId: number | "";
  recurrence: PlanRow["recurrence"];
  weekdays: number[];
  monthDays: string;
  dueTime: string;
  estimatedMins: number;
  priority: Priority;
  active: boolean;
  month: string;
};

export function PlanModal({
  open,
  onClose,
  categories,
  initial,
  month,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  categories: CategoryRow[];
  initial?: PlanRow | null;
  month: string;
  onSaved: () => void;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>({
    title: "",
    description: "",
    categoryId: "",
    recurrence: "weekdays",
    weekdays: [1, 2, 3, 4, 5],
    monthDays: "1",
    dueTime: "18:00",
    estimatedMins: 30,
    priority: "medium",
    active: true,
    month,
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      initial
        ? {
            title: initial.title,
            description: initial.description ?? "",
            categoryId: initial.categoryId ?? "",
            recurrence: initial.recurrence,
            weekdays: (initial.weekdays || "").split(",").map((v) => Number(v)).filter((v) => Number.isFinite(v)),
            monthDays: initial.monthDays || "1",
            dueTime: initial.dueTime ?? "",
            estimatedMins: initial.estimatedMins,
            priority: initial.priority,
            active: initial.active,
            month: initial.month,
          }
        : {
            title: "",
            description: "",
            categoryId: "",
            recurrence: "weekdays",
            weekdays: [1, 2, 3, 4, 5],
            monthDays: "1",
            dueTime: "18:00",
            estimatedMins: 30,
            priority: "medium",
            active: true,
            month,
          },
    );
  }, [open, initial, month]);

  const set = <K extends keyof PlanForm>(key: K, value: PlanForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const hits = useMemo(
    () =>
      monthDates(form.month).filter((d) =>
        planMatchesDate({ recurrence: form.recurrence, weekdays: form.weekdays.join(","), monthDays: form.monthDays }, d),
      ),
    [form],
  );

  async function save() {
    if (!form.title.trim()) {
      setError("প্ল্যানের নাম লিখুন");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: form.title.trim(),
        description: form.description || null,
        categoryId: form.categoryId === "" ? null : form.categoryId,
        recurrence: form.recurrence,
        weekdays: form.weekdays.join(","),
        monthDays: form.monthDays || "1",
        dueTime: form.dueTime || null,
        estimatedMins: Number(form.estimatedMins) || 0,
        priority: form.priority,
        active: form.active,
        month: form.month,
      };
      if (initial?.id) await api(`plans/${initial.id}`, { method: "PATCH", body });
      else await api("plans", { method: "POST", body });
      push(initial ? "প্ল্যান আপডেট হয়েছে" : "মাসিক প্ল্যান যোগ হয়েছে", "success");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "সেভ করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "প্ল্যান সম্পাদনা" : "নতুন মাসিক প্ল্যান"}
      icon="calendar"
      size="lg"
      footer={
        <>
          <span className="mr-auto text-[12.5px] text-[#007bff]">
            {monthLabel(form.month)} মাসে এই প্ল্যান <b>{hits.length}</b> দিন চলবে
          </span>
          <Btn variant="outline" onClick={onClose}>
            বাতিল
          </Btn>
          <Btn variant="primary" onClick={save} disabled={busy} icon="check">
            {busy ? "সেভ হচ্ছে…" : "সেভ করুন"}
          </Btn>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3">
        {error ? <div className="lte-alert lte-alert-danger">{error}</div> : null}
        <div className="lte-alert lte-alert-info !mb-0">
          মাসিক প্ল্যান মানে একই কাজ প্রতিদিন/নির্দিষ্ট দিনে স্বয়ংক্রিয়ভাবে টুডু লিস্টে চলে আসবে — প্রতিদিন আলাদা করে লিখতে হবে না।
        </div>
        <Field label="কাজের নাম *">
          <input className="lte-form-control" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="যেমন: ডেইলি রিপোর্ট লেখা" autoFocus />
        </Field>
        <Field label="বিবরণ">
          <textarea className="lte-form-control min-h-[56px]" value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="মাস">
            <input type="month" className="lte-form-control" value={form.month} onChange={(e) => set("month", e.target.value || currentMonth())} />
          </Field>
          <Field label="কতবার">
            <select className="lte-form-control" value={form.recurrence} onChange={(e) => set("recurrence", e.target.value as PlanForm["recurrence"])}>
              {(Object.keys(RECURRENCE_LABEL) as PlanForm["recurrence"][]).map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="রিমাইন্ডারের সময়">
            <input type="time" className="lte-form-control" value={form.dueTime} onChange={(e) => set("dueTime", e.target.value)} />
          </Field>
        </div>

        {form.recurrence === "weekly" ? (
          <Field label="সপ্তাহের কোন কোন দিন">
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS_BN.map((label, i) => {
                const on = form.weekdays.includes(i);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => set("weekdays", on ? form.weekdays.filter((d) => d !== i) : [...form.weekdays, i])}
                    className={cn(
                      "lte-btn lte-btn-sm",
                      on ? "lte-btn-primary" : "lte-btn-outline",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>
        ) : null}

        {form.recurrence === "monthly" ? (
          <Field label="মাসের কোন তারিখে (কমা দিয়ে আলাদা)" help="যেমন: 1,15,28 — 31 তারিখ না থাকলে সে মাসে চলবে না">
            <input className="lte-form-control" value={form.monthDays} onChange={(e) => set("monthDays", e.target.value)} placeholder="1,15,28" />
          </Field>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="শ্রেণি">
            <select className="lte-form-control" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : "")}>
              <option value="">— শ্রেণি নেই —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="অগ্রাধিকার">
            <select className="lte-form-control" value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="আনুমানিক সময় (মিনিট)">
            <input type="number" min={0} step={5} className="lte-form-control" value={form.estimatedMins} onChange={(e) => set("estimatedMins", Number(e.target.value))} />
          </Field>
        </div>

        <button
          type="button"
          className="lte-check"
          onClick={() => set("active", !form.active)}
        >
          <span className={cn("box", form.active && "!border-[#28a745] !bg-[#28a745] !text-white")}>
            <Icon />
          </span>
          <span className="text-[14px]">প্ল্যানটি সক্রিয় (নিষ্ক্রিয় করলে নতুন কাজ তৈরি হবে না)</span>
        </button>
      </div>
    </Modal>
  );
}

function Icon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
