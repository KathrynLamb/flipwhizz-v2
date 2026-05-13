// scripts/trigger-stuck-stories.ts
// Run once from project root:
//   npx ts-node --skip-project scripts/trigger-stuck-stories.ts
//
// Sends story/build-spread-prompts for every story with missing presence rows.

const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY!;
const INNGEST_BASE_URL = process.env.INNGEST_BASE_URL ?? "https://inn.gs";

if (!INNGEST_EVENT_KEY) {
  console.error("❌ INNGEST_EVENT_KEY env var required");
  process.exit(1);
}

const STUCK_STORY_IDS = [
  "4b6fac04-73ec-4d8e-8ea4-a0921e0cfa4a", // Superhero Theo and the Bathroom Powers
  "80f9e698-4213-4a48-8450-ae1103b2c1de", // Betty and the Brand New Baby
  "58273db3-3c2d-452a-b039-b75963fbaf3a", // Ella and the Big Sister Sparkle
  "3fcd6619-aff4-4a81-9b7e-bd58fbf975a5", // Tabitha's Tiny Moon
  "551a7d74-1ed2-401a-9f4d-9baef287a84e", // The Missing Match Ball Mystery
  "5b212abc-8e2e-44f8-8fe9-4d2c2ff79775", // The Tooth, The Whole Tooth...
  "a8461b60-7217-4f2b-bc62-8da11bafbcd0", // Trevor Triceratops
  "0b0bafd5-d99f-41b4-9c9c-89870a34ab24", // Sophia and the Serious Clouds
  "fdda6d9d-6640-40e7-90f3-459e14df3a04", // Sophia's Spectacular Ski Trip (scene records cleared)
  "4eb8566d-d23b-4de6-8065-66ba1ff85754", // Lexie's Special Day
  "ee5bb6d3-d11c-4838-a29b-d20920804715", // The Dragon Who Counted Stars
  "49291dd1-b758-4b02-9ddf-70664c1649f6", // The Adventure Queens (42 spreads — will be slow)
  "93dccb44-13d5-4a15-a990-9437e31bd361", // Olivia's First Year
  "ae1300d8-6368-4cf2-bb50-9a97b4cf3777", // The Door Mr. Whiskers Found
  "0d70913e-d6ff-428b-b2ff-20bb693ff756", // The Squirrels Who Couldn't Stop Rhyming
  "ad5ad620-90f6-4e4f-ac48-bacfe77fdc01", // The Day Milo's Shadow Ran Away
  "69b7b2cb-6ae3-44fb-91e0-8e5f25cb0028", // Naverly's Spectacularly Disastrous Ski Catastrophe
  "78069275-0b0a-44df-8826-d3e7d829230b", // Jack and the Dinosaur (scene records cleared)
  "5afed616-5afa-48be-9dd3-dd1b68a08942", // The Three Dogs and the Purdy Problem
  "e0f55924-f6f7-483d-ae91-ad0d67b77b7b", // Princess Sophia and the Giggle-Bark Tree
  "92919c8e-188a-4a95-b950-9b9ae110f441", // The Stinkbeast of Valentine's Day
  "f92cb2a2-8333-4f48-802f-6910bd35d635", // Sophia and the Upside-Down Sheep Race
  "69474885-7571-4227-ab7b-d07fb9edf0af", // Keith and Margaret's Story
  "52a2184b-baa5-4233-82f3-7d99165bdec7", // The Library at the End of Everything
  "12b292cf-2247-46cc-92bc-d0b9e0bac67b", // Sophia and the Silence Thief
  "7cd1e75b-4dc3-46cc-8bde-f6257a0a9529", // Tommy and the Missing Match Tickets
  "18a89f4d-f05b-4a69-a11d-b5952afd8653", // The Chicken Who Wanted Bedtime
  "f3e3b2c6-0ac8-4624-a64f-da34ea0d8679", // Adventure Queen Sophia and the Fading Star Festival
  "c4110fdd-8d7b-4fb2-abd8-908da211b68c", // [original stuck story from earlier]
];

async function main() {
  const events = STUCK_STORY_IDS.map((storyId) => ({
    name: "story/build-spread-prompts",
    data: { storyId },
  }));

  console.log(`🚀 Sending ${events.length} events to Inngest...`);

  const res = await fetch(`${INNGEST_BASE_URL}/e/${INNGEST_EVENT_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(events),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ Inngest returned ${res.status}:`, text);
    process.exit(1);
  }

  const json = await res.json();
  console.log(`✅ Done. Inngest accepted ${events.length} events.`);
  console.log(JSON.stringify(json, null, 2));
}

main().catch((err) => {
  console.error("❌ Unexpected error:", err);
  process.exit(1);
});