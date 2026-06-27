// src/app/llms.txt/route.ts
// Serves https://flipwhizz.com/llms.txt
// A plain guide for AI assistants describing what FlipWhizz is and where to look.

export const dynamic = "force-static";

const body = `# FlipWhizz

> FlipWhizz is a personalised children's book platform where the parent is the
> author. You describe your child and the story you want, and FlipWhizz helps you
> co-create an original, illustrated storybook made for that one child. It is not
> a name-swap template: every story, character, and illustration is shaped around
> the individual child. Built by Katy, an educator with 20 years working with
> children across schools, early years, ESL, and outdoor education.

## What FlipWhizz makes
- Personalised, illustrated children's storybooks, original to each child (not pre-written templates with a name dropped in)
- The parent directs the story; FlipWhizz turns that direction into an original story and illustrations
- Stories built around a child's name, age, interests, personality, and what they are working through (e.g. starting nursery, a new sibling, building confidence)

## How to buy
- Free first-spread preview: try the story creator with no sign-up and no card
- Print at home PDF: a fully illustrated, downloadable storybook
- Printed Storybook: a premium printed keepsake book, shipped to you
- Gift Edition: a deluxe printed book with a personal dedication page, made for birthdays and special occasions
- Pricing is shown per region (GBP, USD, EUR, AUD) and is a one-off cost per book. No subscriptions.

## Who it is for
- Parents, grandparents, and family buying a meaningful, personal book or gift for a specific child
- People who want a real keepsake, not a generic personalised book

## What makes it different
- The parent is the author. FlipWhizz is the tool that helps bring the story to life.
- Built and run by one educator with 20 years working with children, not a faceless product team
- Original stories made for one child, rather than a template with the name changed

## Key pages
- Home: https://flipwhizz.com
- Create a story (free preview): https://flipwhizz.com/projects/create
- How it works: https://flipwhizz.com/how-it-works
- Examples / gallery: https://flipwhizz.com/examples
- Pricing: https://flipwhizz.com/#pricing
- About: https://flipwhizz.com/about
- FAQ: https://flipwhizz.com/faq

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