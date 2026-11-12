"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Badge, ToastProvider } from "@/components/ui";
import { api, qs } from "@/lib/client";
import type { TaskRow } from "@/lib/utils";
import { cn, fmtClock, monthOf, todayISO } from "@/lib/utils";

export type ShellUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  color: string;
  notifyBeforeMins: number;
  browserNotifications: boolean;
  autoGenerate: boolean;
};

export type ReminderData = {
  overdue: TaskRow[];
  dueToday: TaskRow[];
  dueNow: TaskRow[];
  upcoming: TaskRow[];
  missingPlans: { id: number; title: string; dueTime: string | null }[];
  counts: { overdue: number; dueToday: number; upcoming: number; alert: number };
};

type Ctx = {
  reminders: ReminderData | null;
  loadingReminders: boolean;
  refreshReminders: () => Promise<void>;
  user: ShellUser;
  setUser: (user: ShellUser) => void;
};

const ShellCtx = createContext<Ctx | null>(null);

export function useShell() {
  const ctx = useContext(ShellCtx);
  if (!ctx) throw new Error("useShell must be used inside <Shell>");
  return ctx;
}

const NAV = [
  { href: "/dashboard", label: "ড্যাশবোর্ড", icon: "dashboard", group: "প্রধান" },
  { href: "/plan", label: "মাসিক ওয়ার্কপ্ল্যান", icon: "calendar", group: "পরিকল্পনা" },
  { href: "/tasks", label: "টুডু লিস্ট", icon: "list", group: "পরিকল্পনা" },
  { href: "/reminders", label: "রিমাইন্ডার সেন্টার", icon: "bell", group: "পরিকল্পনা" },
  { href: "/log", label: "আজকের কাজের হিসাব", icon: "book", group: "হিসাব" },
  { href: "/reports", label: "মাসিক রিপোর্ট", icon: "chart", group: "হিসাব" },
  { href: "/users", label: "টিম ও ইউজার", icon: "users", group: "অ্যাডমিন", adminOnly: true },
  { href: "/settings", label: "সেটিংস", icon: "settings", group: "অ্যাডমিন" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "U";
}

export function Shell({ user: initialUser, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [reminders, setReminders] = useState<ReminderData | null>(null);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [clock, setClock] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const refreshReminders = useCallback(async () => {
    setLoadingReminders(true);
    try {
      const data = await api<ReminderData>(`reminders${qs({ today: todayISO() })}`);
      setReminders(data);
      // browser notifications for things that are due right now
      if (data && user.browserNotifications && typeof Notification !== "undefined" && Notification.permission === "granted") {
        const seen = new Set<string>(
          (sessionStorage.getItem("kh_notified") ? JSON.parse(sessionStorage.getItem("kh_notified") as string) : []) as string[],
        );
        let changed = false;
        for (const t of data.dueNow.slice(0, 3)) {
          const key = `${t.id}-${t.dueDate}`;
          if (seen.has(key)) continue;
          seen.add(key);
          changed = true;
          new Notification("সময় হয়েছে — " + t.title, {
            body: t.dueTime ? `ডিউ ${fmtClock(t.dueTime)}${t.description ? " • " + t.description : ""}` : "আজকের এই কাজটি এখনই শেষ করুন",
            tag: key,
          });
        }
        if (changed) sessionStorage.setItem("kh_notified", JSON.stringify([...seen].slice(-80)));
      }
    } catch {
      /* silent: shell polling should never break the page */
    } finally {
      setLoadingReminders(false);
    }
  }, [user.browserNotifications]);

  useEffect(() => {
    void refreshReminders();
    const id = setInterval(() => void refreshReminders(), 60_000);
    const onFocus = () => void refreshReminders();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshReminders]);

  // once per session: nudge about overdue work
  useEffect(() => {
    if (!reminders) return;
    const key = `kh-nudge-${todayISO()}`;
    if (reminders.counts.overdue > 0 && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, String(reminders.counts.overdue));
      setToast(`⏰ ${reminders.counts.overdue} টি কাজ ওভারডিউ আছে — রিমাইন্ডার সেন্টার থেকে শেষ করুন বা পিছিয়ে দিন`);
      const id = setTimeout(() => setToast(null), 9000);
      return () => clearTimeout(id);
    }
  }, [reminders]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(
        `${d.toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long" })} • ${d.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      );
    };
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setBellOpen(false);
    setUserOpen(false);
  }, [pathname]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof NAV>();
    for (const item of NAV) {
      if (item.adminOnly && user.role !== "admin") continue;
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return [...map.entries()];
  }, [user.role]);

  const counts = reminders?.counts ?? { overdue: 0, dueToday: 0, upcoming: 0, alert: 0 };

  const logout = async () => {
    try {
      await api("auth/logout", { method: "POST", body: {} });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <ToastProvider>
      <ShellCtx.Provider value={{ user, setUser, reminders, loadingReminders, refreshReminders }}>
        <div className="lte-root lte-sidebar">
          <aside className={cn("lte-main-sidebar", sidebarOpen && "is-open")}>
            <div className="lte-brand">
              <span className="grid h-8 w-8 place-items-center rounded bg-[#007bff] text-[15px] font-bold text-white">ক</span>
              <span className="text-[19px]">
                কাজের <span className="font-light opacity-80">হিসাব</span>
              </span>
            </div>

            <div className="lte-user-panel">
              <span className="avatar" style={{ background: user.color }}>
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <p className="m-0 truncate text-[14px] font-semibold">{user.name}</p>
                <p className="m-0 truncate text-[12px] opacity-70">
                  {`${user.role === "admin" ? "অ্যাডমিন" : "মেম্বার"} • ${user.email}`}
                </p>
              </div>
            </div>

            <nav className="pb-16">
              {groups.map(([group, items]) => (
                <div key={group}>
                  <div className="nav-header">{group}</div>
                  {items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const badge =
                      item.href === "/reminders" && counts.overdue ? (
                        <Badge tone="danger">{counts.overdue}</Badge>
                      ) : item.href === "/log" && counts.dueToday - (reminders?.dueToday.filter((t) => t.status === "done").length ?? 0) > 0 ? (
                        <Badge tone="warning">{counts.dueToday}</Badge>
                      ) : null;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn("lte-nav-link nav-link", active && "active")}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <Icon name={item.icon} className="nav-icon" />
                        <span className="flex-1">{item.label}</span>
                        {badge}
                      </Link>
                    );
                  })}
                </div>
              ))}
              <div className="px-3 pt-4">
                <button
                  type="button"
                  onClick={logout}
                  className="lte-btn lte-btn-outline w-full !border-[#4b535a] !bg-transparent !text-[#c2c7d0] hover:!bg-[#2c3136]"
                >
                  <Icon name="logout" />
                  লগ আউট
                </button>
              </div>
            </nav>
          </aside>

          <div className="lte-content-wrapper">
            <nav className="lte-navbar">
              <button
                type="button"
                className="lte-nav-icon-btn lg:hidden"
                aria-label="মেনু"
                onClick={() => setSidebarOpen((v) => !v)}
              >
                <Icon name="menu" className="h-6 w-6" />
              </button>
              <Link href="/dashboard" className="lte-brand !hidden !border-b-0 !px-2 lg:flex">
                <span className="grid h-7 w-7 place-items-center rounded bg-[#343a40] text-[13px] font-bold text-white">ক</span>
                <span className="text-[17px]">কাজের হিসাব</span>
              </Link>
              <div className="hidden items-center gap-2 text-[13px] text-[#6c757d] md:flex">
                <Icon name="clock" className="h-4 w-4" />
                {clock}
              </div>

              <form
                className="ml-auto hidden items-center sm:flex"
                onSubmit={(e) => {
                  e.preventDefault();
                  const input = new FormData(e.currentTarget).get("q");
                  router.push(`/tasks${qs({ q: typeof input === "string" ? input : "" })}`);
                }}
              >
                <div className="relative">
                  <input
                    name="q"
                    placeholder="কাজ খুঁজুন…"
                    className="lte-form-control !w-56 !pl-8"
                    style={{ width: 220, paddingLeft: 32 }}
                  />
                  <Icon name="search" className="absolute left-2 top-2 h-4 w-4 text-[#adb5bd]" />
                </div>
              </form>

              <div className="relative ml-auto flex items-center gap-1 sm:ml-2">
                <button
                  type="button"
                  className="lte-nav-icon-btn"
                  onClick={() => {
                    setBellOpen((v) => !v);
                    setUserOpen(false);
                    void refreshReminders();
                  }}
                  aria-label="রিমাইন্ডার"
                >
                  <Icon name="bell" className="h-5 w-5" />
                  {counts.alert > 0 ? <span className="lte-badge badge-danger nav-badge !px-1.5 !py-0.5 !text-[10px]">{counts.alert}</span> : null}
                </button>

                {bellOpen ? (
                  <div className="lte-dropdown-menu absolute right-0 top-[52px] max-h-[70vh] overflow-y-auto">
                    <div className="dropdown-header">
                      {counts.alert > 0 ? `${counts.alert} টি কাজ এখনও বাকি` : "আজকের সব কাজ ঠিক আছে 👍"}
                    </div>
                    <div className="max-h-[46vh] overflow-y-auto">
                      {reminders === null ? (
                        <p className="px-4 py-4 text-center text-[13px] text-[#6c757d]">লোড হচ্ছে…</p>
                      ) : (
                        <>
                          {reminders.overdue.slice(0, 4).map((t) => (
                            <button key={`o-${t.id}`} className="lte-notification-item" onClick={() => router.push("/reminders")}>
                              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-[#dc3545]" />
                              <span className="min-w-0">
                                <span className="block truncate text-[14px] font-semibold text-[#343a40]">{t.title}</span>
                                <span className="block text-[12px] text-[#dc3545]">
                                  {counts.overdue > 0 ? `ওভারডিউ • ${new Date(t.dueDate).getDate()} ${t.dueTime ? fmtClock(t.dueTime) : ""}` : ""}
                                </span>
                              </span>
                            </button>
                          ))}
                          {reminders.dueNow.slice(0, 5).map((t) => (
                            <button key={`d-${t.id}`} className="lte-notification-item" onClick={() => router.push("/log")}>
                              <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0 text-[#007bff]" />
                              <span className="min-w-0">
                                <span className="block truncate text-[14px] font-semibold text-[#343a40]">{t.title}</span>
                                <span className="block text-[12px] text-[#6c757d]">
                  আজ {t.dueTime ? fmtClock(t.dueTime) : "ডিউ"} • {monthOf(t.dueDate)}
                                </span>
                              </span>
                            </button>
                          ))}
                          {reminders.missingPlans.length > 0 ? (
                            <button className="lte-notification-item" onClick={() => router.push("/plan")}>
                              <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0 text-[#17a2b8]" />
                              <span className="min-w-0">
                                <span className="block text-[14px] font-semibold text-[#343a40]">
                                  আজকের {reminders.missingPlans.length} টি প্ল্যান এখনও তালিকায় আসেনি
                                </span>
                                <span className="block text-[12px] text-[#6c757d]">মাসিক প্ল্যান থেকে কাজ তৈরি করুন</span>
                              </span>
                            </button>
                          ) : null}
                          {reminders.overdue.length === 0 && reminders.dueNow.length === 0 && reminders.missingPlans.length === 0 ? (
                            <p className="px-4 py-6 text-center text-[13px] text-[#28a745]">এই মুহূর্তে কোনো জরুরি রিমাইন্ডার নেই</p>
                          ) : null}
                        </>
                      )}
                    </div>
                    <div className="dropdown-footer">
                      <Link href="/reminders">সব রিমাইন্ডার দেখুন</Link>
                    </div>
                  </div>
                ) : null}

                <div className="relative">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded px-1 py-1 hover:bg-[#f1f3f5]"
                    onClick={() => {
                      setUserOpen((v) => !v);
                      setBellOpen(false);
                    }}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: user.color }}>
                      {initials(user.name)}
                    </span>
                    <Icon name="chevron-down" className="hidden h-4 w-4 text-[#6c757d] sm:block" />
                  </button>
                  {userOpen ? (
                    <div className="lte-dropdown-menu absolute right-0 top-[46px] !min-w-[220px] p-0">
                      <div className="dropdown-header !text-left">
                        <p className="m-0 font-semibold">{user.name}</p>
                        <p className="m-0 text-[12px] font-normal text-[#6c757d]">{user.email}</p>
                      </div>
                      <Link href="/settings" className="lte-notification-item">
                        <Icon name="user" className="h-4 w-4 text-[#6c757d]" /> প্রোফাইল ও সেটিংস
                      </Link>
                      <Link href="/reports" className="lte-notification-item">
                        <Icon name="chart" className="h-4 w-4 text-[#6c757d]" /> আমার রিপোর্ট
                      </Link>
                      <button className="lte-notification-item" onClick={logout}>
                        <Icon name="logout" className="h-4 w-4 text-[#dc3545]" /> লগ আউট
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </nav>

                        {toast ? (
              <div className="lte-alert lte-alert-info mx-4 mt-3" onClick={() => setToast(null)}>
                {toast}
              </div>
            ) : null}

            <main className="lte-main-content">{children}</main>

            <footer className="lte-main-footer">
              <span>
                <b>কাজের হিসাব</b> • টুডু, মাসিক প্ল্যান ও দৈনিক লগ
              </span>
              <span>AdminLTE স্টাইল • v1.0.0</span>
            </footer>
          </div>
        </div>
      </ShellCtx.Provider>
    </ToastProvider>
  );
}

export function PageHeader({ title, lead, crumbs, actions }: { title: string; lead?: string; crumbs?: string[]; actions?: ReactNode }) {
  return (
    <div className="lte-content-header">
      <div>
        <h1>{title}</h1>
        {lead ? <p className="lead">{lead}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        <ol className="lte-breadcrumb ml-1 hidden md:flex">
          <li>
            <Link href="/dashboard">হোম</Link>
          </li>
          {(crumbs ?? [title]).map((c, i, arr) => (
            <li key={c} className="flex items-center gap-1.5">
              <span className="text-[#adb5bd]">/</span>
              <span className={i === arr.length - 1 ? "active" : ""}>{c}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4", className)}>{children}</div>;
}
