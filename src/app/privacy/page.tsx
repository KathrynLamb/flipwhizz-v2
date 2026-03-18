// src/app/privacy/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Privacy Policy — FlipWhizz",
  description:
    "Privacy Policy for FlipWhizz, the AI-powered personalised children's book platform.",
};

const link =
  "underline underline-offset-[3px] decoration-purple-400/30 hover:decoration-purple-400/80 transition-colors";

export default function PrivacyPage() {
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
      <article className="max-w-3xl mx-auto px-6 py-16 pb-24">
        {/* Title */}
        <div className="mb-12">
          <h1
            className="text-4xl md:text-5xl font-extrabold mb-4"
            style={{ color: "#2D2235", letterSpacing: "-0.03em" }}
          >
            Privacy Policy
          </h1>
          <p className="text-sm" style={{ color: "#A897BD" }}>
            Last updated: 16 March 2026
          </p>
        </div>

        {/* Body */}
        <div
          className="space-y-10 text-[16px] leading-[1.8]"
          style={{ color: "#4A3D5C" }}
        >
          <Section title="1. Introduction">
            <p>
              FlipWhizz (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;)
              is operated by Flipwhizz Ltd, registered in England and Wales. We
              take your privacy seriously — especially because our platform
              involves children&rsquo;s stories and, in some cases, photos of
              children.
            </p>
            <p>
              This policy explains what data we collect, why we collect it, how
              we use it, and your rights. We&rsquo;ve written it in plain English
              because we believe you deserve to understand exactly what happens
              with your information.
            </p>
          </Section>

          <Section title="2. What we collect">
            <Subsection title="Account information">
              <p>
                When you sign in with Google, we receive your name, email
                address, and profile picture. We use this to create and manage
                your FlipWhizz account.
              </p>
            </Subsection>

            <Subsection title="Story content">
              <p>
                Everything you provide to create a story: character names,
                descriptions, story ideas, and any text you write or edit. This
                is stored in our database so you can return to your stories at
                any time.
              </p>
            </Subsection>

            <Subsection title="Photos">
              <p>
                If you upload reference photos (of children, pets, family
                members, or locations), these are processed by our AI to generate
                character and location reference images for your story. Photos
                are stored securely on Cloudinary (our image hosting provider)
                and are only accessible to you and our AI systems.
              </p>
            </Subsection>

            <Subsection title="Payment information">
              <p>
                Payments are processed by PayPal. We do not see, store, or have
                access to your credit card or bank details. We only receive
                confirmation that payment was successful, along with a
                transaction ID.
              </p>
            </Subsection>

            <Subsection title="Shipping address">
              <p>
                If you order a printed book, we collect your shipping address.
                This is shared with our print-on-demand partner (Gelato) solely
                for the purpose of delivering your book.
              </p>
            </Subsection>

            <Subsection title="Usage data">
              <p>
                We collect standard web analytics (pages visited, time on site,
                device type) to understand how people use FlipWhizz and to
                improve the experience. We do not track you across other
                websites.
              </p>
            </Subsection>
          </Section>

          <Section title="3. How we use your data">
            <p>We use your data to:</p>
            <BulletList
              items={[
                "Create and manage your account",
                "Generate personalised stories and illustrations using AI",
                "Process orders and deliver printed books",
                "Send order confirmations and delivery updates",
                "Improve our platform and fix issues",
                "Respond to your support requests",
              ]}
            />
            <p className="mt-3">
              We <strong style={{ color: "#2D2235" }}>never</strong> sell your
              data. We <strong style={{ color: "#2D2235" }}>never</strong> use
              your photos for advertising. We{" "}
              <strong style={{ color: "#2D2235" }}>never</strong> share your
              children&rsquo;s information with third parties for marketing
              purposes.
            </p>
          </Section>

          <Section title="4. AI processing">
            <p>
              Your story content and uploaded photos are processed by AI services
              to generate text and images. Specifically:
            </p>
            <BulletList
              items={[
                "Story text is generated using Anthropic's Claude API",
                "Illustrations are generated using Google's Gemini API",
                "Photo analysis (for character creation) uses Google's Gemini API",
              ]}
            />
            <p className="mt-3">
              These AI providers process your data according to their own
              privacy policies and data processing agreements. Content sent to
              these providers is used solely to generate your story — it is not
              used to train their AI models.
            </p>
          </Section>

          <Section title="5. Who we share data with">
            <p>
              We only share your data with the services needed to run FlipWhizz:
            </p>
            <BulletList
              items={[
                "Cloudinary — image storage and processing",
                "Anthropic (Claude) — story text generation",
                "Google (Gemini) — illustration and photo analysis",
                "PayPal — payment processing",
                "Gelato — book printing and delivery",
                "Vercel — website hosting",
                "Neon — database hosting",
                "Resend — transactional emails (order confirmations)",
              ]}
            />
            <p className="mt-3">
              Each provider only receives the minimum data necessary to perform
              their function. We have data processing agreements in place with
              all providers.
            </p>
          </Section>

          <Section title="6. Children's privacy">
            <p>
              FlipWhizz is a tool for adults (parents and caregivers) to create
              books for children. Children do not use FlipWhizz directly.
            </p>
            <p>
              When you provide a child&rsquo;s name, age, or photo, this
              information is used exclusively to personalise their story. We do
              not create profiles of children, we do not use children&rsquo;s
              data for marketing, and we do not share children&rsquo;s
              information with any third party except as described in section 5
              (for the sole purpose of generating the story).
            </p>
            <p>
              If you believe we have inadvertently collected data from a child
              under 13 without parental consent, please contact us immediately
              and we will delete it.
            </p>
          </Section>

          <Section title="7. Data storage and security">
            <p>
              Your data is stored on secure, encrypted servers provided by Neon
              (database) and Cloudinary (images). Both are hosted in the EU/UK
              and comply with GDPR requirements.
            </p>
            <p>
              We use HTTPS encryption for all data in transit. Access to your
              data is restricted to authorised systems only — no FlipWhizz
              employee can view your photos or stories without your explicit
              permission.
            </p>
          </Section>

          <Section title="8. Data retention">
            <p>
              We keep your data for as long as you have a FlipWhizz account. If
              you delete your account, we will delete all associated data
              (stories, characters, photos, orders) within 30 days, except where
              we are legally required to retain it (e.g. financial records for
              tax purposes).
            </p>
            <p>
              AI-generated content sent to Anthropic and Google is subject to
              their retention policies, but is not linked to your identity after
              processing is complete.
            </p>
          </Section>

          <Section title="9. Cookies">
            <p>
              We use essential cookies to keep you signed in and to remember your
              session. We do not use advertising cookies or tracking pixels.
            </p>
            <p>
              If we add analytics in the future, we will update this policy and
              give you the option to opt out.
            </p>
          </Section>

          <Section title="10. Your rights">
            <p>Under UK GDPR, you have the right to:</p>
            <BulletList
              items={[
                "Access — request a copy of all data we hold about you",
                "Rectification — ask us to correct inaccurate data",
                "Erasure — ask us to delete your data (\"right to be forgotten\")",
                "Portability — receive your data in a machine-readable format",
                "Objection — object to specific processing of your data",
                "Withdrawal — withdraw consent for photo processing at any time",
              ]}
            />
            <p className="mt-3">
              To exercise any of these rights, email us at{" "}
              <a
                href="mailto:katy@flipwhizz.co.uk"
                className={link}
                style={{ color: "#9B59D0" }}
              >
                katy@flipwhizz.co.uk
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="11. International transfers">
            <p>
              Some of our service providers (Anthropic, Google, Vercel) are based
              in the United States. Where data is transferred outside the UK/EU,
              it is protected by Standard Contractual Clauses or equivalent
              safeguards as required by UK GDPR.
            </p>
          </Section>

          <Section title="12. Changes to this policy">
            <p>
              We may update this policy from time to time. If we make significant
              changes, we&rsquo;ll notify you via the email associated with your
              account. The &ldquo;last updated&rdquo; date at the top of this
              page will always reflect the current version.
            </p>
          </Section>

          <Section title="13. Contact us">
            <p>
              If you have questions, concerns, or requests about your privacy,
              we&rsquo;d love to hear from you.
            </p>
            <p>
              Email:{" "}
              <a
                href="mailto:katy@flipwhizz.co.uk"
                className={link}
                style={{ color: "#9B59D0" }}
              >
                katy@flipwhizz.co.uk
              </a>
            </p>
            <p>
            Flipwhizz Ltd
              <br />
              Registered in England and Wales
            </p>
          </Section>
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
          <p>© {new Date().getFullYear()} Flipwhizz Ltd. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:underline underline-offset-2">
              Terms of Service
            </Link>
            <Link href="/contact" className="hover:underline underline-offset-2">
              Contact
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Subcomponents                                                        */
/* ------------------------------------------------------------------ */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-bold mb-4" style={{ color: "#2D2235" }}>
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4">
      <h3 className="text-[15px] font-bold mb-2" style={{ color: "#5A4D6B" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-none space-y-2 pl-0 mt-3">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D94590] flex-shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}