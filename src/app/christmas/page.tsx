// src/app/christmas/page.tsx
import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import { getServerSession } from "next-auth";
import Image from "next/image";
import Link from "next/link";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { BOOKS } from "@/content/homeBooks";
import {
  CHRISTMAS_TITLE, CHRISTMAS_DESCRIPTION, CHRISTMAS_PROOF,
  CHRISTMAS_STORY_HREF, christmasPageContent,
} from "@/content/christmas";
import { starterHref } from "@/lib/chatStarter";
import styles from "./christmas.module.css";

const playfair = Playfair_Display({
  subsets: ["latin"], weight: ["500", "600", "700"],
  variable: "--font-christmas-heading", display: "swap",
});

// Do not freeze deadline copy or FAQ answers at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: CHRISTMAS_TITLE },
  description: CHRISTMAS_DESCRIPTION,
  alternates: { canonical: "https://flipwhizz.com/christmas" },
  openGraph: {
    title: CHRISTMAS_TITLE,
    description: CHRISTMAS_DESCRIPTION,
    url: "https://flipwhizz.com/christmas",
    siteName: "FlipWhizz",
    type: "website",
    locale: "en_GB",
    images: [{
      url: "/LandingPage/books/ella.webp", width: 1600, height: 893,
      alt: "An illustrated FlipWhizz storybook starring a little girl and her unicorn",
    }],
  },
  twitter: {
    card: "summary_large_image", title: CHRISTMAS_TITLE,
    description: CHRISTMAS_DESCRIPTION, images: ["/LandingPage/books/ella.webp"],
  },
};

