// scripts/trigger-redraws.mjs
import { config } from "dotenv";
config({ path: ".env.local" });
import { Inngest } from "inngest";

const inngest = new Inngest({
  id: "flipwhizz-app",
  eventKey: process.env.INNGEST_EVENT_KEY,
});

await inngest.send([
  {
    name: "story/generate.single.spread",
    data: {
      storyId: "c677bc66-8c11-43c2-b665-0efe69d2b9ed",
      leftPageId: "6e81d1de-af61-4011-9112-b2092d7a34cc",
      rightPageId: "3545bc10-f3c4-4da4-bf19-db3ab6fb80de",
      pageLabel: "5-6",
    },
  },
  {
    name: "story/generate.single.spread",
    data: {
      storyId: "c677bc66-8c11-43c2-b665-0efe69d2b9ed",
      leftPageId: "49ee2431-c773-48a9-8423-ae83aaf93e50",
      rightPageId: "e9c4bb1e-5ce8-4c18-a5e8-7de612d0dcd3",
      pageLabel: "15-16",
    },
  },
]);

console.log("✅ Both redraws queued");