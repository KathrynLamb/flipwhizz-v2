// tests/lettering-punctuation.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeLettering, pagePassage, quoteMarks, type TextBlock } from "../src/lib/illustrate/geometry";

const left = (text: string): TextBlock => ({ box_2d: [50, 50, 200, 450], text });
const right = (text: string): TextBlock => ({ box_2d: [50, 550, 200, 950], text });

test("quoteMarks keeps quote marks and skips apostrophes inside words", () => {
  assert.equal(quoteMarks("'I need helpers,' said Grandy. 'Who'll fix it with me?'"), "''''");
  assert.equal(quoteMarks("It wouldn't go forward."), "");
  assert.equal(quoteMarks("“Good job, Oakley!” Grandy said."), '""');
  // Curly and straight count the same
  assert.equal(quoteMarks("‘Me! Me! Me!’"), quoteMarks("'Me! Me! Me!'"));
});

// Real pages from "Grandy's Green Tractor"
test("a stray closing quote mark fails (page 2: 'Me! Me! Me!'\")", () => {
  const story = "'I need helpers,' said Grandy. 'Who'll fix it with me?' Oakley jumped up. 'Me! Me! Me!'";
  const lettered = "‘I need helpers,’ said Grandy. ‘Who’ll fix it with me?’ Oakley jumped up. ‘Me! Me! Me!’”";
  const v = judgeLettering([right(lettered)], "", story);
  assert.equal(v.ok, false);
  assert.match(v.problems.join(" "), /quote marks/);
});

test("mismatched single/double pair fails (page 22)", () => {
  const story = 'Grandy sat in the middle with a boy on each side. "Hold on tight, my helpers. It\'s time for our ride!"';
  const lettered = "Grandy sat in the middle with a boy on each side. ‘Hold on tight, my helpers. It’s time for our ride!”";
  const v = judgeLettering([right(lettered)], "", story);
  assert.equal(v.ok, false);
  assert.match(v.problems.join(" "), /Right page quote marks/);
});

test("curly lettering of straight story quotes passes", () => {
  const story = "'We need petrol!' said Oakley, pointing at the can.";
  const lettered = "‘We need petrol!’ said Oakley, pointing at the can.";
  const v = judgeLettering([left(lettered)], story, "");
  assert.equal(v.ok, true, v.problems.join("; "));
});

test("wrong words are reported as words, not quote marks", () => {
  const v = judgeLettering([left("Something else entirely was lettered here")], "'We need petrol!' said Oakley, pointing at the can.", "");
  assert.equal(v.ok, false);
  assert.doesNotMatch(v.problems.join(" "), /quote marks/);
});

test("pagePassage never wraps text in quote marks", () => {
  const p = pagePassage("'Me! Me! Me!'");
  assert.ok(p.includes("\n'Me! Me! Me!'\n"));
  assert.ok(!p.includes(`"'Me`));
  assert.equal(pagePassage("  "), "(no text on this page)");
});
