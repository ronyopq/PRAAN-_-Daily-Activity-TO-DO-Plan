"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { Btn, Checkbox, Field, useToast } from "@/components/ui";
import { api } from "@/lib/client";

export default function RegisterPage() {
  const router = useRouter();
  const { push } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(true);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!agree) {
      setError("এগিয়ে যেতে চেকবক্সটিতে টিক দিন");
      return;
    }
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password !== confirm) {
      setError("দুটো পাসওয়ার্ড মিলছে না");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("auth/register", {
        method: "POST",
        body: { name: String(fd.get("name") ?? ""), email: String(fd.get("email") ?? ""), password },
      });
      push("অ্যাকাউন্ট তৈরি হয়েছে — স্বাগতম!", "success");
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "অ্যাকাউন্ট খোলা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lte-root lte-login-page">
      <div className="lte-login-box !max-w-[480px]">
        <div className="lte-login-logo">
          <span className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded bg-[#28a745] text-white">ক</span>
            কাজের হিসাব
          </span>
          <small>নতুন অ্যাকাউন্ট • নিজের টুডু, প্ল্যান ও দিনের হিসাব</small>
        </div>
        <div className="card">
          <h1 className="m-0 text-center text-[21px] font-semibold text-[#343a40]">অ্যাকাউন্ট খুলুন</h1>
          <p className="mt-1 text-center text-[13px] text-[#6c757d]">প্রতি ইউজারের নিজস্ব কাজ, প্ল্যান ও রিমাইন্ডার থাকবে</p>

          {error ? (
            <div className="lte-alert lte-alert-danger mt-4 flex items-center gap-2">
              <Icon name="alert" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
            <Field label="নাম">
              <input name="name" required className="lte-form-control" placeholder="আপনার নাম" maxLength={80} />
            </Field>
            <Field label="ইমেইল">
              <input name="email" type="email" required className="lte-form-control" placeholder="you@example.com" />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="পাসওয়ার্ড" help="কমপক্ষে ৬ অক্ষর">
                <input name="password" type="password" required minLength={6} className="lte-form-control" />
              </Field>
              <Field label="আবার দিন">
                <input name="confirm" type="password" required className="lte-form-control" />
              </Field>
            </div>
            <Checkbox checked={agree} onChange={setAgree} label="আমি প্রতিদিন কাজের হিসাব রাখব — এবং পুরনো ওভারডিউ কাজ নিজেই ম্যানেজ করব" />
            <Btn type="submit" variant="success" className="lte-btn-block !py-2.5" disabled={busy} icon={busy ? "refresh" : "plus"}>
              {busy ? "তৈরি হচ্ছে…" : "অ্যাকাউন্ট খুলুন"}
            </Btn>
          </form>

          <div className="mt-4 flex items-center justify-between border-t border-[#f1f3f5] pt-3 text-[13px]">
            <span className="text-[#6c757d]">আগেই অ্যাকাউন্ট আছে?</span>
            <Link href="/login" className="font-semibold text-[#007bff] hover:underline">
              লগ ইন করুন
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
