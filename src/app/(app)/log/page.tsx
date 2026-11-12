"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MonthStrip } from "@/components/calendar";
import { TaskModal } from "@/components/forms";
import { Icon } from "@/components/icons";
import { PageHeader, useShell } from "@/components/Shell";
import { TaskList, useTaskActions } from "@/components/task";
import { Badge, Btn, CircleProgress, EmptyState, Field, InfoBox, LteCard, Loading, SmallBox, useToast } from "@/components/ui";
import { api, qs, useQuery } from "@/lib/client";
import {
  addDays,
  currentMonth,
  downloadCsv,
  fmtDate,
  fmtMins,
  monthLabel,
  monthOf,
  toCsv,
  todayISO,
  WEEKDAYS_FULL_BN,
  type CategoryRow,
  type LogRow,
  type TaskRow,
} from "@/lib/utils";

type ReportData = {
  month: string;
  totals: { total: number; done: number; minutes: number; rate: number; logEntries: number; logMinutes: number };
  perDay: { date: string; total: number; done: number; minutes: number }[];
};

export default function LogPage() {
  const today = todayISO();
  const sp = useSearchParams();
  const router = useRouter();
  const { push } = useToast();
  const { refreshReminders } = useShell();
  const [date, setDate] = useState(sp.get("date") || today);
  const [note, setNote] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [editing, setEditing] = useState<{ open: boolean; task: TaskRow | null }>({ open: false, task: null });

  useEffect(() => {
    const fromUrl = sp.get("date");
    if (fromUrl && fromUrl !== date) setDate(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const month = monthOf(date);

  const loader = useCallback(async () => {
    const [tasks, logs, report, cats] = await Promise.all([
      api<TaskRow[]>(`tasks${qs({ date })}`),
      api<LogRow[]>(`logs${qs({ date })}`),
      api<ReportData>(`reports${qs({ month })}`),
      api<CategoryRow[]>("categories"),
    ]);
    return { tasks, logs, report, cats };
  }, [date, month]);

  const { data, loading, refetch } = useQuery(loader, [date, month]);
  const actions = useTaskActions(refetch);
  const tasks = data?.tasks ?? [];
  const logs = data?.logs ?? [];
  const doneCount = tasks.filter((t) => t.status === "done").length;
  const taskMinutes = tasks.reduce((acc, t) => acc + (t.timeSpentMins || 0), 0);
  const logMinutes = logs.reduce((acc, l) => acc + (l.minutes || 0), 0);

  const stripStats = useMemo(() => {
    const out: Record<string, { total: number; done: number; minutes: number }> = {};
    for (const d of data?.report.perDay ?? []) out[d.date] = d;
    return out;
  }, [data]);

  const leftover = tasks.filter((t) => t.status !== "done" && t.status !== "skipped");

  async function addLog(e: FormEvent) {
    e.preventDefault();
    const content = note.trim();
    if (!content) return;
    setNote("");
    try {
      await api("logs", { method: "POST", body: { content, minutes: Number(minutes) || 0, logDate: date } });
      push("দিনের হিসাবে নোট যোগ হয়েছে", "success");
      await refetch();
    } catch (err) {
      push(err instanceof Error ? err.message : "যোগ করা যায়নি", "danger");
    }
  }

  async function removeLog(id: number) {
    await api(`logs/${id}`, { method: "DELETE" }).catch(() => push("মোছা যায়নি", "danger"));
    push("নোট মুছে ফেলা হয়েছে", "info");
    await refetch();
  }

  async function pushLeftoverToTomorrow() {
    if (!leftover.length) return;
    await actions.bulk("reschedule", leftover.map((t) => t.id), addDays(date, 1));
    await refreshReminders();
  }

  async function exportMonth() {
    const monthTasks = await api<TaskRow[]>(`tasks${qs({ month })}`).catch(() => [] as TaskRow[]);
    const rows: (string | number)[][] = [
      ["দিনভিত্তিক সারাংশ", monthLabel(month)],
      ["তারিখ", "দিন", "মোট কাজ", "সম্পন্ন", "সময়(মিনিট)"],
      ...(data?.report.perDay ?? []).map((d) => [d.date, WEEKDAYS_FULL_BN[new Date(d.date).getDay()], d.total, d.done, d.minutes]),
      [],
      ["সব কাজের বিবরণ"],
      ["তারিখ", "কাজ", "অবস্থা", "অগ্রাধিকার", "সময়(মিনিট)", "নোট"],
      ...monthTasks.map((t) => [t.dueDate, t.title, t.status, t.priority, t.timeSpentMins, t.notes ?? ""]),
    ];
    downloadCsv(`worklog-${month}.csv`, toCsv(rows));
    push("CSV ডাউনলোড শুরু হয়েছে", "success");
  }

  return (
    <>
      <PageHeader
        title="দৈনিক কাজের হিসাব"
        lead="যা করেছি, কত সময় লেগেছে আর কী বাকি — দিন ধরে ধরে হিসাব"
        crumbs={["হিসাব", "দৈনিক লগ"]}
        actions={
          <>
            <div className="lte-btn lte-btn-outline !gap-0 !p-0">
              <button className="px-2 py-1.5" onClick={() => setDate(addDays(date, -1))} aria-label="আগের দিন">
                <Icon name="chevron-left" />
              </button>
              <span className="border-x border-[#ced4da] px-2 text-[13px] font-semibold">{date === today ? "আজ" : fmtDate(date, { year: false })}</span>
              <button className="px-2 py-1.5" onClick={() => setDate(addDays(date, 1))} aria-label="পরের দিন">
                <Icon name="chevron-right" />
              </button>
            </div>
            <Btn variant="outline" icon="calendar" onClick={() => setDate(today)}>
              আজ
            </Btn>
            <Btn variant="outline" icon="download" onClick={exportMonth}>
              CSV
            </Btn>
            <Btn variant="primary" icon="plus" onClick={() => setEditing({ open: true, task: null })}>
              কাজ যোগ
            </Btn>
          </>
        }
      />

      <LteCard variant="secondary" icon="calendar" title={`${monthLabel(month)} — দিনভিত্তিক হিসাব`} tools={<Badge tone="soft-primary">ক্লিক করে দিন বদলান</Badge>}>
        <MonthStrip
          month={month}
          stats={stripStats}
          today={today}
          selected={date}
          onSelect={(d) => {
            setDate(d);
            router.replace(`/log${qs({ date: d })}`);
          }}
        />
      </LteCard>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallBox tone="primary" icon="list" value={tasks.length} label="ওই দিনের কাজ" sub={`${doneCount} টি সম্পন্ন`} />
        <SmallBox tone="success" icon="check" value={fmtMins(taskMinutes)} label="কাজে দেওয়া সময়" sub="টাস্ক অনুযায়ী" />
        <SmallBox tone="info" icon="book" value={logs.length} label="লগ এন্ট্রি" sub={`${fmtMins(logMinutes)} নোট করা`} />
        <SmallBox tone={leftover.length ? "danger" : "dark"} icon="alert" value={leftover.length} label="বাকি" sub={leftover.length ? "পরের দিনে ঠেলে দিন" : "দারুণ, সব শেষ!"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LteCard
            variant={leftover.length ? "warning" : "success"}
            icon="list"
            title={`${fmtDate(date, { weekday: true })} এর তালিকা`}
            tools={
              leftover.length ? (
                <Btn size="sm" variant="outline-primary" icon="arrow-right" onClick={() => void pushLeftoverToTomorrow()}>
                  বাকি {leftover.length} টি কালকে ঠেলে দিন
                </Btn>
              ) : null
            }
          >
            {loading && !data ? (
              <Loading />
            ) : (
              <TaskList
                tasks={tasks}
                actions={actions}
                onEdit={(t) => setEditing({ open: true, task: t })}
                emptyTitle="ওই দিনের কোনো কাজ নেই"
                emptyText="টুডু লিস্ট থেকে কাজ যোগ করুন বা মাসিক প্ল্যান থেকে ঐ মাসের কাজ তৈরি করুন।"
                emptyAction={
                  <Link href="/plan">
                    <Btn size="sm" variant="outline-primary" icon="calendar">
                      মাসিক প্ল্যান
                    </Btn>
                  </Link>
                }
              />
            )}
          </LteCard>
        </div>

        <div>
          <LteCard variant="primary" icon="trending" title="দিনের সারাংশ">
            <div className="flex items-center gap-3">
              <CircleProgress value={tasks.length ? (doneCount / tasks.length) * 100 : 0} tone={doneCount === tasks.length && tasks.length ? "#28a745" : "#007bff"} label="দিনের" />
              <div className="flex-1">
                <p className="m-0 text-[13px] leading-relaxed text-[#495057]">
                  {tasks.length
                    ? `${tasks.length} টির মধ্যে ${doneCount} টি সম্পন্ন। মোট ${fmtMins(taskMinutes + logMinutes)} সময় ব্যয়।`
                    : "এই দিনে এখনো কোনো রেকর্ড নেই।"}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <InfoBox label="এ মাসে সম্পন্ন" value={`${data?.report.totals.done ?? 0} টি`} icon="check" tone="#28a745" />
              <InfoBox label="এ মাসে সময়" value={fmtMins((data?.report.totals.minutes ?? 0) + (data?.report.totals.logMinutes ?? 0))} icon="clock" tone="#17a2b8" />
            </div>
          </LteCard>

          <LteCard variant="info" icon="book" title="নতুন নোট যোগ করুন">
            <form onSubmit={addLog} className="flex flex-col gap-2">
              <Field label="কী করলেন?">
                <textarea
                  className="lte-form-control min-h-[76px]"
                  placeholder="যেমন: ক্লায়েন্ট রিপোর্টের ড্রাফট শেষ, ৩টি ইমেইলের রিপ্লাই দেওয়া হয়েছে…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Field>
              <Field label="সময় (মিনিট)">
                <div className="flex gap-2">
                  <input type="number" min={0} step={5} className="lte-form-control" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
                  {[15, 30, 60, 90].map((m) => (
                    <button key={m} type="button" className="lte-btn lte-btn-outline lte-btn-sm" onClick={() => setMinutes(m)}>
                      {m}
                    </button>
                  ))}
                </div>
              </Field>
              <Btn type="submit" variant="info" icon="plus">
                হিসাবে যোগ করুন
              </Btn>
            </form>

            <div className="mt-4 border-t border-[#f1f3f5] pt-3">
              <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#6c757d]">ওই দিনের নোট • {logs.length}</p>
              {logs.length ? (
                <ul className="lte-timeline">
                  {logs.map((l) => (
                    <li key={l.id} className="lte-timeline-item done">
                      <div className="flex items-start justify-between gap-2">
                        <p className="m-0 text-[13.5px] leading-snug text-[#343a40]">{l.content}</p>
                        <button className="text-[#adb5bd] hover:text-[#dc3545]" onClick={() => void removeLog(l.id)} aria-label="মুছুন">
                          <Icon name="trash" className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="m-0 text-[12px] text-[#6c757d]">
                        {l.minutes ? `${fmtMins(l.minutes)} • ` : ""}
                        {new Date(l.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-[13px] text-[#6c757d]">আজকের নোট এখনো নেই। কাজ সম্পন্ন করলে স্বয়ংক্রিয়ভাবে এন্ট্রি যোগ হবে।</p>
              )}
            </div>
          </LteCard>
        </div>
      </div>

      <LteCard variant="dark" icon="inbox" title="এ মাসের লগ (সব দিন)" tools={<Badge tone="secondary">{data?.report.totals.logEntries ?? 0} এন্ট্রি</Badge>}>
        {loading && !data ? (
          <Loading />
        ) : (
          <MonthLog month={month} />
        )}
      </LteCard>

      <TaskModal
        open={editing.open}
        initial={editing.task}
        categories={data?.cats ?? []}
        defaultDate={date}
        onClose={() => setEditing({ open: false, task: null })}
        onSaved={() => void refetch()}
      />
    </>
  );
}

function MonthLog({ month }: { month: string }) {
  const { data, loading } = useQuery(() => api<LogRow[]>(`logs${qs({ month })}`), [month]);
  if (loading && !data) return <Loading />;
  if (!data?.length)
    return <EmptyState icon="book" title="এই মাসে কোনো লগ নেই" text="প্রতিদিনের কাজ শেষ করার সাথে সাথে এখানে হিসাব জমা হবে।" />;
  const grouped = new Map<string, LogRow[]>();
  for (const l of data) grouped.set(l.logDate, [...(grouped.get(l.logDate) ?? []), l]);
  return (
    <div className="lte-scroll-x">
      <table className="lte-table">
        <thead>
          <tr>
            <th>তারিখ</th>
            <th>বিবরণ</th>
            <th className="text-right">সময়</th>
          </tr>
        </thead>
        <tbody>
          {[...grouped.entries()].map(([d, items]) => (
            <tr key={d}>
              <td className="whitespace-nowrap align-top font-semibold text-[#343a40]">
                {fmtDate(d)}
                <span className="block text-[11.5px] font-normal text-[#868e96]">{WEEKDAYS_FULL_BN[new Date(d).getDay()]}</span>
              </td>
              <td>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {items.map((i) => (
                    <li key={i.id} className="text-[13.5px] text-[#495057]">
                      • {i.content}
                    </li>
                  ))}
                </ul>
              </td>
              <td className="whitespace-nowrap text-right text-[13px] text-[#6c757d]">{fmtMins(items.reduce((acc, i) => acc + (i.minutes || 0), 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
