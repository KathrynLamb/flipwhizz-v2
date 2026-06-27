import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Playfair_Display, Lato } from "next/font/google";
import { getServerSession } from "next-auth";
// NOTE: your homepage imports authOptions from this path. If your project
// standardises on "@/lib/auth" (as /projects/create does), swap this one line.
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif", weight: ["400", "700", "900"] });
const lato = Lato({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "About FlipWhizz: The Educator Behind the Personalised Storybooks",
  description:
    "A personalised children's book platform where the parent is the author. Built by Katy, who has spent 20 years working with children. Real, co-created stories made for one child, not name-swap templates.",
  alternates: {
    canonical: "https://flipwhizz.com/about",
  },
  openGraph: {
    title: "About FlipWhizz",
    description:
      "Built by an educator who has spent 20 years working with children. Parent-authored, co-created storybooks made for one child. This is the story behind FlipWhizz.",
    url: "https://flipwhizz.com/about",
    siteName: "FlipWhizz",
    type: "website",
    locale: "en_GB",
  },
};

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Katy",
  jobTitle: "Founder",
  worksFor: {
    "@type": "Organization",
    name: "FlipWhizz",
    url: "https://flipwhizz.com",
  },
  description:
    "Developer and educator with over 20 years of experience working with children across schools, early years, ESL, and outdoor education.",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FlipWhizz",
  url: "https://flipwhizz.com",
  description:
    "Personalised children's book platform where parents author original, co-created stories for their child. Designed by an educator with 20 years working with children. No name-swap templates.",
  founder: {
    "@type": "Person",
    name: "Katy",
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
      name: "About",
      item: "https://flipwhizz.com/about",
    },
  ],
};

