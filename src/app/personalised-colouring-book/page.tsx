// src/app/personalised-colouring-book/page.tsx

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { Playfair_Display, Lato } from "next/font/google";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ColouringPreview from "@/components/ColouringPreview";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  getColouringPriceCents,
  getPriceCents,
  formatPrice,
  countryToCurrency,
} from "@/lib/pricing";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "700", "900"] });
const lato = Lato({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "700"] });

const PAGE_URL = "https://flipwhizz.com/personalised-colouring-book";

export const metadata: Metadata = {
  title: "Personalised Colouring Book for Kids: Their Own Story to Colour | FlipWhizz",
  description:
    "A personalised colouring book (coloring book) made from your child's own story. Every illustration from the book you created together, turned into printable colouring pages. Ages 2 to 10.",
  alternates: { canonical: PAGE_URL },
  openGraph: {
    title: "A Colouring Book Made From Their Own Story | FlipWhizz",
    description:
      "You wrote the story. Now they get to finish it. Every page of your child's FlipWhizz book as printable colouring pages.",
    url: PAGE_URL,
    siteName: "FlipWhizz",
    type: "website",
    locale: "en_GB",
  },
};

const pageFaqs = [
  {
    question: "Is this a generic colouring book with my child's name on it?",
    answer:
      "No. It's made from the story you created for your child, so every page shows their characters, their places, and their adventure, drawn as line art ready to colour.",
  },
  {
    question: "Do I need to buy a storybook first?",
    answer:
      "The colouring book is made from a FlipWhizz story, so you create the story first. You can add the colouring book at checkout, or come back and add it to any book in your library later.",
  },
  {
    question: "Is it printed or a download?",
    answer:
      "It's a PDF you print at home, so you can print a page again whenever it's been finished, and print extra copies for siblings and friends.",
  },
  {
    question: "What paper works best?",
    answer:
      "Normal printer paper is fine for crayons and pencils. For felt tips or paint, use thicker paper (around 120gsm or more) and print single-sided.",
  },
];

