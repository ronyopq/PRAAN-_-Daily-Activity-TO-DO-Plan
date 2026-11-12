"use client";

import { useCallback, useState } from "react";
import { BarChart, MonthCalendar } from "@/components/calendar";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/Shell";
import { Badge, Btn, CircleProgress, EmptyState, InfoBox, LteCard, Loading, Progress, SmallBox, useToast } from "@/components/ui";
import { api, qs, useQuery } from "@/lib/client";
import {
  currentMonth,
  downloadCsv,
  fmtDate,
  fmtMins,
  monthLabel,
  monthOf,
  shiftMonth,
  toCsv,
  todayISO,
  WEEKDAYS_FULL_BN,
} from "@/lib/utils";

type ReportData = {
  month: string;
  totals: { total: number; done: number; pending: number; skipped: number; minutes: number; rate: number; logEntries: number; logMinutes: number };
  perDay: { date: string; total: number; done: number; overdue: number; minutes: number }[];
  perCategory: { name: string; color: string; total: number; done: number; minutes: number }[];
  recentLogs: { id: number; logDate: string; content: string; minutes: number }[];
};

type TaskRow = {
  id: number;
  title: string;
  dueDate: string;
  dueTime: string | null;
  status: string;
  priority: string;
  timeSpentMins: number;
  categoryName: string | null;
  notes: string | null;
};

