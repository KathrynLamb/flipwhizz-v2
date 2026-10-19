// src/app/page.tsx
//
// Homepage. The page is the first message of the story chat: the hero asks
// "Who's this story for?" and answering drops the visitor into /projects/create
// with that answer already sent. Sections, in order, each with one job:
// hero (chat starter + a real book turning its pages), words in / page out,
// real books, how it works, every grown-up who loves them + occasions,
// pricing, about Katy, FAQ, final starter. Copy avoids em dashes by choice.

import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { luluPrintEnabled } from "@/lib/lulu/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeChatStarter from "@/components/home/HomeChatStarter";
import HeroBook from "@/components/home/HeroBook";
import HomeFaq from "@/components/home/HomeFaq";
import { HOME_FAQS } from "@/content/homeFaqs";
import { GIFT_PAGES } from "@/content/giftPages";
import { BOOKS, SHELF_BOOKS } from "@/content/homeBooks";
import { starterHref } from "@/lib/chatStarter";
import { getPriceCents, formatPrice, countryToCurrency } from "@/lib/pricing";
import "./home.css";

import { brico, fraunces } from "./fonts";

const TITLE = "Personalised Children's Books Written by You | FlipWhizz";
const DESCRIPTION =
  "Turn a family memory or your child's imagination into a personalised illustrated book. Free first page, no sign-up. Printed and posted to your door.";

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
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "A personalised FlipWhizz storybook" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/og-image.png"] },
};

