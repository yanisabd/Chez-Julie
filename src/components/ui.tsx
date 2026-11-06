import Link from "next/link";
import { cn } from "@/lib/format";
import { STATUS, PAYMENT_STATUS, type OrderStatus } from "@/lib/constants";
import { Info, Lightbulb } from "lucide-react";

export const btn = {
  base: "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none select-none",
  size: { sm: "h-9 px-4 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-14 px-7 text-base", xl: "h-16 px-8 text-lg" },
  variant: {
    primary: "bg-terracotta text-white hover:bg-terracotta-dark shadow-sm",
    secondary: "bg-forest text-white hover:bg-forest-dark shadow-sm",
    outline: "bg-white text-ink ring-1 ring-inset ring-sand-dark hover:bg-sand",
    ghost: "text-ink hover:bg-black/5",
    danger: "bg-red-600 text-white hover:bg-red-700",
    gold: "bg-gold text-ink hover:brightness-95",
  },
};

export type BtnVariant = keyof typeof btn.variant;
export type BtnSize = keyof typeof btn.size;

export const btnClass = (variant: BtnVariant = "primary", size: BtnSize = "md", extra?: string) =>
  cn(btn.base, btn.size[size], btn.variant[variant], extra);

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: BtnVariant;
  size?: BtnSize;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={btnClass(variant, size, className)}>
      {children}
    </Link>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5", className)}>{children}</div>;
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", className)}>{children}</span>;
}

export function StatusBadge({ status, large }: { status: OrderStatus; large?: boolean }) {
  const s = STATUS[status];
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full font-semibold ring-1 ring-inset", s.color, large ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs")}>
      <span className={cn("rounded-full", s.dot, large ? "size-2.5" : "size-2")} />
      {s.label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: string }) {
  const s = PAYMENT_STATUS[status] ?? PAYMENT_STATUS.unpaid;
  return <Badge className={s.color}>{s.label}</Badge>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Encadré d'aide en langage simple, présent sur les pages d'administration. */
export function Help({ children, title = "Comment ça marche ?" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="mb-6 flex gap-3 rounded-2xl bg-gold-light/70 p-4 text-[15px] leading-relaxed ring-1 ring-gold/30">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-700" />
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-ink/80">{children}</div>
      </div>
    </div>
  );
}

export function Notice({ tone = "info", children, className }: { tone?: "info" | "warn" | "error" | "success"; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "bg-sky-50 text-sky-900 ring-sky-200",
    warn: "bg-amber-50 text-amber-900 ring-amber-200",
    error: "bg-red-50 text-red-900 ring-red-200",
    success: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  };
  return (
    <div className={cn("flex gap-3 rounded-xl p-3.5 text-[15px] ring-1", tones[tone], className)}>
      <Info className="mt-0.5 size-5 shrink-0" />
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-sand-dark bg-white/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <div className="text-lg font-semibold">{title}</div>
      {children && <div className="mt-1 max-w-md text-muted">{children}</div>}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-xl border-0 bg-white px-3.5 py-3 text-[16px] text-ink shadow-sm ring-1 ring-inset ring-sand-dark placeholder:text-stone-400 focus:ring-2 focus:ring-inset focus:ring-forest disabled:bg-stone-50";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[15px] font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {error && <p className="mt-1 text-sm font-medium text-red-700">{error}</p>}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cn(inputClass, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, "pr-9", props.className)} />;
}

/** Case à cocher grande et lisible. */
export function Check({ name, label, defaultChecked, hint, value }: { name: string; label: React.ReactNode; defaultChecked?: boolean; hint?: string; value?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-2 hover:bg-sand/60">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="mt-0.5 size-5 shrink-0 accent-forest" />
      <span>
        <span className="text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-sm text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "warn" | "good" }) {
  return (
    <div className={cn("rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5", tone === "warn" && "ring-amber-300 bg-amber-50", tone === "good" && "")}>
      <div className="text-sm font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <table className="w-full min-w-[640px] text-left text-[15px] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-sm [&_th]:font-semibold [&_th]:text-muted [&_tbody_tr]:border-t [&_tbody_tr]:border-sand">
        {children}
      </table>
    </div>
  );
}
