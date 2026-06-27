import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ — Personalised Children's Books | FlipWhizz",
  description:
    "Answers to common questions about FlipWhizz: how it works, what ages it's for, how it's different from other personalised children's books, printing options, pricing, and more.",
  alternates: {
    canonical: "https://flipwhizz.com/faq",
  },
  openGraph: {
    title: "FAQ — Personalised Children's Books | FlipWhizz",
    description:
      "Everything parents want to know about creating a personalised storybook with FlipWhizz.",
    url: "https://flipwhizz.com/faq",
    siteName: "FlipWhizz",
    type: "website",
    locale: "en_GB",
  },
};

const faqs = [
  {
    question: "What is FlipWhizz?",
    answer:
      "FlipWhizz is an AI-powered tool that helps families create personalised children's storybooks. You tell FlipWhizz about your child — their name, age, interests, and personality — and it builds a unique story from scratch, complete with custom illustrations. You can then order a professionally printed hardcover book or download a print-at-home PDF.",
  },
  {
    question: "How does FlipWhizz work?",
    answer:
      "You start by describing your child and the kind of story you'd like — a bedtime tale, an adventure, a confidence-building story, or something completely different. FlipWhizz uses AI to create a story shaped around those details. You then review and refine the characters, settings, and scenes before building the full illustrated book.",
  },
  {
    question: "Can I try FlipWhizz before signing up?",
    answer:
      "Yes. There's a free story demo on the create page that lets you explore a story idea with no account needed. You send a few messages, see how FlipWhizz responds, and get a feel for how the story takes shape. When you're ready to build the full book, you sign in to continue.",
  },
  {
    question: "How is FlipWhizz different from other personalised children's books?",
    answer:
      "Most personalised book services swap a child's name and appearance into a pre-written story. The plot stays the same for every child — only the name on the cover changes. FlipWhizz is different because it builds the entire story from scratch around your child's personality, interests, and the experience you want to create. A book for a dinosaur-obsessed 4-year-old starting school will be completely different from one made for a 7-year-old who loves football and dreams about space.",
  },
  {
    question: "Can I change the art style FlipWhizz chooses for my book?",
    answer:
      "Yes. FlipWhizz suggests an illustration style based on the tone of your story — soft watercolour for a cozy bedtime tale, vibrant 3D for a space adventure, and so on. If it's not quite right, you can change the style direction yourself, or upload a reference image to show FlipWhizz the look you're after.",
  },
  {
    question: "What if a character's outfit or appearance is wrong on a page?",
    answer:
      "You can fix it. If a character's outfit doesn't match what you pictured — or doesn't match how they looked on a previous page — you can redo that specific scene and adjust the outfit, colours, or details, without regenerating the whole book.",
  },
  {
    question: "If I make more than one book, will the characters stay consistent?",
    answer:
      "Yes. FlipWhizz remembers your child's appearance, your other characters, and the visual style of your book, so if you create a sequel or a new story with the same cast, they look like themselves — not a different version of the character.",
  },
  {
    question: "What kinds of stories can I create?",
    answer:
      "Adventure stories, bedtime stories, confidence-building stories, friendship stories, funny stories, fantasy worlds, sports stories, animal stories, and more. You can create stories that help with real situations too — like starting school, welcoming a new sibling, overcoming a fear, or celebrating something a child is proud of. The best stories are the ones built around something real about your child.",
  },
  {
    question: "What age range is FlipWhizz suitable for?",
    answer:
      "FlipWhizz is designed for children aged roughly 2 to 10. The stories adapt to the age and interests you describe — a story for a 3-year-old will have simpler language and gentler themes than one for an 8-year-old. The illustrations adjust too.",
  },
  {
    question: "Can I order a printed copy of the book?",
    answer:
      "Yes. Once your storybook is complete, you can order a professionally printed hardcover delivered to your door. Books are produced by a professional print-on-demand partner and ship worldwide. You can also download a print-at-home PDF if you'd prefer to print it yourself.",
  },
  {
    question: "How long does it take to create a book?",
    answer:
      "You can shape the story idea in a few minutes using the demo. Building the full book — with illustrated pages, a custom cover, and a print-ready layout — takes a bit longer as you review and refine each part. Most families complete a book in one or two sessions.",
  },
  {
    question: "Is FlipWhizz only for bedtime stories?",
    answer:
      "Not at all. Bedtime stories are popular, but FlipWhizz is equally good at funny adventures, exciting quests, stories about real-life moments like starting school or making new friends, and imaginative fantasy worlds. You choose the tone and direction.",
  },
  {
    question: "Can I include real people or pets in the story?",
    answer:
      "Yes — you can describe family members, friends, or pets and they can appear as characters in the story. Many families include siblings, grandparents, or a beloved pet as part of the adventure.",
  },
  {
    question: "How much does FlipWhizz cost?",
    answer:
      "The story demo is completely free with no sign-up required. Creating a full illustrated book requires an account. Pricing for the book creation and printing options is shown during the creation flow.",
  },
  {
    question: "Is my child's data safe?",
    answer:
      "FlipWhizz takes children's privacy seriously. The details you share are used only to create your story and are not shared with third parties. You can delete your account and all associated data at any time.",
  },
  {
    question: "Can I make more than one book?",
    answer:
      "Yes, you can create as many books as you like. Some families make a new story every few months as their child's interests change, or create different books for siblings.",
  },
  {
    question: "Who created FlipWhizz?",
    answer:
      "FlipWhizz was created by Katy, a self-taught developer with over 30 years of experience working with children across schools, early years settings, ESL classrooms, and outdoor education. The platform is built on the belief that the best children's stories are the ones shaped around who a child actually is.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
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
      name: "FAQ",
      item: "https://flipwhizz.com/faq",
    },
  ],
};

export default function FAQPage() {
  return (
    <main className="min-h-screen bg-[#FDF8F0] text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
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

        <div className="mt-12 text-center sm:mt-16">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-base leading-7 text-slate-600">
            Everything you need to know about creating personalised
            children&apos;s books with FlipWhizz.
          </p>
        </div>

        <div className="mt-10 space-y-4">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="rounded-[22px] bg-white/85 p-5 ring-1 ring-slate-200 shadow-sm sm:p-6"
            >
              <h2 className="text-lg font-black text-slate-900">
                {faq.question}
              </h2>
              <p className="mt-2 text-[15px] leading-7 text-slate-700">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <p className="text-sm text-slate-500">
            Got another question?{" "}
            <a
              href="mailto:hello@flipwhizz.com"
              className="font-semibold text-[#D94590] hover:underline"
            >
              Get in touch
            </a>
          </p>
        </div>

        <div className="mt-10 flex items-center justify-center gap-4 text-sm text-slate-500">
          <Link href="/projects/create" className="transition hover:text-slate-700">
            Create a book
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/about" className="transition hover:text-slate-700">
            About
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