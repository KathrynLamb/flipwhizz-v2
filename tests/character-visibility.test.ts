// tests/character-visibility.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCastReady, isShown } from "../src/lib/characters/readiness";
import { charactersToAutoHide, presenceCast, withoutCharacter } from "../src/lib/characters/visibilityRules";

const approved = { locked: true, portraitImageUrl: "https://images.test/card.jpg" };
const noCard = { locked: false, portraitImageUrl: null };

test("Sifin's case: a not-shown unborn baby no longer blocks the characters step", () => {
  const mama = { ...approved };
  const baba = { ...approved };
  const littleOne = { ...noCard, shown: false };
  assert.equal(isCastReady([mama, baba, littleOne]), true);
});

test("shown characters still all need an approved card", () => {
  assert.equal(isCastReady([approved, { ...noCard, shown: true }]), false);
  assert.equal(isCastReady([approved, noCard]), false, "unset counts as shown (locations and old rows)");
});

test("a cast where nobody is drawn is not ready", () => {
  assert.equal(isCastReady([{ ...noCard, shown: false }]), false);
  assert.equal(isCastReady([]), false);
});

test("isShown: only an explicit false hides", () => {
  assert.equal(isShown({ locked: false }), true);
  assert.equal(isShown({ locked: false, shown: null }), true);
  assert.equal(isShown({ locked: false, shown: false }), false);
});

test("the planner auto-hides only characters on no spread that nobody decided about", () => {
  const cast = [
    { characterId: "mama", shown: true, shownSource: null },
    { characterId: "baby", shown: true, shownSource: null },
    { characterId: "grandad", shown: true, shownSource: "customer" }, // asked for: never auto-hidden
    { characterId: "dog", shown: true, shownSource: "admin" },
    { characterId: "ghost", shown: false, shownSource: "auto" }, // already hidden
  ];
  assert.deepEqual(charactersToAutoHide(cast, new Set(["mama"])), ["baby"]);
});

test("hiding takes a character off a spread's planned cast and keeps the rest", () => {
  const cast = [
    { characterId: "mama", role: "primary" },
    { characterId: "baby", role: "background" },
  ];
  assert.deepEqual(withoutCharacter(cast, "baby"), [{ characterId: "mama", role: "primary" }]);
  assert.deepEqual(withoutCharacter(null, "baby"), []);
});

test("odd stored casts (JSON null, a JSON string) never throw", () => {
  assert.deepEqual(presenceCast(null), []);
  assert.deepEqual(presenceCast("null"), []);
  assert.deepEqual(presenceCast('[{"characterId":"mama","role":"primary"}]'), [{ characterId: "mama", role: "primary" }]);
  assert.deepEqual(presenceCast({ characterId: "x" }), []);
  assert.deepEqual(presenceCast([{ characterId: "a" }, null, 5]), [{ characterId: "a" }]);
});

test("an empty plan hides nobody", () => {
  const cast = [{ characterId: "logan", shown: true, shownSource: null }];
  assert.deepEqual(charactersToAutoHide(cast, new Set()), []);
});
