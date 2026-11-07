// src/content/christmas.ts
import {
  CHRISTMAS, christmasPhase, formatChristmasDate,
  isBeforePrintCutoff, isBeforeColouringCutoff,
} from "../lib/christmas";
import { starterHref } from "../lib/chatStarter";

export const CHRISTMAS_TITLE = "Personalised Christmas Book for Kids | FlipWhizz";
export const CHRISTMAS_DESCRIPTION = "Write a personalised Christmas book starring your child. Shape the story, add familiar faces and choose a printed or digital edition with FlipWhizz.";
export const CHRISTMAS_STORY_HREF = starterHref({ occasion: "christmas", entry: "christmas_hero" });

// Add only approved customer quotes or photos. An empty array hides the section.
// Photos should be optimised files in public/, with a descriptive alt and dimensions.
export type ChristmasProof =
  | { kind: "quote"; quote: string; name: string; disclosure?: string }
  | { kind: "photo"; src: string; alt: string; width: number; height: number; caption: string };
export const CHRISTMAS_PROOF: ChristmasProof[] = [];

export function christmasPageContent(now: Date = new Date()) {
  const printDate = formatChristmasDate(CHRISTMAS.printCutoff);
  const colouringDate = formatChristmasDate(CHRISTMAS.colouringCutoff);
  const phase = christmasPhase(now);
  const printOpen = isBeforePrintCutoff(now);
  const colouringOpen = isBeforeColouringCutoff(now);
  const delivery = [
    {
      product: "Printed storybook",
      deadline: printDate,
      dateTime: CHRISTMAS.printCutoff,
      status: printOpen ? "Order by this date for Christmas delivery." : "Christmas cut-off passed. You can still order for delivery later.",
    },
    {
      product: "Colouring storybook",
      deadline: colouringDate,
      dateTime: CHRISTMAS.colouringCutoff,
      status: colouringOpen ? "Allow extra time for printing and post." : "Christmas cut-off passed. Choose a digital edition to print at home.",
    },
    {
      product: "Digital edition",
      deadline: "No postal deadline",
      dateTime: null,
      status: "Download once your book is finished. Allow time to write, illustrate and review it.",
    },
  ];
  const faqs = [
    {
      question: "Will it arrive by Christmas?",
      answer: printOpen
        ? `Order your printed storybook by ${printDate}, or your printed colouring storybook by ${colouringDate}. Check the delivery estimate for your destination before ordering, and allow time to finish and approve your book. These dates are our Christmas ordering guide, not a delivery guarantee.`
        : `The Christmas print cut-off of ${printDate} has passed. Printed books can still be ordered, but should not be expected before Christmas. Choose a digital edition if you need a book without waiting for the post.`,
    },
    {
      question: "Can I see it before it prints?",
      answer: "Yes. You shape and review the story, characters and illustration style, then review the finished book before sending it to print. You are the author, so make sure the words and pictures feel right to you.",
    },
    {
      question: "Can grandparents order for a grandchild?",
      answer: "Absolutely. Start with your grandchild's name, age and a few things they love. Add family memories, familiar faces and a message from Grandma or Grandad. You can write the whole book yourself and keep it a surprise.",
    },
    {
      question: "What if I miss the deadline?",
      answer: `After ${printDate} for storybooks or ${colouringDate} for colouring books, choose a digital edition. It is ready to download once the book is finished, so there is no postal wait. Gift cards are coming soon and are not available to buy yet.`,
    },
    {
      question: "How long does it take to make?",
      answer: "You can start with a few sentences. The time to finish depends on your story, the changes you make and illustration generation. Leave time to review the finished book, especially near Christmas. Buying a digital edition does not mean the book is already finished.",
    },
  ];
  return {
    phase, printDate, colouringDate, delivery, faqs,
    heroDeadline: phase === "over"
      ? "Keep making stories together, all year round."
      : printOpen
        ? `Order by ${printDate} for Christmas delivery.`
        : "Missed the post? Make a digital edition for Christmas Eve.",
    faqJsonLd: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  };
}
