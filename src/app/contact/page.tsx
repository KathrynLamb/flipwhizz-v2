// src/app/contact/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Contact Us — FlipWhizz",
  description:
    "Get in touch with the FlipWhizz team. We'd love to hear from you.",
};

const link =
  "underline underline-offset-[3px] decoration-purple-400/30 hover:decoration-purple-400/80 transition-colors";

export default function ContactPage() {
  return (
    <main
      className="min-h-screen relative"
      style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700;12..96,800&display=swap"
        rel="stylesheet"
      />

      {/* Background */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 30% 20%, rgba(232,190,255,0.2) 0%, transparent 55%),
            radial-gradient(ellipse 80% 60% at 75% 75%, rgba(255,182,210,0.15) 0%, transparent 50%),
            #FEFCFA
          `,
        }}
      />

      {/* Header */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{
          background: "rgba(254,252,250,0.85)",
          borderBottom: "1px solid rgba(180,150,210,0.08)",
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="transition-transform hover:scale-105">
            <Image
              src="/Flipwhizz_logo_NEW.png"
              alt="FlipWhizz"
              width={130}
              height={40}
              priority
            />
          </Link>
          <Link
            href="/"
            className="text-sm font-semibold transition-colors"
            style={{ color: "#9B59D0" }}
          >
            ← Back to home
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16 pb-24">
        {/* Title */}
        <div className="mb-12">
          <h1
            className="text-4xl md:text-5xl font-extrabold mb-4"
            style={{ color: "#2D2235", letterSpacing: "-0.03em" }}
          >
            Get in touch
          </h1>
          <p
            className="text-lg leading-relaxed max-w-xl"
            style={{ color: "#7B6E90" }}
          >
            Whether it&rsquo;s a question about your book, a feature idea, or
            just to say hello — we&rsquo;d love to hear from you.
          </p>
        </div>

        {/* Contact cards */}
        <div className="grid sm:grid-cols-2 gap-5 mb-16">
          {/* Email */}
          <a
            href="mailto:katy@flipwhizz.co.uk"
            className="group rounded-[22px] p-7 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "white",
              border: "1px solid rgba(180,150,210,0.12)",
              boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                boxShadow: "0 4px 16px rgba(176,92,230,0.2)",
              }}
            >
              <svg
                className="w-5 h-5 text-white"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </div>
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: "#2D2235" }}
            >
              Email us
            </h3>
            <p className="text-sm mb-4" style={{ color: "#7B6E90" }}>
              Best for questions, support, and detailed requests.
            </p>
            <span
              className="text-sm font-semibold group-hover:underline underline-offset-2"
              style={{ color: "#9B59D0" }}
            >
              katy@flipwhizz.co.uk →
            </span>
          </a>

          {/* Response time */}
          <div
            className="rounded-[22px] p-7"
            style={{
              background: "white",
              border: "1px solid rgba(180,150,210,0.12)",
              boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
            }}
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: "rgba(67,184,156,0.1)",
              }}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#43B89C"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3
              className="text-lg font-bold mb-1"
              style={{ color: "#2D2235" }}
            >
              Response time
            </h3>
            <p className="text-sm mb-4" style={{ color: "#7B6E90" }}>
              We&rsquo;re a small team, but we reply quickly.
            </p>
            <span
              className="text-sm font-semibold"
              style={{ color: "#43B89C" }}
            >
              Usually within 24 hours
            </span>
          </div>
        </div>

        {/* FAQ / Common topics */}
        <div className="mb-16">
          <h2
            className="text-2xl font-extrabold mb-8"
            style={{ color: "#2D2235" }}
          >
            Common questions
          </h2>

          <div className="space-y-4">
            <FaqItem
              question="My book hasn't arrived yet"
              answer="Printed books are produced by Gelato and typically take 5–10 business days for UK delivery and 7–14 days internationally. If it's been longer than that, email us your order details and we'll chase it up for you."
            />
            <FaqItem
              question="Can I change my story after ordering?"
              answer="Once a print order has been submitted, the story is locked for production. However, you can always create a new version of your story and order again. If there's a genuine error, get in touch and we'll see what we can do."
            />
            <FaqItem
              question="How do I delete my account and data?"
              answer="Email us at katy@flipwhizz.co.uk and we'll delete your account and all associated data (stories, characters, photos) within 30 days. See our Privacy Policy for full details."
            />
            <FaqItem
              question="The illustrations don't look like my child"
              answer="AI illustration is improving all the time, but it's not perfect. Uploading a clear, well-lit reference photo makes a big difference. If you're not happy with the results, let us know — we're always working on making character likeness better."
            />
            <FaqItem
              question="I have a feature idea"
              answer="We love hearing what parents want. Drop us an email with your idea — many of FlipWhizz's best features have come from user suggestions."
            />
          </div>
        </div>

        {/* Social / follow */}
        <div
          className="rounded-[22px] p-8 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(232,213,255,0.3), rgba(255,213,229,0.3))",
            border: "1px solid rgba(199,125,255,0.12)",
          }}
        >
          <h3
            className="text-lg font-bold mb-2"
            style={{ color: "#2D2235" }}
          >
            Follow along
          </h3>
          <p className="text-sm mb-5" style={{ color: "#7B6E90" }}>
            We share behind-the-scenes updates, new features, and the
            occasional adorable book reveal.
          </p>
          <div className="flex items-center justify-center gap-4">
            <SocialLink
              href="https://www.instagram.com/flipwhizz/"
              label="Instagram"
              icon={
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                </svg>
              }
            />
            <SocialLink
              href="https://www.facebook.com/flipwhizz"
              label="Facebook"
              icon={
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* Rainbow divider */}
        <div
          className="h-1 rounded-full mt-16 mb-8"
          style={{
            background:
              "linear-gradient(90deg, #F28B7B, #F5A862, #F5CE62, #7DD4A8, #6DBCE0, #A78BDA)",
          }}
        />

        {/* Footer nav */}
        <div
          className="flex flex-wrap items-center justify-between gap-4 text-sm"
          style={{ color: "#A897BD" }}
        >
          <p>
            © {new Date().getFullYear()} Flipwhizz Ltd. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link
              href="/terms"
              className="hover:underline underline-offset-2"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="hover:underline underline-offset-2"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponents                                                        */
/* ------------------------------------------------------------------ */

function FaqItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <div
      className="rounded-2xl p-6"
      style={{
        background: "white",
        border: "1px solid rgba(180,150,210,0.1)",
        boxShadow: "0 1px 4px rgba(100,60,140,0.03)",
      }}
    >
      <h4
        className="text-[15px] font-bold mb-2"
        style={{ color: "#2D2235" }}
      >
        {question}
      </h4>
      <p className="text-sm leading-relaxed" style={{ color: "#7B6E90" }}>
        {answer}
      </p>
    </div>
  );
}

function SocialLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 hover:shadow-md hover:scale-105 active:scale-[0.98]"
      style={{
        background: "white",
        color: "#2D2235",
        border: "1.5px solid rgba(180,150,210,0.15)",
      }}
    >
      <span style={{ color: "#9B59D0" }}>{icon}</span>
      {label}
    </a>
  );
}