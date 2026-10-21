// src/lib/chatStarter.ts
//
// Shared vocabulary for the homepage chat starter and the create-page hand-off.
//
// A visitor answers the first question ("Who's this story for?") on the
// homepage or a gift page. We send them to /projects/create with that answer in
// the URL. The create page then shows the conversation as if it had already
// started: the opener, their answer, and a tailored follow-up question.
//
// The pre-sent answer is built client-side, costs nothing, and does NOT count
// toward the 3 free demo messages (it never reaches /api/chat/demo on its own;
// it only travels as context in the history of their first real message).

export type RecipientKey = "son" | "daughter" | "grandchild" | "niece-nephew" | "other";
export type OccasionKey =
  | "birthday"
  | "new-sibling"
  | "starting-school"
  | "christmas"
  | "christening"
  | "missing-someone";
export type AboutKey = "memory" | "change" | "imagination" | "bedtime" | "everyday";

export const STARTER_OPENER = "Hi! What would you like to make a story about?";

export const RECIPIENTS: { key: RecipientKey; label: string; answer: string; followUp: string }[] = [
  {
    key: "son",
    label: "My son",
    answer: "It's for my son.",
    followUp: "Lovely. What's his name, how old is he, and what is he into right now?",
  },
  {
    key: "daughter",
    label: "My daughter",
    answer: "It's for my daughter.",
    followUp: "Lovely. What's her name, how old is she, and what is she into right now?",
  },
  {
    key: "grandchild",
    label: "My grandchild",
    answer: "It's for my grandchild.",
    followUp:
      "How special. What's their name and how old are they? And is there a family memory you'd love them to have in a book, like something from your own childhood?",
  },
  {
    key: "niece-nephew",
    label: "My niece or nephew",
    answer: "It's for my niece or nephew.",
    followUp:
      "What a thoughtful gift. What's their name, roughly how old are they, and what do you know they love? Even one or two things is plenty.",
  },
  {
    key: "other",
    label: "Someone else",
    answer: "It's for a child I love.",
    followUp: "Wonderful. Who's the lucky child? Tell me their name, roughly how old they are, and how you know them.",
  },
];

export const OCCASIONS: { key: OccasionKey; label: string; answer: string; followUp: string }[] = [
  { key: "birthday", label: "Birthday", answer: "It's a birthday present.", followUp: "A birthday book, perfect." },
  { key: "new-sibling", label: "New sibling", answer: "There's a new baby coming in the family.", followUp: "A new sibling is such a big change, and a story can really help." },
  { key: "starting-school", label: "Starting school", answer: "They're starting school soon.", followUp: "Starting school is a huge step, let's make them feel brave about it." },
  { key: "christmas", label: "Christmas", answer: "It's a Christmas present.", followUp: "A Christmas book, lovely." },
  { key: "christening", label: "Christening", answer: "It's a christening gift.", followUp: "A christening book to keep, how lovely." },
  { key: "missing-someone", label: "Missing someone", answer: "They're missing someone special.", followUp: "Stories are a gentle way to keep someone close." },
];

export const ABOUTS: { key: AboutKey; label: string; answer: string; followUp: string }[] = [
  { key: "everyday", label: "A small discovery", answer: "I'd like to make a story from something I noticed in everyday life.", followUp: "What caught your attention? Tell me what you saw and we can imagine a story around it." },
  {
    key: "memory",
    label: "A family memory",
    answer: "I'd like it to be about a family memory.",
    followUp: "Family memories make the best books. Who is the story for, and what's the memory? Even a rough version is fine.",
  },
  {
    key: "change",
    label: "A big change",
    answer: "I'd like it to help with a big change.",
    followUp: "Stories are brilliant for big changes. Who is it for, and what's coming up for them?",
  },
  {
    key: "imagination",
    label: "Something imagined",
    answer: "I'd like to make up an imaginary story.",
    followUp: "Tell me about the world or characters you have in mind. A tiny idea is enough to start.",
  },
  {
    key: "bedtime",
    label: "A bedtime story",
    answer: "I'd like a calm bedtime story.",
    followUp: "A bedtime story it is. Who is it for, and what helps them settle at night?",
  },
];

export type StarterParams = {
  for?: string | null;
  name?: string | null;
  occasion?: string | null;
  about?: string | null;
};

/** Keep a typed name to something that looks like a first name. */
export function cleanName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[^\p{L}\p{M}\s'.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Turn starter URL params into the conversation the visitor should land in.
 * Returns null when there is nothing to pre-send.
 */
export function buildStarterConversation(params: StarterParams): { answer: string; followUp: string } | null {
  const recipient = RECIPIENTS.find((r) => r.key === params.for);
  const occasion = OCCASIONS.find((o) => o.key === params.occasion);
  const about = ABOUTS.find((a) => a.key === params.about);
  const name = cleanName(params.name);

  const answerParts: string[] = [];
  let followUp: string | null = null;

  if (name) {
    answerParts.push(`It's for ${name}.`);
    followUp = `Lovely, a story for ${name}! How old are they, and what do they love right now? Any little detail helps.`;
  } else if (recipient) {
    answerParts.push(recipient.answer);
    followUp = recipient.followUp;
  }

  if (about) {
    answerParts.push(about.answer);
    // When we already know who it's for, keep the recipient follow-up but lead with the theme.
    followUp = followUp ? `${about.followUp.split(".")[0]}. ${followUp}` : about.followUp;
  }

  if (occasion) {
    answerParts.push(occasion.answer);
    followUp = followUp
      ? `${occasion.followUp} ${followUp}`
      : `${occasion.followUp} Who is the story for? Tell me their name, roughly how old they are, and what they love.`;
  }

  if (answerParts.length === 0 || !followUp) return null;
  return { answer: answerParts.join(" "), followUp };
}

/** Build the create-page URL for a starter answer. */
export function starterHref(params: StarterParams & { entry?: string; bookType?: string }): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `/projects/create?${qs}` : "/projects/create";
}
