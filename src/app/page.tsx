// src/app/page.tsx
//
// Homepage. The page is the first message of the story chat: the hero asks
// "Who's this story for?" and answering drops the visitor into /projects/create
// with that answer already sent. Sections, in order, each with one job:
// hero chat starter, trust strip, real books, how it works (+ second starter),
// every grown-up who loves them, occasions, pricing, about Katy, FAQ (+ final
// starter). Copy avoids em dashes by choice.

import type { Metadata } from "next";
import { luluPrintEnabled } from "@/lib/lulu/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { Playfair_Display, Lato } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { stories, bookCovers } from "@/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import GallerySection from "@/components/GallerySection";
import HomeChatStarter from "@/components/home/HomeChatStarter";
import HomeFaq from "@/components/home/HomeFaq";
import { HOME_FAQS } from "@/content/homeFaqs";
import { GIFT_PAGES } from "@/content/giftPages";
import { starterHref } from "@/lib/chatStarter";
import { getPriceCents, formatPrice, countryToCurrency } from "@/lib/pricing";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "700", "900"] });
const lato = Lato({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "700"] });

const TITLE = "Personalised Children's Books Written by You | FlipWhizz";
const DESCRIPTION =
  "Turn a family memory or your child's imagination into a personalised illustrated book. Free first page, no sign-up. Printed and delivered in the UK.";

export const metadata: Metadata = {
  // absolute: skip the layout's "%s | FlipWhizz" template, the brand is already in the title.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "https://flipwhizz.com" },
  openGraph: {
    type: "website",
    url: "https://flipwhizz.com",
    siteName: "FlipWhizz",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_GB",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "A personalised FlipWhizz storybook made from family photos" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og-image.png"] },
};

const INK = "#2D2235";
const BODY = "#5C5048";
const PINK = "#D94590";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em]" style={{ color: PINK }}>
      {children}
    </p>
  );
}

