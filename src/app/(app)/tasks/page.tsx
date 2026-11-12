"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TaskModal } from "@/components/forms";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/Shell";
import { TaskList, useTaskActions } from "@/components/task";
import { Badge, Btn, EmptyState, LteCard, Loading, SmallBox } from "@/components/ui";
import { api, qs, useDebounced, useQuery } from "@/lib/client";
import {
  currentMonth,
  downloadCsv,
  fmtDate,
  monthOf,
  toCsv,
  todayISO,
  type CategoryRow,
  type TaskRow,
} from "@/lib/utils";

const VIEWS = [
  { key: "open", label: "বাকি সব", icon: "list" },
  { key: "today", label: "আজ", icon: "calendar" },
  { key: "overdue", label: "ওভারডিউ", icon: "alert" },
  { key: "upcoming", label: "আসন্ন ১৪ দিন", icon: "clock" },
  { key: "month", label: "এ মাস", icon: "repeat" },
  { key: "all", label: "সব", icon: "inbox" },
];

export default function TasksPage() {
  const today = todayISO();
  const router = useRouter();
  const sp = useSearchParams();
  const [view, setView] = useState<string>(sp.get("view") || "open");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState(sp.get("q") || "");
  const q = useDebounced(search, 300);
  const [modal, setModal] = useState<{ open: boolean; task: TaskRow | null }>({ open: false, task: null });
  const [selected, setSelected] = useState<number[]>([]);
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    if (!sp.get("q")) return;
    setSearch(sp.get("q") ?? "");
    setView("all");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  const loader = useCallback(async () => {
    const query: Record<string, string> = { today };
    if (view === "overdue" || view === "upcoming" || view === "open" || view === "today") query.view = view;
    if (view === "month") query.month = month;
    if (status !== "all") query.status = status;
    if (priority !== "all") query.priority = priority;
    if (categoryId !== "all") query.categoryId = categoryId;
    if (q) query.q = q;
    const [tasks, cats] = await Promise.all([api<TaskRow[]>(`tasks${qs(query)}`), api<CategoryRow[]>("categories")]);
    return { tasks, cats };
  }, [view, status, priority, categoryId, q, today, month]);

  const { data, loading, refetch } = useQuery(loader, [view, status, priority, categoryId, q, today, month]);
  const actions = useTaskActions(refetch);
  const tasks = data?.tasks ?? [];

  const stats = useMemo(() => {
    const done = tasks.filter((t) => t.status === "done").length;
    const overdue = tasks.filter((t) => t.status !== "done" && t.dueDate < today).length;
    const todayCount = tasks.filter((t) => t.dueDate === today).length;
    return { done, overdue, todayCount, open: tasks.length - done };
  }, [tasks, today]);

  const grouped = useMemo(() => {
    if (view === "all" || view === "month" || view === "upcoming") {
      const map = new Map<string, TaskRow[]>();
      for (const t of tasks) {
        const key = t.dueDate;
        map.set(key, [...(map.get(key) ?? []), t]);
      }
      return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 40);
    }
    return [[view === "today" ? today : "", tasks]] as [string, TaskRow[]][];
  }, [tasks, view, today]);

  const toggleSelect = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));

  return (
    <>
      <PageHeader
        title="টুডু লিস্ট"
        lead="সব কাজ এক জায়গায় — ফিল্টার করুন, সিলেক্ট করে একসাথে সম্পন্ন করুন"
        crumbs={["পরিকল্পনা", "টুডু লিস্ট"]}
        actions={
          <>
            <Btn
              variant="outline"
              icon="download"
              onClick={() => {
                const rows = [
                  ["তারিখ", "সময়", "কাজ", "অবস্থা", "অগ্রাধিকার", "শ্রেণি", "সময়(মিনিট)", "নোট"],
                  ...tasks.map((t) => [t.dueDate, t.dueTime ?? "", t.title, t.status, t.priority, t.categoryName ?? "", t.timeSpentMins, t.notes ?? ""]),
                ];
                downloadCsv(`tasks-${monthOf(today)}.csv`, toCsv(rows));
              }}
            >
              CSV
            </Btn>
            <Btn variant="primary" icon="plus" onClick={() => setModal({ open: true, task: null })}>
              নতুন কাজ
            </Btn>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallBox tone="primary" icon="list" value={tasks.length} label="ফিল্টারে কাজ" sub={`আজে ${stats.todayCount} টি`} />
        <SmallBox tone="warning" icon="clock" value={stats.open} label="বাকি" sub={`${stats.done} টি সম্পন্ন`} />
        <SmallBox tone="danger" icon="alert" value={stats.overdue} label="ওভারডিউ" sub="আগের দিনের বকেয়া" />
        <SmallBox tone="success" icon="check" value={`${Math.round((stats.done / Math.max(1, tasks.length)) * 100)}%`} label="কমপ্লিশন" sub={view === "month" ? `${monthLabelSafe(month)}` : "এই ভিউতে"} />
      </div>

      <LteCard
        variant="primary"
        icon="filter"
        title="ফিল্টার"
        tools={
          selected.length ? (
            <span className="text-[12.5px] text-[#dc3545]">{selected.length} টি সিলেক্টেড</span>
          ) : (
            <Badge tone="soft-primary">{tasks.length} ফলাফল</Badge>
          )
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {VIEWS.map((v) => (
              <button key={v.key} onClick={() => { setView(v.key); setSelected([]); }} className={`lte-btn lte-btn-sm ${view === v.key ? "lte-btn-primary" : "lte-btn-outline"}`}>
                <Icon name={v.icon} />
                {v.label}
              </button>
            ))}
            {view === "month" ? (
              <input type="month" className="lte-form-control !w-auto" value={month} onChange={(e) => setMonth(e.target.value)} />
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <input className="lte-form-control !pl-9" placeholder="কাজ খুঁজুন…" value={search} onChange={(e) => setSearch(e.target.value)} />
              <Icon name="search" className="absolute left-2.5 top-2.5 h-4 w-4 text-[#adb5bd]" />
            </div>
            <select className="lte-form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">সব অবস্থা</option>
              <option value="pending">পেন্ডিং</option>
              <option value="progress">চলছে</option>
              <option value="done">সম্পন্ন</option>
              <option value="skipped">বাদ পড়েছে</option>
            </select>
            <select className="lte-form-control" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="all">সব অগ্রাধিকার</option>
              <option value="urgent">অতি জরুরি</option>
              <option value="high">জরুরি</option>
              <option value="medium">স্বাভাবিক</option>
              <option value="low">কম জরুরি</option>
            </select>
            <select className="lte-form-control" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="all">সব শ্রেণি</option>
              {data?.cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {selected.length ? (
            <div className="flex flex-wrap items-center gap-2 rounded border border-[#ffe9a8] bg-[#fff8e1] px-3 py-2">
              <span className="text-[13px] font-semibold text-[#856404]">
                <Icon name="check" className="mr-1 inline h-4 w-4" />
                {selected.length} টি কাজে বাল্ক অ্যাকশন:
              </span>
              <Btn size="sm" variant="success" icon="check" onClick={() => void actions.bulk("done", selected).then(() => setSelected([]))}>
                সব সম্পন্ন
              </Btn>
              <Btn size="sm" variant="outline" icon="repeat" onClick={() => void actions.bulk("reopen", selected).then(() => setSelected([]))}>
                পেন্ডিং করুন
              </Btn>
              <Btn
                size="sm"
                variant="outline"
                icon="arrow-right"
                onClick={() => {
                  const d = window.prompt("কোন তারিখে ঠেলে দেবেন (YYYY-MM-DD)?", today);
                  if (d) void actions.bulk("reschedule", selected, d).then(() => setSelected([]));
                }}
              >
                তারিখ পিছান
              </Btn>
              <Btn
                size="sm"
                variant="danger"
                icon="trash"
                onClick={() => {
                  if (window.confirm(`${selected.length} টি কাজ মুছে ফেলবেন?`)) void actions.bulk("delete", selected).then(() => setSelected([]));
                }}
              >
                মুছুন
              </Btn>
              <Btn size="sm" variant="link" onClick={() => setSelected([])}>
                বাতিল
              </Btn>
            </div>
          ) : null}
        </div>
      </LteCard>

      {loading && !data ? (
        <LteCard title="তালিকা">
          <Loading />
        </LteCard>
      ) : (
        grouped.map(([date, list]) => (
          <LteCard
            key={date || "all"}
            icon="list"
            title={
              date ? (
                <span className="flex items-center gap-2">
                  {fmtDate(date, { weekday: true })}
                  {date === today ? <Badge tone="primary">আজ</Badge> : null}
                  {date < today ? <Badge tone="danger">অতীত</Badge> : null}
                </span>
              ) : (
                "সব কাজ"
              )
            }
            tools={
              <>
                <Badge tone="secondary">{list.length}</Badge>
                <Btn size="sm" variant="link" icon="plus" onClick={() => setModal({ open: true, task: null })}>
                  যোগ
                </Btn>
              </>
            }
          >
            <TaskList
              tasks={list}
              actions={actions}
              onEdit={(t) => setModal({ open: true, task: t })}
              selection={{ selected, toggle: toggleSelect }}
              emptyTitle="এই ফিল্টারে কিছু নেই"
              emptyText="অন্য ভিউ বেছে নিন বা নতুন কাজ যোগ করুন।"
              emptyAction={
                <Btn size="sm" variant="outline-primary" icon="plus" onClick={() => setModal({ open: true, task: null })}>
                  নতুন কাজ
                </Btn>
              }
            />
          </LteCard>
        ))
      )}

      {!loading && data && !tasks.length ? (
        <EmptyState icon="inbox" title="কোনো কাজ পাওয়া যায়নি" text="ফিল্টার বদলে দেখুন অথবা নতুন একটি কাজ যোগ করুন।" />
      ) : null}

      <TaskModal
        open={modal.open}
        initial={modal.task}
        categories={data?.cats ?? []}
        defaultDate={view === "today" ? today : undefined}
        onClose={() => setModal({ open: false, task: null })}
        onSaved={() => {
          void refetch();
          router.replace("/tasks");
        }}
      />
    </>
  );
}

function monthLabelSafe(month: string) {
  const [y, m] = month.split("-").map(Number);
  const names = ["জানু", "ফেব", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্টে", "অক্টো", "নভে", "ডিসে"];
  return `${names[(m ?? 1) - 1]} ${y}`;
}
