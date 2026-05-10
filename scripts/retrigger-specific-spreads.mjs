/**
 * retrigger-specific-spreads.mjs
 *
 * Retriggers specific spreads for The Monkey in the Mystery Section.
 * Clears existing image URLs then fires individual spread generation events.
 *
 * Run from project root:
 *   node scripts/retrigger-specific-spreads.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

const STORY_ID = "063a7db7-be94-4c54-9bf2-0e082ba94aec";

const SPREADS = [
  {
    label: "15-16",
    leftPageId:  "63aa1373-2ebf-4e25-be29-92074b1d466d",
    rightPageId: "8d9665ce-b268-4cb2-8182-a3b99d5a5ee9",
  },
  {
    label: "23-24",
    leftPageId:  "560b9333-fc3e-4939-b1e2-f1cca17dd092",
    rightPageId: "635976c6-615a-4766-88f7-5e3c82d200f6",
  },
];

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const INNGEST_BASE_URL  = process.env.INNGEST_BASE_URL ?? "https://inn.gs";

if (!INNGEST_EVENT_KEY) {
  console.error("❌ INNGEST_EVENT_KEY not found in .env.local");
  process.exit(1);
}

console.log(`\n🔁 Retriggering ${SPREADS.length} spreads for The Monkey in the Mystery Section\n`);

for (const spread of SPREADS) {
  console.log(`📄 Spread ${spread.label}`);

  // Clear existing image URLs so the pipeline regenerates fresh
  await sql`
    UPDATE story_pages
    SET image_url = NULL
    WHERE id IN (${spread.leftPageId}, ${spread.rightPageId})
  `;
  console.log(`   🗑️  Cleared existing image URLs`);

  // Fire the single spread generation event
  const res = await fetch(`${INNGEST_BASE_URL}/e/${INNGEST_EVENT_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "story/generate.single.spread",
      data: {
        storyId:     STORY_ID,
        leftPageId:  spread.leftPageId,
        rightPageId: spread.rightPageId,
        pageLabel:   spread.label,
      },
    }),
  });

  if (res.ok) {
    const json = await res.json();
    console.log(`   ✅ Queued — event ID: ${json.ids?.[0] ?? "(unknown)"}`);
  } else {
    const text = await res.text();
    console.error(`   ❌ Failed (${res.status}): ${text}`);
  }

  await new Promise(r => setTimeout(r, 500));
}

console.log(`\n✅ Done — check Inngest dashboard for progress\n`);

await sql.end();
