"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";

/* --------------------------------- card ---------------------------------- */

export function LteCard({
  title,
  icon,
  variant,
  tools,
  footer,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  icon?: string;
  variant?: "primary" | "success" | "danger" | "warning" | "info" | "secondary" | "dark";
  tools?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("lte-card", variant && `bg-${variant}`, className)}>
      {(title || tools) && (
        <header className="lte-card-header">
          <h2 className="lte-card-title">
            {icon && <Icon name={icon} className="h-[18px] w-[18px] text-muted-2" />}
            {title}
          </h2>
          {tools ? <div className="lte-card-tools">{tools}</div> : null}
        </header>
      )}
      <div className={cn("lte-card-body", bodyClassName)}>{children}</div>
      {footer ? <footer className="lte-card-footer">{footer}</footer> : null}
    </section>
  );
}

/* ------------------------------- small box -------------------------------- */

export function SmallBox({
  value,
  label,
  sub,
  icon,
  tone = "primary",
  onClick,
}: {
  value: ReactNode;
  label: string;
  sub?: ReactNode;
  icon: string;
  tone?: "primary" | "success" | "danger" | "warning" | "info" | "dark" | "secondary";
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn("lte-small-box", `bg-${tone}-bg`, onClick && "text-left")}
    >
      <div className="icon">
        <Icon name={icon} />
      </div>
      <div className="inner">
        <h3>{value}</h3>
        <p>{label}</p>
        {sub ? <p className="!mb-0 !mt-1 text-[12px] opacity-80">{sub}</p> : null}
      </div>
    </Wrapper>
  );
}

export function Badge({ children, tone = "secondary", className }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={cn("lte-badge", tone.startsWith("badge-") ? tone : `badge-${tone}`, className)}>{children}</span>;
}

/* --------------------------------- button -------------------------------- */

export function Btn({
  children,
  variant = "outline",
  size,
  icon,
  className,
  type = "button",
  ...rest
}: {
  children?: ReactNode;
  variant?: "primary" | "success" | "danger" | "warning" | "info" | "secondary" | "dark" | "outline" | "outline-primary" | "link";
  size?: "sm";
  icon?: string;
  className?: string;
  type?: "button" | "submit";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button type={type} className={cn("lte-btn", `lte-btn-${variant}`, size === "sm" && "lte-btn-sm", className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/* --------------------------------- modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  icon,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  icon?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";
  return (
    <div className="fixed inset-0 z-[1080] flex items-start justify-center overflow-y-auto bg-black/50 p-4 py-10" onClick={onClose}>
      <div
        className={cn("fade-up w-full rounded-md bg-white shadow-2xl", width)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-[#f1f3f5] px-4 py-3">
          <h3 className="m-0 flex items-center gap-2 text-[17px] font-semibold text-[#343a40]">
            {icon && <Icon name={icon} className="h-5 w-5 text-[#007bff]" />}
            {title}
          </h3>
          <button className="lte-btn lte-btn-link !px-2" onClick={onClose} aria-label="বন্ধ করুন">
            <Icon name="close" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-2 border-t border-[#f1f3f5] px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/* --------------------------------- fields -------------------------------- */

export function Field({
  label,
  children,
  help,
  error,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="lte-label">{label}</label>
      {children}
      {help && !error ? <p className="lte-help">{help}</p> : null}
      {error ? <p className="lte-invalid-feedback">{error}</p> : null}
    </div>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <button
      type="button"
      className={cn("lte-check", checked && "checked")}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      aria-pressed={checked}
    >
      <span className="box">
        <Icon name="check" className="h-3.5 w-3.5" />
      </span>
      {label ? <span className="text-[14px] leading-snug">{label}</span> : null}
    </button>
  );
}

/* -------------------------------- progress -------------------------------- */

export function Progress({ value, tone = "#007bff", height = 10 }: { value: number; tone?: string; height?: number }) {
  return (
    <div className="lte-progress" style={{ height }}>
      <div className="lte-progress-bar" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: tone }} />
    </div>
  );
}

export function CircleProgress({ value, size = 96, label, tone = "#007bff" }: { value: number; size?: number; label?: ReactNode; tone?: string }) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, Math.round(value)));
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#e9ecef" strokeWidth={9} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={9}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: "stroke-dashoffset .5s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-[18px] font-bold leading-none text-[#343a40]">{pct}%</div>
        {label ? <div className="mt-0.5 text-[11px] text-[#6c757d]">{label}</div> : null}
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("spin h-5 w-5 text-[#007bff]", className)} fill="none" stroke="currentColor" strokeWidth={3}>
      <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = "লোড হচ্ছে…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[#6c757d]">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = "inbox", title, text, action }: { icon?: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-[#f1f3f5] text-[#adb5bd]">
        <Icon name={icon} className="h-7 w-7" />
      </div>
      <p className="m-0 mt-1 text-[15px] font-semibold text-[#495057]">{title}</p>
      {text ? <p className="m-0 max-w-md text-[13px] text-[#6c757d]">{text}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function InfoBox({ label, value, icon, tone = "#007bff" }: { label: string; value: ReactNode; icon?: string; tone?: string }) {
  return (
    <div className="lte-info-box">
      {icon ? (
        <span className="grid h-9 w-9 place-items-center rounded" style={{ background: `${tone}1a`, color: tone }}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      ) : null}
      <div className="flex-1">
        <p>{label}</p>
        <h3 className="text-[#343a40]">{value}</h3>
      </div>
    </div>
  );
}

/* --------------------------------- toast ---------------------------------- */

type Toast = { id: number; text: string; tone: "success" | "danger" | "info" | "warning" };
const ToastCtx = createContext<{ push: (text: string, tone?: Toast["tone"]) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

const TONE_BG: Record<Toast["tone"], string> = {
  success: "#28a745",
  danger: "#dc3545",
  info: "#17a2b8",
  warning: "#e0a800",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3800);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="lte-toast-stack">
        {items.map((t) => (
          <div key={t.id} className="lte-toast" style={{ background: TONE_BG[t.tone] }}>
            <Icon name={t.tone === "success" ? "check" : t.tone === "danger" ? "alert" : "bell"} className="h-4 w-4 shrink-0" />
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
