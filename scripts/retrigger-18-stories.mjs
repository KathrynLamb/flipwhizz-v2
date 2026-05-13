// scripts/retrigger-18-stories.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { Inngest } from "inngest";

const inngest = new Inngest({
  id: "flipwhizz-app",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

const stories = [
  { id: "ada25c75-760f-456d-ac48-d8ac59677440", title: "Adam and the Big Storm" },
  { id: "49291dd1-b758-4b02-9ddf-70664c1649f6", title: "The Adventure Queens and the River's Secret" },
  { id: "c4110fdd-8d7b-4fb2-abd8-908da211b68c", title: "The Mystery of the Missing Acorns" },
  { id: "f326e97b-6401-4ed3-8fdd-280087691332", title: "Oscar's Color-Mixing Garden" },
  { id: "0f9ab06c-37e7-4288-b724-b02005d8acc9", title: "Olivia's Tiny Seahorse Secret" },
  { id: "78069275-0b0a-44df-8826-d3e7d829230b", title: "Jack and the Dinosaur Who Talked Too Much" },
  { id: "fdda6d9d-6640-40e7-90f3-459e14df3a04", title: "Sophia's Spectacular Ski Trip" },
  { id: "74be4a8d-dcf6-43ca-843a-3341623c7e18", title: "The Universe Doesn't Care About Your Stepovers" },
  { id: "87caf15e-4eed-4b1b-b54b-2a7f83fe47c1", title: "Sophia and Naverly Save the Singing Woods" },
  { id: "b1029f6d-8ebd-46fc-862d-3bf9ac613093", title: "Bicu Stefan's Words" },
  { id: "ccc40920-1f69-4f46-b996-547d0b2d603d", title: "The Room That Wouldn't Stay Still" },
  { id: "630180b6-030d-4dcb-bc23-8b3a0ff5f532", title: "The Red Scarf and the Promotion Quest" },
  { id: "0945f02f-9d08-49e3-a373-81bf7d628d13", title: "The Teeny-Tiny Talent Show" },
  { id: "c547dae9-a36a-4363-883a-33a4f0eb08d8", title: "The Adventure Queens and the Whispering Waterfall" },
  { id: "8a2d0265-c504-47af-bcab-3e48fd275c82", title: "Sophia's Seriously Fast Ski Story" },
  { id: "6dd4cc65-36d4-4647-8cbe-ffb75d2ff7ed", title: "Logan and the Extremely Cursed Chicken Nugget" },
  { id: "e617bee5-65fd-42a5-bcb7-51b17d5da97f", title: "Grandma Goes Downhill (And Uncle Poopy Pants Too)" },
  { id: "1c1c5971-52c8-4812-9664-7d06fa5c4538", title: "Nico and the Sunset Layers" },
];

const events = stories.map((s) => ({
  name: "story/generate-spreads",
  data: { storyId: s.id },
}));

await inngest.send(events);

console.log(`✅ Retriggered ${stories.length} stories:`);
stories.forEach((s) => console.log(`  - ${s.title}`));
