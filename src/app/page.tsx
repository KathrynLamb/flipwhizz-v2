// Editorial homepage: broad story ideas, real books and a mobile-first path into chat.

import { Suspense } from "react";
import CreateDemoClient from "./projects/create/CreateDemoClient";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { luluPrintEnabled } from "@/lib/lulu/client";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HeroBook from "@/components/home/HeroBook";
import HomeFaq from "@/components/home/HomeFaq";
import { HOME_FAQS } from "@/content/homeFaqs";
import { BOOKS } from "@/content/homeBooks";
import { starterHref } from "@/lib/chatStarter";
import { getPriceCents, formatPrice, countryToCurrency } from "@/lib/pricing";
import "./home.css";

import { brico, fraunces } from "./fonts";

const TITLE = "Your Ideas, Made into Illustrated Books | FlipWhizz";
const DESCRIPTION =
  "Turn family memories, small discoveries and imaginary worlds into your own illustrated storybook. Try your first illustrated page free.";

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
      "A platform for turning family memories, everyday discoveries and original ideas into illustrated storybooks. Founded by educator Katy Lamb.",
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
    name: "Personalised illustrated storybook",
    description:
      "An original illustrated storybook shaped from your ideas through a conversation. Available as a digital or printed book.",
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

  return (
    <main className={`fw-home fw-editorial ${brico.variable} ${fraunces.variable}`}>
      {[organizationJsonLd, websiteJsonLd, webPageJsonLd, productJsonLd, faqJsonLd].map((json, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
      ))}
      <div className="fw-masthead"><Header session={session} /></div>
      <section className="fw-opening fw-wrap" aria-labelledby="opening-title">
        <div className="fw-opening-copy">
          <p className="fw-kicker">Your ideas. An illustrated book.</p>
          <h1 id="opening-title">There’s a<br />book in <em>that.</em></h1>
          <p className="fw-intro">A family story. A small discovery. Something completely made up. Tell us your idea; we’ll help you turn it into a book.</p>
          <div id="start-story"><Suspense fallback={<p>Loading your story chat…</p>}><CreateDemoClient embedded /></Suspense></div>
        </div>
        <div className="fw-opening-art">
          <p className="fw-margin-note">From a conversation<br />to a proper page-turner.</p>
          <HeroBook />
        </div>
      </section>
      <section className="fw-ideas fw-wrap" aria-labelledby="ideas-title">
        <div className="fw-section-label"><span>01 / The beginning</span><span>Big stories start small.</span></div>
        <h2 id="ideas-title">What have you got<br />a story <em>about?</em></h2>
        <div className="fw-idea-list">
          {[
            { n: "A", title: "The stories you inherited.", text: "How your grandparents came to America. The shop they opened. The suitcase they kept.", about: "memory", note: "Pass it on." },
            { n: "B", title: "The things you noticed.", text: "Two snails in the garden this morning. Where were they going? And why was one in such a hurry?", about: "everyday", note: "Look a little closer." },
            { n: "C", title: "The worlds you made up.", text: "A moon that’s afraid of the dark. A dog who drives a digger. An idea nobody else could have had.", about: "imagination", note: "Go absolutely anywhere." },
          ].map((idea) => <Link key={idea.n} href={starterHref({ about: idea.about, entry: "home_idea" })} className="fw-idea">
            <span className="fw-idea-letter" aria-hidden="true">{idea.n}</span>
            <div><h3>{idea.title}</h3><p>{idea.text}</p><span className="fw-idea-note">{idea.note} <span aria-hidden="true">↗</span></span></div>
          </Link>)}
        </div>
      </section>
      <section id="gallery" className="fw-gallery" aria-labelledby="gallery-title">
        <div className="fw-wrap">
          <div className="fw-section-label"><span>02 / On the bookshelf</span><span>Made with FlipWhizz</span></div>
          <div className="fw-heading-row"><h2 id="gallery-title">No two stories.<br /><em>No two books.</em></h2><p>Different characters, different worlds, different ways of seeing things. These are real pages from books made here.</p></div>
          <div className="fw-spreads">
            {[BOOKS.tabitha, BOOKS.samDog, BOOKS.ella].map((book, i) => <figure key={book.src} className={`fw-spread fw-spread-${i}`}>
              <Image src={book.src} alt={book.alt} width={1600} height={893} sizes="(min-width: 900px) 650px, 92vw" />
              <figcaption><span>0{i + 1}</span> {book.title}</figcaption>
            </figure>)}
          </div>
        </div>
      </section>
      <section id="how-it-works" className="fw-process fw-wrap" aria-labelledby="process-title">
        <div className="fw-section-label"><span>03 / Making your book</span><span>You bring the idea.</span></div>
        <div className="fw-process-grid"><h2 id="process-title">You don’t have<br />to call yourself<br /><em>a writer.</em></h2>
          <ol>
            <li><span>01</span><div><h3>Tell us what you’re thinking.</h3><p>A few sentences is enough. A memory, a character, a half-formed idea. We’ll ask questions and help you find the story.</p></div></li>
            <li><span>02</span><div><h3>Make it sound like you.</h3><p>Read the draft, change the words, choose the look. Add photos for familiar faces, or invent an entirely new cast.</p></div></li>
            <li><span>03</span><div><h3>Give it a life off-screen.</h3><p>Start with a free illustrated page. Choose your edition when you’re ready, then finish your book to read, keep or give.</p></div></li>
          </ol>
        </div>
        <Link className="fw-text-link" href={starterHref({ entry: "home_process" })}>Let’s start with your idea <span aria-hidden="true">↗</span></Link>
      </section>
      <section id="gifts" className="fw-gift-note"><div className="fw-wrap fw-gift-inner"><p className="fw-kicker">For someone. For everyone. For the shelf.</p><h2>A story can be a gift.<br /><em>It can also just be a story.</em></h2><p>Make a family memory into something you can hold. Write an adventure to read together. Or follow a wonderfully odd idea and see where it goes.</p><Link className="fw-text-link" href={starterHref({ entry: "home_gifts" })}>Make something of your own ↗</Link></div></section>
      <section id="pricing" className="fw-prices fw-wrap" aria-labelledby="pricing-title">
        <div className="fw-section-label"><span>04 / Yours to keep</span><span>No subscription.</span></div>
        <h2 id="pricing-title">First, an idea.<br />Then, <em>your edition.</em></h2>
        <p className="fw-section-intro">Try your first illustrated page free. Choose how you’d like to keep the finished story.</p>
        <div className="fw-editions">
          {[
            { name: "The digital edition", price: priceDigital, text: "Your illustrated book as a PDF. Read it on a screen or print it at home.", entry: "pricing_digital" },
            { name: "The printed storybook", price: pricePrint, text: "A full-colour book posted to your door. Digital copy included.", entry: "pricing_print" },
            { name: "The hardback gift", price: priceGift, text: "A hardcover edition with your personal dedication. For a place on their bookshelf.", entry: "pricing_gift" },
          ].map((edition) => <div className="fw-edition" key={edition.entry}><h3>{edition.name}</h3><p className="fw-price">{edition.price}</p><p>{edition.text}</p><Link className="fw-text-link" href={starterHref({ entry: edition.entry })}>Start free ↗</Link></div>)}
        </div>
        {colouringAvailable && <p className="fw-colouring">Prefer to add your own colour? <Link href="/projects/create?bookType=colouring_storybook&entry=pricing_colouring">Make a colouring storybook, {priceColouring} ↗</Link></p>}
      </section>
      <section className="fw-founder fw-wrap" aria-labelledby="founder-title">
        <Image src="/About/katy-portrait.png" alt="Katy, founder of FlipWhizz" width={300} height={400} sizes="(min-width: 700px) 240px, 140px" />
        <div><p className="fw-kicker">A note from the founder</p><h2 id="founder-title">Hello, I’m Katy.</h2><p>I’ve spent 20 years working with children, in classrooms and outdoors. FlipWhizz brings together that background and the possibilities of technology: a place to turn your memories, observations and imagination into illustrated books.</p><Link className="fw-text-link" href="/about">More about FlipWhizz ↗</Link></div>
      </section>
      <section id="faq" className="fw-faq-section fw-wrap"><h2>A few things<br /><em>you might be wondering.</em></h2><HomeFaq faqs={HOME_FAQS} /></section>
      <section className="fw-last-page fw-wrap"><p className="fw-kicker">Every book starts somewhere.</p><h2>What’s <em>your</em> story?</h2><Link className="fw-ink-button" href={starterHref({ entry: "home_footer" })}>Start your book ↗</Link><p className="fw-small">First illustrated page free. No sign-up or card.</p></section>
      <Footer />

    </main>
  );
}
