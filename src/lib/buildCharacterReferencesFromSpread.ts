/* ======================================================
   TYPES (local to this util)
====================================================== */

export type SpreadCharacterRow = {
    characterId: string;
    name: string;
    referenceImageUrl?: string | null;
    description?: string | null;
  
    // Optional page-specific metadata (nice but not required)
    emotionalState?: string | null;
    action?: string | null;
    prominence?: string | null;
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
     BUILDER (spread-aware)
  ====================================================== */
  
  export function buildCharacterReferencesFromSpread(
    spreadCharacters: SpreadCharacterRow[]
  ): CharacterReference[] {
    const seen = new Set<string>();
    const references: CharacterReference[] = [];
  
    for (const c of spreadCharacters) {
      if (!c.name || seen.has(c.characterId)) continue;
      seen.add(c.characterId);
  
      // 🖼️ Prefer visual reference
      if (c.referenceImageUrl) {
        references.push({
          type: "character",
          label: c.name,
          mode: "image",
          url: c.referenceImageUrl,
        });
        continue;
      }
  
      // 📝 Build a rich description fallback
      const descriptionParts: string[] = [];
  
      if (c.description) descriptionParts.push(c.description);
      if (c.emotionalState)
        descriptionParts.push(`Emotion: ${c.emotionalState}`);
      if (c.action) descriptionParts.push(`Action: ${c.action}`);
  
      if (descriptionParts.length > 0) {
        references.push({
          type: "character",
          label: c.name,
          mode: "description",
          description: descriptionParts.join(". "),
        });
      }
    }
  
    return references;
  }
  