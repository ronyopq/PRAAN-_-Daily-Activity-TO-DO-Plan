"use client";

import { useCallback, useState, type FormEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { PageHeader, useShell, type ShellUser } from "@/components/Shell";
import { Badge, Btn, Field, InfoBox, LteCard, Loading, useToast } from "@/components/ui";
import { api, useQuery } from "@/lib/client";
import type { CategoryRow } from "@/lib/utils";

const COLORS = ["#007bff", "#28a745", "#dc3545", "#17a2b8", "#6f42c1", "#e83e8c", "#fd7e14", "#343a40"];

export default function SettingsPage() {
  const { user, setUser } = useShell();
  const { push } = useToast();
  const [form, setForm] = useState({ name: user.name, email: user.email, color: user.color });
  const [busy, setBusy] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [newCat, setNewCat] = useState({ name: "", color: "#007bff" });

  const loader = useCallback(() => api<CategoryRow[]>("categories"), []);
  const { data: cats, loading, refetch } = useQuery(loader, []);

  async function saveProfile() {
    setBusy(true);
    try {
      const updated = await api<ShellUser>("profile", { method: "POST", body: form });
      setUser({ ...user, ...updated });
      push("প্রোফাইল আপডেট হয়েছে", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "সেভ করা যায়নি", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    if (pwd.next !== pwd.confirm) {
      push("নতুন পাসওয়ার্ড দুটো মিলছে না", "danger");
      return;
    }
    setBusy(true);
    try {
      await api("password", { method: "POST", body: { current: pwd.current, next: pwd.next } });
      setPwd({ current: "", next: "", confirm: "" });
      push("পাসওয়ার্ড বদলে গেছে", "success");
    } catch (err) {
      push(err instanceof Error ? err.message : "পারিনি", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(e: FormEvent) {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    await api("categories", { method: "POST", body: { name: newCat.name.trim(), color: newCat.color } }).catch((err) =>
      push(err instanceof Error ? err.message : "যোগ করা যায়নি", "danger"),
    );
    setNewCat({ name: "", color: "#007bff" });
    push("শ্রেণি যোগ হয়েছে", "success");
    await refetch();
  }

  async function renameCategory(id: number, patch: { name?: string; color?: string }, done: () => void) {
    await api(`categories/${id}`, { method: "PATCH", body: patch }).catch(() => push("সেভ হয়নি", "danger"));
    push("শ্রেণি আপডেট হয়েছে", "success");
    done();
  }

  return (
    <>
      <PageHeader title="সেটিংস" lead="প্রোফাইল, নোটিফিকেশন, শ্রেণি ও ডেটা" crumbs={["অ্যাডমিন", "সেটিংস"]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LteCard variant="primary" icon="user" title="প্রোফাইল">
          <div className="flex flex-col gap-3">
            <Field label="নাম">
              <input className="lte-form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="ইমেইল" help="লগইনের সময় এটাই ব্যবহার হবে">
              <input className="lte-form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="অ্যাভাটার রঙ">
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className="h-8 w-8 rounded-full border-2"
                    style={{ background: c, borderColor: form.color === c ? "#343a40" : "transparent" }}
                    aria-label={c}
                  />
                ))}
              </div>
            </Field>
            <Btn variant="primary" icon="check" onClick={saveProfile} disabled={busy}>
              প্রোফাইল সেভ করুন
            </Btn>
          </div>
        </LteCard>

        <LteCard variant="dark" icon="key" title="পাসওয়ার্ড পরিবর্তন">
          <form className="flex flex-col gap-3" onSubmit={savePassword}>
            <Field label="বর্তমান পাসওয়ার্ড">
              <input type="password" className="lte-form-control" value={pwd.current} onChange={(e) => setPwd({ ...pwd, current: e.target.value })} required />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="নতুন পাসওয়ার্ড">
                <input type="password" minLength={6} className="lte-form-control" value={pwd.next} onChange={(e) => setPwd({ ...pwd, next: e.target.value })} required />
              </Field>
              <Field label="আবার লিখুন">
                <input type="password" className="lte-form-control" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
              </Field>
            </div>
            <Btn type="submit" variant="dark" icon="key" disabled={busy}>
              পাসওয়ার্ড বদলান
            </Btn>
          </form>
        </LteCard>

        <LteCard variant="warning" icon="bell" title="রিমাইন্ডার প্রেফারেন্স">
          <div className="flex flex-col gap-3">
            <Field label="কত আগে রিমাইন্ড">
              <select
                className="lte-form-control"
                value={user.notifyBeforeMins}
                onChange={async (e) => {
                  const v = Number(e.target.value);
                  setUser({ ...user, notifyBeforeMins: v });
                  await api("profile", { method: "POST", body: { notifyBeforeMins: v } });
                  push("সেভ হয়েছে", "success");
                }}
              >
                {[0, 15, 30, 60, 120, 240, 1440].map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "ঠিক সময়" : m < 60 ? `${m} মিনিট আগে` : m === 1440 ? "১ দিন আগে" : `${m / 60} ঘণ্টা আগে`}
                  </option>
                ))}
              </select>
            </Field>
            {[
              { key: "autoGenerate" as const, label: "প্রতিদিন প্ল্যান থেকে আজকের কাজ স্বয়ংক্রিয়ভাবে তৈরি" },
              { key: "browserNotifications" as const, label: "ব্রাউজার নোটিফিকেশন চালু (ডিউ হলে পপআপ)" },
            ].map((row) => (
              <button
                key={row.key}
                type="button"
                className="lte-check"
                onClick={async () => {
                  const v = !user[row.key];
                  if (row.key === "browserNotifications" && v && typeof Notification !== "undefined") {
                    const p = await Notification.requestPermission();
                    if (p !== "granted") {
                      push("ব্রাউজার নোটিফিকেশনের অনুমতি দেওয়া হয়নি", "warning");
                      return;
                    }
                  }
                  setUser({ ...user, [row.key]: v } as ShellUser);
                  await api("profile", { method: "POST", body: { [row.key]: v } });
                  push("সেভ হয়েছে", "success");
                }}
              >
                <span className={`box ${user[row.key] ? "!border-[#28a745] !bg-[#28a745] !text-white" : ""}`}>
                  <Icon name="check" className="h-3.5 w-3.5" />
                </span>
                <span className="text-[14px]">{row.label}</span>
              </button>
            ))}
            <p className="lte-help">বিস্তারিত রিমাইন্ডার সেটিংস <b>রিমাইন্ডার সেন্টার</b> পেজেও আছে।</p>
          </div>
        </LteCard>
      </div>

      <LteCard variant="info" icon="download" title="PHP সংস্করণ (InfinityFree ফিক্সড)" tools={<Badge tone="soft-info">শুধু PHP · MySQL/SQLite</Badge>}>
        <p className="mt-0 text-[13.5px] text-[#495057]">
          পূর্ণ PHP সংস্করণ — InfinityFree-এর ৫০০ এরর ফিক্স করা, ১ ক্লিক ইনস্টলারসহ। MySQL (InfinityFree) অথবা SQLite — একই কোড; Composer/SSH লাগে না।
        </p>
        <div className="flex flex-wrap gap-2">
          <a className="lte-btn lte-btn-info" href="/php-version.tar.gz" download>
            <Icon name="download" />
            PHP সোর্স ডাউনলোড
          </a>
          <Link className="lte-btn lte-btn-outline" href="/php-version">
            PHP সংস্করণের বিবরণ
          </Link>
        </div>
      </LteCard>

      {user.role === "admin" ? <DatabaseInfoCard /> : null}

      <LteCard
        variant="success"
        icon="briefcase"
        title="শ্রেণি (ক্যাটাগরি)"
        tools={<Badge tone="secondary">{cats?.length ?? 0} টি</Badge>}
        bodyClassName="!p-0"
      >
        {loading && !cats ? (
          <Loading />
        ) : (
          <table className="lte-table">
            <thead>
              <tr>
                <th>নাম</th>
                <th>রঙ</th>
                <th className="text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody>
              {(cats ?? []).map((c) => (
                <CategoryRowItem key={c.id} category={c} onSave={renameCategory} refetch={refetch} />
              ))}
              <tr>
                <td colSpan={3} className="!bg-[#f8f9fa]">
                  <form className="flex flex-wrap items-center gap-2" onSubmit={addCategory}>
                    <input className="lte-form-control !w-56" placeholder="নতুন শ্রেণির নাম" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
                    <input type="color" className="h-9 w-14 cursor-pointer rounded border border-[#ced4da]" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} />
                    <Btn type="submit" variant="success" size="sm" icon="plus">
                      যোগ করুন
                    </Btn>
                  </form>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </LteCard>
    </>
  );
}

function CategoryRowItem({
  category,
  onSave,
  refetch,
}: {
  category: CategoryRow;
  onSave: (id: number, patch: { name?: string; color?: string }, done: () => void) => Promise<void>;
  refetch: () => void | Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const { push } = useToast();
  return (
    <tr>
      <td>
        <input className="lte-form-control" value={name} onChange={(e) => setName(e.target.value)} />
      </td>
      <td>
        <div className="flex items-center gap-2">
          <input type="color" className="h-8 w-12 cursor-pointer rounded border border-[#ced4da]" value={color} onChange={(e) => setColor(e.target.value)} />
          <span className="inline-flex items-center gap-1 text-[12.5px] text-[#6c757d]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            {color}
          </span>
        </div>
      </td>
      <td>
        <div className="flex justify-end gap-1">
          <Btn size="sm" variant="outline" icon="check" onClick={() => void onSave(category.id, { name, color }, () => void refetch())}>
            সেভ
          </Btn>
          <Btn
            size="sm"
            variant="outline"
            icon="trash"
            className="!text-[#dc3545]"
            onClick={async () => {
              if (!window.confirm(`"${category.name}" শ্রেণি মুছে ফেলবেন? কাজগুলো থেকে শ্রেণি সরে যাবে।`)) return;
              await api(`categories/${category.id}`, { method: "DELETE" }).catch(() => push("মোছা যায়নি", "danger"));
              push("শ্রেণি মুছে ফেলা হয়েছে", "info");
              await refetch();
            }}
          />
        </div>
      </td>
    </tr>
  );
}

type DbInfo = {
  engine: string;
  host: string;
  port: string;
  database: string;
  user: string;
  url: string;
  databaseSize: string;
  version: string;
  tables: { table: string; rows: number }[];
  tablesOnServer: { table_name: string; rows: number; size: string }[];
  schemaFile: string;
  envFile: string;
  backupHint: string;
};

const TABLE_LABEL: Record<string, string> = {
  users: "ইউজার (লগইন)",
  sessions: "সেশন টোকেন",
  categories: "শ্রেণি/ক্যাটাগরি",
  plans: "মাসিক প্ল্যান",
  tasks: "টুডু/কাজ",
  workLogs: "দৈনিক কাজের লগ",
};

function DatabaseInfoCard() {
  const { data } = useQuery(() => api<DbInfo>("db-info"), []);
  const [showUrl, setShowUrl] = useState(false);

  return (
    <LteCard
      variant="dark"
      icon="inbox"
      title="ডেটাবেস কোথায় সেভ হচ্ছে"
      tools={<Badge tone="soft-success">সংযুক্ত • PostgreSQL</Badge>}
    >
      {!data ? (
        <Loading />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="lte-alert lte-alert-info mb-0 text-[13px] leading-relaxed">
            আপনার সব ইউজার, টুডু, মাসিক প্ল্যান, রিমাইন্ডার ও কাজের হিসাব সার্ভারের <b>PostgreSQL</b> ডেটাবেসে সেভ হয় —
            ব্রাউজারে নয়। সংযোগের তথ্য <code>.env</code> ফাইলের <code>DATABASE_URL</code> থেকে আসে, আর টেবিলের গঠন আছে{" "}
            <code>{data.schemaFile}</code> ফাইলে (Drizzle ORM)।
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <InfoBox label="হোস্ট" value={data.host} icon="inbox" tone="#007bff" />
            <InfoBox label="পোর্ট" value={data.port} icon="briefcase" tone="#17a2b8" />
            <InfoBox label="ডেটাবেসের নাম" value={data.database} icon="list" tone="#28a745" />
            <InfoBox label="ইউজার" value={data.user} icon="user" tone="#6c757d" />
            <InfoBox label="ডেটাবেস সাইজ" value={data.databaseSize} icon="chart" tone="#fd7e14" />
            <InfoBox label="ইঞ্জিন" value={data.version} icon="spark" tone="#6f42c1" />
          </div>

          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-[12px] font-bold uppercase tracking-wide text-[#6c757d]">সংযোগ স্ট্রিং</span>
              <Btn size="sm" variant="link" icon="eye" onClick={() => setShowUrl((v) => !v)}>
                {showUrl ? "লুকান" : "দেখুন"}
              </Btn>
            </div>
            <code className="block break-all rounded bg-[#f1f3f5] px-2 py-1.5 text-[12px] text-[#343a40]">
              {showUrl ? data.url : data.url.replace(/postgres(ql)?:\/\/[^@]+@/, "postgresql://•••:•••@")}
            </code>
          </div>

          <div className="lte-scroll-x">
            <table className="lte-table">
              <thead>
                <tr>
                  <th>টেবিল</th>
                  <th>কী রাখা আছে</th>
                  <th className="text-right">রো (সার্ভার)</th>
                </tr>
              </thead>
              <tbody>
                {data.tables.map((t) => {
                  const server = data.tablesOnServer.find((x) => x.table_name === (t.table === "workLogs" ? "work_logs" : t.table));
                  return (
                    <tr key={t.table}>
                      <td className="font-mono text-[12.5px] text-[#343a40]">{t.table === "workLogs" ? "work_logs" : t.table}</td>
                      <td className="text-[13px] text-[#495057]">{TABLE_LABEL[t.table] ?? "—"}</td>
                      <td className="text-right text-[13px] font-semibold">
                        {server?.rows ?? t.rows}
                        {server?.size ? <span className="ml-2 text-[11.5px] font-normal text-[#adb5bd]">{server.size}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded border border-[#ffe9a8] bg-[#fff8e1] px-3 py-2 text-[12.5px] text-[#856404]">
            <b>ব্যাকআপ:</b> <code className="break-all">{data.backupHint}</code> — এই কমান্ড দিয়ে পুরো ডেটা এক ফাইলে সেভ করা যায়।
          </div>
        </div>
      )}
    </LteCard>
  );
}
