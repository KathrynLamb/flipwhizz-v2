// src/app/projects/page.tsx
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Playfair_Display, Lato } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "700", "900"],
});

const lato = Lato({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "700"],
});

export default async function ProjectsIndexPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main
        className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-slate-900`}
      >
        {/* Top bar */}
        <header className="w-full px-6 py-6 md:px-12 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#261C15]">
            <span className="text-2xl">📖</span>
            <span className="font-serif text-2xl font-bold tracking-wide">
              FlipWhizz
            </span>
          </Link>

          <Link
            href="/api/auth/signin"
            className="px-5 py-2 rounded-full bg-[#F4A261] text-[#0F2236] font-bold hover:bg-[#E76F51] transition shadow-lg"
          >
            Sign in
          </Link>
        </header>

        <section className="px-6 md:px-12 pb-24">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-3xl border-4 border-[#E6D5B8] bg-[#F3EAD3] p-10 md:p-14">
              {/* subtle “paper glow” */}
              <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/40 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-white/30 blur-3xl" />

              <div className="relative z-10 text-center">
                <h1 className="font-serif text-4xl md:text-5xl text-[#261C15] font-bold">
                  Your Stories
                </h1>
                <p className="mt-4 text-[#6B5D52] md:text-lg">
                  Sign in to view your library and keep building keepsakes.
                </p>

                <div className="mt-8 flex justify-center">
                  <Link
                    href="/api/auth/signin"
                    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-[#261C15] shadow-lg ring-1 ring-black/5 hover:bg-white/90 transition"
                  >
                    <span className="text-lg">✨</span>
                    Sign in to your library
                  </Link>
                </div>

                <p className="mt-6 text-xs text-[#6B5D52]/80">
                  Designed to be printed, held, and read under a duvet with a flashlight.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const list = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, session.user.id))
    .orderBy(desc(projects.createdAt));

  return (
    <main
      className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-slate-900 overflow-x-hidden`}
    >
      {/* Top bar */}
      <header className="w-full px-6 py-6 md:px-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-[#261C15]">
          <span className="text-2xl">📖</span>
          <span className="font-serif text-2xl font-bold tracking-wide">
            FlipWhizz
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="hidden sm:inline-flex px-4 py-2 rounded-full border border-[#E6D5B8] text-sm font-semibold text-[#261C15] hover:bg-[#F3EAD3] transition"
          >
            Home
          </Link>
          <Link
            href="/projects/create"
            className="inline-flex items-center gap-2 rounded-full bg-[#F4A261] px-5 py-2.5 text-sm font-bold text-[#0F2236] hover:bg-[#E76F51] transition shadow-lg"
          >
            <span className="text-base">➕</span> New Project
          </Link>
        </div>
      </header>

      {/* Page header */}
      <section className="px-6 md:px-12 pb-10">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="font-serif text-4xl md:text-5xl text-[#261C15] font-bold">
                Your Library
              </h1>
              <p className="mt-3 text-[#6B5D52] md:text-lg">
                Your magical story projects — ready when you are.
              </p>
            </div>

            {/* little “keepsake” badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F3EAD3] border-2 border-[#E6D5B8] px-4 py-2 text-xs font-bold text-[#261C15] w-fit">
              <span>📚</span> Keepsakes in progress
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="px-6 md:px-12 pb-24">
        <div className="mx-auto max-w-6xl">
          {list.length === 0 ? (
            <div className="rounded-3xl border-4 border-[#E6D5B8] bg-[#F3EAD3] p-10 md:p-14 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow ring-1 ring-black/5">
                <span className="text-3xl">🌟</span>
              </div>

              <h2 className="font-serif text-3xl text-[#261C15] font-bold">
                No projects yet
              </h2>
              <p className="mt-3 text-[#6B5D52]">
                Start with one tiny detail — a toy, a pet, a fear — and we’ll turn it into a book.
              </p>

              <div className="mt-8 flex justify-center">
                <Link
                  href="/projects/create"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-[#261C15] shadow-lg ring-1 ring-black/5 hover:bg-white/90 transition"
                >
                  <span className="text-lg">➕</span> Create your first project
                </Link>
              </div>

              <p className="mt-6 text-xs text-[#6B5D52]/80">
                Tip: try “Space,” “Dragons,” “Foxes,” or “The brave explorer.”
              </p>
            </div>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <li key={p.id} className="group">
                  <Link
                    href={`/projects/${p.id}`}
                    className="block h-full rounded-3xl border-4 border-[#E6D5B8] bg-[#F3EAD3] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(0,0,0,0.12)]"
                  >
                    {/* top “polaroid” strip */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="font-serif text-2xl font-bold text-[#261C15] truncate">
                          {p.name}
                        </h2>
                        <p className="mt-1 text-sm text-[#6B5D52]">
                          Created{" "}
                          {p.createdAt
                            ? new Date(p.createdAt).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>

                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow ring-1 ring-black/5 transition group-hover:scale-105">
                        →
                      </span>
                    </div>

                    {/* “story seed” chips */}
                    <div className="mt-5 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#261C15] ring-1 ring-black/5">
                        ✨ Story Seed
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#261C15] ring-1 ring-black/5">
                        📖 Pages
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#261C15] ring-1 ring-black/5">
                        🎨 Style
                      </span>
                    </div>

                    <p className="mt-5 text-sm text-[#6B5D52] leading-relaxed">
                      Open to continue crafting, refining, and preparing it for print.
                    </p>

                    <div className="mt-6 h-1 w-full rounded-full bg-gradient-to-r from-[#F4A261] via-[#E6D5B8] to-transparent" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