const H2 = "m-0 text-[clamp(36px,4.4vw,60px)] font-bold leading-[1.02] tracking-[-0.03em]";
const LEAD = "mt-5 text-[19px] leading-[1.5] text-[#4E4259] sm:text-[21px]";

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
  };
  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Personalised children's storybook",
    description:
      "An original, illustrated children's book written by you about a child you love, from a short chat. Available as a digital book or a printed storybook.",
    brand: { "@type": "Brand", name: "FlipWhizz" },
    image: `https://flipwhizz.com${BOOKS.samDog.src}`,
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
    <main
      className={`fw-home min-h-screen overflow-x-hidden bg-white text-[#24182F] ${brico.variable} ${fraunces.variable}`}
      style={{ fontFamily: "var(--font-brico), system-ui, sans-serif" }}
    >
      {[organizationJsonLd, websiteJsonLd, webPageJsonLd, productJsonLd, faqJsonLd].map((json, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
      ))}

      <div className="relative z-30">
        <Header session={session} />
      </div>

      {/* ── 1. HERO ── */}
      <section className="px-4 pb-20 pt-10 sm:px-6 lg:pb-28 lg:pt-16">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-14 lg:flex-row lg:items-center lg:gap-12">
          <div className="min-w-0 lg:max-w-[540px] lg:flex-1">
            <h1 className="m-0 text-[clamp(42px,5.4vw,74px)] font-bold leading-[0.98] tracking-[-0.035em]">
              A book about the child you love, written by you.
            </h1>
            <p className="mt-5 max-w-[32ch] text-[19px] leading-[1.45] text-[#4E4259] sm:text-[21px]">
              Tell us about them in a short chat. We help you shape the story and illustrate every page.
            </p>
            <div className="mt-9">
              <HomeChatStarter position="hero" />
              <p className="mt-4 text-[15px] text-[#6A5E73]">Your first illustrated page is free. No sign-up, no card.</p>
            </div>
          </div>
          <div className="min-w-0 pt-6 lg:flex-1 lg:pt-0">
            <HeroBook />
          </div>
        </div>
      </section>

      {/* ── 2. TRUST LINE ── */}
      <section aria-label="Why families trust FlipWhizz" className="border-y border-[#EFE7F5] px-4 py-6 sm:px-6">
        <ul className="mx-auto flex max-w-[1240px] flex-col items-start gap-3 text-[16px] font-semibold sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-10">
          {[
            ["#F2546A", "Made by an educator with 20 years working with children"],
            ["#F7A93E", "Printed and posted to your door"],
            ["#6F4BB0", "Your photos stay private"],
          ].map(([c, t]) => (
            <li key={t} className="flex items-center gap-3">
              <span aria-hidden="true" className="fw-blob h-3 w-3 shrink-0" style={{ background: c }} />
              {t}
            </li>
          ))}
        </ul>
      </section>

      {/* ── 3. WORDS IN, PAGE OUT ── */}
      <section className="bg-[#24182F] px-4 py-24 text-white sm:px-6 lg:py-28">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-14 lg:flex-row lg:items-center lg:gap-16">
          <div className="min-w-0 lg:max-w-[460px] lg:flex-1">
            <h2 className={H2}>Your words go in. Their page comes out.</h2>
            <p className="mt-5 text-[19px] leading-[1.5] text-[#D9CFE6] sm:text-[20px]">
              A few lines about what they love is enough. Here&apos;s the kind of thing someone might say, and the page it became.
            </p>
            <div className="mt-8 flex flex-col items-end gap-2.5">
              <p className="m-0 max-w-[34ch] rounded-[20px] rounded-br-[6px] bg-[#FBD3E0] px-[18px] py-3 text-[18px] font-semibold text-[#24182F]">
                Sam&apos;s two and points at every digger on the way to school.
              </p>
              <p className="m-0 max-w-[34ch] rounded-[20px] rounded-br-[6px] bg-[#FBD3E0] px-[18px] py-3 text-[18px] font-semibold text-[#24182F]">
                His scruffy dog Pickle follows him everywhere.
              </p>
            </div>
          </div>
          <div className="min-w-0 lg:flex-[1.3]">
            <div className="relative aspect-[1600/893] overflow-hidden rounded-[14px] bg-[#3A2C47] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
              <Image src={BOOKS.samDigger.src} alt={`A storybook spread: ${BOOKS.samDigger.alt}`} fill sizes="(min-width: 1024px) 720px, 100vw" className="fw-wash object-cover" />
              <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0) 46%, rgba(36,24,47,.18) 50%, rgba(0,0,0,0) 54%)" }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. REAL BOOKS ── */}
      <section id="gallery" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <h2 className={`${H2} max-w-[16ch]`}>Every book is drawn for one child</h2>
          <p className={`${LEAD} max-w-[40ch]`}>No templates and no name swaps. The story, the people and the style all come from your chat.</p>

          {/* Mobile: swipe through. Desktop: two big, three smaller. */}
          <ul className="-mx-4 mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-x-8 lg:gap-y-12 lg:overflow-visible lg:px-0 lg:pb-0">
            {SHELF_BOOKS.map((b, i) => (
              <li key={b.src} className={`fw-shelf w-[82%] shrink-0 snap-center sm:w-[60%] lg:w-auto ${i < 2 ? "lg:col-span-3" : "lg:col-span-2"}`}>
                <div className="relative aspect-[1600/893] overflow-hidden rounded-[12px] shadow-[0_20px_40px_-24px_rgba(36,24,47,0.5)]">
                  <Image src={b.src} alt={`A spread from ${b.title}: ${b.alt}`} fill sizes="(min-width: 1024px) 600px, 82vw" className="object-cover" />
                </div>
                <p className="mb-0 mt-4 text-[16px] font-semibold">{b.caption}</p>
                <p className="m-0 mt-1 text-[14px] text-[#6A5E73]">{b.title}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS ── */}
      <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-24 overflow-hidden bg-[#F6F1FC] px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-[1180px]">
          <h2 id="how-title" className={`${H2} max-w-[15ch]`}>You don&apos;t need to be a writer.</h2>
          <p className={`${LEAD} max-w-[34ch]`}>If you can send a text message, you can make them a book. Here&apos;s how it goes.</p>

          <ol className="relative mt-16 flex list-none flex-col gap-20 p-0 lg:gap-28">
            <span aria-hidden="true" className="fw-thread absolute bottom-6 left-[21px] top-6 hidden w-[3px] rounded-full sm:block" />

            {/* 1 */}
            <Step n={1} color="#F2546A" title="Just talk about them" tag="No sign-up to start"
              text="Answer a few friendly questions in your own words. What they love, what's on their mind, the name of the dog. We turn it into a story.">
              <div role="img" aria-label="An example chat about a five-year-old called Ella who is about to become a big sister" className="flex flex-col gap-2.5 rounded-[28px] bg-white px-[22px] pb-[26px] pt-[22px] shadow-[0_30px_60px_-36px_rgba(36,24,47,0.45)]">
                <p className="mb-1.5 ml-1 mt-0 text-[13px] font-bold uppercase tracking-[0.08em] text-[#8B7F95]">Example chat</p>
                <Bubble from="fw" className="fw-rise">Who&apos;s this story for?</Bubble>
                <Bubble from="you" className="fw-rise fw-rise-2">My granddaughter Ella. She&apos;s five.</Bubble>
                <Bubble from="fw" className="fw-rise fw-rise-3">Lovely! What&apos;s going on in Ella&apos;s world right now?</Bubble>
                <Bubble from="you" className="fw-rise fw-rise-4">Her baby brother is due in March and she&apos;s a bit worried. She loves unicorns and never lets go of her bunny, Button.</Bubble>
              </div>
            </Step>

            {/* 2 */}
            <Step n={2} color="#F7A93E" title="See their first page before you pay" tag="Free to try, no card needed"
              text="Your first illustrated page is free. Change any word, or ask for a picture to be redrawn, until it feels like them.">
              <div className="relative overflow-hidden rounded-[18px] bg-[#FFFDF6] shadow-[0_30px_60px_-36px_rgba(36,24,47,0.5)]">
                <div className="relative aspect-[1600/893]">
                  <span className="fw-sticker absolute bottom-3 right-3 z-[2] rotate-[5deg] bg-[#E8455C] px-[15px] py-[9px] text-[15px] font-bold text-white shadow-[0_8px_18px_-8px_rgba(232,69,92,0.7)]">Page 1 is free</span>
                  <Image src={BOOKS.ella.src} alt={`A storybook spread: ${BOOKS.ella.alt}`} fill sizes="(min-width: 1024px) 620px, 100vw" className="object-cover" />
                </div>
                <p className="m-0 px-6 pb-6 pt-5 text-[clamp(18px,2vw,22px)] leading-[1.5]" style={{ fontFamily: "var(--font-book), Georgia, serif" }}>
                  <span className="mb-1.5 block text-[13px] font-bold uppercase tracking-[0.08em] text-[#8B7F95]" style={{ fontFamily: "var(--font-brico), system-ui, sans-serif" }}>Editing page 1</span>
                  Ella looked at her hands. Were they glowing? Just a <span className="fw-w-old">little</span><span className="fw-w-new">teeny, tiny bit</span>?
                </p>
              </div>
              <div aria-hidden="true" className="mt-3.5 flex flex-wrap gap-2">
                {["Change a word", "Redraw a picture", "Add the dog"].map((t) => (
                  <span key={t} className="rounded-full border-[1.5px] border-[#E4DCF0] bg-white px-3 py-1.5 text-[14px] font-semibold text-[#4E4259]">{t}</span>
                ))}
              </div>
            </Step>

            {/* 3 */}
            <Step n={3} color="#6F4BB0" title="Give them a book they'll keep"
              text="A real printed book with their name on the cover, posted to your door. Or download it and read it together tonight.">
              <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-center sm:gap-12">
                <div className="relative flex w-full justify-center py-6 sm:w-auto sm:flex-1">
                  <div aria-hidden="true" className="fw-blob absolute left-1/2 top-1/2 aspect-square w-[min(280px,90%)] -translate-x-1/2 -translate-y-1/2 bg-[#FFE7C2]" />
                  <div role="img" aria-label={`The finished book: ${BOOKS.ella.title}`} className="fw-book relative aspect-[800/893] w-[min(220px,70vw)] overflow-hidden rounded-[3px_12px_12px_3px]">
                    <Image src={BOOKS.ella.src} alt="" fill sizes="220px" className="object-cover object-[88%_50%]" />
                    <p className="absolute inset-x-0 top-0 m-0 bg-[#FFFDF6] px-4 pb-3.5 pt-5 text-center text-[16px] font-semibold leading-[1.15]" style={{ fontFamily: "var(--font-book), Georgia, serif" }}>
                      {BOOKS.ella.title}
                    </p>
                  </div>
                </div>
                <ul className="m-0 flex w-full list-none flex-col gap-3 p-0 sm:flex-1">
                  <KeepOption bg="#FBD3E0" icon="parcel" title="Printed book" sub="Made to order and posted to your door" />
                  <KeepOption bg="#FFE7C2" icon="gift" title="Hardback gift edition" sub="With a dedication page from you" />
                  <KeepOption bg="#E4DCF0" icon="phone" title="Digital book" sub="Ready to read on any screen tonight" />
                </ul>
              </div>
            </Step>
          </ol>

          <div className="mt-20 flex flex-wrap items-center gap-5">
            <Link href={starterHref({ entry: "home_how" })} className="fw-cta min-h-[58px] px-[30px] text-[19px]">Start their story</Link>
            <p className="m-0 text-[17px] text-[#4E4259]">Free to start. You only pay if you love it.</p>
          </div>
        </div>
      </section>

      {/* ── 6. EVERY GROWN-UP WHO LOVES THEM + OCCASIONS ── */}
      <section id="gifts" aria-labelledby="gifts-title" className="scroll-mt-24 px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <h2 id="gifts-title" className={`${H2} max-w-[18ch]`}>A gift only you could give</h2>
          <p className={`${LEAD} max-w-[42ch]`}>You don&apos;t need to know every detail. A name, an age and a couple of things they love is enough.</p>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { who: "Grandparents", line: "Put your family stories in their hands, in a book they'll ask for again and again.", href: "/gifts/grandchildren", cta: "Gifts for grandchildren", bg: "#FFE7C2" },
              { who: "Aunts, uncles and godparents", line: "Be the one who gave the book with their name, their dog and their jokes in it.", href: "/gifts/from-aunt-and-uncle", cta: "Gifts from an aunt or uncle", bg: "#FBD3E0" },
              { who: "Parents", line: "Their bedtime, their world, their big moments, with their name on every page.", href: starterHref({ entry: "home_parents_card" }), cta: "Start their story", bg: "#E4DCF0" },
            ].map((card) => (
              <Link key={card.who} href={card.href} className="group flex flex-col rounded-[28px] p-8 transition-transform duration-300 hover:-translate-y-1" style={{ background: card.bg }}>
                <h3 className="m-0 text-[28px] font-bold leading-[1.05] tracking-[-0.02em]">{card.who}</h3>
                <p className="mb-0 mt-3 flex-1 text-[18px] leading-[1.5] text-[#4E4259]">{card.line}</p>
                <span className="mt-7 inline-flex items-center gap-2 text-[17px] font-bold">
                  {card.cta}
                  <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ))}
          </div>

          <div className="mt-14 flex flex-col gap-5 rounded-[28px] border-[1.5px] border-[#EFE7F5] p-7 sm:p-9 lg:flex-row lg:items-center lg:gap-10">
            <h3 className="m-0 shrink-0 text-[24px] font-bold tracking-[-0.02em]">A book for the big moments</h3>
            <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
              {occasionLinks.map((g) => (
                <li key={g.slug}>
                  <Link href={`/gifts/${g.slug}`} className="fw-chip inline-flex min-h-[48px] items-center px-5 text-[16px]">
                    {g.occasionLabel}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 7. PRICING ── */}
      <section id="pricing" aria-labelledby="pricing-title" className="scroll-mt-24 bg-[#F6F1FC] px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto max-w-[1240px]">
          <h2 id="pricing-title" className={`${H2} max-w-[16ch]`}>One book, one price. No subscription.</h2>
          <p className={`${LEAD} max-w-[40ch]`}>Your first illustrated page is free. You only pay when you&apos;re happy with the whole book.</p>

          <div className="mt-12 grid max-w-[1040px] gap-5 md:grid-cols-2">
            <div className="flex flex-col rounded-[28px] bg-white p-8 shadow-[0_24px_50px_-36px_rgba(36,24,47,0.45)] sm:p-10">
              <h3 className="m-0 text-[26px] font-bold tracking-[-0.02em]">Digital book</h3>
              <p className="mb-0 mt-2 text-[17px] leading-[1.5] text-[#4E4259]">The whole illustrated book to read on any screen or print at home. Ready the moment it&apos;s finished.</p>
              <p className="mb-0 mt-8 text-[56px] font-bold leading-none tracking-[-0.03em]">{priceDigital}</p>
              <Link href={starterHref({ entry: "pricing_digital" })} className="mt-8 inline-flex min-h-[54px] items-center justify-center rounded-full border-[1.5px] border-[#24182F] px-6 text-[17px] font-bold transition-colors hover:bg-[#24182F] hover:text-white">
                Start free
              </Link>
            </div>

            <div className="relative flex flex-col rounded-[28px] bg-[#24182F] p-8 text-white shadow-[0_30px_60px_-30px_rgba(36,24,47,0.6)] sm:p-10">
              <span className="fw-sticker absolute -top-4 right-8 rotate-[4deg] bg-[#F7A93E] px-4 py-1.5 text-[14px] font-bold text-[#24182F]">Most loved</span>
              <h3 className="m-0 text-[26px] font-bold tracking-[-0.02em]">Printed storybook</h3>
              <p className="mb-0 mt-2 text-[17px] leading-[1.5] text-[#D9CFE6]">A full-colour printed book posted to your door, with the digital copy included.</p>
              <p className="mb-0 mt-8 text-[56px] font-bold leading-none tracking-[-0.03em]">{pricePrint}</p>
              <Link href={starterHref({ entry: "pricing_print" })} className="fw-cta mt-8 min-h-[54px] px-6 text-[17px]">
                Start free
              </Link>
            </div>
          </div>

          <div className="mt-5 max-w-[1040px] rounded-[28px] bg-white p-7 text-[17px] leading-[1.55] text-[#4E4259] sm:p-9">
            <p className="m-0 font-bold text-[#24182F]">Or choose at the end of your story:</p>
            <ul className="m-0 mt-3 list-none space-y-2.5 p-0">
              <li><strong className="text-[#24182F]">Hardback gift edition, {priceGift}.</strong> A hardcover book with a personal dedication page from you.</li>
              {colouringAvailable && (
                <li>
                  <strong className="text-[#24182F]">Colouring edition, {priceColouring}.</strong> A coil-bound book of outline pictures to colour in, plus a printable PDF, delivery included.{" "}
                  <Link href="/projects/create?bookType=colouring_storybook&entry=pricing_colouring" className="font-bold text-[#6F4BB0] underline underline-offset-4">
                    Make a colouring book
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ── 8. ABOUT KATY ── */}
      <section aria-labelledby="katy-title" className="px-4 py-24 sm:px-6 lg:py-28">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-12 md:flex-row md:items-center md:gap-16">
          <div className="relative mx-auto w-[240px] shrink-0 md:mx-0 md:w-[300px]">
            <div aria-hidden="true" className="fw-blob absolute -inset-4 rotate-6 bg-[#FFE7C2]" />
            <div className="relative aspect-[3/4] overflow-hidden rounded-[24px] rotate-[-2deg]">
              <Image src="/About/katy-portrait.png" alt="Katy, founder of FlipWhizz" fill sizes="300px" className="object-cover" />
            </div>
          </div>
          <div className="min-w-0 md:max-w-[640px]">
            <h2 id="katy-title" className={H2}>Hi, I&apos;m Katy.</h2>
            <p className="mb-0 mt-5 text-[19px] leading-[1.6] text-[#4E4259]">
              I&apos;ve spent 20 years working with children, in schools, early years settings, language classrooms and outdoors. I built FlipWhizz because the stories children love most are the ones about their own lives, told by the people who love them.
            </p>
            <p className="mb-0 mt-6 text-[24px] font-semibold leading-[1.3] text-[#6F4BB0]" style={{ fontFamily: "var(--font-book), Georgia, serif" }}>
              &ldquo;AI never talks to your child. It helps the adult who loves them.&rdquo;
            </p>
            <Link href="/about" className="mt-7 inline-flex min-h-[48px] items-center gap-2 text-[17px] font-bold underline decoration-[#E8455C] decoration-2 underline-offset-[6px]">
              Read my story <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 9. FAQ ── */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 px-4 pb-24 sm:px-6">
        <div className="mx-auto max-w-[1240px]">
          <h2 id="faq-title" className={H2}>Questions people ask</h2>
          <div className="mt-10 max-w-[820px]">
            <HomeFaq faqs={HOME_FAQS} />
          </div>
          <p className="mb-0 mt-6 text-[17px] text-[#4E4259]">
            Something else? <Link href="/faq" className="font-bold text-[#24182F] underline underline-offset-4">See the full FAQ</Link> or email{" "}
            <a href="mailto:hello@flipwhizz.com" className="font-bold text-[#24182F] underline underline-offset-4">hello@flipwhizz.com</a>.
          </p>
        </div>
      </section>

      {/* ── 10. FINAL STARTER ── */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto flex max-w-[1240px] flex-col gap-10 overflow-hidden rounded-[36px] bg-[#FFE7C2] px-7 py-14 sm:px-12 lg:flex-row lg:items-center lg:gap-16 lg:py-16">
          <div className="min-w-0 lg:flex-1">
            <h2 className={`${H2} max-w-[14ch]`}>Ready when you are.</h2>
            <p className="mb-0 mt-5 max-w-[34ch] text-[19px] leading-[1.5] text-[#4E4259]">It takes one answer to start. You can stop, come back and change anything.</p>
          </div>
          <div className="min-w-0 lg:flex-1">
            <HomeChatStarter position="footer" question="Who's this story for?" tone="tinted" />
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Step({ n, color, title, text, tag, children }: { n: number; color: string; title: string; text: string; tag?: string; children: React.ReactNode }) {
  return (
    <li className="relative flex flex-col gap-4 sm:flex-row sm:gap-8 lg:gap-10">
      <span aria-hidden="true" className="fw-blob relative z-[1] flex h-[46px] w-[46px] shrink-0 items-center justify-center text-[20px] font-extrabold text-white shadow-[0_0_0_8px_#F6F1FC]" style={{ background: color }}>
        {n}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">
        <div className="min-w-0 pt-1 lg:max-w-[400px] lg:flex-1">
          <h3 className="m-0 text-[clamp(28px,2.8vw,36px)] font-bold leading-[1.05] tracking-[-0.025em]">
            <span className="sr-only">Step {n}: </span>
            {title}
          </h3>
          <p className="mb-0 mt-3.5 text-[18px] leading-[1.55] text-[#4E4259]">{text}</p>
          {tag && (
            <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-[7px] text-[15px] font-semibold">
              <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />
              {tag}
            </span>
          )}
        </div>
        <div className="min-w-0 lg:flex-[1.5]">{children}</div>
      </div>
    </li>
  );
}

function Bubble({ from, className = "", children }: { from: "fw" | "you"; className?: string; children: React.ReactNode }) {
  const base = "m-0 max-w-[86%] px-[17px] py-[11px] text-[17px] font-semibold leading-[1.4]";
  return from === "fw" ? (
    <p className={`${base} ${className} self-start origin-bottom-left rounded-[20px] rounded-bl-[6px] bg-[#6F4BB0] text-white`}>{children}</p>
  ) : (
    <p className={`${base} ${className} self-end origin-bottom-right rounded-[20px] rounded-br-[6px] bg-[#FBD3E0]`}>{children}</p>
  );
}

function KeepOption({ bg, icon, title, sub }: { bg: string; icon: "parcel" | "gift" | "phone"; title: string; sub: string }) {
  return (
    <li className="flex items-center gap-3.5 rounded-[18px] bg-white px-[18px] py-3.5 shadow-[0_14px_30px_-24px_rgba(36,24,47,0.5)]">
      <svg viewBox="0 0 36 36" aria-hidden="true" className="h-9 w-9 shrink-0">
        <circle cx="18" cy="18" r="18" fill={bg} />
        {icon === "parcel" && (
          <g fill="none" stroke="#24182F" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M10 14.5 18 11l8 3.5v8L18 26l-8-3.5z" />
            <path d="M10 14.5 18 18l8-3.5M18 18v8" />
          </g>
        )}
        {icon === "gift" && (
          <g fill="none" stroke="#24182F" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round">
            <path d="M12 11h12v15H12z" />
            <path d="M15 11v15M18 21l2 1.5 3-4" />
          </g>
        )}
        {icon === "phone" && (
          <g fill="none" stroke="#24182F" strokeWidth="1.8" strokeLinecap="round">
            <rect x="13" y="9.5" width="10" height="17" rx="2" />
            <path d="M17 23.5h2" />
          </g>
        )}
      </svg>
      <span className="text-[17px] font-semibold leading-[1.3]">
        {title}
        <small className="mt-0.5 block text-[14px] font-medium text-[#6A5E73]">{sub}</small>
      </span>
    </li>
  );
}