export default async function AboutPage() {
  const session = await getServerSession(authOptions);

  return (
    <main
      className={`relative min-h-screen ${playfair.variable} ${lato.variable} font-sans text-slate-900 overflow-x-hidden`}
      style={{ background: "#FEFCFA" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Real shared header */}
      <div className="relative z-30 bg-white">
        <Header session={session} />
      </div>

      {/* Warm ambient accents, matching the homepage glow language */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full opacity-[0.06] blur-3xl"
          style={{ background: "radial-gradient(circle, #D94590, #7C3AED)" }}
        />
        <div
          className="absolute right-[-120px] top-[28%] h-[460px] w-[460px] rounded-full opacity-[0.05] blur-3xl"
          style={{ background: "radial-gradient(circle, #5EEAD4, #7C3AED)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl px-6 pb-24 pt-12 sm:pt-16 lg:px-12">
        {/* ── HERO ── */}
        <section className="grid items-center gap-10 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p
              className="mb-4 text-sm font-semibold uppercase tracking-[0.2em]"
              style={{ color: "#D94590" }}
            >
              ✦ Our Story ✦
            </p>
            <h1
              className="font-serif text-4xl font-bold leading-[1.08] sm:text-5xl"
              style={{ color: "#2D2235" }}
            >
              The books that matter most feel like they were made for one child.
            </h1>
            <p className="mt-5 text-lg leading-8" style={{ color: "#6B5D52" }}>
              FlipWhizz is a personalised children&apos;s book platform where the
              parent is the author, built by someone who&apos;s spent 20 years
              working with kids.
            </p>
          </div>

          <div className="lg:col-span-2">
            {/* IMAGE SLOT — Katy portrait.
                Drop a real photo of you at /public/About/katy-portrait.jpg
                Recommended: portrait orientation, ~1000x1250 (4:5). This is the
                highest-trust element on the page, so use a warm, friendly shot. */}
            <div
              className="relative aspect-[4/5] w-full overflow-hidden rounded-[22px]"
              style={{
                boxShadow:
                  "0 25px 60px rgba(45,34,53,0.18), 0 0 0 1px rgba(45,34,53,0.04)",
              }}
            >
              <Image
                src="/About/katy-portrait.png"
                alt="Katy, the founder of FlipWhizz, who spent 20 years working with children before building the platform"
                fill
                priority
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* ── WHY ── */}
        <section className="mt-16 sm:mt-20">
          <h2 className="font-serif text-3xl font-bold" style={{ color: "#2D2235" }}>
            Why FlipWhizz exists
          </h2>
          <div className="mt-5 space-y-5 text-[17px] leading-8" style={{ color: "#4A4038" }}>
            <p>
              I&apos;ve spent over 20 years working with children: in secondary
              schools in the UK, in early years and childcare settings, in ESL
              classrooms, and in outdoor and experiential education. Across all of
              it, one thing has always been true. Children light up when they feel
              seen.
            </p>
            <p>
              A story that mentions something a child actually cares about, like
              their favourite animal, a worry they&apos;re working through, or the
              game they play at break time, lands completely differently from a
              generic one. It&apos;s not just more engaging. It tells the child
              that someone made this for them. Someone knows them.
            </p>
          </div>
        </section>

        {/* ── PULL QUOTE ── */}
        <section className="mt-12">
          <figure
            className="rounded-[22px] bg-white px-7 py-10 text-center sm:px-12"
            style={{
              border: "1px solid #E8DDCF",
              boxShadow: "0 4px 24px rgba(45,34,53,0.06)",
            }}
          >
            <blockquote
              className="font-serif text-2xl font-bold leading-snug sm:text-3xl"
              style={{ color: "#2D2235" }}
            >
              &ldquo;Someone made this for me. Someone knows me.&rdquo;
            </blockquote>
            <figcaption className="mt-4 text-sm" style={{ color: "#6B5D52" }}>
              The feeling every FlipWhizz book is built to give.
            </figcaption>
          </figure>
        </section>

        {/* ── DIFFERENT ── */}
        <section className="mt-16 sm:mt-20">
          <h2 className="font-serif text-3xl font-bold" style={{ color: "#2D2235" }}>
            How it&apos;s different
          </h2>
          <div className="mt-5 space-y-5 text-[17px] leading-8" style={{ color: "#4A4038" }}>
            <p>
              Most personalised children&apos;s books start with a template. You
              type in a name, pick a hair colour, and the name gets dropped into a
              story that&apos;s the same for every child. The only thing that
              really changes is the cover.
            </p>
            <p>
              FlipWhizz works the other way round. You&apos;re the author. You tell
              the story you want for your child: what they love, what they&apos;re
              working through, the kind of adventure you have in mind. FlipWhizz
              takes your direction and helps shape it into an original story and
              illustrations made for that one child, using a process I designed
              around what actually works for kids at different ages and stages.
            </p>
            <p>
              A book for a 4-year-old who loves diggers and is nervous about
              starting nursery should be nothing like one for a 7-year-old who
              plays football and dreams about space. With a template, they&apos;d
              be the same book. Here, they&apos;re not.
            </p>
          </div>
        </section>

        {/* ── BUILT BY HAND (educator-first) ── */}
        <section className="mt-16 grid items-center gap-10 sm:mt-20 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <h2 className="font-serif text-3xl font-bold" style={{ color: "#2D2235" }}>
              Built by hand, by one person
            </h2>
            <div className="mt-5 space-y-5 text-[17px] leading-8" style={{ color: "#4A4038" }}>
              <p>
                I&apos;m Katy. Before I wrote a single line of FlipWhizz&apos;s
                code, I&apos;d spent two decades in classrooms, nurseries, and the
                outdoors, paying close attention to what actually makes a child
                lean in. That&apos;s the part no template can fake, and it&apos;s
                the part I care most about getting right.
              </p>
              <p>
                I&apos;m also a self-taught developer, so I built the whole thing
                myself. I designed the platform, wrote the code, shaped the process
                behind every story, and set up the printing, and every decision
                runs through what I&apos;ve learned from years of watching children
                respond to stories.
              </p>
              <p>
                FlipWhizz isn&apos;t made by a big company or a faceless product
                team. It&apos;s one person who believes the children&apos;s books
                that matter most are the ones that feel like they were made for
                exactly one child.
              </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            {/* IMAGE SLOT — candid / working shot (optional but recommended).
                Drop a photo at /public/About/katy-candid.jpg
                Recommended: landscape or square, ~1200x900. A warm candid (you
                with a printed book, or at a desk) reinforces "made by one real
                person". If you don't have one yet, delete this whole div. */}
            <div
              className="relative aspect-[4/3] w-full overflow-hidden rounded-[22px]"
              style={{
                boxShadow:
                  "0 16px 48px rgba(45,34,53,0.12), 0 0 0 1px rgba(45,34,53,0.04)",
              }}
            >
              <Image
                src="/About/katy-candid.png"
                alt="Katy holding a printed FlipWhizz storybook"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <div
          className="mt-20 rounded-[28px] px-6 py-10 text-center text-white"
          style={{
            background: "#2D2235",
            boxShadow: "0 20px 60px rgba(45,34,53,0.22)",
          }}
        >
          <h2 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
            Make one for your child
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-white/70">
            The story demo is free and takes about two minutes. No sign-up needed.
          </p>
          <Link
            href="/projects/create"
            className="mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition hover:scale-105"
            style={{ background: "#D94590", color: "#FFFFFF", boxShadow: "0 6px 28px rgba(217,69,144,0.35)" }}
          >
            Create a story
          </Link>
        </div>
      </div>

      {/* Real shared footer */}
      <Footer />
    </main>
  );
}