export default async function Home() {
  const session = await getServerSession(authOptions);

  // Display currency from geo. The page is already dynamic (it reads the
  // session cookie), so reading a header adds no extra caching cost.
  const country = (await headers()).get("x-vercel-ip-country");
  const currency = countryToCurrency(country);

  const digitalCents = getPriceCents("digital", currency);
  const printCents = getPriceCents("print", currency);
  const priceDigital = formatPrice(digitalCents, currency);
  const pricePrint = formatPrice(printCents, currency);
  const priceGift = formatPrice(getPriceCents("gift", currency), currency);
  const priceColouring = formatPrice(getPriceCents("print", currency, "colouring_storybook"), currency);
  const colouringAvailable = luluPrintEnabled();

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

  const lastModified = new Date(publicStories[0]?.updatedAt ?? Date.now()).toISOString();

  // ── Structured data ──
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "FlipWhizz",
    url: "https://flipwhizz.com",
    logo: "https://flipwhizz.com/og-image.png",
    email: "hello@flipwhizz.com",
    description:
      "Personalised children's book platform where the adult who loves a child authors an original, illustrated story for them. Built by an educator with 20 years working with children.",
    founder: { "@type": "Person", name: "Katy", jobTitle: "Founder", url: "https://flipwhizz.com/about" },
    sameAs: ["https://www.instagram.com/flipwhizz_kate"],
  };

  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "FlipWhizz",
    url: "https://flipwhizz.com",
    publisher: { "@type": "Organization", name: "FlipWhizz" },
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: "https://flipwhizz.com",
    name: TITLE,
    description: DESCRIPTION,
    isPartOf: { "@type": "WebSite", url: "https://flipwhizz.com" },
    dateModified: lastModified,
  };

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Personalised children's storybook",
    description:
      "An original, illustrated children's book written by you about a child you love, from a short chat. Available as a digital book or a printed storybook.",
    brand: { "@type": "Brand", name: "FlipWhizz" },
    image: "https://flipwhizz.com/LandingPage/photo_to_book.jpeg",
    offers: [
      { "@type": "Offer", name: "Digital book (PDF)", price: (digitalCents / 100).toFixed(2), priceCurrency: currency, availability: "https://schema.org/InStock", url: "https://flipwhizz.com/#pricing" },
      { "@type": "Offer", name: "Printed storybook", price: (printCents / 100).toFixed(2), priceCurrency: currency, availability: "https://schema.org/InStock", url: "https://flipwhizz.com/#pricing" },
    ],
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: HOME_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  const occasionLinks = GIFT_PAGES.filter((g) => g.showInOccasions);

  return (
    <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans text-[18px] text-slate-900 overflow-x-hidden`} style={{ background: "#FEFCFA" }}>
      {[organizationJsonLd, websiteJsonLd, webPageJsonLd, productJsonLd, faqJsonLd].map((json, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
      ))}

      <div className="relative z-30">
        <Header session={session} />
      </div>

      {/* ── 1. HERO: the chat starter ── */}
      <section className="bg-white px-4 pb-12 pt-8 sm:px-6 lg:px-12 lg:pb-20 lg:pt-14">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="min-w-0">
            <h1 className="font-serif text-[34px] font-bold leading-[1.12] sm:text-5xl lg:text-[54px]" style={{ color: INK }}>
              A personalised children&apos;s book, written by you, about the child you love.
            </h1>
            <p className="mt-5 max-w-xl text-[19px] leading-relaxed sm:text-xl" style={{ color: BODY }}>
              Tell us about them in a short chat. We&apos;ll help you shape the story and illustrate every page.
            </p>
            <div className="mt-7">
              <HomeChatStarter position="hero" />
              <p className="mt-3 pl-2 text-base font-semibold" style={{ color: "#7960AF" }}>
                Free first illustrated page. No sign-up to start. No card.
              </p>
            </div>
          </div>

          <figure className="min-w-0">
            <div className="relative aspect-[1504/704] w-full overflow-hidden rounded-[22px] shadow-[0_25px_60px_rgba(45,34,53,0.16)]">
              <Image
                src="/LandingPage/photo_to_book.jpeg"
                alt="Family photos of a little girl, a park bandstand, a cat and a dog, next to the illustrated storybook page they became"
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-3 text-center text-base" style={{ color: BODY }}>
              Your photos and memories in, their own illustrated book out.
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ── 2. TRUST STRIP ── */}
      <section aria-label="Why families trust FlipWhizz" className="border-y border-[#EFE6DA] bg-[#FBF7F2] px-4 py-6 sm:px-6">
        <ul className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-3 text-center text-[17px] font-semibold sm:flex-row sm:gap-10" style={{ color: INK }}>
          <li>Created by an educator with 20 years working with children</li>
          <li aria-hidden="true" className="hidden sm:block text-[#D9C9B6]">✦</li>
          <li>Printed and delivered to your door</li>
          <li aria-hidden="true" className="hidden sm:block text-[#D9C9B6]">✦</li>
          <li>Your photos stay private</li>
        </ul>
      </section>

      {/* ── 3. SEE INSIDE REAL BOOKS ── */}
      <GallerySection stories={publicStories} coverByStoryId={coverByStoryId} session={session} hasProjects={hasProjects} />

      {/* ── 4. HOW IT WORKS ── */}
      <section id="how-it-works" aria-labelledby="how-title" className="px-4 py-20 sm:px-6 lg:px-12 lg:py-24" style={{ background: "#F7F3FB" }}>
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <Eyebrow>How it works</Eyebrow>
            <h2 id="how-title" className="font-serif text-4xl font-bold lg:text-5xl" style={{ color: INK }}>
              How to make a personalised children&apos;s book
            </h2>
          </div>
          <ol className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["Chat", "Tell us about them: a memory, a joke, a dream, the dog. No writing skills needed."],
              ["Shape", "See the first illustrated page free, then change anything until it feels like them."],
              ["Keep", "Download it tonight, or get a printed storybook posted to your door."],
            ].map(([title, text], i) => (
              <li key={title} className="rounded-[22px] bg-white p-7 shadow-[0_4px_24px_rgba(45,34,53,0.06)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#D94590] text-lg font-bold text-white">{i + 1}</span>
                <h3 className="mt-4 font-serif text-2xl font-bold" style={{ color: INK }}>{title}</h3>
                <p className="mt-2 text-[17px] leading-relaxed" style={{ color: BODY }}>{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12 flex justify-center">
            <HomeChatStarter position="mid" mode="about" question="What should the story be about?" tone="tinted" />
          </div>
        </div>
      </section>

      {/* ── 5. EVERY GROWN-UP WHO LOVES THEM ── */}
      <section aria-labelledby="who-title" className="px-4 py-20 sm:px-6 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>For every grown-up who loves them</Eyebrow>
            <h2 id="who-title" className="font-serif text-4xl font-bold lg:text-5xl" style={{ color: INK }}>
              Personalised book gifts for grandchildren, nieces, nephews and your own little ones
            </h2>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { who: "Grandparents", line: "Put your stories in their hands. Just chat, we'll do the rest.", href: "/gifts/grandchildren", cta: "Gifts for grandchildren" },
              { who: "Aunts, uncles and godparents", line: "The gift no one else could give. Download it the same day or have it posted.", href: "/gifts/from-aunt-and-uncle", cta: "Gifts from an aunt or uncle" },
              { who: "Parents", line: "Their bedtime, their world, their name on every page.", href: starterHref({ entry: "home_parents_card" }), cta: "Start their story" },
            ].map((card) => (
              <div key={card.who} className="flex flex-col rounded-[22px] border border-[#E8DDCF] bg-white p-7">
                <h3 className="font-serif text-2xl font-bold" style={{ color: INK }}>{card.who}</h3>
                <p className="mt-3 flex-1 text-[18px] leading-relaxed" style={{ color: BODY }}>{card.line}</p>
                <Link href={card.href} className="mt-6 inline-flex min-h-[48px] items-center font-bold underline decoration-2 underline-offset-4" style={{ color: PINK }}>
                  {card.cta} <span aria-hidden="true" className="ml-2">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. OCCASIONS ── */}
      <section id="gifts" aria-labelledby="occasions-title" className="px-4 pb-20 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-5xl rounded-[28px] bg-[#FBF7F2] px-6 py-12 text-center sm:px-10">
          <h2 id="occasions-title" className="font-serif text-3xl font-bold lg:text-4xl" style={{ color: INK }}>
            A book for the moments that matter
          </h2>
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            {occasionLinks.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/gifts/${g.slug}`}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-[#E3D6ED] bg-white px-6 text-[17px] font-semibold transition-colors hover:border-[#A270C9]"
                  style={{ color: INK }}
                >
                  {g.occasionLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 7. PRICING ── */}
      <section id="pricing" aria-labelledby="pricing-title" className="px-4 py-20 sm:px-6 lg:px-12 lg:py-24" style={{ background: "#F7F3FB" }}>
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Eyebrow>Pricing</Eyebrow>
            <h2 id="pricing-title" className="font-serif text-4xl font-bold lg:text-5xl" style={{ color: INK }}>
              Simple, honest pricing
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[19px] leading-relaxed" style={{ color: BODY }}>
              Your first illustrated page is free. Only pay if you love it. One-off price, no subscription.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="flex flex-col rounded-[22px] border border-[#E8DDCF] bg-white p-8">
              <h3 className="font-serif text-2xl font-bold" style={{ color: INK }}>Digital book</h3>
              <p className="mt-1 text-[17px]" style={{ color: BODY }}>A fully illustrated PDF to read on screen or print at home. Ready as soon as it&apos;s finished.</p>
              <p className="mt-6 font-serif text-5xl font-bold" style={{ color: INK }}>{priceDigital}</p>
              <Link href={starterHref({ entry: "pricing_digital" })} className="mt-8 inline-flex min-h-[54px] items-center justify-center rounded-full border-2 border-[#D94590] px-6 text-[17px] font-bold" style={{ color: PINK }}>
                Start free
              </Link>
            </div>

            <div className="relative flex flex-col rounded-[22px] border-2 border-[#D94590] bg-white p-8 shadow-[0_12px_40px_rgba(217,69,144,0.14)]">
              <span className="absolute -top-4 left-8 rounded-full bg-[#D94590] px-4 py-1 text-sm font-bold text-white">Most loved</span>
              <h3 className="font-serif text-2xl font-bold" style={{ color: INK }}>Printed storybook</h3>
              <p className="mt-1 text-[17px]" style={{ color: BODY }}>A full-colour printed book posted to your door, plus the digital copy.</p>
              <p className="mt-6 font-serif text-5xl font-bold" style={{ color: INK }}>{pricePrint}</p>
              <Link href={starterHref({ entry: "pricing_print" })} className="mt-8 inline-flex min-h-[54px] items-center justify-center rounded-full bg-[#D94590] px-6 text-[17px] font-bold text-white shadow-[0_6px_20px_rgba(217,69,144,0.3)]">
                Start free
              </Link>
            </div>
          </div>

          <div className="mt-8 rounded-[22px] bg-white p-6 text-[17px] leading-relaxed sm:p-8" style={{ color: BODY }}>
            <p className="font-bold" style={{ color: INK }}>Choose at the end of your story:</p>
            <ul className="mt-3 space-y-2">
              <li><strong style={{ color: INK }}>Gift edition, {priceGift}:</strong> a hardcover printed book with a personal dedication page.</li>
              {colouringAvailable && (
                <li>
                  <strong style={{ color: INK }}>Colouring edition, {priceColouring}:</strong> a coil-bound book with outline pictures to colour in, plus a printable PDF, delivery included.{" "}
                  <Link href="/projects/create?bookType=colouring_storybook&entry=pricing_colouring" className="font-bold underline underline-offset-4" style={{ color: "#7960AF" }}>
                    Make a colouring book
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 8. ABOUT KATY ── */}
      <section aria-labelledby="katy-title" className="px-4 py-20 sm:px-6 lg:px-12 lg:py-24">
        <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-[280px_1fr]">
          <div className="relative mx-auto aspect-[3/4] w-56 overflow-hidden rounded-[22px] md:w-full">
            <Image src="/About/katy-portrait.png" alt="Katy, founder of FlipWhizz" fill sizes="280px" className="object-cover" />
          </div>
          <div>
            <Eyebrow>Who&apos;s behind it</Eyebrow>
            <h2 id="katy-title" className="font-serif text-4xl font-bold" style={{ color: INK }}>Hi, I&apos;m Katy</h2>
            <p className="mt-4 text-[19px] leading-relaxed" style={{ color: BODY }}>
              I&apos;ve spent 20 years working with children, in schools, early years settings, language classrooms and outdoors. I built FlipWhizz because the stories children love most are the ones about their own lives, told by the people who love them.
            </p>
            <p className="mt-5 font-serif text-2xl font-bold italic leading-snug" style={{ color: "#7960AF" }}>
              &ldquo;AI never touches the child. It supports the adult who loves them.&rdquo;
            </p>
            <Link href="/about" className="mt-6 inline-flex min-h-[48px] items-center font-bold underline decoration-2 underline-offset-4" style={{ color: PINK }}>
              Read my story <span aria-hidden="true" className="ml-2">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 9. FAQ + FINAL STARTER ── */}
      <section id="faq" aria-labelledby="faq-title" className="px-4 pb-24 pt-4 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className="text-center font-serif text-4xl font-bold" style={{ color: INK }}>
            Personalised children&apos;s book FAQ
          </h2>
          <div className="mt-10">
            <HomeFaq faqs={HOME_FAQS} />
          </div>
          <p className="mt-6 text-center text-[17px]" style={{ color: BODY }}>
            More questions? <Link href="/faq" className="font-bold underline underline-offset-4" style={{ color: PINK }}>See the full FAQ</Link> or email{" "}
            <a href="mailto:hello@flipwhizz.com" className="font-bold underline underline-offset-4" style={{ color: PINK }}>hello@flipwhizz.com</a>.
          </p>
          <div className="mt-14 flex flex-col items-center">
            <h2 className="mb-6 text-center font-serif text-3xl font-bold" style={{ color: INK }}>Ready to start?</h2>
            <HomeChatStarter position="footer" question="Ready? Who's this story for?" />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
