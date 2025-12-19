/* ======================================================
   TYPES (local to this util)
====================================================== */

export type Entity = {
  id: string;
  name: string;
  referenceImageUrl?: string | null;
  description?: string | null;
};

export type CharacterReference =
  | {
      type: "character";
      label: string;
      mode: "image";
      url: string;
    }
  | {
      type: "character";
      label: string;
      mode: "description";
      description: string;
    };

/* ======================================================
   BUILDER
====================================================== */

export function buildCharacterReferences(
  characters: Entity[]
): CharacterReference[] {
  const references: CharacterReference[] = [];

  for (const c of characters) {
    const name = c.name?.trim();
    if (!name) continue;

    // ✅ Prefer image reference
    if (c.referenceImageUrl) {
      references.push({
        type: "character",
        label: name,
        mode: "image",
        url: c.referenceImageUrl,
      });
      continue;
    }

    // ✅ Fallback to description
    if (c.description?.trim()) {
      references.push({
        type: "character",
        label: name,
        mode: "description",
        description: c.description.trim(),
      });
    }
  }

  return references;
}
