import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

export default defineConfig({
  out: "./drizzle",
  schema: ["./src/db/schema.ts", "./src/db/schema-worlds.ts"],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
