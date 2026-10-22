# Reference photos and colouring artwork

HEIC and HEIF are required product features for iPhone customers. Both character
and location uploads, desktop and mobile, must call `prepareReferencePhoto` from
`src/lib/heicPreview.ts` before Firebase upload. The group-photo picker shares it.
Keep `.heic` and `.heif` in the file input's accept list: MIME filters alone can
hide these files on desktop. Keep filename and MIME detection, including empty
MIME values. The primary converter is `heic-to`; do not regress to the older
`heic2any` decoder alone. Return actual JPEG bytes with JPEG MIME and filename;
never relabel raw HEIC bytes as JPEG after a conversion failure.

Colouring reference cards depict the subject itself, never a book/page mockup.
`referencePromptForBook` removes wardrobe colour directions from disposable image
prompts and appends mandatory line-art rules. Supplemental photo instructions
must also pass through `outlineReferenceText`. Do not overwrite saved descriptions
or outfits: full-colour covers and explicitly coloured hybrid spreads need them.
Do not apply these reference-only transformations to full-colour generation.

Run:

```sh
node --import tsx --test tests/reference-photos.test.ts tests/reference-style.test.ts
```

Before release, exercise real iPhone HEIC/HEIF files in the character and location
pickers on desktop and mobile. Verify conversion, upload, validation and generation,
including group-photo selection. Test that notes/chat navigation never hides the
story acceptance action, and that failed confirmation does not advance the user.
