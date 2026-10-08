// src/app/admin/AdminShell.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sun, BookOpen, Users, Package, Wrench } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Today", icon: Sun, exact: true },
  { href: "/admin/books", label: "Books", icon: BookOpen },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/orders", label: "Orders", icon: Package },
  { href: "/admin/tools", label: "Tools", icon: Wrench },
];

export default function AdminShell({ email, children }: { email: string | null; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/admin";
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));

  return (
    <div className="min-h-screen bg-[#07070f] text-slate-200">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-52 flex-col border-r border-white/10 bg-[#0b0b16] md:flex">
        <Link href="/admin" className="px-5 pb-4 pt-6">
          <div className="text-sm font-bold text-white">FlipWhizz</div>
          <div className="text-xs text-slate-500">Admin</div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active(href, exact) ? "bg-[#8B5CF6]/20 font-semibold text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="truncate px-5 py-4 text-xs text-slate-600">{email}</div>
      </aside>

      {/* Content */}
      <main className="pb-24 md:pb-10 md:pl-52">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">{children}</div>
      </main>

      {/* Phone bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-white/10 bg-[#0b0b16]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {NAV.map(({ href, label, icon: Icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active(href, exact) ? "text-[#C4B5FD]" : "text-slate-500"}`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
