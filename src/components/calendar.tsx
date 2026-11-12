"use client";

import { cn, fmtMins, pad2, WEEKDAYS_BN, fromISO } from "@/lib/utils";
import { Icon } from "@/components/icons";

export type DayStat = { total: number; done: number; minutes?: number; planned?: number; colors?: string[] };

export function MonthCalendar({
  month,
  stats,
  selected,
  today,
  onSelect,
  onPrev,
  onNext,
  label,
}: {
  month: string;
  stats: Record<string, DayStat>;
  selected?: string | null;
  today?: string;
  onSelect?: (date: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  label?: string;
}) {
  const first = `${month}-01`;
  const offset = fromISO(first).getDay();
  const days = Object.keys(stats).length ? maxDay(month) : 30;
  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${pad2(i + 1)}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {onPrev ? (
            <button type="button" className="lte-btn lte-btn-outline lte-btn-sm" onClick={onPrev} aria-label="আগের মাস">
              <Icon name="chevron-left" />
            </button>
          ) : null}
          <h3 className="m-0 min-w-[132px] text-center text-[16px] font-semibold text-[#343a40]">{label ?? month}</h3>
          {onNext ? (
            <button type="button" className="lte-btn lte-btn-outline lte-btn-sm" onClick={onNext} aria-label="পরের মাস">
              <Icon name="chevron-right" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-3 text-[11.5px] text-[#6c757d]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#28a745]" /> সম্পন্ন
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#ffc107]" /> বাকি
          </span>
          <span className="inline-flex items-circle gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#dc3545]" /> ওভারডিউ
          </span>
        </div>
      </div>

      <div className="lte-cal">
        {WEEKDAYS_BN.map((d) => (
          <div key={d} className="lte-cal-head">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`b-${i}`} className="lte-cal-cell lte-cal-cell-empty !cursor-default !bg-transparent !border-transparent" />;
          const s = stats[date];
          const isToday = date === today;
          const allDone = !!s && s.total > 0 && s.done === s.total;
          const overdue = !!s && s.done < s.total && date < (today ?? "");
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect?.(date)}
              className={cn(
                "lte-cal-cell",
                isToday && "is-today",
                selected === date && "is-selected",
                allDone && "!bg-[#eef9f0]",
                overdue && "!bg-[#fdecee]",
              )}
            >
              <span className="flex items-center justify-between">
                <span className="day-num text-[#343a40]">{Number(date.slice(-2))}</span>
                {s?.total ? (
                  <span className={cn("text-[10.5px] font-bold", allDone ? "text-[#28a745]" : "text-[#6c757d]")}>
                    {s.done}/{s.total}
                  </span>
                ) : null}
              </span>
              <span className="mt-1 flex h-1.5 w-full overflow-hidden rounded bg-[#e9ecef]">
                {s?.total ? <span className="h-full bg-[#28a745]" style={{ width: `${(s.done / s.total) * 100}%` }} /> : null}
                {s && s.total > s.done ? (
                  <span className="h-full bg-[#ffc107]" style={{ width: `${((s.total - s.done) / s.total) * 100}%` }} />
                ) : null}
              </span>
              {s?.colors?.length ? (
                <span className="dots">
                  {s.colors.slice(0, 6).map((c, idx) => (
                    <span key={idx} className="dot" style={{ background: c }} />
                  ))}
                </span>
              ) : null}
              {s?.minutes ? <span className="mt-0.5 block text-[10px] text-[#868e96]">{fmtMins(s.minutes)}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function maxDay(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function MonthStrip({
  month,
  stats,
  today,
  selected,
  onSelect,
}: {
  month: string;
  stats: Record<string, DayStat>;
  today?: string;
  selected?: string;
  onSelect?: (d: string) => void;
}) {
  const total = maxDay(month);
  return (
    <div className="flex flex-wrap gap-1">
      {Array.from({ length: total }, (_, i) => `${month}-${pad2(i + 1)}`).map((date) => {
        const s = stats[date];
        const rate = s && s.total ? s.done / s.total : 0;
        const bg = !s?.total ? "#f1f3f5" : rate >= 1 ? "#28a745" : rate > 0 ? "#7ed957" : "#ffc107";
        return (
          <button
            key={date}
            type="button"
            onClick={() => onSelect?.(date)}
            title={`${date}${s?.total ? ` • ${s.done}/${s.total} সম্পন্ন` : ""}`}
            className={cn(
              "relative h-8 w-8 rounded border text-[11.5px] font-semibold transition",
              selected === date ? "border-[#343a40]" : "border-transparent",
              today === date && "!ring-2 !ring-[#007bff]",
            )}
            style={{ background: bg, color: rate >= 1 || (s && s.total > 0 && rate > 0) ? "#fff" : "#495057" }}
          >
            {Number(date.slice(-2))}
          </button>
        );
      })}
    </div>
  );
}

export function BarChart({
  data,
  tone = "#007bff",
  height = 130,
}: {
  data: { label: string; value: number; sub?: string; highlight?: boolean }[];
  tone?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="lte-bar-chart" style={{ height }}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="bar-col" title={`${d.label}: ${d.value}${d.sub ? ` (${d.sub})` : ""}`}>
          <span className="text-[11px] font-bold text-[#495057]">{d.value || ""}</span>
          <span
            className={cn("bar", !d.value && "zero")}
            style={{
              height: `${Math.max(3, (d.value / max) * 100)}%`,
              background: d.highlight ? "#28a745" : !d.value ? undefined : `linear-gradient(180deg, ${tone}, ${tone}bb)`,
            }}
          />
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
