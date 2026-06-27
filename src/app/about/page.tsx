import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title:
    "About FlipWhizz: The Educator Behind the Personalised Storybooks",
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
    "Developer and educator with over 30 years of experience working with children across schools, early years, ESL, and outdoor education.",
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "FlipWhizz",
  url: "https://flipwhizz.com",
  description:
    "Personalised children's book platform where parents author original, co-created stories for their child. Designed by an educator with 30 years working with children. No name-swap templates.",
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

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F0] text-slate-900">
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

      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 left-[-60px] h-[320px] w-[320px] rounded-full bg-fuchsia-200/40 blur-3xl" />
        <div className="absolute right-[-80px] top-[10%] h-[360px] w-[360px] rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pb-24 pt-6 sm:px-6">
        <nav className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-slate-200 backdrop-blur transition hover:bg-white"
          >
            <span aria-hidden="true">←</span>
            FlipWhizz
          </Link>

          <Link
            href="/projects/create"
            className="rounded-full bg-[#D94590] px-4 py-2 text-sm font-bold text-white shadow-[0_4px_16px_rgba(217,69,144,0.25)] transition hover:opacity-90"
          >
            Try the demo
          </Link>
        </nav>

        <div className="mt-12 sm:mt-16">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            About FlipWhizz
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            A personalised children&apos;s book platform where the parent is the
            author, built by someone who&apos;s spent 30 years working with kids.
          </p>
        </div>

        <article className="mt-10 space-y-6">
          <section className="rounded-[22px] bg-white/85 p-5 ring-1 ring-slate-200 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-slate-900">
              Why FlipWhizz exists
            </h2>
            <div className="mt-3 space-y-4 text-[15px] leading-7 text-slate-700">
              <p>
                I&apos;ve spent over 20 years working with children: in secondary
                schools in the UK, in early years and childcare settings, in ESL
                classrooms, and in outdoor and experiential education. Across all
                of it, one thing has always been true. Children light up when
                they feel seen.
              </p>
              <p>
                A story that mentions something a child actually cares about,
                like their favourite animal, a fear they&apos;re working through,
                or the game they play at break time, lands completely
                differently from a generic one. It&apos;s not just more engaging.
                It tells the child that someone made this for them. Someone knows
                them.
              </p>
              <p>
                That&apos;s the idea behind FlipWhizz. Not a book with a
                child&apos;s name swapped in, but a story shaped entirely around
                who they are right now: what they love, what makes them laugh,
                what they dream about, what they&apos;re navigating.
              </p>
            </div>
          </section>

          <section className="rounded-[22px] bg-white/85 p-5 ring-1 ring-slate-200 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-slate-900">
              How it&apos;s different
            </h2>
            <div className="mt-3 space-y-4 text-[15px] leading-7 text-slate-700">
              <p>
                Most personalised children&apos;s books start with a template.
                You type in a name, pick a hair colour, and the name gets dropped
                into a story that&apos;s the same for every child. The only thing
                that really changes is the cover.
              </p>
              <p>
                FlipWhizz works the other way round. You&apos;re the author. You
                tell the story you want for your child: what they love, what
                they&apos;re working through, the kind of adventure you have in
                mind. FlipWhizz takes your direction and helps shape it into an
                original story and illustrations made for that one child, using a
                process I designed around what actually works for kids at
                different ages and stages.
              </p>
              <p>
                A book for a 4-year-old who loves diggers and is nervous about
                starting nursery should be nothing like one for a 7-year-old who
                plays football and dreams about space. With a template,
                they&apos;d be the same book. Here, they&apos;re not.
              </p>
            </div>
          </section>

          <section className="rounded-[22px] bg-white/85 p-5 ring-1 ring-slate-200 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-slate-900">
              Built by hand, by one person
            </h2>
            <div className="mt-3 space-y-4 text-[15px] leading-7 text-slate-700">
              <p>
                I&apos;m Katy, and I built FlipWhizz myself. I&apos;m a
                self-taught developer. I designed the platform, wrote the code,
                built the process behind every story, and set up the printing,
                and I made every decision based on what I&apos;ve learned from
                years of watching children respond to stories.
              </p>
              <p>
                FlipWhizz isn&apos;t backed by a venture fund or run by a faceless
                product team. It&apos;s one educator building a tool she genuinely
                believes should exist, because the children&apos;s books that
                matter most are the ones that feel like they were made for
                exactly one child. You stay in control of every story you create.
              </p>
            </div>
          </section>

          <section className="rounded-[22px] bg-white/85 p-5 ring-1 ring-slate-200 shadow-sm sm:p-6">
            <h2 className="text-xl font-black text-slate-900">
              Where FlipWhizz is going
            </h2>
            <div className="mt-3 space-y-4 text-[15px] leading-7 text-slate-700">
              <p>
                FlipWhizz starts with personalised storybooks, and that&apos;s
                where the focus stays. The wider goal is to give parents more ways
                to create meaningful, personal moments with their children, all
                grounded in how children actually learn and grow.
              </p>
              <p>
                Whatever comes next, the principle holds. The parent is the
                author, the child is the heart of the story, and everything is
                built around your family, never around a profile of your child.
              </p>
            </div>
          </section>
        </article>

        <div className="mt-14 rounded-[28px] bg-slate-900 px-6 py-8 text-center text-white shadow-[0_20px_60px_rgba(15,23,42,0.15)]">
          <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
            Try it yourself
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-white/70">
            The story demo is free and takes about two minutes. No sign-up
            needed.
          </p>
          <Link
            href="/projects/create"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-100"
          >
            Create a story
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-4 text-sm text-slate-500">
          <Link href="/projects/create" className="transition hover:text-slate-700">
            Create a book
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/faq" className="transition hover:text-slate-700">
            FAQ
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/how-it-works" className="transition hover:text-slate-700">
            How it works
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/examples" className="transition hover:text-slate-700">
            Examples
          </Link>
        </div>
      </div>
    </main>
  );
}