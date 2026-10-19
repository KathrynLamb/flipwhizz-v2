// src/app/gifts/[slug]/page.tsx
// Gift landing page template. Content lives in src/content/giftPages.ts.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { Playfair_Display, Lato } from "next/font/google";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomeChatStarter from "@/components/home/HomeChatStarter";
import HomeFaq from "@/components/home/HomeFaq";
import { GIFT_PAGES, getGiftPage } from "@/content/giftPages";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "700"] });
const lato = Lato({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "700"] });

const INK = "#2D2235";
const BODY = "#5C5048";
const PINK = "#D94590";

export function generateStaticParams() {
  return GIFT_PAGES.map((g) => ({ slug: g.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getGiftPage(slug);
  if (!page) return {};
  const url = `https://flipwhizz.com/gifts/${page.slug}`;
  return {
    title: { absolute: page.metaTitle },
    description: page.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url,
      siteName: "FlipWhizz",
      type: "website",
      locale: "en_GB",
      images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    },
  };
}

export default async function GiftPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getGiftPage(slug);
  if (!page) notFound();

  const session = await getServerSession(authOptions);
  const others = GIFT_PAGES.filter((g) => g.slug !== page.slug);
  const url = `https://flipwhizz.com/gifts/${page.slug}`;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://flipwhizz.com" },
      { "@type": "ListItem", position: 2, name: page.footerLabel, item: url },
    ],
  };

  return (
    <main className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans text-[18px]`} style={{ background: "#FEFCFA" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <div className="relative z-30">
        <Header session={session} />
      </div>

      <section className="bg-white px-4 pb-14 pt-8 sm:px-6 lg:px-12 lg:pt-14">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="mb-4 text-base" style={{ color: BODY }}>
              <Link href="/" className="underline underline-offset-4">Home</Link> <span aria-hidden="true">/</span> {page.footerLabel}
            </nav>
            <h1 className="font-serif text-[34px] font-bold leading-[1.12] sm:text-5xl" style={{ color: INK }}>
              {page.h1}
            </h1>
            <p className="mt-5 text-[19px] leading-relaxed" style={{ color: BODY }}>{page.intro}</p>
            <div className="mt-7">
              <HomeChatStarter
                position="gift"
                entry={`gift_${page.slug}`}
                question={page.starterQuestion}
                fixedOccasion={page.occasion}
              />
              <p className="mt-3 pl-2 text-base font-semibold" style={{ color: "#7960AF" }}>
                Free first illustrated page. No sign-up to start. No card.
              </p>
            </div>
          </div>
          <div className="relative aspect-[1504/704] w-full overflow-hidden rounded-[22px] shadow-[0_25px_60px_rgba(45,34,53,0.16)]">
            <Image
              src="/LandingPage/photo_to_book.jpeg"
              alt="Family photos turned into an illustrated personalised storybook page"
              fill
              priority
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-12" style={{ background: "#F7F3FB" }}>
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="font-serif text-3xl font-bold" style={{ color: INK }}>{page.ideasTitle}</h2>
            <ul className="mt-6 space-y-3">
              {page.ideas.map((idea) => (
                <li key={idea} className="flex gap-3 text-[18px] leading-relaxed" style={{ color: BODY }}>
                  <span aria-hidden="true" style={{ color: PINK }}>✦</span>
                  {idea}
                </li>
              ))}
            </ul>
          </div>
          <div className="self-start rounded-[22px] bg-white p-7">
            <p className="text-sm font-bold uppercase tracking-[0.16em]" style={{ color: PINK }}>A story could start with</p>
            <p className="mt-3 font-serif text-2xl italic leading-snug" style={{ color: INK }}>&ldquo;{page.examplePrompt}&rdquo;</p>
            <p className="mt-4 text-base" style={{ color: BODY }}>
              One sentence is enough. We&apos;ll ask a few friendly questions and help you build it into a whole book.
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-serif text-3xl font-bold" style={{ color: INK }}>Questions</h2>
          <div className="mt-8">
            <HomeFaq faqs={page.faqs} location={`gift_${page.slug}`} />
          </div>
          <p className="mt-6 text-center text-[17px]" style={{ color: BODY }}>
            See <Link href="/#pricing" className="font-bold underline underline-offset-4" style={{ color: PINK }}>prices</Link> or{" "}
            <Link href="/faq" className="font-bold underline underline-offset-4" style={{ color: PINK }}>all questions</Link>.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-12">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-serif text-2xl font-bold" style={{ color: INK }}>More gift ideas</h2>
          <ul className="mt-6 flex flex-wrap justify-center gap-3">
            {others.map((g) => (
              <li key={g.slug}>
                <Link
                  href={`/gifts/${g.slug}`}
                  className="inline-flex min-h-[48px] items-center rounded-full border border-[#E3D6ED] bg-white px-5 text-[17px] font-semibold"
                  style={{ color: INK }}
                >
                  {g.footerLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Footer />
    </main>
  );
}
