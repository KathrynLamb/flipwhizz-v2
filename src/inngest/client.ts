// src/inngest/client.ts
import { Inngest } from "inngest";
import { UsageMiddleware } from "./usageMiddleware";

export const inngest = new Inngest({ 
  id: "flipwhizz-app",
  eventKey: process.env.INNGEST_EVENT_KEY,
  // Tags every AI call a background job makes with its book (admin Costs tab).
  middleware: [UsageMiddleware],
});