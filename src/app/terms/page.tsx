// src/app/terms/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Terms of Service — FlipWhizz",
  description:
    "Terms of Service for FlipWhizz, the AI-powered personalised children's book platform.",
};

export default function TermsPage() {
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
            Terms of Service
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
          <Section title="1. Who we are">
            <p>
              FlipWhizz is operated by Flipwhizz Ltd, a company registered in
              England and Wales. When we say &ldquo;FlipWhizz&rdquo;,
              &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;, we
              mean Flipwhizz Ltd. When we say &ldquo;you&rdquo; or
              &ldquo;your&rdquo;, we mean you, the person using our platform.
            </p>
            <p>
              Our platform is available at{" "}
              <a href="https://flipwhizz.com" className="link">
                flipwhizz.com
              </a>
              .
            </p>
          </Section>

          <Section title="2. What FlipWhizz does">
            <p>
              FlipWhizz is an AI-powered platform that helps parents and
              caregivers create personalised, illustrated storybooks for
              children. You provide the ideas, characters, and details — our AI
              writes and illustrates a unique story that can be viewed digitally, downloaded as a pdf
              or ordered as a printed book.
            </p>
          </Section>

          <Section title="3. Your account">
            <p>
              You need a Google account to sign in. You&rsquo;re responsible for
              keeping your account secure and for all activity under it. You must
              be at least 18 years old to use FlipWhizz, or have permission from
              a parent or guardian.
            </p>
            <p>
              We reserve the right to suspend or close accounts that violate
              these terms or are used to create inappropriate content.
            </p>
          </Section>

          <Section title="4. Creating stories">
            <p>
              Stories are generated using artificial intelligence (including
              language models and image generation models). While we work hard to
              make every story wonderful, AI-generated content can sometimes be
              unpredictable. We encourage you to review your story before
              ordering a printed copy.
            </p>
            <p>
              You retain ownership of the input you provide (names, ideas,
              photos, descriptions). The AI-generated story text and
              illustrations are licensed to you for personal, non-commercial use.
              You may share your book with family and friends, give it as a gift,
              and keep it forever — but you may not resell the content or use it
              commercially without our written permission.
            </p>
          </Section>

          <Section title="5. Photos and personal information">
            <p>
              If you upload reference photos (of children, pets, or family
              members), we use them solely to create character reference images
              for your story. We do not sell, share, or use your photos for any
              other purpose.
            </p>
            <p>
              By uploading a photo, you confirm that you have the right to use it
              and that you consent to it being processed by our AI systems for
              the purpose of creating your book. You can request deletion of your
              photos and data at any time by contacting us.
            </p>
          </Section>

          <Section title="6. Pricing and payment">
            <p>
              Our current pricing is displayed on the site. All prices are in GBP
              (£) and include VAT where applicable. Printed books incur shipping
              costs which are calculated at checkout based on your delivery
              address.
            </p>
            <p>
              Payment is processed securely through PayPal. We do not store your
              payment card details. Once payment is confirmed, your order is
              final — see our refund policy below.
            </p>
          </Section>

          <Section title="7. Printed books and delivery">
            <p>
              Printed books are produced by our print-on-demand partner, Gelato.
              Delivery times vary by location but are typically 5–10 business
              days for UK orders and 7–14 business days for international orders.
              These are estimates, not guarantees.
            </p>
            <p>
              We are not responsible for delays caused by the postal service,
              customs, or other factors outside our control. If your book arrives
              damaged or doesn&rsquo;t arrive at all, please contact us and
              we&rsquo;ll make it right.
            </p>
          </Section>

          <Section title="8. Refunds and satisfaction">
            <p>
              Digital products (PDF downloads) are non-refundable once delivered,
              as they can be accessed immediately.
            </p>
            <p>
              For printed books: if your book arrives damaged, is misprinted, or
              has a quality issue that&rsquo;s our fault, we&rsquo;ll reprint
              and reship it at no cost. If you&rsquo;re simply not happy with
              your book, get in touch — we genuinely want every family to love
              their story, and we&rsquo;ll do our best to make it right.
            </p>
          </Section>

          <Section title="9. Acceptable use">
            <p>You agree not to use FlipWhizz to:</p>
            <ul className="list-none space-y-2 pl-0 mt-3">
              {[
                "Create content that is harmful, abusive, hateful, or discriminatory",
                "Generate content involving real people without their consent",
                "Upload images you don't have the right to use",
                "Attempt to reverse-engineer, scrape, or misuse our AI systems",
                "Use the platform for any illegal purpose",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#D94590] flex-shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              We reserve the right to refuse service and remove content that
              violates these rules.
            </p>
          </Section>

          <Section title="10. Intellectual property">
            <p>
              The FlipWhizz brand, logo, website design, and underlying
              technology are owned by Flipwhizz Ltd. You may not copy, modify, or
              distribute any part of our platform without permission.
            </p>
            <p>
              AI-generated illustrations are created uniquely for each story.
              While they are licensed to you for personal use, the underlying AI
              models and technology remain our property (and that of our
              technology partners).
            </p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>
              FlipWhizz is provided &ldquo;as is&rdquo;. While we do our best to
              ensure everything works beautifully, we cannot guarantee
              uninterrupted service, perfect AI output, or specific delivery
              dates. To the extent permitted by law, our liability is limited to
              the amount you paid for the specific product in question.
            </p>
          </Section>

          <Section title="12. Changes to these terms">
            <p>
              We may update these terms from time to time. If we make significant
              changes, we&rsquo;ll let you know via the email associated with
              your account. Continued use of FlipWhizz after changes take effect
              means you accept the updated terms.
            </p>
          </Section>

          <Section title="13. Governing law">
            <p>
              These terms are governed by the laws of England and Wales. Any
              disputes will be subject to the exclusive jurisdiction of the
              courts of England and Wales.
            </p>
          </Section>

          <Section title="14. Contact us">
            <p>
              Questions about these terms? We&rsquo;d love to hear from you.
            </p>
            <p>
              Email:{" "}
              <a href="mailto:katy@flipwhizz.co.uk" className="link">
                katy@flipwhizz.co.uk
              </a>
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
          <p>© {new Date().getFullYear()} Karstaway Ltd. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:underline underline-offset-2">
              Privacy Policy
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
/* Section component                                                    */
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
      <h2
        className="text-xl font-bold mb-4"
        style={{ color: "#2D2235" }}
      >
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}