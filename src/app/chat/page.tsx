import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Header from "@/components/Header";
import ChatClient from "@/app/chat/ChatClient";


export const metadata: Metadata = {
  title: "Create a Personalised Children's Book | AI Storybook Maker | FlipWhizz",
  description:
    "Create a personalised children's book built around your child's name, interests, and personality. Try the free story demo, no sign-up needed. Adventure stories, bedtime stories, confidence-building books, and more.",
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
    "AI-powered personalised children's book creator. Build custom storybooks shaped around a child's name, interests, and personality.",
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
    <main className="relative flex h-screen flex-col overflow-hidden bg-white text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Real shared header, stripped for the conversion flow, title in-bar.
          session comes from getServerSession above; if Sign in/out doesn't
          reflect your real auth state, the cause is session resolution here,
          not this component, since Header already branches on session
          internally. */}
      <Header
        session={session}
        minimal
        title="Make a story only your family could tell"
        subtitle="Personalised, illustrated, and entirely yours."
      />

      {/* Full-height app surface: h-screen on main (not min-h-screen) so this
          flex-1 region has a real, fixed height for CreateDemoClient's
          h-full to resolve against. No card, no footer, the chat is the
          page. */}
      <div className="relative flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <ChatClient />
        </Suspense>
      </div>
    </main>
  );
}