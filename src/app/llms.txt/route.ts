// src/app/llms.txt/route.ts
// Serves https://flipwhizz.com/llms.txt
// A plain guide for AI assistants describing what FlipWhizz is and where to look.
// Prices are read from src/lib/pricing.ts so this never contradicts the site.

import { formatPrice, getPriceCents, type CurrencyCode } from "@/lib/pricing";
import { GIFT_PAGES } from "@/content/giftPages";

export const dynamic = "force-static";

function priceLine(currency: CurrencyCode) {
  const p = (product: "digital" | "print" | "gift", bookType?: string) =>
    formatPrice(getPriceCents(product, currency, bookType), currency);
  return `${currency}: digital book ${p("digital")}, printed storybook ${p("print")}, gift edition ${p("gift")}, colouring edition ${p("print", "colouring_storybook")}`;
}

const giftLines = GIFT_PAGES.map((g) => `- ${g.footerLabel}: https://flipwhizz.com/gifts/${g.slug}`).join("\n");

const body = `# FlipWhizz

> FlipWhizz helps any adult who loves a child (parents, grandparents, aunts,
> uncles, godparents) write a personalised, illustrated children's book about
> that child. You chat about them, a memory, a joke or an idea, and FlipWhizz
> helps you shape the story and illustrates every page. The adult is the author.
> It is not a name-swap template. Built by Katy, an educator with 20 years
> working with children across schools, early years, ESL and outdoor education.

## What FlipWhizz makes
- Original, illustrated children's storybooks made for one child, for ages roughly 2 to 10
- Stories from family memories, real-life moments (new sibling, starting school, missing someone) or a child's imagination
- Characters can be drawn from uploaded family photos, pets included
- A colouring edition: outline pictures to colour in, coil-bound

## How it works
1. Chat: answer a few friendly questions about the child. No sign-up needed to start.
2. Shape: see the first illustrated page free, then change anything.
3. Keep: download the digital book, or order a printed book posted to your door.

## Prices (one-off per book, no subscription)
- ${priceLine("GBP")}
- ${priceLine("USD")}
- Prices are also shown in EUR, CAD and AUD by region.
- The first illustrated page is free. No card needed to start.

## Delivery
- Digital books are ready to download as soon as they are finished.
- Printed books are made to order and posted to your door (UK and worldwide). The delivery estimate is shown at order time.

## Who it is for
- Parents making a bedtime book about their child's real life
- Grandparents putting family stories into a keepsake
- Aunts, uncles, godparents and family friends looking for a personal gift

## What makes it different
- The adult is the author. AI helps illustrate and polish; it never talks to the child.
- Built and run by one educator with 20 years working with children, not a faceless product team.
- Every story is original to one child, rather than a template with the name changed.

## Key pages
- Home: https://flipwhizz.com
- Start a story (free, no sign-up): https://flipwhizz.com/projects/create
- How it works: https://flipwhizz.com/#how-it-works
- Example books: https://flipwhizz.com/#gallery
- Pricing: https://flipwhizz.com/#pricing
- Colouring books: https://flipwhizz.com/colouring-books
- About Katy: https://flipwhizz.com/about
- FAQ: https://flipwhizz.com/faq

## Gift guides
${giftLines}

## Contact
- Email: hello@flipwhizz.com
- Instagram: https://www.instagram.com/flipwhizz_kate
`;

export function GET() {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
