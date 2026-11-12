"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { BarChart } from "@/components/calendar";
import { TaskModal } from "@/components/forms";
import { Icon } from "@/components/icons";
import { PageHeader, useShell } from "@/components/Shell";
import { TaskList, useTaskActions } from "@/components/task";
import { Badge, Btn, CircleProgress, EmptyState, InfoBox, LteCard, Loading, SmallBox, useToast } from "@/components/ui";
import { api, qs, useQuery } from "@/lib/client";
import {
  addDays,
  fmtDate,
  fmtMins,
  monthLabel,
  monthOf,
  todayISO,
  WEEKDAYS_FULL_BN,
  type CategoryRow,
  type LogRow,
  type PlanRow,
  type TaskRow,
} from "@/lib/utils";

type ReportData = {
  month: string;
  totals: { total: number; done: number; pending: number; skipped: number; minutes: number; rate: number; logEntries: number; logMinutes: number };
  perDay: { date: string; total: number; done: number; overdue: number; minutes: number }[];
  perCategory: { name: string; color: string; total: number; done: number; minutes: number }[];
  recentLogs: LogRow[];
};

export default function DashboardPage() {
  const today = todayISO();
  const month = monthOf(today);
  const { push } = useToast();
  const { reminders, refreshReminders } = useShell();
  const [editing, setEditing] = useState<{ open: boolean; task: TaskRow | null }>({ open: false, task: null });
  const [quick, setQuick] = useState("");
  const [generating, setGenerating] = useState(false);

  const loader = useCallback(async () => {
    const [tasksToday, overdue, upcoming, cats, report, logs, plans] = await Promise.all([
      api<TaskRow[]>(`tasks${qs({ date: today })}`),
      api<TaskRow[]>(`tasks${qs({ view: "overdue", today })}`),
      api<TaskRow[]>(`tasks${qs({ view: "upcoming", today })}`),
      api<CategoryRow[]>("categories"),
      api<ReportData>(`reports${qs({ month })}`),
      api<LogRow[]>(`logs${qs({ date: today })}`),
      api<PlanRow[]>(`plans${qs({ month })}`),
    ]);
    return { tasksToday, overdue, upcoming, cats, report, logs, plans };
  }, [today, month]);

  const { data, loading, refetch, setData } = useQuery(loader, [today, month]);
  const actions = useTaskActions(refetch);

  const genToday = useCallback(
    async (silent = false) => {
      setGenerating(true);
      try {
        const res = await api<{ created: number }>("generate", { method: "POST", body: { fromDate: today, toDate: today } });
        if (!silent) {
          push(res.created ? `${res.created} টি প্ল্যান-কাজ আজকের তালিকায় যোগ হয়েছে` : "আজকের জন্য নতুন কাজ তৈরি করার মতো প্ল্যান নেই", res.created ? "success" : "info");
        }
        await refetch();
        await refreshReminders();
      } catch (err) {
        if (!silent) push(err instanceof Error ? err.message : "তৈরি করা যায়নি", "danger");
      } finally {
        setGenerating(false);
      }
    },
    [today, refetch, refreshReminders, push],
  );

  useEffect(() => {
    const key = `kh-gen-${today}`;
    if (typeof window === "undefined" || localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    void (async () => {
      const res = await api<{ created: number }>("generate", { method: "POST", body: { fromDate: today, toDate: today } }).catch(() => null);
      if (res?.created) await refetch();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const todayDone = data?.tasksToday.filter((t) => t.status === "done").length ?? 0;
  const todayOpen = (data?.tasksToday.length ?? 0) - todayDone;
  const week = useMemo(() => {
    const days = data?.report.perDay ?? [];
    const byDate = new Map(days.map((d) => [d.date, d]));
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, -6 + i);
      const entry = byDate.get(date);
      return { label: WEEKDAYS_FULL_BN[new Date(date).getDay()].slice(0, 3), value: entry?.done ?? 0, sub: entry ? `${entry.done}/${entry.total}` : "" };
    });
  }, [data, today]);

  const alerts = (reminders?.counts.overdue ?? data?.overdue.length ?? 0) + (reminders?.counts.dueToday ?? 0);

  async function quickAdd(e: FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title) return;
    setQuick("");
    const created = await api<TaskRow>("tasks", { method: "POST", body: { title, dueDate: today } }).catch((err) => {
      push(err instanceof Error ? err.message : "যোগ করা যায়নি", "danger");
      return null;
    });
    if (!created) return;
    setData((prev) => (prev ? { ...prev, tasksToday: [...prev.tasksToday, created] } : prev));
    push("আজকের তালিকায় যোগ হয়েছে", "success");
    void refreshReminders();
  }

  return (
    <>
      <PageHeader
        title="ড্যাশবোর্ড"
        lead={`${WEEKDAYS_FULL_BN[new Date().getDay()]}, ${fmtDate(today)} • ${monthLabel(month)}`}
        actions={
          <>
            <Btn variant="outline-primary" icon="repeat" onClick={() => void genToday()} disabled={generating}>
              {generating ? "তৈরি হচ্ছে…" : "প্ল্যান থেকে আজকের কাজ"}
            </Btn>
            <Btn variant="primary" icon="plus" onClick={() => setEditing({ open: true, task: null })}>
              নতুন কাজ
            </Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallBox tone="primary" icon="list" value={data?.tasksToday.length ?? "—"} label="আজকের মোট কাজ" sub={`${todayOpen} টি বাকি`} />
        <SmallBox tone="success" icon="check" value={todayDone} label="আজ সম্পন্ন" sub={`${monthLabel(month)} এ ${data?.report.totals.done ?? 0} টি`} />
        <SmallBox tone="danger" icon="alert" value={data?.overdue.length ?? "—"} label="ওভারডিউ (আগের দিন)" sub="যত দ্রুত সম্ভব শেষ করুন" />
        <SmallBox tone="warning" icon="clock" value={fmtMins(data?.report.totals.minutes ?? 0)} label={`${monthLabel(month)} এর মোট সময়`} sub={`${data?.report.totals.logEntries ?? 0} লগ এন্ট্রি`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LteCard
            variant="primary"
            icon="calendar"
            title="আজকের রুটিন"
            tools={
              <>
                <Badge tone="secondary">{data?.tasksToday.length ?? 0} টি</Badge>
                <Link href="/log" className="text-[13px] font-semibold text-[#007bff] hover:underline">
                  পুরনো দিন দেখুন
                </Link>
              </>
            }
            footer={
              <form onSubmit={quickAdd} className="flex flex-wrap items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#eef6ff] text-[#007bff]">
                  <Icon name="plus" className="h-4 w-4" />
                </span>
                <input
                  className="lte-form-control flex-1"
                  placeholder="দ্রুত একটি কাজ লিখে Enter চাপুন…"
                  value={quick}
                  onChange={(e) => setQuick(e.target.value)}
                />
                <Btn type="submit" variant="primary" size="sm">
                  যোগ করুন
                </Btn>
              </form>
            }
          >
            {loading && !data ? (
              <Loading label="আজকের তালিকা আসছে…" />
            ) : (
              <TaskList
                tasks={data?.tasksToday ?? []}
                actions={actions}
                onEdit={(t) => setEditing({ open: true, task: t })}
                emptyTitle="আজকের জন্য কোনো কাজ তালিকায় নেই"
                emptyText="মাসিক ওয়ার্কপ্ল্যান থেকে আজকের কাজ তৈরি করুন, অথবা নিচে দ্রুত যোগ করুন।"
                emptyAction={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Btn variant="outline-primary" size="sm" icon="repeat" onClick={() => void genToday()} disabled={generating}>
                      প্ল্যান থেকে তৈরি করুন
                    </Btn>
                    <Btn variant="primary" size="sm" icon="plus" onClick={() => setEditing({ open: true, task: null })}>
                      নতুন কাজ
                    </Btn>
                  </div>
                }
              />
            )}
          </LteCard>
        </div>

        <div>
          <LteCard variant="danger" icon="bell" title="রিমাইন্ডার বোর্ড" tools={<Badge tone={alerts ? "danger" : "success"}>{alerts ? `${alerts} টি বাকি` : "পরিষ্কার"}</Badge>}>
            {loading && !data ? (
              <Loading />
            ) : (
              <>
                {reminders?.missingPlans.length ? (
                  <div className="lte-alert lte-alert-warning flex items-start gap-2">
                    <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="text-[13px]">
                      আজকের {reminders.missingPlans.length} টি প্ল্যান এখনও তালিকায় নেই।{" "}
                      <button className="font-bold underline" onClick={() => void genToday()}>
                        এখনই তৈরি করুন
                      </button>
                    </span>
                  </div>
                ) : null}
                {data?.overdue.length ? (
                  <div className="mb-3">
                    <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#dc3545]">ওভারডিউ • {data.overdue.length}</p>
                    <ul className="lte-todo">
                      {data.overdue.slice(0, 4).map((t) => (
                        <li key={t.id} className="priority-urgent !py-2">
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[14px] font-semibold">{t.title}</p>
                            <p className="m-0 text-[12px] text-[#dc3545]">
                              {fmtDate(t.dueDate)} • {Math.round((Date.now() - new Date(t.dueDate).getTime()) / 86400000)} দিন পেরিয়েছে
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Btn size="sm" variant="success" icon="check" onClick={() => void actions.finish(t, true)}>
                              শেষ
                            </Btn>
                            <Btn size="sm" variant="outline" icon="arrow-right" onClick={() => void actions.postpone(t, 1)} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {reminders?.dueNow.length ? (
                  <div className="mb-3">
                    <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#e0a800]">এখন সময় হয়েছে</p>
                    <ul className="lte-todo">
                      {reminders.dueNow.slice(0, 4).map((t) => (
                        <li key={t.id} className="priority-medium !py-2">
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[14px] font-semibold">{t.title}</p>
                            <p className="m-0 text-[12px] text-[#6c757d]">ডিউ {t.dueTime ? `${t.dueTime}` : "আজ"} • {t.categoryName ?? "সাধারণ"}</p>
                          </div>
                          <Btn size="sm" variant="success" icon="check" onClick={() => void actions.finish(t, true)}>
                            সম্পন্ন
                          </Btn>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {data?.upcoming.length ? (
                  <div>
                    <p className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#17a2b8]">আসন্ন ১৪ দিন • {data.upcoming.length}</p>
                    <ul className="lte-todo">
                      {data.upcoming.slice(0, 3).map((t) => (
                        <li key={t.id} className="!border-l-[#17a2b8] !py-2">
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[14px] font-semibold">{t.title}</p>
                            <p className="m-0 text-[12px] text-[#6c757d]">{fmtDate(t.dueDate, { weekday: true })}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {!alerts && !data?.upcoming.length ? <EmptyState icon="check" title="সব ঠিক আছে" text="এই মুহূর্তে কোনো ওভারডিউ বা ডিউ কাজ নেই।" /> : null}
              </>
            )}
            <div className="mt-3 border-t border-[#f1f3f5] pt-2 text-right">
              <Link href="/reminders" className="text-[13px] font-semibold text-[#007bff] hover:underline">
                সব রিমাইন্ডার →
              </Link>
            </div>
          </LteCard>

          <LteCard variant="success" icon="trending" title="এ মাসের অগ্রগতি">
            <div className="flex items-center gap-4">
              <CircleProgress value={data?.report.totals.rate ?? 0} tone="#28a745" label="সম্পন্ন" />
              <div className="grid flex-1 grid-cols-2 gap-2">
                <InfoBox label="মোট পরিকল্পিত" value={data?.report.totals.total ?? 0} icon="list" tone="#007bff" />
                <InfoBox label="সম্পন্ন" value={data?.report.totals.done ?? 0} icon="check" tone="#28a745" />
                <InfoBox label="বাদ পড়েছে" value={data?.report.totals.skipped ?? 0} icon="minus" tone="#6c757d" />
                <InfoBox label="মোট সময়" value={fmtMins(data?.report.totals.minutes ?? 0)} icon="clock" tone="#17a2b8" />
              </div>
            </div>
          </LteCard>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <LteCard variant="info" icon="chart" title="গত ৭ দিনে যা শেষ হয়েছে" tools={<Link href="/reports" className="text-[13px] font-semibold text-[#007bff]">রিপোর্ট →</Link>}>
          <BarChart data={week} tone="#17a2b8" />
        </LteCard>

        <LteCard
          variant="secondary"
          icon="book"
          title="আজকের কাজের হিসাব"
          tools={
            <Link href="/log" className="text-[13px] font-semibold text-[#007bff]">
              খুলুন →
            </Link>
          }
        >
          {data?.logs.length ? (
            <ul className="lte-timeline">
              {data.logs.slice(0, 6).map((l) => (
                <li key={l.id} className="lte-timeline-item done">
                  <p className="m-0 text-[13.5px] leading-snug text-[#343a40]">{l.content}</p>
                  <p className="m-0 text-[12px] text-[#6c757d]">
                    {new Date(l.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                    {l.minutes ? ` • ${fmtMins(l.minutes)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="book"
              title="আজ এখনো কোনো লগ নেই"
              text="কাজ শেষ করার সাথে সাথে এখানে স্বয়ংক্রিয়ভাবে এন্ট্রি যোগ হবে।"
              action={
                <Link href="/log">
                  <Btn size="sm" variant="outline-primary" icon="plus">
                    নোট লিখুন
                  </Btn>
                </Link>
              }
            />
          )}
        </LteCard>

        <LteCard
          variant="dark"
          icon="repeat"
          title="এ মাসের প্ল্যান"
          tools={
            <Link href="/plan" className="text-[13px] font-semibold text-[#007bff]">
              প্ল্যান →
            </Link>
          }
        >
          {data?.plans.length ? (
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {data.plans.slice(0, 7).map((p) => (
                <li key={p.id} className="flex items-center gap-2 border-b border-[#f6f7f8] py-1.5 last:border-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.categoryColor ?? "#6c757d" }} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#343a40]">{p.title}</span>
                  <span className="shrink-0 text-[12px] text-[#6c757d]">
                    {p.doneThisMonth ?? 0}/{p.hitsThisMonth ?? 0}
                  </span>
                  {!p.active ? <Badge tone="secondary">নিষ্ক্রিয়</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon="calendar"
              title="এ মাসের জন্য কোনো প্ল্যান নেই"
              text="একবার প্ল্যান বানালে প্রতিদিন কাজ স্বয়ংক্রিয়ভাবে তালিকায় চলে আসবে।"
              action={
                <Link href="/plan">
                  <Btn size="sm" variant="primary" icon="plus">
                    মাসিক প্ল্যান বানান
                  </Btn>
                </Link>
              }
            />
          )}
        </LteCard>
      </div>

      <TaskModal
        open={editing.open}
        initial={editing.task}
        categories={data?.cats ?? []}
        defaultDate={today}
        onClose={() => setEditing({ open: false, task: null })}
        onSaved={() => void refetch()}
      />
    </>
  );
}