export default async function ColouringBookPage() {
  const session = await getServerSession(authOptions);
  const country = (await headers()).get("x-vercel-ip-country");
  const currency = countryToCurrency(country);
  const priceColouring = formatPrice(getColouringPriceCents(currency), currency);
  const priceDigital = formatPrice(getPriceCents("digital", currency), currency);

  let hasProjects = false;
  if (session?.user?.id) {
    const rows = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.userId, session.user.id));
    hasProjects = rows[0].count > 0;
  }
  const ctaHref = hasProjects ? "/projects" : "/projects/create";
  const ctaLabel = hasProjects ? "Add it to one of your stories" : "Start their story free";

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "FlipWhizz Personalised Colouring Book",
    description:
      "Printable colouring pages made from a child's own personalised FlipWhizz storybook. Every illustration from their story as line art.",
    brand: { "@type": "Brand", name: "FlipWhizz" },
    url: PAGE_URL,
    offers: {
      "@type": "Offer",
      price: (getColouringPriceCents("GBP") / 100).toFixed(2),
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
      url: PAGE_URL,
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: pageFaqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://flipwhizz.com" },
      { "@type": "ListItem", position: 2, name: "Personalised Colouring Book", item: PAGE_URL },
    ],
  };

  const steps = [
    {
      n: "1",
      title: "Create their story",
      body: "Tell us about your child and the story you want. You shape the characters, the places, and what happens.",
    },
    {
      n: "2",
      title: "Add the colouring book",
      body: `Add it at checkout for ${priceColouring}, or later from your library. Every illustration comes back as clean line art.`,
    },
    {
      n: "3",
      title: "Print, colour, repeat",
      body: "Download the PDF and print as many pages as you like. When a page is finished, print it again.",
    },
  ];

  const reasons = [
    {
      title: "They already know these pictures",
      body: "Colouring a page from a story they've heard at bedtime invites them to retell it: who's this, what happened next, what colour should the dragon be. That's storytelling and language practice disguised as crayons.",
    },
    {
      title: "Their book, finished by them",
      body: "FlipWhizz is built on co-creation. You're the author, and with the colouring book your child becomes the illustrator. Same story, their colours.",
    },
    {
      title: "Made to be used up",
      body: "Because it's a PDF, nothing is precious. Scribble, start again, print a set for a sibling, take a few pages on a long journey.",
    },
  ];

  return (
    <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans text-slate-900 overflow-x-hidden`} style={{ background: "#FEFCFA" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="relative z-30 bg-white">
        <Header session={session} />
      </div>

      {/* ── HERO ── */}
      <section className="relative px-6 lg:px-12 pt-12 pb-20 lg:pt-20 lg:pb-28 bg-white overflow-hidden">
        <div
          className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full opacity-[0.07] pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, #F2546A, #F7A93E)" }}
        />
        <div
          className="absolute -bottom-40 -right-32 w-[420px] h-[420px] rounded-full opacity-[0.07] pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, #8AC7E0, #A270C9)" }}
        />
        <div className="relative mx-auto max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
          <div className="text-center lg:text-left">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: "#D94590" }}>
              ✦ Personalised Colouring Book ✦
            </p>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight" style={{ color: "#2D2235" }}>
              You wrote the story. Now they get to finish it.
            </h1>
            <p className="mt-6 text-lg leading-relaxed" style={{ color: "#6B5D52" }}>
              A colouring book made from your child&apos;s own FlipWhizz story. Every
              illustration, every character, every moment you created together,
              turned into pages they can colour themselves.
            </p>
            <div className="mt-8 flex flex-col items-center lg:items-start gap-3">
              <Link
                href={ctaHref}
                className="px-10 py-4 rounded-full text-base lg:text-lg font-bold text-white tracking-wide transition-all duration-300 hover:scale-105 active:scale-[0.98]"
                style={{ background: "#D94590", boxShadow: "0 6px 28px rgba(217,69,144,0.35)" }}
              >
                {ctaLabel}
              </Link>
              <p className="text-sm" style={{ color: "#A89B8E" }}>
                {priceColouring} added to any book. Your first illustrated spread is free.
              </p>
            </div>
          </div>
          <ColouringPreview />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="px-6 lg:px-12 py-20 lg:py-24" style={{ background: "#FEFCFA" }}>
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: "#D94590" }}>
              ✦ How it works ✦
            </p>
            <h2 className="font-serif text-3xl lg:text-5xl font-bold" style={{ color: "#2D2235" }}>
              From bedtime story to colouring table
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((s) => (
              <div key={s.n} className="rounded-[22px] bg-white p-8" style={{ border: "1px solid #E8DDCF", boxShadow: "0 4px 24px rgba(45,34,53,0.06)" }}>
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center font-serif text-xl font-bold text-white mb-5"
                  style={{ background: "linear-gradient(135deg, #F2546A, #F7A93E, #8AC7E0, #A270C9)" }}
                >
                  {s.n}
                </div>
                <h3 className="font-serif text-xl font-bold mb-2" style={{ color: "#2D2235" }}>{s.title}</h3>
                <p className="text-[15px] leading-relaxed" style={{ color: "#6B5D52" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY ── */}
      <section className="px-6 lg:px-12 py-20 lg:py-24 bg-white">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-14 max-w-2xl mx-auto">
            <p className="text-sm font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: "#D94590" }}>
              ✦ Why it works ✦
            </p>
            <h2 className="font-serif text-3xl lg:text-5xl font-bold" style={{ color: "#2D2235" }}>
              Not just another colouring book
            </h2>
            <p className="mt-5 text-lg leading-relaxed" style={{ color: "#6B5D52" }}>
              Generic colouring books are someone else&apos;s pictures. This one is
              full of a world your child already loves, because you made it for them.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            {reasons.map((r) => (
              <div key={r.title}>
                <h3 className="font-serif text-xl font-bold mb-3" style={{ color: "#D94590" }}>{r.title}</h3>
                <p className="text-[15px] leading-relaxed" style={{ color: "#4A4038" }}>{r.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-14 text-center text-sm italic max-w-xl mx-auto" style={{ color: "#6B5D52" }}>
            FlipWhizz is built by Katy, an educator who has spent 20 years working with
            children in schools, early years, and outdoor learning.{" "}
            <Link href="/about" className="not-italic font-semibold hover:underline" style={{ color: "#D94590" }}>
              Read her story
            </Link>
          </p>
        </div>
      </section>

      {/* ── PRICE ── */}
      <section className="px-6 lg:px-12 py-20 lg:py-24" style={{ background: "#FEFCFA" }}>
        <div className="mx-auto max-w-md">
          <div className="rounded-[22px] bg-white p-10 text-center" style={{ border: "2px solid #D94590", boxShadow: "0 12px 40px rgba(217,69,144,0.15)" }}>
            <div className="text-4xl mb-3" aria-hidden="true">🖍️</div>
            <h2 className="font-serif text-2xl font-bold" style={{ color: "#2D2235" }}>Colouring Book</h2>
            <div className="mt-4">
              <span className="text-5xl font-serif font-bold" style={{ color: "#D94590" }}>{priceColouring}</span>
              <span style={{ color: "#6B5D52" }}> added to any book</span>
            </div>
            <ul className="mt-7 space-y-3 text-sm text-left" style={{ color: "#4A4038" }}>
              {[
                "Every illustration from their story as line art",
                "Printable PDF, print as often as you like",
                "Add at checkout or later from your library",
                `Works with any book, from the ${priceDigital} PDF up`,
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span style={{ color: "#D94590" }} className="mt-0.5">✦</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={ctaHref}
              className="mt-8 inline-flex w-full items-center justify-center px-8 py-4 rounded-full font-bold text-white transition-all duration-300 hover:scale-[1.02]"
              style={{ background: "#D94590", boxShadow: "0 6px 24px rgba(217,69,144,0.3)" }}
            >
              {ctaLabel}
            </Link>
            <Link href="/#pricing" className="mt-4 inline-block text-sm font-semibold hover:underline" style={{ color: "#6B5D52" }}>
              See all book options
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 lg:px-12 pb-24 pt-4" style={{ background: "#FEFCFA" }}>
        <div className="mx-auto max-w-3xl">
          <h2 className="font-serif text-3xl font-bold text-center mb-10" style={{ color: "#2D2235" }}>
            Colouring book questions
          </h2>
          <div className="space-y-4">
            {pageFaqs.map((f) => (
              <div key={f.question} className="rounded-[22px] bg-white p-6" style={{ border: "1px solid #E8DDCF" }}>
                <h3 className="text-lg font-bold" style={{ color: "#2D2235" }}>{f.question}</h3>
                <p className="mt-2 text-[15px] leading-7" style={{ color: "#4A4038" }}>{f.answer}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-sm" style={{ color: "#6B5D52" }}>
            More questions? See the{" "}
            <Link href="/faq" className="font-semibold hover:underline" style={{ color: "#D94590" }}>full FAQ</Link>{" "}
            or email{" "}
            <a href="mailto:hello@flipwhizz.com" className="font-semibold hover:underline" style={{ color: "#D94590" }}>hello@flipwhizz.com</a>
          </p>
        </div>
      </section>

      <Footer />
    </main>
  );
}
