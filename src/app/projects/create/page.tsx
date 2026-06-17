import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import CreateDemoClient from "./CreateDemoClient";

export const metadata: Metadata = {
  title: "Create a Personalised Children's Book | AI Storybook Maker | FlipWhizz",
  description:
    "Create a personalised children's book built around your child's name, interests, and personality. Try the free story demo — no sign-up needed. Adventure stories, bedtime stories, confidence-building books, and more.",
  keywords: [
    "personalised children's book",
    "personalised storybook",
    "custom children's book",
    "AI storybook maker",
    "personalised book for kids",
    "children's book with child's name",
    "bedtime story creator",
    "personalised bedtime story",
    "custom story for kids UK",
    "personalised gift for children",
  ],
  alternates: {
    canonical: "https://www.flipwhizz.com/projects/create",
  },
  openGraph: {
    title: "Create a Personalised Children's Book | FlipWhizz",
    description:
      "Build a one-of-a-kind storybook shaped around your child's world. Try the free demo — no sign-up needed.",
    url: "https://www.flipwhizz.com/projects/create",
    siteName: "FlipWhizz",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create a Personalised Children's Book | FlipWhizz",
    description:
      "Shape a story around your child's interests, personality, and imagination — then turn it into a real book.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FlipWhizz",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  url: "https://www.flipwhizz.com",
  description:
    "AI-powered personalised children's book creator. Build custom storybooks shaped around a child's name, interests, and personality.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
    description: "Free story demo — no sign-up required",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://www.flipwhizz.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Create",
      item: "https://www.flipwhizz.com/projects/create",
    },
  ],
};

export default function CreatePage() {
  return (
    <main className="min-h-screen bg-[#FDF8F0] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Background wash */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-[-60px] h-[320px] w-[320px] rounded-full bg-fuchsia-200/40 blur-3xl" />
        <div className="absolute right-[-80px] top-[10%] h-[360px] w-[360px] rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4 pb-24 pt-6 sm:px-6">
        {/* Nav */}
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 backdrop-blur transition hover:bg-white"
          >
            <span aria-hidden="true">←</span>
            FlipWhizz
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href="/faq"
              className="rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-white"
            >
              FAQ
            </Link>
            <Link
              href="/about"
              className="hidden rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-white sm:inline-flex"
            >
              About
            </Link>
          </div>
        </nav>

        {/* Hero */}
        <div className="mt-10 text-center sm:mt-14">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Create a personalised storybook for your child
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-slate-600">
            Tell us about your child and the kind of story you&apos;d like.
            No sign-up needed.
          </p>
        </div>

        {/* Demo chat */}
        <div className="mt-8">
          <Suspense fallback={null}>
            <CreateDemoClient />
          </Suspense>
        </div>

        {/* Footer links */}
        <div className="mt-10 flex items-center justify-center gap-4 text-sm text-slate-500">
          <Link href="/how-it-works" className="transition hover:text-slate-700">
            How it works
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/faq" className="transition hover:text-slate-700">
            FAQ
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/examples" className="transition hover:text-slate-700">
            Examples
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/about" className="transition hover:text-slate-700">
            About
          </Link>
        </div>
      </div>
    </main>
  );
}