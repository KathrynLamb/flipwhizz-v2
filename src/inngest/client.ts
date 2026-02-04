// inngest/client.ts
import { Inngest } from "inngest";

export const inngest = new Inngest({ 
  id: "flipwhizz-app",
  eventKey: process.env.INNGEST_EVENT_KEY,
});