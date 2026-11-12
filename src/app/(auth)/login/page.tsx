"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/icons";
import { Btn, Field, useToast } from "@/components/ui";
import { api } from "@/lib/client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="lte-root lte-login-page">
          <div className="lte-login-box">
            <div className="card text-center text-[13px] text-[#6c757d]">লোড হচ্ছে…</div>
          </div>
        </div>
      }
    >
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const router = useRouter();
  const sp = useSearchParams();
  const { push } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [needsSetup, setNeedsSetup] = useState(false);
  const [dbProblem, setDbProblem] = useState<string | null>(null);

  useEffect(() => {
    void api<{ needsSetup: boolean }>("auth/status")
      .then((res) => {
        setNeedsSetup(res.needsSetup);
        setDbProblem(null);
      })
      .catch((err) => setDbProblem(err instanceof Error ? err.message : "ডেটাবেসে সংযোগ করা যায়নি"));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await api<{ name: string; role: string }>("auth/login", {
        method: "POST",
        body: { email: form.email, password: form.password },
      });
      push(`স্বাগতম ${user.name} — ${user.role === "admin" ? "অ্যাডমিন" : "মেম্বার"} হিসেবে লগইন হয়েছে`, "success");
      const next = sp.get("next");
      router.replace(next && next.startsWith("/") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "লগইন করা যায়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lte-root lte-login-page">
      <div className="lte-login-box">
        <div className="lte-login-logo">
          <span className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded bg-[#007bff] text-white">ক</span>
            কাজের হিসাব
          </span>
          <small>টুডু লিস্ট • মাসিক ওয়ার্কপ্ল্যান • দৈনিক কাজের হিসাব</small>
        </div>

        <div className="card">
          <h1 className="m-0 text-center text-[21px] font-semibold text-[#343a40]">অ্যাকাউন্টে লগ ইন করুন</h1>
          <p className="mt-1 text-center text-[13px] text-[#6c757d]">অ্যাডমিন ও ইউজার — একই ফর্ম, নিজের ইমেইল ও পাসওয়ার্ড দিন</p>

          {needsSetup ? (
            <div className="lte-alert lte-alert-info mt-3 flex items-start gap-2">
              <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-[12.5px]">
                এখনো কোনো অ্যাকাউন্ট নেই। প্রথম অ্যাকাউন্টটি অ্যাডমিন হিসেবে তৈরি হবে —{" "}
                <Link href="/register" className="font-bold underline">
                  এখানে খুলুন
                </Link>
                ।
              </span>
            </div>
          ) : null}

          {dbProblem && !error ? (
            <div className="lte-alert lte-alert-danger mt-3 flex items-start gap-2">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-[12.5px] leading-relaxed">
                <b>ডেটাবেসে সংযোগ হচ্ছে না।</b> {dbProblem}
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="lte-alert lte-alert-danger mt-3 flex items-center gap-2">
              <Icon name="alert" className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="mt-4 flex flex-col gap-3" onSubmit={onSubmit}>
            <Field label="ইমেইল">
              <input
                type="email"
                required
                autoComplete="username"
                className="lte-form-control"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="পাসওয়ার্ড">
              <input
                type="password"
                required
                autoComplete="current-password"
                className="lte-form-control"
                placeholder="••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Btn type="submit" variant="primary" className="lte-btn-block !py-2.5" disabled={busy} icon="logout">
              {busy ? "চেক করা হচ্ছে…" : "লগ ইন"}
            </Btn>
          </form>

          <div className="mt-4 flex items-center justify-between border-t border-[#f1f3f5] pt-3 text-[13px]">
            <span className="text-[#6c757d]">অ্যাকাউন্ট নেই?</span>
            <Link href="/register" className="font-semibold text-[#007bff] hover:underline">
              নতুন অ্যাকাউন্ট খুলুন
            </Link>
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-[#adb5bd]">
          প্রথম অ্যাকাউন্টটি অ্যাডমিন হয় — অ্যাডমিন ইউজার তৈরি, টিম প্রগ্রেস ও ডেটাবেস তথ্য দেখতে পারেন।
          <br />
          বাকিরা নিজের ইমেইল দিয়ে ঢুকে শুধু নিজের কাজ দেখেন।
        </p>
        <p className="mt-1 text-center text-[12px]">
          <Link href="/php-version" className="font-semibold text-[#17a2b8] hover:underline">
            PHP সংস্করণ দেখুন / ডাউনলোড করুন →
          </Link>
        </p>
      </div>
    </div>
  );
}
