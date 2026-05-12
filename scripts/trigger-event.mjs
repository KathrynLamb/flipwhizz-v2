// scripts/trigger-event.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { Inngest } from "inngest";

const inngest = new Inngest({ 
  id: "flipwhizz-app",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

await inngest.send({
  name: "story/build-spread-prompts",
  data: { storyId: "c677bc66-8c11-43c2-b665-0efe69d2b9ed" },
});

console.log("✅ Event sent");