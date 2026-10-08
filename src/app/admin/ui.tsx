// src/app/admin/ui.tsx
//
// Small shared pieces for the admin pages (no hooks: usable from server
// and client components).
import Link from "next/link";
import { KIND_INFO, type BookKind } from "@/lib/admin/catalog";

export function PageHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-white md:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-400">{subtitle}</div>}
      </div>
      {right && <div className="flex flex-wrap gap-2">{right}</div>}
    </div>
  );
}

export function Card({ title, right, children, className = "" }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function KindBadge({ kind }: { kind: BookKind }) {
  const k = KIND_INFO[kind];
  return <span className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${k.className}`}>{k.label}</span>;
}

export function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "red" | "amber" | "violet" }) {
  const tones = {
    slate: "border-white/15 bg-white/5 text-slate-300",
    green: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    red: "border-rose-400/30 bg-rose-500/10 text-rose-200",
    amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    violet: "border-violet-400/30 bg-violet-500/10 text-violet-200",
  } as const;
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] ${tones[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-slate-500">{children}</p>;
}

export function MigrationBanner() {
  return (
    <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
      Run <b>admin-controls.sql</b> in Neon to turn on snapshots, the activity log and test copies. Until then those buttons are refused.
    </div>
  );
}

export function FilterLinks({ base, current, options }: { base: string; current: string; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Link
          key={o.value}
          href={o.value === "all" ? base : `${base}${base.includes("?") ? "&" : "?"}filter=${o.value}`}
          className={`rounded-full border px-3 py-1 text-xs ${current === o.value ? "border-[#C4B5FD] bg-[#8B5CF6]/20 text-white" : "border-white/10 text-slate-400 hover:text-white"}`}
        >
          {o.label}
        </Link>
      ))}
    </div>
  );
}

/** Small Cloudinary rendition (falls back to the full image). */
export function thumb(url: string | null | undefined, w = 360): string | undefined {
  if (!url) return undefined;
  return url.includes("res.cloudinary.com") && url.includes("/upload/") ? url.replace("/upload/", `/upload/w_${w},q_auto,f_auto/`) : url;
}

export function when(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SearchBox({ action, q, placeholder }: { action: string; q?: string; placeholder: string }) {
  return (
    <form action={action} className="mb-4">
      <input
        name="q"
        defaultValue={q ?? ""}
        placeholder={placeholder}
        className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#C4B5FD] focus:outline-none"
      />
    </form>
  );
}
