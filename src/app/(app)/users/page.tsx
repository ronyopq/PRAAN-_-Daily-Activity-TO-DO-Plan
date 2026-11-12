"use client";

import { useCallback, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/Shell";
import { Badge, Btn, EmptyState, Field, LteCard, Loading, Modal, Progress, SmallBox, useToast } from "@/components/ui";
import { api, qs, useQuery } from "@/lib/client";
import { fmtMins, todayISO } from "@/lib/utils";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  active: boolean;
  color: string;
  createdAt: string;
  stats: { total: number; done: number; today: number } | null;
};

type TeamRow = { id: number; name: string; color: string; total: number; done: number; minutes: number };

const blank = { name: "", email: "", password: "", role: "user", active: true };

export default function UsersPage() {
  const today = todayISO();
  const { push } = useToast();
  const [modal, setModal] = useState<{ open: boolean; user: AdminUser | null }>({ open: false, user: null });
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);

  const loader = useCallback(async () => {
    const [users, team] = await Promise.all([api<AdminUser[]>("users"), api<TeamRow[]>(`team${qs({ date: today })}`)]);
    return { users, team };
  }, [today]);

  const { data, loading, refetch } = useQuery(loader, [today]);
  const users = data?.users ?? [];

  function openCreate() {
    setForm(blank);
    setModal({ open: true, user: null });
  }

  function openEdit(u: AdminUser) {
    setForm({ name: u.name, email: u.email, password: "", role: u.role, active: u.active });
    setModal({ open: true, user: u });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (modal.user) {
        await api(`users/${modal.user.id}`, {
          method: "PATCH",
          body: { name: form.name, email: form.email, role: form.role, active: form.active, ...(form.password ? { password: form.password } : {}) },
        });
        push("ইউজার আপডেট হয়েছে", "success");
      } else {
        await api("users", { method: "POST", body: { ...form } });
        push("নতুন ইউজার তৈরি হয়েছে", "success");
      }
      setModal({ open: false, user: null });
      await refetch();
    } catch (err) {
      push(err instanceof Error ? err.message : "সেভ করা যায়নি", "danger");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u: AdminUser) {
    await api(`users/${u.id}`, { method: "PATCH", body: { active: !u.active, role: u.role, name: u.name, email: u.email } }).catch(() =>
      push("পারিনি", "danger"),
    );
    push(u.active ? "অ্যাকাউন্ট বন্ধ করা হয়েছে" : "অ্যাকাউন্ট আবার চালু", "info");
    await refetch();
  }

  async function remove(u: AdminUser) {
    if (!window.confirm(`${u.name} এর অ্যাকাউন্ট, সব কাজ, প্ল্যান ও লগ মুছে যাবে। নিশ্চিত?`)) return;
    await api(`users/${u.id}`, { method: "DELETE" }).catch((err) => push(err instanceof Error ? err.message : "মোছা যায়নি", "danger"));
    push("ইউজার মুছে ফেলা হয়েছে", "info");
    await refetch();
  }

  return (
    <>
      <PageHeader
        title="টিম ও ইউজার"
        lead="মাল্টি-ইউজার স্পেস — প্রত্যেকের নিজস্ব টুডু, প্ল্যান, রিমাইন্ডার ও হিসাব"
        crumbs={["অ্যাডমিন", "ইউজার"]}
        actions={
          <Btn variant="primary" icon="plus" onClick={openCreate}>
            নতুন ইউজার
          </Btn>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SmallBox tone="primary" icon="users" value={users.length} label="মোট অ্যাকাউন্ট" sub={`${users.filter((u) => u.active).length} টি সক্রিয়`} />
        <SmallBox tone="dark" icon="briefcase" value={users.filter((u) => u.role === "admin").length} label="অ্যাডমিন" sub="সব ম্যানেজ করতে পারে" />
        <SmallBox tone="success" icon="check" value={users.reduce((a, u) => a + (u.stats?.done ?? 0), 0)} label="সব মিলিয়ে সম্পন্ন" sub="আজকের দিন" />
        <SmallBox tone="warning" icon="list" value={users.reduce((a, u) => a + (u.stats?.today ?? 0), 0)} label="আজকের মোট কাজ" sub={today} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <LteCard variant="dark" icon="users" title="ইউজার তালিকা" tools={<Badge tone="secondary">{users.length}</Badge>} bodyClassName="!p-0">
            {loading && !data ? (
              <Loading />
            ) : (
              <div className="lte-scroll-x">
                <table className="lte-table">
                  <thead>
                    <tr>
                      <th>ইউজার</th>
                      <th>রোল</th>
                      <th>স্ট্যাটাস</th>
                      <th>অগ্রগতি</th>
                      <th className="text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className={!u.active ? "!opacity-60" : undefined}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-white" style={{ background: u.color }}>
                              {u.name.slice(0, 1).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="m-0 truncate text-[14px] font-semibold text-[#343a40]">{u.name}</p>
                              <p className="m-0 truncate text-[12px] text-[#6c757d]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge tone={u.role === "admin" ? "primary" : "secondary"}>{u.role === "admin" ? "অ্যাডমিন" : "মেম্বার"}</Badge>
                        </td>
                        <td>
                          <Badge tone={u.active ? "success" : "danger"}>{u.active ? "সক্রিয়" : "বন্ধ"}</Badge>
                        </td>
                        <td>
                          <div className="min-w-[140px] text-[12px] text-[#6c757d]">
                            {u.stats?.done ?? 0}/{u.stats?.total ?? 0} কাজ সম্পন্ন
                            <div className="lte-progress mt-1 !h-1.5">
                              <div
                                className="lte-progress-bar"
                                style={{
                                  width: `${(u.stats?.total ? (u.stats.done ?? 0) / u.stats.total : 0) * 100}%`,
                                  background: u.active ? "#28a745" : "#adb5bd",
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Btn size="sm" variant="outline" icon={u.active ? "pause" : "play"} onClick={() => void toggleActive(u)} title={u.active ? "বন্ধ করুন" : "চালু করুন"} />
                            <Btn size="sm" variant="outline" icon="edit" onClick={() => openEdit(u)} title="সম্পাদনা" />
                            <Btn size="sm" variant="outline" icon="trash" className="!text-[#dc3545]" onClick={() => void remove(u)} title="মুছুন" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-[#f1f3f5] px-3 py-2 text-[12.5px] text-[#6c757d]">
              নতুন কেউ দলে যোগ দিতে এই পেজ থেকেই অ্যাকাউন্ট খুলে দিন — সে নিজের ইমেইল ও পাসওয়ার্ড দিয়ে ঢুকে নিজের কাজ দেখবে।
            </div>
          </LteCard>
        </div>

        <LteCard variant="primary" icon="trending" title={`আজকের টিম প্রগ্রেস`} tools={<Badge tone="soft-primary">{today}</Badge>}>
          {data?.team.length ? (
            <div className="flex flex-col gap-3">
              {data.team.map((t) => (
                <div key={t.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[13.5px]">
                    <span className="inline-flex items-center gap-2 font-semibold text-[#343a40]">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: t.color }} />
                      {t.name}
                    </span>
                    <span className="text-[12px] text-[#6c757d]">
                      {t.done}/{t.total} • {fmtMins(t.minutes)}
                    </span>
                  </div>
                  <Progress value={t.total ? (t.done / t.total) * 100 : 0} tone={t.total && t.done === t.total ? "#28a745" : "#007bff"} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="users" title="আজ কারও কাজ তালিকায় নেই" text="সবার প্ল্যান থেকে কাজ তৈরি হলে এখানে প্রগ্রেস দেখা যাবে।" />
          )}
          <div className="lte-alert lte-alert-info mt-3 mb-0 flex items-start gap-2">
            <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-[12.5px]">টিম মেম্বাররা একে অপরের কাজ দেখতে পায় না — শুধু অ্যাডমিন এই সামারি দেখতে পান।</span>
          </div>
        </LteCard>
      </div>

      <Modal
        open={modal.open}
        onClose={() => setModal({ open: false, user: null })}
        title={modal.user ? "ইউজার সম্পাদনা" : "নতুন ইউজার"}
        icon="users"
      >
        <form className="flex flex-col gap-3" onSubmit={save}>
          <Field label="নাম">
            <input className="lte-form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <Field label="ইমেইল">
            <input type="email" className="lte-form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label={modal.user ? "নতুন পাসওয়ার্ড (ফাঁকা রাখলে বদলাবে না)" : "পাসওয়ার্ড"}>
            <input
              type="text"
              className="lte-form-control"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!modal.user}
              minLength={modal.user ? undefined : 6}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="রোল">
              <select className="lte-form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">মেম্বার</option>
                <option value="admin">অ্যাডমিন</option>
              </select>
            </Field>
            <Field label="স্ট্যাটাস">
              <select
                className="lte-form-control"
                value={form.active ? "1" : "0"}
                onChange={(e) => setForm({ ...form, active: e.target.value === "1" })}
              >
                <option value="1">সক্রিয়</option>
                <option value="0">বন্ধ</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#f1f3f5] pt-3">
            <Btn variant="outline" onClick={() => setModal({ open: false, user: null })}>
              বাতিল
            </Btn>
            <Btn type="submit" variant="primary" icon="check" disabled={busy}>
              {busy ? "সেভ হচ্ছে…" : "সেভ করুন"}
            </Btn>
          </div>
        </form>
      </Modal>
    </>
  );
}
