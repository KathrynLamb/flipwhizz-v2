"use client"; 
import Link from "next/link";
import Image from "next/image";
import { getAllPosts } from "@/lib/blog";

// Same rainbow colours as the Header
const RAINBOW = ["#E8457A", "#F5A623", "#7BC67E", "#5EAED4"];

export default function Footer() {
  const recentPosts = getAllPosts().slice(0, 3);

  return (
    <footer className="relative overflow-hidden" style={{ background: "#2D2235" }}>
      {/* ── Soft curved transition from page background ── */}
      <div className="absolute top-0 left-0 w-full overflow-hidden leading-none">
        <svg
          className="relative block w-full h-[60px] lg:h-[80px]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z"
            fill="#FEFCFA"
          />
        </svg>
      </div>

      {/* ── Rainbow line accent ── */}
      <div
        className="absolute top-[59px] lg:top-[79px] left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, ${RAINBOW[0]}, ${RAINBOW[1]}, ${RAINBOW[2]}, ${RAINBOW[3]})`,
        }}
      />

      {/* ── Decorative blobs ── */}
      <div
        className="absolute top-20 -right-32 w-[400px] h-[400px] rounded-full opacity-[0.06] pointer-events-none blur-3xl"
        style={{ background: `radial-gradient(circle, ${RAINBOW[0]}, ${RAINBOW[3]})` }}
      />
      <div
        className="absolute bottom-0 -left-32 w-[300px] h-[300px] rounded-full opacity-[0.04] pointer-events-none blur-3xl"
        style={{ background: `radial-gradient(circle, ${RAINBOW[2]}, ${RAINBOW[1]})` }}
      />

      {/* ── Subtle cross-hatch texture ── */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            #FEFCFA 10px,
            #FEFCFA 11px
          )`,
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 lg:px-12 pt-28 lg:pt-32 pb-12">
        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 pb-16" style={{ borderBottom: "1px solid rgba(254,252,250,0.08)" }}>

          {/* Brand column */}
          <div className="lg:col-span-4 flex flex-col gap-5">
            <Link href="/" className="w-fit">
              <Image
                src="/Flipwhizz_logo_NEW.png"
                alt="FlipWhizz"
                width={160}
                height={160}
                className="brightness-0 invert opacity-90"
              />
            </Link>
            <p className="text-sm leading-relaxed max-w-xs" style={{ color: "rgba(254,252,250,0.45)" }}>
              Every child deserves to be the hero of their own story. Personalised, illustrated, and made to last.
            </p>
            {/* Rainbow dot accent */}
            <div className="flex items-center gap-2 mt-1">
              {RAINBOW.map((color) => (
                <div
                  key={color}
                  className="w-2 h-2 rounded-full"
                  style={{ background: color, opacity: 0.7 }}
                />
              ))}
            </div>
          </div>

          {/* Nav column */}
          <div className="lg:col-span-3 flex flex-col gap-2">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] mb-3"
              style={{ color: RAINBOW[0] }}
            >
              Navigate
            </p>
            {[
              { href: "/", label: "Home", color: RAINBOW[0] },
              { href: "#how-it-works", label: "How It Works", color: RAINBOW[0] },
              { href: "#gallery", label: "Gallery", color: RAINBOW[1] },
              { href: "#pricing", label: "Pricing", color: RAINBOW[3] },
              { href: "/blog", label: "Blog", color: RAINBOW[2] },
              { href: "/contact", label: "Contact", color: RAINBOW[3] },
            ].map(({ href, label, color }) => (
              <Link
                key={href}
                href={href}
                className="text-sm w-fit transition-all duration-200 hover:translate-x-1"
                style={{ color: "rgba(254,252,250,0.45)" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = color; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(254,252,250,0.45)"; }}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Blog column */}
          <div className="lg:col-span-5 flex flex-col gap-2">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em] mb-3"
              style={{ color: RAINBOW[2] }}
            >
              From the Blog
            </p>
            {recentPosts.length === 0 ? (
              <p className="text-sm italic" style={{ color: "rgba(254,252,250,0.25)" }}>
                Posts coming soon.
              </p>
            ) : (
              recentPosts.map((post, i) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-1 py-2.5"
                  style={{ borderBottom: `1px solid rgba(254,252,250,0.05)` }}
                >
                  <span
                    className="text-sm leading-snug transition-colors duration-200"
                    style={{ color: "rgba(254,252,250,0.6)" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = RAINBOW[i % RAINBOW.length]; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(254,252,250,0.6)"; }}
                  >
                    {post.title}
                  </span>
                  <span className="text-xs" style={{ color: "rgba(254,252,250,0.2)" }}>
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
              className="mt-2 text-xs font-semibold w-fit transition-colors duration-200"
              style={{ color: RAINBOW[2] }}
              onMouseEnter={(e) => { e.currentTarget.style.color = RAINBOW[1]; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = RAINBOW[2]; }}
            >
              All posts →
            </Link>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="pt-8 flex flex-col lg:flex-row items-center justify-between gap-4 text-xs" style={{ color: "rgba(254,252,250,0.18)" }}>
          <p>© {new Date().getFullYear()} FlipWhizz Ltd. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="transition-colors duration-200 hover:text-white/40">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors duration-200 hover:text-white/40">
              Terms of Use
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}