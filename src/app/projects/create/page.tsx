import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CreateDemoClient from "./CreateDemoClient";
import ChatFooter from "@/components/ChatFooter";

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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Real shared header, stripped for the conversion flow, title in-bar */}
      <Header
        session={session}
        minimal
        title="Make a story only your family could tell"
        subtitle="Personalised, illustrated, and entirely yours."
      />

      {/* Content. White-dominant surface; the logo's true spectrum appears
          once, as a soft painterly glow behind the chat, the way colour
          blooms behind the logo's brushwork, not a flat banner. */}
      <div className="relative flex-1">
        {/* The single colour moment for this page: a diffuse, multi-stop
            bloom sourced from the actual logo palette (sampled, not
            guessed), kept soft and high-value so it glows rather than
            shouts, sitting behind the chat card like a light source. */}
        {/* <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-20 h-[560px] w-[920px] -translate-x-1/2 rounded-full opacity-[0.16] blur-[110px]"
          style={{
            background:
              "conic-gradient(from 200deg, #FA626F, #FAB043, #F7CD55, #71CBE5, #9D6CC7, #DB6AAC, #FA626F)",
          }}
        /> */}
        {/* <div> */}

        <div className="relative mx-auto max-w-2xl px-4 pb-16 pt-10 sm:px-6 sm:pt-14">
          <Suspense fallback={null}>
            <CreateDemoClient />
          </Suspense>
        </div>
      </div>

      {/* <ChatFooter /> */}
    </main>
  );
}