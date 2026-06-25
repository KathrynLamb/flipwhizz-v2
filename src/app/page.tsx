import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Link from "next/link";
import Image from "next/image";
import { Playfair_Display, Lato } from "next/font/google";
import HeroButton from "@/components/HeroButton";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { stories, bookCovers } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import GallerySection from "@/components/GallerySection";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "700", "900"] });
const lato = Lato({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "700"] });

export default async function Home() {
  const session = await getServerSession(authOptions);

  const publicStories = await db
    .select({ id: stories.id, title: stories.title, description: stories.description, coverSpreadUrl: stories.coverSpreadUrl, updatedAt: stories.updatedAt })
    .from(stories).where(eq(stories.public, true)).orderBy(desc(stories.updatedAt)).limit(8);

  const publicStoryIds = publicStories.map((s) => s.id);
  const selectedCovers = publicStoryIds.length
    ? await db.select({ storyId: bookCovers.storyId, imageUrl: bookCovers.imageUrl }).from(bookCovers).where(and(inArray(bookCovers.storyId, publicStoryIds), eq(bookCovers.isSelected, true)))
    : [];
  const coverByStoryId = new Map(selectedCovers.map((c) => [c.storyId, c.imageUrl]));

  let hasProjects = false;
  if (session?.user?.id) {
    const userProjects = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.userId, session.user.id));
    hasProjects = userProjects[0].count > 0;
  }

  return (
    <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans text-slate-900 overflow-x-hidden`} style={{ background: "#FEFCFA" }}>
      {/* CSS-only hover effects for pricing cards */}
      <style>{`
        .pricing-card {
          border: 1px solid #E8DDCF;
          box-shadow: 0 4px 24px rgba(45,34,53,0.06);
          transition: box-shadow 0.3s, transform 0.3s;
        }
        .pricing-card:hover {
          box-shadow: 0 16px 48px rgba(217,69,144,0.1), 0 0 0 1px rgba(217,69,144,0.12);
          transform: translateY(-4px);
        }
        .pricing-card-featured {
          border: 2px solid #D94590;
          box-shadow: 0 12px 40px rgba(217,69,144,0.15), 0 0 0 1px rgba(217,69,144,0.1);
          transition: box-shadow 0.3s, transform 0.3s;
        }
        .pricing-card-featured:hover {
          box-shadow: 0 24px 60px rgba(217,69,144,0.22), 0 0 0 1px rgba(217,69,144,0.2);
          transform: translateY(-4px);
        }
      `}</style>

      {/* ── HERO ── */}
      <section className="relative w-full flex flex-col bg-white">
        <div className="relative z-30">
          <Header session={session} />
        </div>
        <div className="relative w-full">
          <div className="hidden lg:block relative w-full" style={{ height: "min(75vh, 700px)" }}>
            <Image src="/LandingPage/white_hero.jpg" alt="Big Imaginations Deserve Beautiful Books" fill priority className="object-cover object-top" />
          </div>
          <div className="lg:hidden relative w-full">
            <Image src="/LandingPage/white_hero_mob.jpg" alt="Big Imaginations Deserve Beautiful Books" width={1536} height={2752} priority className="w-full h-auto" />
          </div>
        </div>
      </section>

      {/* ── CTA STRIP ── */}
      <section className="relative pt-4 pb-14 lg:pt-6 lg:pb-20 bg-white overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
          style={{ background: "linear-gradient(to bottom, white, #FEFCFA)" }}
        />
        <div className="relative flex flex-col items-center gap-5 px-6">
          <Link
            href={hasProjects ? "/projects" : "/projects/create"}
            className="group px-10 py-4 lg:px-14 lg:py-5 rounded-full text-base lg:text-lg font-bold text-white tracking-wide transition-all duration-300 hover:scale-105 active:scale-[0.98]"
            style={{
              background: "#D94590",
              boxShadow: "0 6px 28px rgba(217,69,144,0.35)",
            }}
          >
            {hasProjects ? "Create Another Story" : "Create Your First Story"}
          </Link>
          <div className="text-center space-y-1.5">
            <p className="text-sm lg:text-base font-medium" style={{ color: "#6B5D52" }}>
              See your first illustrated spread for free — no card, no commitment.
            </p>
            <p className="text-xs lg:text-sm" style={{ color: "#A89B8E" }}>
              The whole thing takes about 15 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}

      
      <section id="how-it-works" style={{ background: "#FEFCFA" }}>
        <div className="relative w-full">
          <div className="hidden lg:block relative w-full" style={{ aspectRatio: "16 / 9" }}>
            <Image src="/LandingPage/how-it-works.jpg" alt="How FlipWhizz works: 1. Share your idea, 2. We craft their story, 3. Hold it in your hands" fill className="object-contain" />
          </div>
          <div className="lg:hidden relative w-full" style={{ aspectRatio: "9 / 16" }}>
            <Image src="/LandingPage/how-it-works-mobile.jpg" alt="How FlipWhizz works: 1. Share your idea, 2. We craft their story, 3. Hold it in your hands" fill className="object-contain" />
          </div>
        </div>
      </section>

      {/* ── THIS IS OLIVIA'S BOOK ── */}
      <section className="relative py-20 lg:py-28 px-6 lg:px-12 overflow-hidden" style={{ background: "#FEFCFA" }}>
        <div
          className="absolute -top-32 -left-32 w-[400px] h-[400px] rounded-full opacity-[0.06] pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, #D94590, #7C3AED)" }}
        />
        <div className="relative mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p
              className="text-sm font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: "#D94590" }}
            >
              ✦ Personalisation ✦
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold" style={{ color: "#2D2235" }}>
              This Is Olivia&apos;s Book. No One Else&apos;s.
            </h2>
            <p className="mt-4 text-lg" style={{ color: "#6B5D52" }}>
              Your photos. Your words. Their one-of-a-kind book.
            </p>
          </div>
          <div
            className="relative w-full aspect-[21/10] rounded-[22px] overflow-hidden"
            style={{
              boxShadow: "0 25px 60px rgba(45,34,53,0.18), 0 0 0 1px rgba(45,34,53,0.04)",
            }}
          >
            <Image src="/LandingPage/photo_to_book.jpeg" alt="Real family photos transformed into a personalised illustrated storybook" fill className="object-cover" />
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <GallerySection stories={publicStories} coverByStoryId={coverByStoryId} session={session} hasProjects={hasProjects} />

      {/* ── PRICING ── */}
      <section id="pricing" className="relative py-28 px-6 lg:px-12 overflow-hidden" style={{ background: "#FEFCFA" }}>
        {/* Background texture */}
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              #2D2235 10px,
              #2D2235 11px
            )`,
          }}
        />
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.05] pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, #D94590, #7C3AED)" }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full opacity-[0.04] pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, #5EEAD4, #7C3AED)" }}
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <p
              className="text-sm font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: "#D94590" }}
            >
              ✦ Pricing ✦
            </p>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold" style={{ color: "#2D2235" }}>
              Simple, Honest Pricing
            </h2>
            <p className="mt-6 text-lg leading-relaxed" style={{ color: "#6B5D52" }}>
              Each story is crafted once, then yours forever.<br />
              No subscriptions. No upsells. Just a beautiful book.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-stretch">
            {/* DIGITAL */}
            <div className="pricing-card rounded-[22px] bg-white p-8 flex flex-col">
              <h3 className="font-serif text-2xl font-bold mb-2" style={{ color: "#D94590" }}>Print at home PDF</h3>
              <p className="text-sm mb-6" style={{ color: "#6B5D52" }}>A beautifully illustrated story, ready to read or print.</p>
              <div className="mb-6">
                <span className="text-4xl font-serif font-bold" style={{ color: "#2D2235" }}>£14</span>
                <span style={{ color: "#6B5D52" }}> one-off</span>
              </div>
              <ul className="space-y-3 text-sm mb-8" style={{ color: "#4A4038" }}>
                {["Fully personalised story", "Custom illustrations", "Unlimited re-reads", "High-quality PDF download"].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span style={{ color: "#D94590" }} className="mt-0.5">✦</span>{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <HeroButton session={session} hasProjects={hasProjects} intent="digital" className="w-full" variant="primary" />
              </div>
            </div>

            {/* PRINTED — featured */}
            <div className="pricing-card-featured rounded-[22px] bg-white p-10 relative flex flex-col lg:-mt-4 lg:mb-[-16px]">
              <div
                className="absolute -top-4 left-1/2 -translate-x-1/2 text-white text-xs font-semibold px-5 py-1.5 rounded-full tracking-wide"
                style={{ background: "#D94590", boxShadow: "0 4px 12px rgba(217,69,144,0.3)" }}
              >
                Most Loved
              </div>
              <div
                className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 rounded-tr-lg opacity-15 pointer-events-none"
                style={{ borderColor: "#D94590" }}
              />
              <h3 className="font-serif text-2xl font-bold mb-2" style={{ color: "#D94590" }}>Printed Storybook</h3>
              <p className="text-sm mb-6" style={{ color: "#6B5D52" }}>A keepsake to hold, gift, and treasure for years.</p>
              <div className="mb-6">
                <span className="text-4xl font-serif font-bold" style={{ color: "#2D2235" }}>£29</span>
                <span style={{ color: "#6B5D52" }}> one-off</span>
              </div>
              <ul className="space-y-3 text-sm mb-8" style={{ color: "#4A4038" }}>
                {["Everything in Digital", "Premium soft-touch cover", "Beautiful full-colour pages", "Perfect for bedtime reading"].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span style={{ color: "#D94590" }} className="mt-0.5">✦</span>{f}
                  </li>
                ))}
              </ul>
              <HeroButton session={session} hasProjects={hasProjects} intent="print" variant="primary" className="w-full" />
            </div>

            {/* GIFT */}
            <div className="pricing-card rounded-[22px] bg-white p-8 flex flex-col">
              <h3 className="font-serif text-2xl font-bold mb-2" style={{ color: "#D94590" }}>Gift Edition</h3>
              <p className="text-sm mb-6" style={{ color: "#6B5D52" }}>Made for birthdays, Christmas, and once-in-a-lifetime moments.</p>
              <div className="mb-6">
                <span className="text-4xl font-serif font-bold" style={{ color: "#2D2235" }}>£39</span>
                <span style={{ color: "#6B5D52" }}> one-off</span>
              </div>
              <ul className="space-y-3 text-sm mb-8" style={{ color: "#4A4038" }}>
                {["Deluxe printed book", "Personal dedication page", "Gift-ready presentation", "Designed to be kept forever"].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span style={{ color: "#D94590" }} className="mt-0.5">✦</span>{f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <HeroButton session={session} hasProjects={hasProjects} intent="gift" className="w-full" variant="primary" />
              </div>
            </div>
          </div>

          <div className="mt-20 text-center text-sm" style={{ color: "#6B5D52" }}>
            <p>No subscriptions. No hidden fees.<br />If your child doesn&apos;t love it, we&apos;ll make it right.</p>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}