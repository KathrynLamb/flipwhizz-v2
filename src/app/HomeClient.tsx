"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Session } from "next-auth";

type Props = {
  session: Session | null;
  fonts: string;
};

export default function HomeClient({ session, fonts }: Props) {
  const router = useRouter();

  async function createProject() {
    // 🔐 Not logged in → sign in first
    if (!session) {
      router.push("/api/auth/signin");
      return;
    }

    // 🚀 Create project immediately
    const res = await fetch("/api/projects/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Storybook",
      }),
    });

    if (!res.ok) {
      alert("Something went wrong creating your project.");
      return;
    }

    const data = await res.json();

    if (data.id) {
      router.push(`/projects/${data.id}`);
    }
  }

  return (
    <main
      className={`min-h-screen ${fonts} font-sans bg-[#FDF8F0] text-slate-900 overflow-x-hidden`}
    >
      {/* ================= HERO ================= */}
      <section className="relative w-full min-h-[90vh] flex flex-col">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/LandingPage/hero-forest.jpeg"
            alt="Magical forest"
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#0F2236]/90" />
        </div>

        {/* NAV */}
        <header className="relative z-50 w-full px-6 py-6 md:px-12 flex justify-between items-center">
          <div className="flex items-center gap-2 text-[#FDF8F0]">
            <span className="text-2xl">📖</span>
            <span className="font-serif text-2xl font-bold">
              FlipWhizz
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-[#FDF8F0]/90 text-sm font-medium">
            <Link href="#how-it-works" className="hover:text-amber-200">
              How It Works
            </Link>
            <Link href="#gallery" className="hover:text-amber-200">
              Gallery
            </Link>

            {!session ? (
              <Link
                href="/api/auth/signin"
                className="px-6 py-2 rounded-full border border-white/30 hover:bg-white hover:text-[#0F2236]"
              >
                Sign In
              </Link>
            ) : (
              <Link
                href="/projects"
                className="px-6 py-2 rounded-full bg-[#F4A261] text-[#0F2236] font-bold hover:bg-[#E76F51]"
              >
                My Library
              </Link>
            )}
          </nav>
        </header>

        {/* HERO COPY */}
        <div className="relative z-10 flex-grow flex flex-col justify-center px-6 md:px-20 max-w-4xl">
          <h1 className="font-serif text-5xl md:text-7xl text-[#FDF8F0] leading-tight">
            Turn Their Inner World
            <br />
            <span className="text-[#F4A261]">
              Into a Tangible Tale
            </span>
          </h1>

          <p className="mt-6 text-lg text-white/90 max-w-xl">
            Beautifully illustrated storybooks created from your
            child’s imagination — made together, treasured forever.
          </p>

          <div className="mt-10">
            <button
              onClick={createProject}
              className="px-10 py-5 text-lg font-serif font-bold text-[#261C15] bg-[#FDF8F0] rounded-full shadow-xl hover:scale-105 transition"
            >
              Create Your First Story
            </button>
          </div>
        </div>
      </section>

      {/* (Your remaining sections — How it Works, Gallery, Footer — stay unchanged) */}
    </main>
  );
}