export default function ReportsPage() {
  const today = todayISO();
  const [month, setMonth] = useState(currentMonth());
  const { push } = useToast();

  const loader = useCallback(async () => {
    const [report, tasks] = await Promise.all([
      api<ReportData>(`reports${qs({ month })}`),
      api<TaskRow[]>(`tasks${qs({ month })}`),
    ]);
    return { report, tasks };
  }, [month]);

  const { data, loading } = useQuery(loader, [month]);
  const report = data?.report;

  const bestDay = (report?.perDay ?? []).reduce(
    (acc, d) => (d.done > (acc?.done ?? 0) ? d : acc),
    null as null | { date: string; done: number },
  );

  const calendarStats = Object.fromEntries(
    (report?.perDay ?? []).map((d) => [d.date, { total: d.total, done: d.done, minutes: d.minutes }]),
  ) as Record<string, { total: number; done: number; minutes: number }>;

  async function exportMonth() {
    if (!data) return;
    const rows: (string | number)[][] = [
      [`কাজের হিসাব — মাসিক রিপোর্ট, ${monthLabel(report?.month ?? month)}`],
      ["মোট কাজ", report?.totals.total ?? 0, "সম্পন্ন", report?.totals.done ?? 0, "সময়(মিনিট)", report?.totals.minutes ?? 0],
      [],
      ["তারিখ", "দিন", "মোট", "সম্পন্ন", "বাদ", "সময়"],
      ...(report?.perDay ?? []).map((d) => [d.date, WEEKDAYS_FULL_BN[new Date(d.date).getDay()], d.total, d.done, d.overdue, d.minutes]),
      [],
      ["তারিখ", "কাজ", "অবস্থা", "অগ্রাধিকার", "শ্রেণি", "সময়(মিনিট)", "নোট"],
      ...data.tasks.map((t) => [t.dueDate, t.title, t.status, t.priority, t.categoryName ?? "", t.timeSpentMins, t.notes ?? ""]),
    ];
    downloadCsv(`report-${month}.csv`, toCsv(rows));
    push("রিপোর্ট CSV ডাউনলোড হচ্ছে", "success");
  }

  return (
    <>
      <PageHeader
        title="মাসিক রিপোর্ট"
        lead="প্ল্যান অনুযায়ী কতটুকু হলো, কোন দিনে কত কাজ — সব হিসাব"
        crumbs={["হিসাব", "রিপোর্ট"]}
        actions={
          <>
            <div className="lte-btn lte-btn-outline !gap-0 !p-0">
              <button className="px-2 py-1.5" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="আগের মাস">
                <Icon name="chevron-left" />
              </button>
              <span className="border-x border-[#ced4da] px-2 text-[13px] font-semibold">{monthLabel(month)}</span>
              <button className="px-2 py-1.5" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="পরের মাস">
                <Icon name="chevron-right" />
              </button>
            </div>
            <Btn variant="outline" icon="download" onClick={() => void exportMonth()}>
              CSV এক্সপোর্ট
            </Btn>
            <Btn variant="secondary" icon="eye" onClick={() => window.print()}>
              প্রিন্ট
            </Btn>
          </>
        }
      />

      {loading && !data ? (
        <Loading />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SmallBox tone="primary" icon="list" value={report?.totals.total ?? 0} label="মোট কাজ" sub={`${report?.totals.pending ?? 0} টি বাকি`} />
            <SmallBox tone="success" icon="check" value={report?.totals.done ?? 0} label="সম্পন্ন" sub={`${report?.totals.rate ?? 0}% কমপ্লিশন`} />
            <SmallBox tone="info" icon="clock" value={fmtMins(report?.totals.minutes ?? 0)} label="কাজে ব্যয় Time" sub={`নোটে ${fmtMins(report?.totals.logMinutes ?? 0)}`} />
            <SmallBox tone="dark" icon="trending" value={bestDay ? bestDay.done : 0} label="সেরা দিনে সম্পন্ন" sub={bestDay ? fmtDate(bestDay.date, { year: false }) : "—"} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <LteCard variant="success" icon="chart" title="দিনে দিনে সম্পন্ন কাজ" tools={<Badge tone="soft-success">{monthLabel(month)}</Badge>}>
                <BarChart
                  height={170}
                  tone="#007bff"
                  data={(report?.perDay ?? []).map((d) => ({
                    label: String(Number(d.date.slice(-2))),
                    value: d.done,
                    sub: `${d.done}/${d.total}`,
                    highlight: d.date === today,
                  }))}
                />
                <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-[#f1f3f5] pt-2 text-[12px] text-[#6c757d]">
                  <span>মাসে মোট কাজ: <b className="text-[#343a40]">{report?.totals.total ?? 0}</b></span>
                  <span>সম্পন্ন: <b className="text-[#28a745]">{report?.totals.done ?? 0}</b></span>
                  <span>বাদ পড়েছে: <b className="text-[#6c757d]">{report?.totals.skipped ?? 0}</b></span>
                  <span>লগ এন্ট্রি: <b className="text-[#17a2b8]">{report?.totals.logEntries ?? 0}</b></span>
                </div>
              </LteCard>

              <LteCard variant="primary" icon="calendar" title="ক্যালেন্ডার ভিউ">
                <MonthCalendar month={month} stats={calendarStats} today={monthOf(today) === month ? today : undefined} label={monthLabel(month)} />
              </LteCard>
            </div>

            <div>
              <LteCard variant="dark" icon="trending" title="সামগ্রিক অগ্রগতি">
                <div className="flex flex-col items-center gap-2">
                  <CircleProgress value={report?.totals.rate ?? 0} size={140} tone="#28a745" label="এ মাসের" />
                  <p className="m-0 text-center text-[13px] text-[#495057]">
                    {report?.totals.done ?? 0} / {report?.totals.total ?? 0} কাজ শেষ হয়েছে
                  </p>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  <InfoBox label="প্ল্যানের সংখ্যা" value={(report?.perCategory ?? []).length ? `${(report?.perDay ?? []).filter((d) => d.total > 0).length} দিনে কাজ` : "—"} icon="repeat" tone="#007bff" />
                  <InfoBox label="মোট ব্যয় সময়" value={fmtMins((report?.totals.minutes ?? 0) + (report?.totals.logMinutes ?? 0))} icon="clock" tone="#17a2b8" />
                </div>
              </LteCard>

              <LteCard variant="info" icon="briefcase" title="শ্রেণি অনুযায়ী হিসাব">
                {report?.perCategory.length ? (
                  <div className="flex flex-col gap-3">
                    {report.perCategory.map((c) => (
                      <div key={c.name}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-[13.5px]">
                          <span className="inline-flex items-center gap-2 font-semibold text-[#343a40]">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                            {c.name}
                          </span>
                          <span className="text-[#6c757d]">
                            {c.done}/{c.total} • {fmtMins(c.minutes)}
                          </span>
                        </div>
                        <Progress value={c.total ? (c.done / c.total) * 100 : 0} tone={c.color} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="briefcase" title="এ মাসে কোনো কাজ নেই" text="কাজ যোগ করে সম্পন্ন করলে এখানে ভাগ হয়ে যাবে।" />
                )}
              </LteCard>
            </div>
          </div>

          <LteCard variant="secondary" icon="book" title="দিনের লগ এন্ট্রি" tools={<Badge tone="secondary">{report?.totals.logEntries ?? 0} টি</Badge>} bodyClassName="!p-0">
            {report?.recentLogs.length ? (
              <div className="lte-scroll-x">
                <table className="lte-table">
                  <thead>
                    <tr>
                      <th>তারিখ</th>
                      <th>কী করেছেন</th>
                      <th className="text-right">সময়</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.recentLogs.map((l) => (
                      <tr key={l.id}>
                        <td className="whitespace-nowrap text-[13px] font-semibold text-[#343a40]">{fmtDate(l.logDate, { year: false })}</td>
                        <td className="text-[13.5px] text-[#495057]">{l.content}</td>
                        <td className="whitespace-nowrap text-right text-[13px] text-[#6c757d]">{l.minutes ? fmtMins(l.minutes) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3">
                <EmptyState icon="book" title="এ মাসে কোনো লগ নেই" text="কাজ শেষ করলে বা দিনের নোট লিখলে এখানে জমা হবে।" />
              </div>
            )}
          </LteCard>
        </>
      )}
    </>
  );
}
