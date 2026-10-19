// src/content/giftPages.ts
// Content for the /gifts/[slug] landing pages. One template renders them all.
// Each page owns one search phrase in its title and H1, links into the chat
// with its occasion already set, and has a short FAQ (also used for FAQPage
// JSON-LD). Copy avoids em dashes by choice.

import type { Faq } from "./homeFaqs";
import type { OccasionKey } from "@/lib/chatStarter";

export type GiftPage = {
  slug: string;
  /** Label on the homepage Occasions row. */
  occasionLabel: string;
  /** Label in the footer's Gift ideas list. */
  footerLabel: string;
  showInOccasions: boolean;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  /** Passed to the chat so the first answer carries the occasion. */
  occasion?: OccasionKey;
  starterQuestion: string;
  ideasTitle: string;
  ideas: string[];
  /** An example of how a story could start. Illustrative, not a customer quote. */
  examplePrompt: string;
  faqs: Faq[];
};

const SHARED_PRINT_FAQ: Faq = {
  question: "How long does a printed book take to arrive?",
  answer:
    "Printed books are made to order and posted to your door. You'll see the delivery estimate when you order. If you're up against a date, the digital book is ready to download as soon as it's finished, so you can give it on the day and post the printed copy after.",
};

export const GIFT_PAGES: GiftPage[] = [
  {
    slug: "grandchildren",
    occasionLabel: "For a grandchild",
    footerLabel: "For grandchildren",
    showInOccasions: false,
    metaTitle: "Personalised Books for Grandchildren | FlipWhizz",
    metaDescription:
      "Put your family stories into a personalised illustrated book for your grandchild. Just chat, we'll help with the rest. Free first page, no sign-up to start.",
    h1: "Personalised books for grandchildren, full of your family stories",
    intro:
      "The tales you tell at the kitchen table deserve a book. Tell us about your grandchild and a memory you'd love them to keep, and we'll help you turn it into an illustrated story they can read again and again.",
    starterQuestion: "Hi! Who's this story for?",
    ideasTitle: "Stories grandparents love to make",
    ideas: [
      "Your own childhood, with your grandchild along for the adventure",
      "The day they were born, told from your side",
      "A remembered grandparent or great-grandparent, so they know them too",
      "The family dog, the allotment, the caravan holidays",
      "A bedtime story set at your house, for sleepovers",
    ],
    examplePrompt: "Grandad used to cycle to school with his dog in the basket.",
    faqs: [
      {
        question: "I'm not very good with technology. Is it hard?",
        answer:
          "If you can send a text message, you can make a FlipWhizz book. It's a chat: we ask a question, you answer in your own words, and we do the rest. You can stop and come back whenever you like.",
      },
      {
        question: "Can I put real family members in it?",
        answer:
          "Yes. Grandparents, parents, cousins and pets can all be characters, and you can upload photos so they look like themselves.",
      },
      SHARED_PRINT_FAQ,
    ],
  },
  {
    slug: "from-aunt-and-uncle",
    occasionLabel: "From an aunt or uncle",
    footerLabel: "From an aunt or uncle",
    showInOccasions: false,
    metaTitle: "Personalised Book Gifts from an Aunt or Uncle | FlipWhizz",
    metaDescription:
      "The gift no one else could give: a personalised illustrated book for your niece or nephew. Ready to download the same day, or printed and posted.",
    h1: "Personalised book gifts for your niece or nephew",
    intro:
      "Beat another toy with a book starring them. You don't need to know every detail: a name, an age and a couple of things they love is plenty, and you can download it the same day if you're cutting it fine.",
    starterQuestion: "Hi! Who's this story for?",
    ideasTitle: "Ideas that work even if you don't see them every week",
    ideas: [
      "An adventure with their favourite animal or toy",
      "A story about a day out with you",
      "Their big interest right now: dinosaurs, space, football, ballet",
      "A funny story built around a family joke",
    ],
    examplePrompt: "She's six, obsessed with sharks, and refuses to wear matching socks.",
    faqs: [
      {
        question: "What if I don't know much about them?",
        answer:
          "That's fine. We'll ask simple questions and work with whatever you know. A name, an age and one thing they love is enough to make a lovely story.",
      },
      {
        question: "Can I give it on the day if I order late?",
        answer:
          "Yes. The digital book is ready to download as soon as it's finished, so you can share it on the day and order the printed copy as well.",
      },
      SHARED_PRINT_FAQ,
    ],
  },
  {
    slug: "birthday",
    occasionLabel: "Birthday",
    footerLabel: "Birthday books",
    showInOccasions: true,
    metaTitle: "Personalised Birthday Book for Kids | FlipWhizz",
    metaDescription:
      "Make a personalised birthday book starring the birthday child, written by you and illustrated for them. Free first page, no sign-up to start.",
    h1: "A personalised birthday book starring the birthday child",
    intro:
      "Celebrate the year they've had and the adventures ahead. Tell us what they've loved, learned and laughed about this year, and we'll help you make it into a book they'll keep.",
    occasion: "birthday",
    starterQuestion: "Hi! Who's the birthday book for?",
    ideasTitle: "Birthday story ideas",
    ideas: [
      "Their year so far, told as an adventure",
      "A birthday quest to find the perfect party",
      "Turning five (or seven, or ten) and what that unlocks",
      "Everyone they love turning up for the big day",
    ],
    examplePrompt: "He's turning four and wants a digger cake and a party on the moon.",
    faqs: [
      {
        question: "Can I add a birthday message?",
        answer: "Yes. The gift edition adds a personal dedication page for your own message.",
      },
      SHARED_PRINT_FAQ,
    ],
  },
  {
    slug: "new-sibling",
    occasionLabel: "New sibling",
    footerLabel: "New baby sibling books",
    showInOccasions: true,
    metaTitle: "Personalised Big Brother and Big Sister Books | FlipWhizz",
    metaDescription:
      "Help your child get ready for a new baby with a personalised book about becoming a big brother or big sister. Written by you, illustrated for them.",
    h1: "Personalised big brother and big sister books for a new baby",
    intro:
      "A new baby is a huge change for a little one. A story where they're the brave, kind big sibling helps them picture what's coming and feel proud of their new role.",
    occasion: "new-sibling",
    starterQuestion: "Hi! Who's going to be a big brother or sister?",
    ideasTitle: "Story ideas for a new sibling",
    ideas: [
      "Getting the house ready for the baby",
      "Being the baby's helper and best teacher",
      "Big feelings, and how much they're still loved",
      "Meeting the baby for the first time",
    ],
    examplePrompt: "Our daughter is three and a bit worried about sharing her room.",
    faqs: [
      {
        question: "When is the best time to give it?",
        answer:
          "Many families read it in the weeks before the baby arrives so it has time to become familiar, then again once the baby is home.",
      },
      SHARED_PRINT_FAQ,
    ],
  },
  {
    slug: "starting-school",
    occasionLabel: "Starting school",
    footerLabel: "Starting school books",
    showInOccasions: true,
    metaTitle: "Personalised Starting School Book for Children | FlipWhizz",
    metaDescription:
      "Help your child feel brave about starting school or nursery with a personalised story about their first day. Written by you, illustrated for them.",
    h1: "A personalised starting school book to help them feel brave",
    intro:
      "Reading about their own first day, with their own name, uniform and worries, helps children picture school before they get there. Tell us what they're excited and nervous about and we'll shape a story around it.",
    occasion: "starting-school",
    starterQuestion: "Hi! Who's starting school?",
    ideasTitle: "Starting school story ideas",
    ideas: [
      "Their first day, from getting dressed to home time",
      "Saying goodbye at the gate and finding a friend",
      "A brave toy that comes along in their bag",
      "What to do when a big feeling turns up",
    ],
    examplePrompt: "He starts reception in September and worries about where the toilets are.",
    faqs: [
      {
        question: "Is it suitable for nursery as well as school?",
        answer: "Yes. Tell us whether it's nursery, preschool or school and the story is pitched to match.",
      },
      SHARED_PRINT_FAQ,
    ],
  },
  {
    slug: "christmas",
    occasionLabel: "Christmas",
    footerLabel: "Christmas books",
    showInOccasions: true,
    metaTitle: "Personalised Christmas Book for Kids | FlipWhizz",
    metaDescription:
      "Make a personalised Christmas book starring the children you love, with your family traditions in every page. Free first page, no sign-up to start.",
    h1: "A personalised Christmas book full of your family traditions",
    intro:
      "Your Christmas Eve routine, the wonky tree, the dog in a jumper. Put the things that make your family's Christmas yours into a book they'll bring out every year.",
    occasion: "christmas",
    starterQuestion: "Hi! Who's this Christmas story for?",
    ideasTitle: "Christmas story ideas",
    ideas: [
      "A Christmas Eve adventure through your own house",
      "Helping Father Christmas when something goes wrong",
      "Your family traditions, told as magic",
      "A snowy adventure with the whole family",
    ],
    examplePrompt: "Every Christmas Eve we leave a carrot out and the dog always eats it.",
    faqs: [
      {
        question: "When should I order a printed book for Christmas?",
        answer:
          "As early as you can, because printed books are made to order. Check the delivery estimate when you order. If time runs short, the digital book is ready straight away.",
      },
      SHARED_PRINT_FAQ,
    ],
  },
  {
    slug: "christening",
    occasionLabel: "Christening",
    footerLabel: "Christening gifts",
    showInOccasions: true,
    metaTitle: "Personalised Christening Gift Book | FlipWhizz",
    metaDescription:
      "A personalised christening or naming day book they'll keep for years, written by a godparent or family member and illustrated for them.",
    h1: "A personalised christening book to keep for years",
    intro:
      "A christening or naming day gift that grows with them. Write a story about the family they've joined and the people who'll be cheering them on, to read together as they grow.",
    occasion: "christening",
    starterQuestion: "Hi! Who's this christening book for?",
    ideasTitle: "Christening and naming day ideas",
    ideas: [
      "The story of their name",
      "Everyone who welcomed them into the family",
      "A promise from their godparents",
      "A gentle bedtime story about being loved",
    ],
    examplePrompt: "She's named after her great-grandmother, who ran a bakery in Whitby.",
    faqs: [
      {
        question: "Can I write it as a godparent?",
        answer: "Yes. You're the author, so the story can come from you, with a dedication page in the gift edition.",
      },
      SHARED_PRINT_FAQ,
    ],
  },
  {
    slug: "missing-someone",
    occasionLabel: "Missing someone",
    footerLabel: "Missing someone",
    showInOccasions: true,
    metaTitle: "Personalised Book for a Child Missing Someone | FlipWhizz",
    metaDescription:
      "A gentle personalised story to help a child who is missing someone, whether they're far away, working away or no longer here. Written by you, with care.",
    h1: "A gentle personalised book for a child who is missing someone",
    intro:
      "When someone they love is far away, working away or no longer here, a story can keep that person close. You decide what the story says and how, and you see every page before anything is printed.",
    occasion: "missing-someone",
    starterQuestion: "Hi. Who's this story for?",
    ideasTitle: "Stories you could make",
    ideas: [
      "A parent working away, and the countdown to coming home",
      "A grandparent who lives in another country",
      "Remembering someone special, with their favourite things in it",
      "A pet who is no longer here",
    ],
    examplePrompt: "Her dad works on the rigs for three weeks at a time.",
    faqs: [
      {
        question: "Can I make it about someone who has died?",
        answer:
          "Yes. Go at your own pace, share only what feels right, and change any word you like. You see every page before anything is printed.",
      },
      SHARED_PRINT_FAQ,
    ],
  },
];

export function getGiftPage(slug: string): GiftPage | undefined {
  return GIFT_PAGES.find((g) => g.slug === slug);
}
