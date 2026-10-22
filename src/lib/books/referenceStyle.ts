/** Reference images show the same line-art treatment as colouring interiors. */
export const COLOURING_REFERENCE_STYLE = `BLACK LINE-ART REFERENCE — mandatory output treatment:
Draw crisp black closed outlines on pure white. Leave all colourable shapes white.
No colour, grey fills, shading, shadows, gradients, cross-hatching, painted texture or large black fills.
Preserve identity, facial proportions, hairstyle, clothing shapes, markings and location architecture through outlines only.
Colours mentioned in descriptions or visible in photos identify features; do not render those colours.
Use generous, uncluttered spaces suitable for children to colour. No text, labels or watermarks.
Draw the subject itself directly against an uninterrupted white background. This is the actual artwork, never a photograph or mockup of artwork.
Do not draw a sheet of paper, page edges, an open book, binding, spiral rings, a frame, border, desk, hands holding artwork, or a picture within a picture.
These rules override any conflicting colour, lighting, texture or painting instructions in descriptions and references.`;

export function referenceStyleForBook(bookType: unknown, original: { styleBlock: string; avoidBlock: string }) {
  if (bookType !== 'colouring_storybook') return original;
  return {
    styleBlock: COLOURING_REFERENCE_STYLE,
    avoidBlock: 'colour, grey fills, shading, shadows, gradients, cross-hatching, painted texture, large black fills, text, logos, watermarks, photorealism, 3D render',
  };
}

/** Keep saved descriptions intact for full-colour covers. Only neutralise the
 * disposable reference-generation prompt. Outfit colour requests must not reach
 * the image model: a later "no colour" instruction is not sufficient. */
const COLOURS = /\b(?:(?:light|dark|pale|bright|deep|royal|sky|baby|hot|forest)[ -]+)?(?:navy|olive|mint|emerald|burgundy|maroon|scarlet|crimson|teal|turquoise|lavender|violet|magenta|pink|purple|red|blue|green|yellow|orange|brown|beige|cream|ivory|golden|gold|silver|grey|gray|black|white|multicolou?red|rainbow)\b/gi;
const GARMENT = /\b(?:t-?shirts?|dresses|dress|trousers|pants|shorts|skirts?|coats?|jackets?|jumpers?|sweaters?|hoodies?|hats?|caps?|scarves|scarf|boots?|shoes?|socks?|pyjamas|pajamas|overalls|dungarees|outfits?|clothing|uniforms?|suits?|capes?|vests?|tunics?|tops?|bows?|ribbons?|gloves|mittens|leggings|waistcoats?|trainers|sneakers|sandals|aprons?|belts?)\b/i;

export function outlineReferenceText(prompt: string): string {
  // Never run this over the mandatory art rules: black lines / white fills are
  // rendering instructions, not wardrobe colours.
  const [description, ...rules] = prompt.split(COLOURING_REFERENCE_STYLE);
  const neutral = description
    .replace(/^.*(?:preserve EXACT eye color|do NOT change hair color|coat colour is non-negotiable|COAT COLOUR:|coat colour must match|A golden retriever is NOT|A brown dog is NOT|Match:.*(?:colour|color)|Soft, hand-painted).*$/gim, '')
    // Work on clauses, not the complete prompt, preserving names and identity in
    // separate fields. Handles both "red shirt" and "shirt in red".
    .split(/([\n.;])/)
    .map(clause => GARMENT.test(clause) ? clause.replace(COLOURS, '').replace(/(^|\s)-(?=\s|$)/g, '$1').replace(/[ \t]{2,}/g, ' ') : clause)
    .join('')
    .replace(/(\b(?:colour|color)(?:s)?\s*[:=])[^\n;]+/gi, '$1 unspecified');
  return rules.length ? [neutral, ...rules].join(COLOURING_REFERENCE_STYLE) : neutral;
}

export function referencePromptForBook(bookType: unknown, prompt: string): string {
  return bookType === 'colouring_storybook' ? `${outlineReferenceText(prompt)}\n\n${COLOURING_REFERENCE_STYLE}` : prompt;
}
