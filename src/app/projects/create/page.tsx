import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Header from "@/components/Header";
import CreateDemoClient from "./CreateDemoClient";
import { brandFontClass, brandFontStyle } from "@/app/fonts";

export const metadata: Metadata = {
  title: { absolute: "Start Your Personalised Children's Book, Free | FlipWhizz" },
  description:
    "Write a personalised children's book about a child you love, from a short chat. You tell the story, we help you shape it and illustrate every page. Free to start, no sign-up needed.",
  keywords: [
    "personalised children's book",
    "personalised storybook",
    "custom children's book",
    "personalised book for kids",
    "children's book with child's name",
    "bedtime story creator",
    "personalised bedtime story",
    "custom story for kids UK",
    "personalised gift for children",
  ],
  alternates: {
    canonical: "https://flipwhizz.com/projects/create",
  },
  openGraph: {
    title: "Create a Personalised Children's Book | FlipWhizz",
    description:
      "Build a one-of-a-kind storybook shaped around your child's world. Try the free demo, no sign-up needed.",
    url: "https://flipwhizz.com/projects/create",
    siteName: "FlipWhizz",
    type: "website",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "Create a Personalised Children's Book | FlipWhizz",
    description:
      "Shape a story around your child's interests, personality, and imagination, then turn it into a real book.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "FlipWhizz",
  applicationCategory: "DesignApplication",
  operatingSystem: "Web",
  url: "https://flipwhizz.com",
  description:
    "Personalised children's book creator where the adult is the author: chat about a child you love and FlipWhizz helps shape the story and illustrate every page.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
    description: "Free story demo, no sign-up required",
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
      item: "https://flipwhizz.com",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Create",
      item: "https://flipwhizz.com/projects/create",
    },
  ],
};

export default async function CreatePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className={`relative flex min-h-screen flex-col bg-white text-[#24182F] ${brandFontClass}`} style={brandFontStyle}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Shared header, stripped for the conversion flow: every extra link
          is an exit from the chat. */}
      <Header session={session} minimal />

      <div className="relative mx-auto w-full max-w-2xl flex-1 px-4 pt-8 sm:px-6 sm:pt-12">
        <h1 className="m-0 text-[clamp(32px,5vw,46px)] font-bold leading-[1.02] tracking-[-0.03em]">
          Let&apos;s make their book.
        </h1>
        <p className="mb-8 mt-3 max-w-[40ch] text-[18px] leading-[1.5] text-[#4E4259]">
          Answer a few questions in your own words. We&apos;ll shape the story and illustrate it with you.
        </p>
        <Suspense fallback={null}>
          <CreateDemoClient />
        </Suspense>
      </div>
    </main>
  );
}
