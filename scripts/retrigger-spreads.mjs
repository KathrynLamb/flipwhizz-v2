/**
 * retrigger-spreads.mjs
 *
 * Sends a story/generate-spreads event to Inngest for each story,
 * retriggering the full illustration pipeline.
 *
 * Run from project root:
 *   node scripts/retrigger-spreads.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const STORY_IDS = [
  "b1029f6d-8ebd-46fc-862d-3bf9ac613093", 
];

// Inngest accepts events at this endpoint using your event key
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY;
const INNGEST_BASE_URL  = process.env.INNGEST_BASE_URL ?? "https://inn.gs";

if (!INNGEST_EVENT_KEY) {
  console.error("❌ INNGEST_EVENT_KEY not found in .env.local");
  process.exit(1);
}

const url = `${INNGEST_BASE_URL}/e/${INNGEST_EVENT_KEY}`;

for (const storyId of STORY_IDS) {
  console.log(`\n📤 Triggering spreads for story: ${storyId}`);

  const body = JSON.stringify({
    name: "story/generate-spreads",
    data: { storyId },
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  if (res.ok) {
    const json = await res.json();
    console.log(`   ✅ Accepted — event ID: ${json.ids?.[0] ?? "(unknown)"}`);
  } else {
    const text = await res.text();
    console.error(`   ❌ Failed (${res.status}): ${text}`);
  }

  // Small pause between events
  await new Promise((r) => setTimeout(r, 500));
}

console.log("\n✅ Done — check Inngest dashboard for run status");
