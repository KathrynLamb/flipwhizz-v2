// src/components/Footer.tsx
import Link from "next/link";
import Image from "next/image";
import { getAllPosts } from "@/lib/blog";
import { GIFT_PAGES } from "@/content/giftPages";

// Site footer. Dark ink, quiet type, four short columns and a closing line.
// Shared by every page that renders <Footer />.

const MAKE = [
  { href: "/projects/create?entry=footer", label: "Start a story" },
  { href: "/colouring-books", label: "Colouring books" },
  { href: "/#gallery", label: "Example books" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

const COMPANY = [
  { href: "/about", label: "About Katy" },
  { href: "/faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  const latestPost = getAllPosts()[0];

  return (
    <footer className="bg-[#24182F] text-white">
      <div className="mx-auto max-w-[1240px] px-6 pb-10 pt-20 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-4">
            <Link href="/" aria-label="FlipWhizz home" className="inline-block">
              <Image src="/Flipwhizz_logo_NEW.png" alt="FlipWhizz" width={180} height={180} className="h-auto w-[132px] brightness-0 invert" />
            </Link>
            <p className="mt-5 max-w-[30ch] text-[17px] leading-[1.5] text-[#D9CFE6]">
              Personalised picture books, written by the grown-ups who love them.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="mailto:hello@flipwhizz.com" className="rounded-full border border-white/20 px-4 py-2 text-[15px] font-semibold transition-colors hover:border-white/60">
                hello@flipwhizz.com
              </a>
              <a href="https://www.instagram.com/flipwhizz_kate" target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/20 px-4 py-2 text-[15px] font-semibold transition-colors hover:border-white/60">
                Instagram
              </a>
            </div>
          </div>

          <FooterColumn title="Make a book" links={MAKE} className="lg:col-span-2" />
          <FooterColumn
            title="Gift ideas"
            links={GIFT_PAGES.map((g) => ({ href: `/gifts/${g.slug}`, label: g.footerLabel }))}
            className="lg:col-span-3"
          />
          <div className="lg:col-span-3">
            <FooterColumn title="FlipWhizz" links={COMPANY} />
            {latestPost && (
              <Link href={`/blog/${latestPost.slug}`} className="group mt-8 block rounded-[18px] bg-white/[0.06] p-4 transition-colors hover:bg-white/[0.1]">
                <span className="block text-[13px] font-bold uppercase tracking-[0.08em] text-[#F7A93E]">From the blog</span>
                <span className="mt-1.5 block text-[15px] font-semibold leading-snug text-white">{latestPost.title}</span>
              </Link>
            )}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-white/10 pt-8 text-[14px] text-[#B5A9C2] sm:flex-row sm:items-center sm:justify-between">
          <p className="m-0">© {new Date().getFullYear()} FlipWhizz Ltd.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links, className = "" }: { title: string; links: { href: string; label: string }[]; className?: string }) {
  return (
    <nav aria-label={title} className={className}>
      <p className="m-0 text-[13px] font-bold uppercase tracking-[0.1em] text-[#B5A9C2]">{title}</p>
      <ul className="m-0 mt-4 list-none space-y-2.5 p-0">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[16px] text-white/85 transition-colors hover:text-white hover:underline hover:decoration-[#E8455C] hover:decoration-2 hover:underline-offset-4">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
