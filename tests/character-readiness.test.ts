import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasPortrait, isAppearanceApproved, isCastReady } from '../src/lib/characters/readiness';

test('text confirmation and old locks cannot substitute for a portrait', () => {
  assert.equal(isCastReady([{ locked: true, portraitImageUrl: null }]), false);
  assert.equal(isCastReady([]), false);
});
test('uploaded photo alone is not an approved generated appearance', () => {
  const character = { locked: true, referenceImageUrl: 'https://images.test/photo.jpg', portraitImageUrl: null };
  assert.equal(hasPortrait(character), false);
  assert.equal(isAppearanceApproved(character), false);
});
test('every generated appearance requires explicit approval', () => {
  const approved = { locked: true, portraitImageUrl: 'https://images.test/portrait.jpg' };
  assert.equal(isCastReady([approved, { ...approved, locked: false }]), false);
  assert.equal(isCastReady([approved, approved]), true);
});
test('unusable portrait values do not pass readiness', () => {
  for (const portraitImageUrl of ['', '  ', 'data:image/png;base64,abc', 'blob:local']) {
    assert.equal(isAppearanceApproved({ locked: true, portraitImageUrl }), false);
  }
});
