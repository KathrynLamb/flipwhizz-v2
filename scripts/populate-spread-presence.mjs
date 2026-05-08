/**
 * populate-spread-presence.mjs
 *
 * Populates story_spread_presence with correct character assignments
 * and location for every spread in Bicu Stefan's Words.
 *
 * Run from project root:
 *   node scripts/populate-spread-presence.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

const STORY_ID = "b1029f6d-8ebd-46fc-862d-3bf9ac613093";

// ── Location ─────────────────────────────────────────────────────────
const LIVING_ROOM = {
  id: "5ea64d7f-4ec1-40e5-9929-e623c3ace586",
  name: "The Living Room Floor",
};

// ── Characters ───────────────────────────────────────────────────────
const CHARACTERS = {
  oscar:      { id: "d1db22c3-c27c-46cf-9588-b5cef7b057fb", name: "Oscar" },
  olivia:     { id: "3bf4cc14-f884-44ad-974d-e182f690df9d", name: "Olivia" },
  bicuStefan: { id: "780b9178-d2ed-4f68-8170-cc7cc066c10c", name: "Bicu Stefan" },
  mama:       { id: "b109e716-69b6-42ca-a765-2bfc95c81208", name: "Mama" },
  mitzu:      { id: "7341cbd2-3364-4c49-b05f-0b4579bc4b37", name: "Tuxedo cat" },
};

// ── Spread assignments ────────────────────────────────────────────────
const SPREAD_ASSIGNMENTS = [
  {
    // Pages 1-2: Oscar and Olivia sit with photo album, cat jumps in
    spreadIndex: 1,
    primary:    [CHARACTERS.oscar, CHARACTERS.olivia],
    background: [CHARACTERS.mitzu],
    excluded:   [],
  },
  {
    // Pages 3-4: Oscar points to Bicu Stefan's photo, Olivia speaks
    spreadIndex: 2,
    primary:    [CHARACTERS.oscar, CHARACTERS.olivia],
    background: [],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 5-6: Romanian lullaby poem
    spreadIndex: 3,
    primary:    [CHARACTERS.oscar, CHARACTERS.olivia],
    background: [],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 7-8: Romanian poem continues — Olivia mentioned by name
    spreadIndex: 4,
    primary:    [CHARACTERS.olivia, CHARACTERS.oscar],
    background: [],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 9-10: Cat paws at photo, folded papers fall out
    spreadIndex: 5,
    primary:    [CHARACTERS.mitzu],
    background: [CHARACTERS.oscar, CHARACTERS.olivia],
    excluded:   [],
  },
  {
    // Pages 11-12: Oscar picks up paper, Olivia calls Mama
    spreadIndex: 6,
    primary:    [CHARACTERS.oscar, CHARACTERS.olivia],
    background: [],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 13-14: Mama comes over, looks at papers
    spreadIndex: 7,
    primary:    [CHARACTERS.mama, CHARACTERS.oscar, CHARACTERS.olivia],
    background: [],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 15-16: Oscar says they can't read it, Mama explains Romanian
    spreadIndex: 8,
    primary:    [CHARACTERS.oscar, CHARACTERS.mama],
    background: [CHARACTERS.olivia],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 17-18: Mama wipes eyes, Oscar and Olivia move closer
    spreadIndex: 9,
    primary:    [CHARACTERS.mama, CHARACTERS.oscar, CHARACTERS.olivia],
    background: [],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 19-20: Olivia asks Mama to translate, Mama reads slowly
    spreadIndex: 10,
    primary:    [CHARACTERS.mama, CHARACTERS.olivia],
    background: [CHARACTERS.oscar],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 21-22: Mama reads Oscar's poem, translates
    spreadIndex: 11,
    primary:    [CHARACTERS.mama, CHARACTERS.oscar],
    background: [CHARACTERS.olivia],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 23-24: Mama reads Olivia's poem, pauses
    spreadIndex: 12,
    primary:    [CHARACTERS.mama, CHARACTERS.olivia],
    background: [CHARACTERS.oscar],
    excluded:   [CHARACTERS.mitzu],
  },
  {
    // Pages 25-26: Oscar whispers, cat purrs against poems
    spreadIndex: 13,
    primary:    [CHARACTERS.oscar, CHARACTERS.mama],
    background: [CHARACTERS.olivia, CHARACTERS.mitzu],
    excluded:   [],
  },
  {
    // Pages 27-28: Oscar and Olivia hands on hearts, cat curls on poems
    spreadIndex: 14,
    primary:    [CHARACTERS.oscar, CHARACTERS.olivia],
    background: [CHARACTERS.mama, CHARACTERS.mitzu],
    excluded:   [],
  },
];

// ── Main ─────────────────────────────────────────────────────────────

console.log(`\n📖 Populating spread presence for Bicu Stefan's Words\n`);

const spreads = await sql`
  SELECT id, spread_index
  FROM story_spreads
  WHERE story_id = ${STORY_ID}
  ORDER BY spread_index
`;

if (spreads.length === 0) {
  console.error("❌ No spreads found");
  await sql.end();
  process.exit(1);
}

console.log(`Found ${spreads.length} spreads\n`);

// Location assigned to every spread — whole story takes place in the living room
const locationJson = JSON.stringify([{
  locationId: LIVING_ROOM.id,
  role: "primary",
  confidence: 99,
  reason: "Entire story takes place on the living room floor",
}]);

for (const spread of spreads) {
  const assignment = SPREAD_ASSIGNMENTS.find(a => a.spreadIndex === spread.spread_index);
  if (!assignment) {
    console.warn(`⚠️  No assignment for spread ${spread.spread_index} — skipping`);
    continue;
  }

  const characters = [
    ...assignment.primary.map(c => ({
      characterId: c.id,
      role: "primary",
      confidence: 95,
      reason: `${c.name} is featured in this spread`,
    })),
    ...assignment.background.map(c => ({
      characterId: c.id,
      role: "background",
      confidence: 80,
      reason: `${c.name} appears in background`,
    })),
  ];

  const excludedCharacters = assignment.excluded.map(c => ({
    characterId: c.id,
    reason: `${c.name} does not appear in this spread`,
  }));

  await sql`
    UPDATE story_spread_presence
    SET
      characters          = ${JSON.stringify(characters)}::jsonb,
      excluded_characters = ${JSON.stringify(excludedCharacters)}::jsonb,
      locations           = ${locationJson}::jsonb,
      primary_location_id = ${LIVING_ROOM.id},
      reasoning           = ${"Populated from story text analysis"},
      updated_at          = NOW()
    WHERE spread_id = ${spread.id}
  `;

  const leftPage  = (spread.spread_index * 2) - 1;
  const rightPage = spread.spread_index * 2;
  const primaryNames = assignment.primary.map(c => c.name).join(", ");
  const bgNames      = assignment.background.map(c => c.name).join(", ");

  console.log(`✅ Spread ${spread.spread_index} (pages ${leftPage}-${rightPage})`);
  console.log(`   Primary:    ${primaryNames || "(none)"}`);
  console.log(`   Background: ${bgNames || "(none)"}`);
  if (assignment.excluded.length > 0) {
    console.log(`   Excluded:   ${assignment.excluded.map(c => c.name).join(", ")}`);
  }
  console.log(`   Location:   ${LIVING_ROOM.name}`);
}

console.log(`\n✅ Done — all spreads populated with characters and location`);
console.log(`\nNow retrigger the story:`);
console.log(`  node scripts/retrigger-spreads.mjs`);

await sql.end();
