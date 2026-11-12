"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader, useShell } from "@/components/Shell";
import { TaskList, useTaskActions } from "@/components/task";
import { Badge, Btn, EmptyState, Field, LteCard, Loading, SmallBox, useToast } from "@/components/ui";
import { api, qs, useQuery } from "@/lib/client";
import { fmtClock, fmtDate, todayISO, type TaskRow } from "@/lib/utils";

export default function RemindersPage() {
  const today = todayISO();
  const { reminders, loadingReminders, refreshReminders, user, setUser } = useShell();
  const { push } = useToast();
  const [permission, setPermission] = useState<string>("default");
  const [before, setBefore] = useState(user.notifyBeforeMins);
  const [busy, setBusy] = useState(false);

  const loader = useCallback(async () => {
    const [overdue, cats] = await Promise.all([
      api<TaskRow[]>(`tasks${qs({ view: "overdue", today })}`),
      api<{ id: number; name: string }[]>("categories"),
    ]);
    return { overdue, cats };
  }, [today]);

  const { data, loading, refetch } = useQuery(loader, [today]);
  const actions = useTaskActions(refetch);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  const snoozed = useMemo(() => {
    const all = [...(reminders?.dueToday ?? []), ...(reminders?.upcoming ?? [])];
    return all.filter((t) => t.snoozeUntil && new Date(t.snoozeUntil).getTime() > Date.now());
  }, [reminders]);

  async function askPermission() {
    if (typeof Notification === "undefined") {
      push("এই ব্রাউজারে নোটিফিকেশন সাপোর্ট করে না", "warning");
      return;
    }
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") {
      await api("profile", { method: "POST", body: { browserNotifications: true } });
      setUser({ ...user, browserNotifications: true });
      new Notification("কাজের হিসাব", { body: "রিমাইন্ডার এখন থেকে ব্রাউজারে পাবেন ✅" });
      push("ব্রাউজার নোটিফিকেশন চালু হয়েছে", "success");
    } else {
      push("নোটিফিকেশন ব্লক করা আছে — ব্রাউজার সেটিংস থেকে অনুমতি দিন", "warning");
    }
  }

  async function generateToday() {
    setBusy(true);
    try {
      const res = await api<{ created: number }>("generate", { method: "POST", body: { fromDate: today, toDate: today } });
      push(res.created ? `${res.created} টি কাজ আজকের তালিকায় যোগ হয়েছে` : "নতুন কোনো প্ল্যান কাজ নেই", res.created ? "success" : "info");
      await refetch();
      await refreshReminders();
    } finally {
      setBusy(false);
    }
  }

  async function savePrefs(patch: Record<string, unknown>) {
    await api("profile", { method: "POST", body: patch }).catch(() => push("সেটিংস সেভ হয়নি", "danger"));
  }

  const overdue = data?.overdue ?? [];
  const dueToday = reminders?.dueToday ?? [];
  const upcoming = reminders?.upcoming ?? [];

  return (
    <>
      <PageHeader
        title="রিমাইন্ডার সেন্টার"
        lead="মাসিক প্ল্যান ও টুডু লিস্ট থেকে ডিউ কাজের তালিকা — এখান থেকেই শেষ করুন বা পিছিয়ে দিন"
        crumbs={["পরিকল্পনা", "রিমাইন্ডার"]}
        actions={
          <>
            <Btn variant="outline" icon="refresh" onClick={() => void refreshReminders()} disabled={loadingReminders}>
              {loadingReminders ? "চেক হচ্ছে…" : "আবার চেক করুন"}
            </Btn>
            <Btn variant="outline-primary" icon="spark" onClick={() => void generateToday()} disabled={busy}>
              আজকের প্ল্যান-কাজ তৈরি
            </Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallBox tone="danger" icon="alert" value={overdue.length} label="ওভারডিউ" sub="নজরে রাখুন" onClick={() => document.getElementById("overdue")?.scrollIntoView({ behavior: "smooth" })} />
        <SmallBox tone="warning" icon="clock" value={dueToday.length} label="আজকের ডিউ" sub={`${reminders?.dueNow.length ?? 0} টি এখনই করার`} />
        <SmallBox tone="info" icon="calendar" value={upcoming.length} label="আসন্ন ১৪ দিন" sub="আগাম পরিকল্পনা" />
        <SmallBox tone="secondary" icon="bell" value={snoozed.length} label="স্নুজ করা" sub="পরে মনে করিয়ে দেওয়া" />
      </div>

      {reminders?.missingPlans.length ? (
        <div className="lte-alert lte-alert-warning flex flex-wrap items-center gap-2">
          <Icon name="spark" className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            আজ {reminders.missingPlans.length} টি প্ল্যান অনুযায়ী কাজ থাকা কথা কিন্তু তালিকায় নেই:{" "}
            <b>{reminders.missingPlans.slice(0, 3).map((p) => p.title).join(", ")}</b>
            {reminders.missingPlans.length > 3 ? " …" : ""}
          </span>
          <Btn size="sm" variant="warning" icon="plus" onClick={() => void generateToday()}>
            তৈরি করে দিন
          </Btn>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" id="overdue">
        <LteCard
          variant="danger"
          icon="alert"
          title={`ওভারডিউ • ${overdue.length}`}
          tools={
            overdue.length ? (
              <Btn
                size="sm"
                variant="outline"
                icon="calendar"
                onClick={() => {
                  if (window.confirm(`${overdue.length} টি কাজ আজকের তারিখে নিয়ে আসবেন?`))
                    void actions.bulk("reschedule", overdue.map((t) => t.id), today);
                }}
              >
                সব আজকে নিন
              </Btn>
            ) : null
          }
        >
          {loading && !data ? (
            <Loading />
          ) : (
            <TaskList
              tasks={overdue}
              actions={actions}
              showDate
              emptyTitle="কোনো ওভারডিউ নেই 🎉"
              emptyText="আগের দিনের সব বকেয়া শেষ — দারুণ!"
            />
          )}
        </LteCard>

        <LteCard variant="warning" icon="clock" title={`আজকের ডিউ • ${dueToday.length}`} tools={<Badge tone="soft-warning">{fmtClock(new Date().toTimeString().slice(0, 5))} এখন</Badge>}>
          <TaskList
            tasks={dueToday}
            actions={actions}
            emptyTitle="আজকের সব কাজ শেষ"
            emptyText="নতুন কাজ টুডু লিস্ট থেকে যোগ করুন।"
            emptyAction={
              <Link href="/tasks">
                <Btn size="sm" variant="outline-primary" icon="plus">
                  কাজ যোগ করুন
                </Btn>
              </Link>
            }
          />
        </LteCard>

        <LteCard variant="info" icon="calendar" title={`আসন্ন কাজ • ${upcoming.length}`} bodyClassName="!p-0">
          {upcoming.length ? (
            <table className="lte-table">
              <thead>
                <tr>
                  <th>কাজ</th>
                  <th>কবে</th>
                  <th className="text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.slice(0, 12).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <p className="m-0 text-[14px] font-semibold text-[#343a40]">{t.title}</p>
                      <p className="m-0 text-[12px] text-[#6c757d]">
                        {t.categoryName ?? "শ্রেণিবিহীন"}
                        {t.dueTime ? ` • ${fmtClock(t.dueTime)}` : ""}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-[13px] text-[#495057]">{fmtDate(t.dueDate, { weekday: true, year: false })}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Btn size="sm" variant="outline" icon="calendar" onClick={() => void actions.update(t.id, { dueDate: today }, "আজকে নিয়ে আসা হলো")}>
                          আজকে
                        </Btn>
                        <Btn size="sm" variant="success" icon="check" onClick={() => void actions.finish(t, true)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-3">
              <EmptyState icon="calendar" title="পরের ১৪ দিনে কিছু নেই" text="মাসিক প্ল্যান যোগ করলে স্বয়ংক্রিয়ভাবে এখানে দেখা যাবে।" />
            </div>
          )}
        </LteCard>

        <LteCard variant="secondary" icon="settings" title="রিমাইন্ডার সেটিংস">
          <div className="flex flex-col gap-3">
            <div className="lte-alert lte-alert-info mb-0 flex flex-wrap items-center gap-2">
              <Icon name="bell" className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-[13px]">
                ব্রাউজার নোটিফিকেশন:{" "}
                <b>{permission === "granted" ? "অনুমোদিত" : permission === "denied" ? "ব্লক করা" : "চালু নয়"}</b>
              </span>
              {permission !== "granted" ? (
                <Btn size="sm" variant="primary" icon="bell" onClick={askPermission}>
                  চালু করুন
                </Btn>
              ) : (
                <Btn
                  size="sm"
                  variant="outline"
                  icon="close"
                  onClick={async () => {
                    await api("profile", { method: "POST", body: { browserNotifications: false } });
                    setUser({ ...user, browserNotifications: false });
                    push("ব্রাউজার নোটিফিকেশন বন্ধ করা হয়েছে", "info");
                  }}
                >
                  বন্ধ
                </Btn>
              )}
            </div>

            <Field label="ডিউয়ের কত আগে মনে করিয়ে দেবে" help="সময় মানে ডিউ টাইমের আগে থেকে বার বার রিমাইন্ডারে দেখাবে">
              <div className="flex gap-2">
                <select
                  className="lte-form-control"
                  value={before}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setBefore(v);
                    void savePrefs({ notifyBeforeMins: v });
                  }}
                >
                  {[0, 15, 30, 60, 120, 240, 1440].map((m) => (
                    <option key={m} value={m}>
                      {m === 0 ? "ঠিক সময়" : m < 60 ? `${m} মিনিট আগে` : m === 1440 ? "১ দিন আগে" : `${m / 60} ঘণ্টা আগে`}
                    </option>
                  ))}
                </select>
              </div>
            </Field>

            <button
              type="button"
              className="lte-check"
              onClick={() => {
                const v = !user.autoGenerate;
                setUser({ ...user, autoGenerate: v });
                void savePrefs({ autoGenerate: v });
                push(v ? "প্রতিদিন স্বয়ংক্রিয়ভাবে কাজ তৈরি হবে" : "অটো জেনারেশন বন্ধ", "info");
              }}
            >
              <span className={`box ${user.autoGenerate ? "!border-[#28a745] !bg-[#28a745] !text-white" : ""}`}>
                <Icon name="check" className="h-3.5 w-3.5" />
              </span>
              <span className="text-[14px]">প্রতিদিন লগইনের পর প্ল্যান অনুযায়ী আজকের কাজ স্বয়ংক্রিয়ভাবে তৈরি রাখুন</span>
            </button>

            {typeof document !== "undefined" ? (
              <Btn
                variant="outline-primary"
                icon="bell"
                onClick={() => {
                  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
                    new Notification("টেস্ট রিমাইন্ডার", { body: "এভাবেই ডিউ কাজের নোটিফিকেশন পাবেন 🔔" });
                    push("টেস্ট নোটিফিকেশন পাঠানো হয়েছে", "success");
                  } else {
                    push("আগে ব্রাউজার নোটিফিকেশন চালু করুন", "warning");
                  }
                }}
              >
                নোটিফিকেশন টেস্ট
              </Btn>
            ) : null}
          </div>
        </LteCard>

        {snoozed.length ? (
          <LteCard variant="dark" icon="bell" title={`স্নুজ করা • ${snoozed.length}`}>
            <TaskList tasks={snoozed} actions={actions} showDate />
          </LteCard>
        ) : null}
      </div>
    </>
  );
}
