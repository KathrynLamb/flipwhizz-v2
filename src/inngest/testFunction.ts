import { inngest } from "@/inngest/client";

export const testFunction = inngest.createFunction(
  { id: "test-function" , triggers: [{ event: "test/hello" }] },
  async ({ event }) => {
    console.log("🎉 Test function triggered!", event.data);
    return { success: true };
  }
);