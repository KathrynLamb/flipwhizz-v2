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
    assert.match(prompt, /Photo reference|Text-only fallback/);
    assert.doesNotMatch(prompt, /blue coat/);
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


test('colouring wardrobe descriptions contain shapes, not colour instructions', () => {
  const original = 'CHARACTER NAME:\nRose Brown\nCOAT / OUTFIT:\nA bright red striped shirt, navy-blue trousers and gold boots. A scarf in pink.\nSTYLE:\nLine art';
  const prompt = referencePromptForBook('colouring_storybook', original);
  assert.match(prompt, /Rose Brown/);
  assert.match(prompt, /striped shirt/);
  assert.match(prompt, /trousers/);
  assert.doesNotMatch(prompt, /bright red|navy|blue|gold boots|in pink/);
  assert.equal(referencePromptForBook('storybook', original), original);
});
test('reference artwork excludes physical pages and book mockups', () => {
  const prompt = referencePromptForBook('colouring_storybook', 'A rabbit');
  assert.match(prompt, /never a photograph or mockup/);
  assert.match(prompt, /Do not draw a sheet of paper, page edges, an open book/);
});
test('animal and photo colour locks cannot override outline rendering', () => {
  const prompt = referencePromptForBook('colouring_storybook', '- COAT COLOUR: reproduce EXACTLY BLACK fur\n- Preserve EXACT eye color from the photo\n- Preserve eye size, spacing, and facial proportions');
  assert.doesNotMatch(prompt, /reproduce EXACTLY|Preserve EXACT eye color/);
  assert.match(prompt, /Preserve eye size/);
  assert.ok(prompt.endsWith(COLOURING_REFERENCE_STYLE));
});
