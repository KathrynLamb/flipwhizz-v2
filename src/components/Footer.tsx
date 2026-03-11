import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export default function Footer() {
  const recentPosts = getAllPosts().slice(0, 3);

  return (
    <footer className="relative bg-[#0F2236] text-[#FDF8F0] pt-32 pb-12">
      {/* Wave divider */}
      <div className="absolute top-[-1px] left-0 w-full overflow-hidden leading-none">
        <svg
          className="relative block w-[calc(100%+1.3px)] h-[60px] md:h-[100px]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
            fill="#FDF8F0"
          />
        </svg>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 md:px-12">
        {/* Main footer grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 pb-16 border-b border-white/10">

          {/* Brand column */}
          <div className="flex flex-col gap-4">
            <h4 className="font-serif text-2xl font-bold">FlipWhizz</h4>
            <p className="text-sm text-[#FDF8F0]/50 leading-relaxed max-w-xs">
              AI-powered personalised children's books. Every child deserves to be the hero of their own story.
            </p>
            <p className="text-xs text-[#FDF8F0]/30 font-serif italic mt-2">
              Made for magic, built to last. ✨
            </p>
          </div>

          {/* Nav column */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#FDF8F0]/30 mb-3">
              Navigate
            </p>
            {[
              { href: "/", label: "Home" },
              { href: "#how-it-works", label: "How It Works" },
              { href: "#gallery", label: "Gallery" },
              { href: "#pricing", label: "Pricing" },
              { href: "/blog", label: "Blog" },
              { href: "/contact", label: "Contact" },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-[#FDF8F0]/50 hover:text-white transition-colors duration-200 w-fit"
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Blog column */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#FDF8F0]/30 mb-3">
              From the Blog
            </p>
            {recentPosts.length === 0 ? (
              <p className="text-sm text-[#FDF8F0]/30 italic">Posts coming soon.</p>
            ) : (
              recentPosts.map(post => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-1 py-2 border-b border-white/5 last:border-0"
                >
                  <span className="text-sm text-[#FDF8F0]/70 group-hover:text-white transition-colors duration-200 leading-snug">
                    {post.title}
                  </span>
                  <span className="text-xs text-[#FDF8F0]/25">
                    {new Date(post.date).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </Link>
              ))
            )}
            <Link
              href="/blog"
              className="mt-2 text-xs font-semibold text-[#8B5A83] hover:text-purple-300 transition-colors duration-200 w-fit"
            >
              All posts →
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-[#FDF8F0]/20">
          <p>© {new Date().getFullYear()} FlipWhizz Ltd. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[#FDF8F0]/50 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[#FDF8F0]/50 transition-colors">
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}