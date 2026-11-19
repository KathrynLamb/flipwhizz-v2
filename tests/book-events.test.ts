// tests/book-events.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderEventEmail, stallStage, stallSummary, type BookProgress } from "../src/lib/events/bookEventsCore";

const base: BookProgress = {
  paid: false,
  characters: 3,
  charactersWithCard: 3,
  charactersApproved: 3,
  places: 2,
  placesWithCard: 2,
  placesApproved: 2,
  pagesDrawn: 0,
};

test("a book like Sifin's (1 of 3 cards) is stuck making character cards", () => {
  const p = { ...base, charactersWithCard: 1, charactersApproved: 0 };
  assert.equal(stallStage(p), "character_cards");
  assert.match(stallSummary(p, "character_cards", 25), /1 of 3 cards made/);
});

test("cards made but not approved is a different stage", () => {
  assert.equal(stallStage({ ...base, charactersApproved: 2 }), "character_approval");
});

test("places are checked after characters", () => {
  assert.equal(stallStage({ ...base, placesWithCard: 1, placesApproved: 0 }), "place_cards");
  assert.equal(stallStage({ ...base, placesApproved: 1 }), "place_approval");
});

test("everything approved but nothing drawn", () => {
  assert.equal(stallStage(base), "before_first_page");
});

test("no characters yet", () => {
  assert.equal(stallStage({ ...base, characters: 0, charactersWithCard: 0, charactersApproved: 0 }), "before_characters");
});

test("a drawn page means the paywall, not a stall; paid books are never stalled", () => {
  assert.equal(stallStage({ ...base, pagesDrawn: 2 }), null);
  assert.equal(stallStage({ ...base, paid: true, charactersWithCard: 0 }), null);
});

test("the email shows the customer, admin links and the cost so far", () => {
  const mail = renderEventEmail({
    kind: "draft_created",
    summary: 'Story draft written: "Before You Came" (28 pages)',
    site: "https://flipwhizz.com",
    storyTitle: "Before You Came",
    ownerEmail: "parent@example.com",
    userId: "u1",
    storyId: "s1",
    costs: [
      { kind: "writing", calls: 5, microUsd: 60_000 },
      { kind: "planning", calls: 2, microUsd: 130_000 },
    ],
    details: { reader: "Little One", pages: 28 },
    history: [{ kind: "chat_started", summary: "Started a chat", createdAt: "2026-11-19T04:37:11.000Z" }],
    usdToGbp: 0.77,
  });
  assert.match(mail.subject, /^Story draft created: "Before You Came" · parent@example\.com · /);
  assert.match(mail.text, /Admin \(book\): https:\/\/flipwhizz\.com\/admin\/books\/s1/);
  assert.match(mail.text, /Scene planning and prompts: 2 calls/);
  assert.match(mail.text, /TOTAL: 14\.6p \(\$0\.19\)/);
  assert.match(mail.text, /Chat started: Started a chat/);
  assert.match(mail.html, /<table/);
});

test("an anonymous demo chat says so and has no cost table", () => {
  const mail = renderEventEmail({
    kind: "chat_started",
    summary: 'Started a chat before signing up: "a <b>dragon</b>"',
    site: "https://flipwhizz.com",
    costs: [],
    usdToGbp: 0.77,
  });
  assert.match(mail.subject, /anonymous visitor/);
  assert.match(mail.text, /not signed in yet/);
  assert.match(mail.text, /nothing tracked yet/);
  assert.ok(!mail.html.includes("<b>dragon"), "customer text is escaped in the html");
});

test("problems get a red marker in the subject", () => {
  const mail = renderEventEmail({ kind: "stalled", summary: "stuck", site: "x", costs: [], usdToGbp: 1 });
  assert.match(mail.subject, /^🔴 Stalled/);
});
