"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { MonthCalendar } from "@/components/calendar";
import { PlanModal } from "@/components/forms";
import { Icon } from "@/components/icons";
import { PageHeader, useShell } from "@/components/Shell";
import { Badge, Btn, EmptyState, InfoBox, LteCard, Loading, SmallBox, useToast } from "@/components/ui";
import { api, qs, useQuery } from "@/lib/client";
import {
  currentMonth,
  daysInMonth,
  fmtMins,
  monthDates,
  monthLabel,
  monthOf,
  pad2,
  parseCsvList,
  PRIORITY_BADGE,
  PRIORITY_LABEL,
  planMatchesDate,
  RECURRENCE_LABEL,
  shiftMonth,
  todayISO,
  type CategoryRow,
  type PlanRow,
  type Priority,
  type Recurrence,
} from "@/lib/utils";

type ReportData = {
  month: string;
  totals: { total: number; done: number; pending: number; skipped: number; minutes: number; rate: number };
  perDay: { date: string; total: number; done: number; minutes: number }[];
};

export default function PlanPage() {
  const today = todayISO();
  const [month, setMonth] = useState(currentMonth());
  const { push } = useToast();
  const { refreshReminders } = useShell();
  const [modal, setModal] = useState<{ open: boolean; plan: PlanRow | null }>({ open: false, plan: null });
  const [busy, setBusy] = useState(false);

  const loader = useCallback(async () => {
    const [plans, cats, report] = await Promise.all([
      api<PlanRow[]>(`plans${qs({ month })}`),
      api<CategoryRow[]>("categories"),
      api<ReportData>(`reports${qs({ month })}`),
    ]);
    return { plans, cats, report };
  }, [month]);

  const { data, loading, refetch } = useQuery(loader, [month]);
  const plans = data?.plans ?? [];

  const calendarStats = useMemo(() => {
    const dates = monthDates(month);
    const perDay = new Map((data?.report.perDay ?? []).map((d) => [d.date, d]));
    const out: Record<string, { total: number; done: number; minutes: number; colors: string[]; planned: number }> = {};
    for (const date of dates) {
      const matching = plans.filter(
        (p) => p.active && planMatchesDate({ recurrence: p.recurrence, weekdays: p.weekdays, monthDays: p.monthDays }, date),
      );
      const stat = perDay.get(date);
      out[date] = {
        total: stat?.total ?? matching.length,
        done: stat?.done ?? 0,
        minutes: stat?.minutes ?? 0,
        colors: matching.map((p) => p.categoryColor ?? "#007bff"),
        planned: matching.length,
      };
    }
    return out;
  }, [month, plans, data]);

  const summary = useMemo(() => {
    let days = 0;
    let items = 0;
    let minutes = 0;
    for (const p of plans) {
      const hits = monthDates(month).filter((d) => planMatchesDate({ recurrence: p.recurrence, weekdays: p.weekdays, monthDays: p.monthDays }, d)).length;
      days += hits;
      items += hits;
      minutes += hits * (p.estimatedMins || 0);
    }
    const activeDays = monthDates(month).filter((d) => plans.some((p) => p.active && planMatchesDate({ recurrence: p.recurrence, weekdays: p.weekdays, monthDays: p.monthDays }, d))).length;
    return { days: items, items, minutes, activeDays, total: monthDates(month).length };
  }, [plans, month]);

  async function generateMonth() {
    const total = daysInMonth(month);
    setBusy(true);
    try {
      const res = await api<{ created: number; requested: number }>("generate", {
        method: "POST",
        body: { fromDate: `${month}-01`, toDate: `${month}-${pad2(total)}` },
      });
      push(res.created ? `${res.created} টি কাজ ${monthLabel(month)} এর তালিকায় তৈরি হয়েছে` : "সব কাজ আগেই তৈরি আছে", res.created ? "success" : "info");
      await refetch();
      await refreshReminders();
    } catch (err) {
      push(err instanceof Error ? err.message : "তৈরি করা যায়নি", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function togglePlan(p: PlanRow) {
    await api(`plans/${p.id}`, { method: "PATCH", body: { active: !p.active } }).catch((err) =>
      push(err instanceof Error ? err.message : "পারিনি", "danger"),
    );
    push(p.active ? "প্ল্যান নিষ্ক্রিয় করা হয়েছে" : "প্ল্যান আবার সক্রিয়", "info");
    await refetch();
  }

  async function deletePlan(p: PlanRow) {
    if (!window.confirm(`"${p.title}" প্ল্যানটি মুছে যাবে — এর থেকে তৈরি কাজগুলোও মুছে ফেলা হবে। নিশ্চিত?`)) return;
    await api(`plans/${p.id}`, { method: "DELETE" }).catch((err) => push(err instanceof Error ? err.message : "মোছা যায়নি", "danger"));
    push("প্ল্যান মুছে ফেলা হয়েছে", "info");
    await refetch();
  }

  return (
    <>
      <PageHeader
        title="মাসিক ওয়ার্কপ্ল্যান"
        lead="মাসের শুরুতেই ঠিক করে দিন কোন দিনে কোন কাজ চলবে — বাকিটা টুডু লিস্ট ও রিমাইন্ডার নিজে সামলাবে"
        crumbs={["পরিকল্পনা", "মাসিক ওয়ার্কপ্ল্যান"]}
        actions={
          <>
            <div className="lte-btn lte-btn-outline !cursor-default">
              <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="আগের মাস">
                <Icon name="chevron-left" />
              </button>
              <span className="px-1 font-semibold">{monthLabel(month)}</span>
              <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="পরের মাস">
                <Icon name="chevron-right" />
              </button>
            </div>
            <Btn variant="outline-primary" icon="repeat" onClick={generateMonth} disabled={busy}>
              {busy ? "তৈরি হচ্ছে…" : `${monthLabel(month)} এর কাজ তৈরি`}
            </Btn>
            <Btn variant="primary" icon="plus" onClick={() => setModal({ open: true, plan: null })}>
              নতুন প্ল্যান
            </Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallBox tone="dark" icon="repeat" value={plans.length} label="এ মাসের প্ল্যান" sub={`${plans.filter((p) => p.active).length} টি সক্রিয়`} />
        <SmallBox tone="primary" icon="calendar" value={`${summary.activeDays}/${summary.total}`} label="দিনে কাজ আছে" sub={`${summary.items} টি কাজ তৈরি হবে`} />
        <SmallBox tone="info" icon="clock" value={fmtMins(summary.minutes)} label="আনুমানিক সময়" sub="প্ল্যান অনুযায়ী মাসজুড়ে" />
        <SmallBox tone="success" icon="check" value={data?.report.totals.done ?? 0} label="এ মাসে সম্পন্ন" sub={`${data?.report.totals.rate ?? 0}% হার`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LteCard
            variant="primary"
            icon="calendar"
            title="মাসের ক্যালেন্ডার প্রিভিউ"
            tools={<span className="text-[12px] text-[#6c757d]">যেকোনো দিনে ক্লিক করে ওই দিনের কাজ দেখুন</span>}
          >
            {loading && !data ? (
              <Loading />
            ) : (
              <MonthCalendar
                month={month}
                stats={calendarStats}
                today={monthOf(today) === month ? today : undefined}
                onPrev={() => setMonth(shiftMonth(month, -1))}
                onNext={() => setMonth(shiftMonth(month, 1))}
                label={monthLabel(month)}
                onSelect={(date) => {
                  window.location.href = `/log${qs({ date })}`;
                }}
              />
            )}
          </LteCard>
        </div>

        <div>
          <LteCard variant="secondary" icon="chart" title="এ মাসের প্ল্যান লোড">
            <div className="flex flex-col gap-2">
              <InfoBox label="মোট কাজের দিন" value={summary.activeDays} icon="calendar" tone="#007bff" />
              <InfoBox label="তৈরি হওয়া টাস্ক" value={`${data?.report.totals.total ?? 0}`} icon="list" tone="#17a2b8" />
              <InfoBox label="সম্পন্ন" value={`${data?.report.totals.done ?? 0} / ${data?.report.totals.total ?? 0}`} icon="check" tone="#28a745" />
              <InfoBox label="বাদ পড়েছে" value={data?.report.totals.skipped ?? 0} icon="minus" tone="#6c757d" />
            </div>
            <div className="lte-alert lte-alert-info mt-3 mb-0">
              <b>টিপস:</b> শুক্রবার সাপ্তাহিক বন্ধ রাখতে চাইলে প্ল্যান এডিট করে ঐ দিনটি আনচেক করুন।
            </div>
          </LteCard>

          <LteCard variant="warning" icon="spark" title="কীভাবে শুরু করবেন" tools={null}>
            <ol className="m-0 list-decimal pl-4 text-[13.5px] leading-relaxed text-[#495057]">
              <li>উপরের <b>নতুন প্ল্যান</b> বাটনে চাপুন।</li>
              <li>কাজের নাম, কতবার (প্রতিদিন / সপ্তাহে / মাসের তারিখ) ও রিমাইন্ডারের সময় দিন।</li>
              <li>শেষে <b>কাজ তৈরি</b> বাটনে চাপলে পুরো মাসের টুডু তৈরি হবে।</li>
            </ol>
          </LteCard>
        </div>
      </div>

      <LteCard
        variant="dark"
        icon="list"
        title="প্ল্যান তালিকা"
        tools={
          <>
            <Badge tone="secondary">{plans.length} টি</Badge>
            <Btn size="sm" variant="primary" icon="plus" onClick={() => setModal({ open: true, plan: null })}>
              যোগ করুন
            </Btn>
          </>
        }
        bodyClassName="!p-0"
      >
        {loading && !data ? (
          <Loading />
        ) : plans.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={`${monthLabel(month)} এর জন্য কোনো প্ল্যান নেই`}
            text="নতুন প্ল্যান যোগ করুন — প্রতিবার আলাদা করে লিখতে হবে না, ওই মাসের সব দিনে কাজ স্বয়ংক্রিয়ভাবে চলে আসবে।"
            action={
              <Btn size="sm" variant="primary" icon="plus" onClick={() => setModal({ open: true, plan: null })}>
                প্রথম প্ল্যান যোগ করুন
              </Btn>
            }
          />
        ) : (
          <div className="lte-scroll-x">
            <table className="lte-table">
              <thead>
                <tr>
                  <th>কাজ</th>
                  <th>কতবার</th>
                  <th>রিমাইন্ডার</th>
                  <th>অগ্রাধিকার</th>
                  <th>এ মাসে</th>
                  <th className="text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} className={!p.active ? "!opacity-60" : undefined}>
                    <td>
                      <div className="flex items-start gap-2">
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: p.categoryColor ?? "#adb5bd" }} />
                        <div className="min-w-0">
                          <p className="m-0 text-[14px] font-semibold text-[#343a40]">{p.title}</p>
                          {p.description ? <p className="m-0 line-clamp-1 text-[12px] text-[#6c757d]">{p.description}</p> : null}
                          <p className="m-0 text-[11.5px] text-[#868e96]">
                            {p.categoryName ?? "শ্রেণিবিহীন"} • ~{p.estimatedMins} মি
                          </p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge tone={p.active ? "soft-primary" : "secondary"}>{RECURRENCE_LABEL[p.recurrence as Recurrence] ?? p.recurrence}</Badge>
                      {p.recurrence === "weekly" ? (
                        <span className="mt-1 block text-[11.5px] text-[#6c757d]">
                          {parseCsvList(p.weekdays)
                            .map((d) => ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"][d])
                            .join(", ")}
                        </span>
                      ) : null}
                      {p.recurrence === "monthly" ? <span className="mt-1 block text-[11.5px] text-[#6c757d]">তারিখ: {p.monthDays}</span> : null}
                    </td>
                    <td className="whitespace-nowrap text-[13px]">
                      {p.dueTime ? (
                        <span className="inline-flex items-center gap-1 text-[#007bff]">
                          <Icon name="clock" className="h-3.5 w-3.5" />
                          {p.dueTime}
                        </span>
                      ) : (
                        <span className="text-[#adb5bd]">সারাদিন</span>
                      )}
                    </td>
                    <td>
                      <span className={`lte-badge ${PRIORITY_BADGE[p.priority as Priority]}`}>{PRIORITY_LABEL[p.priority as Priority]}</span>
                    </td>
                    <td>
                      <div className="text-[13px] font-semibold text-[#343a40]">
                        {p.doneThisMonth ?? 0}/{p.hitsThisMonth ?? 0} সম্পন্ন
                      </div>
                      <div className="lte-progress mt-1 !h-1.5">
                        <div
                          className="lte-progress-bar"
                          style={{
                            width: `${p.hitsThisMonth ? Math.round(((p.doneThisMonth ?? 0) / p.hitsThisMonth) * 100) : 0}%`,
                            background: "#28a745",
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-end gap-1">
                        <Btn size="sm" variant="outline" icon={p.active ? "pause" : "play"} onClick={() => void togglePlan(p)} title={p.active ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"} />
                        <Btn size="sm" variant="outline" icon="edit" onClick={() => setModal({ open: true, plan: p })} title="সম্পাদনা" />
                        <Btn size="sm" variant="outline" icon="trash" className="!text-[#dc3545]" onClick={() => void deletePlan(p)} title="মুছুন" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-[#f1f3f5] px-3 py-2 text-[12.5px] text-[#6c757d]">
          নতুন প্ল্যান যোগ করলে বা দিন বদলালে <b>{monthLabel(month)} এর কাজ তৈরি</b> বাটনে চাপ দিন — অথবা ড্যাশবোর্ড প্রতিদিন স্বয়ংক্রিয়ভাবে আজকের কাজ তৈরি করে নেয়।
        </div>
      </LteCard>

      <PlanModal
        open={modal.open}
        initial={modal.plan}
        month={month}
        categories={data?.cats ?? []}
        onClose={() => setModal({ open: false, plan: null })}
        onSaved={() => void refetch()}
      />
    </>
  );
}