export default async function ChristmasPage() {
  const session = await getServerSession(authOptions);
  const { heroDeadline, delivery, faqs, faqJsonLd } = christmasPageContent();
  return (
    <div className={`${styles.page} ${playfair.variable}`}>
      <Header session={session} />
      <main id="christmas-main">
        <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }} />
        <section className={styles.hero} aria-labelledby="christmas-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>A little more you. A lot more Christmas.</p>
            <h1 id="christmas-title">A Christmas book your child stars in, <em>written by you</em></h1>
            <p className={styles.promise}>Their favourite people. Your wonderfully silly ideas. A personalised Christmas book only you could write.</p>
            <p className={styles.deadline}><span aria-hidden="true">✦</span> {heroDeadline}</p>
            <div className={styles.actions}>
              <Link className={styles.primary} href={CHRISTMAS_STORY_HREF}>Start your Christmas story <span aria-hidden="true">↗</span></Link>
              <Link className={styles.secondary} href="#gift-card">Give a gift card <span aria-hidden="true">↓</span></Link>
            </div>
            <p className={styles.small}>First illustrated page free. No sign-up or card to start.</p>
          </div>
          <figure className={styles.heroArt}>
            <div className={styles.bookFrame}>
              <p className={styles.bookLabel}>For the child with a big imagination.</p>
              <Image src={BOOKS.ella.src} alt={BOOKS.ella.alt} width={1600} height={893}
                sizes="(min-width: 1000px) 50vw, 92vw" priority />
              <span className={styles.giftTag}>To: your favourite<br />little person<br /><strong>From: you ♡</strong></span>
            </div>
            <figcaption>A real FlipWhizz book: <cite>{BOOKS.ella.title}</cite>. Yours can be a Christmas adventure.</figcaption>
          </figure>
        </section>

        <section className={styles.stepsSection} aria-labelledby="how-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>From a tiny idea to a very big smile</p><h2 id="how-title">You wrote this.<br /><em>Just with a bit of help.</em></h2></div>
          <ol className={styles.steps}>
            <li><span className={styles.number}>01</span><h3>Tell us about your child</h3><p>The name. The favourite dinosaur. The joke only your family gets. Start with the little things you know by heart.</p></li>
            <li><span className={styles.number}>02</span><h3>Write it together</h3><p>You bring the ideas and make the decisions. We help shape the words and pictures. Rewrite, personalise and review until it feels like your story.</p></li>
            <li><span className={styles.number}>03</span><h3>We print and post it</h3><p>Approve your finished book, choose your printed edition and let us take care of the post. Or keep it digital, ready for a Christmas Eve read.</p></li>
          </ol>
        </section>

        <section className={styles.difference} aria-labelledby="different-title">
          <div><p className={styles.eyebrow}>You know them. That is the magic.</p><h2 id="different-title">More than a name<br /><em>on the cover.</em></h2>
            <p className={styles.manifesto}>AI never touches the child. It supercharges the adult who loves them.</p>
            <p>You do the chatting. You choose what stays. Your child gets a story made by someone who knows their world.</p>
          </div>
          <div className={styles.reasons}>
            {[
              ["Your words, with a helping hand", "Shape the plot, change the ending, add your own jokes. You are the author, with AI as your tool."],
              ["Your child, the hero", "Let them rescue Christmas, help a lost reindeer or bring the family together. You choose the adventure."],
              ["Faces that feel like family", "Upload photos to guide the characters' appearance, or describe them in your own words. Pets are welcome too."],
              ["Made by an educator", "Katy created FlipWhizz after 20 years working with children, in classrooms and outdoors."],
            ].map(([title, text]) => <article key={title}><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>

        <section className={styles.giftsSection} aria-labelledby="gifts-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>Who is it from?</p><h2 id="gifts-title">The best bit is<br /><em>who wrote it.</em></h2></div>
          <div className={styles.giftGrid}>
            <article><span className={styles.giftIndex}>01 / From Mum & Dad</span><h3>A Christmas only your family could imagine.</h3><p>The dog steals Santa's biscuits. The favourite teddy saves the day. Make your own traditions part of the adventure.</p><Link href={starterHref({ occasion: "christmas", entry: "christmas_parents" })}>Write their Christmas adventure ↗</Link></article>
            <article><span className={styles.giftIndex}>02 / From grandparents</span><h3>A book from Grandma, starring your grandchild.</h3><p>Bring them into a Christmas from your childhood, or make up a new one together. A story in your voice, even when you live far apart.</p><Link href={starterHref({ for: "grandchild", occasion: "christmas", entry: "christmas_grandparents" })}>Make a book for your grandchild ↗</Link></article>
            <article><span className={styles.giftIndex}>03 / For a new big sibling</span><h3>A little reminder that they are a very big deal.</h3><p>Celebrate the new big brother or sister with a Christmas adventure where their kindness, courage and brilliant ideas lead the way.</p><Link href={starterHref({ occasion: "christmas", about: "change", entry: "christmas_sibling" })}>Start their big-sibling story ↗</Link></article>
            <article><span className={styles.giftIndex}>04 / A stocking full of colour</span><h3>One story. A box of pencils. A busy Christmas morning.</h3><p>Pair a personalised book with a colouring storybook for a gift they can make their own. Printed and digital colouring editions are available.</p><Link href={starterHref({ occasion: "christmas", bookType: "colouring_storybook", entry: "christmas_colouring" })}>Make a Christmas colouring book ↗</Link><p className={styles.small}>Build your own bundle. Editions are purchased separately.</p></article>
          </div>
          <aside id="gift-card" className={styles.giftCard} aria-labelledby="gift-card-title">
            <div><p className={styles.eyebrow}>Let them write the adventure</p><h3 id="gift-card-title">Gift cards are coming soon.</h3><p>They are not available to buy just yet. For now, you can write a personalised book to give yourself.</p></div>
            <Link className={styles.secondary} href={starterHref({ occasion: "christmas", entry: "christmas_gift_alternative" })}>Make a book to give ↗</Link>
          </aside>
        </section>

        {CHRISTMAS_PROOF.length > 0 ? (
          <section className={styles.proofSection} aria-labelledby="proof-title">
            <p className={styles.eyebrow}>Made by families, for their people</p><h2 id="proof-title">Off the screen.<br /><em>Into their hands.</em></h2>
            <div className={styles.proofGrid}>{CHRISTMAS_PROOF.slice(0, 5).map((item, index) => (
              <figure key={index}>{item.kind === "quote" ? <>
                <blockquote>{item.quote}</blockquote><figcaption>{item.name}{item.disclosure ? ` · ${item.disclosure}` : ""}</figcaption>
              </> : <>
                <Image src={item.src} alt={item.alt} width={item.width} height={item.height} sizes="(min-width: 900px) 30vw, 90vw" />
                <figcaption>{item.caption}</figcaption>
              </>}</figure>
            ))}</div>
          </section>
        ) : null}

        <section className={styles.deliverySection} aria-labelledby="delivery-title">
          <div><p className={styles.eyebrow}>A date for your diary</p><h2 id="delivery-title">Make time<br /><em>for the magic.</em></h2><p>Leave time to finish and approve your book before the print cut-off. Check the delivery estimate for your destination when ordering.</p></div>
          <div className={styles.tableWrap}>
            <table><caption>Christmas ordering dates, UK time</caption><thead><tr><th scope="col">Your edition</th><th scope="col">Order by</th><th scope="col">Good to know</th></tr></thead>
              <tbody>{delivery.map((row) => <tr key={row.product}><th scope="row">{row.product}</th><td>{row.dateTime ? <time dateTime={row.dateTime}>{row.deadline}</time> : row.deadline}</td><td>{row.status}</td></tr>)}</tbody>
            </table>
            <p className={styles.small}>Postal dates are a guide, not a delivery guarantee. Digital books still need time to be written, illustrated and reviewed.</p>
          </div>
        </section>

        <section className={styles.faqSection} aria-labelledby="faq-title">
          <div><p className={styles.eyebrow}>Before you begin</p><h2 id="faq-title">A few Christmas<br /><em>questions.</em></h2></div>
          <div className={styles.faqs}>{faqs.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
        </section>

        <section className={styles.finalCta} aria-labelledby="last-title"><p className={styles.eyebrow}>Their name on the page. Your heart in the story.</p><h2 id="last-title">What happens in<br /><em>your Christmas story?</em></h2><Link className={styles.primary} href={starterHref({ occasion: "christmas", entry: "christmas_footer" })}>Start your Christmas story ↗</Link></section>
      </main>
      <Footer />
    </div>
  );
}
