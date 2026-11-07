// tests/christmas-page.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { CHRISTMAS } from "../src/lib/christmas";
import {
  CHRISTMAS_DESCRIPTION, CHRISTMAS_TITLE, CHRISTMAS_STORY_HREF,
  CHRISTMAS_PROOF, christmasPageContent,
} from "../src/content/christmas";
import { buildStarterConversation } from "../src/lib/chatStarter";

test("Christmas CTA seeds the existing story chat", () => {
  const url = new URL(CHRISTMAS_STORY_HREF, "https://flipwhizz.com");
  assert.equal(url.pathname, "/projects/create");
  const conversation = buildStarterConversation({ occasion: url.searchParams.get("occasion") });
  assert.equal(conversation?.answer, "It's a Christmas present.");
  assert.equal(url.searchParams.get("entry"), "christmas_hero");
});

test("SEO title, description and empty proof have safe defaults", () => {
  assert.equal(CHRISTMAS_TITLE, "Personalised Christmas Book for Kids | FlipWhizz");
  assert.ok(CHRISTMAS_DESCRIPTION.length < 160);
  assert.deepEqual(CHRISTMAS_PROOF, []);
});

test("FAQ structured data exactly matches visible questions and answers", () => {
  const { faqs, faqJsonLd } = christmasPageContent(new Date("2026-11-07T12:00:00Z"));
  assert.equal(faqs.length, 5);
  assert.equal(faqJsonLd["@type"], "FAQPage");
  for (let i = 0; i < faqs.length; i++) {
    assert.equal(faqJsonLd.mainEntity[i].name, faqs[i].question);
    assert.equal(faqJsonLd.mainEntity[i].acceptedAnswer.text, faqs[i].answer);
  }
});

test("delivery distinguishes the earlier colouring deadline from storybooks", () => {
  const { delivery, heroDeadline } = christmasPageContent(new Date("2026-12-09T12:00:00Z"));
  assert.match(delivery[0].status, /^Order by/);
  assert.match(delivery[1].status, /cut-off passed/);
  assert.match(heroDeadline, /12 December/);
  const late = christmasPageContent(new Date(CHRISTMAS.printCutoff));
  assert.match(late.heroDeadline, /digital edition/);
  assert.match(late.faqs[0].answer, /should not be expected before Christmas/);
});

test("changing central dates updates page copy, delivery and FAQ markup", () => {
  const original = { ...CHRISTMAS };
  try {
    CHRISTMAS.printCutoff = "2026-12-14T23:59:00Z";
    CHRISTMAS.colouringCutoff = "2026-12-10T23:59:00Z";
    const content = christmasPageContent(new Date("2026-11-07T12:00:00Z"));
    assert.match(content.heroDeadline, /14 December/);
    assert.equal(content.delivery[1].deadline, "10 December");
    assert.match(content.faqJsonLd.mainEntity[0].acceptedAnswer.text, /14 December.*10 December/);
    assert.doesNotMatch(JSON.stringify(content), /—/);
  } finally { Object.assign(CHRISTMAS, original); }
});
