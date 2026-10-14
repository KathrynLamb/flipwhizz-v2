/** Reference images show the same line-art treatment as colouring interiors. */
export const COLOURING_REFERENCE_STYLE = `COLOURING BOOK REFERENCE — mandatory output treatment:
Draw crisp black closed outlines on pure white. Leave all colourable shapes white.
No colour, grey fills, shading, shadows, gradients, cross-hatching, painted texture or large black fills.
Preserve identity, facial proportions, hairstyle, clothing shapes, markings and location architecture through outlines only.
Colours mentioned in descriptions or visible in photos identify features; do not render those colours.
Use generous, uncluttered spaces suitable for children to colour. No text, labels or watermarks.
These rules override any conflicting colour, lighting, texture or painting instructions in descriptions and references.`;

export function referenceStyleForBook(bookType: unknown, original: { styleBlock: string; avoidBlock: string }) {
  if (bookType !== 'colouring_storybook') return original;
  return {
    styleBlock: COLOURING_REFERENCE_STYLE,
    avoidBlock: 'colour, grey fills, shading, shadows, gradients, cross-hatching, painted texture, large black fills, text, logos, watermarks, photorealism, 3D render',
  };
}

export function referencePromptForBook(bookType: unknown, prompt: string): string {
  return bookType === 'colouring_storybook' ? `${prompt}\n\n${COLOURING_REFERENCE_STYLE}` : prompt;
}
