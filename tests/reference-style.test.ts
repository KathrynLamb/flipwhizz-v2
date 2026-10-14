import test from 'node:test';
import assert from 'node:assert/strict';
import { referenceStyleForBook, referencePromptForBook, COLOURING_REFERENCE_STYLE } from '../src/lib/books/referenceStyle';

test('colouring references replace conflicting painted style and palette instructions', () => {
  const result = referenceStyleForBook('colouring_storybook', { styleBlock: 'Soft painted watercolour. Red and blue palette.', avoidBlock: 'black outlines, white backgrounds' });
  assert.equal(result.styleBlock, COLOURING_REFERENCE_STYLE);
  assert.doesNotMatch(result.styleBlock, /watercolour|Red and blue/);
  assert.match(result.avoidBlock, /colour, grey fills, shading/);
  assert.doesNotMatch(result.avoidBlock, /black outlines|white backgrounds/);
});
test('photo and fallback prompts retain identity but finish with mandatory outline treatment', () => {
  for (const description of ['Photo reference: preserve curly red hair and blue coat.', 'Text-only fallback: cottage with red roof.']) {
    const prompt = referencePromptForBook('colouring_storybook', description);
    assert.ok(prompt.startsWith(description));
    assert.ok(prompt.endsWith(COLOURING_REFERENCE_STYLE));
    assert.match(prompt, /do not render those colours/);
  }
});
test('normal and legacy storybooks preserve their existing rendering', () => {
  const original = { styleBlock: 'Painted watercolour', avoidBlock: 'harsh outlines' };
  for (const type of ['storybook', null, undefined]) {
    assert.deepEqual(referenceStyleForBook(type, original), original);
    assert.equal(referencePromptForBook(type, 'Original prompt'), 'Original prompt');
  }
});
