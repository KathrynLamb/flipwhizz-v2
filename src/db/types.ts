// src/db/types.ts
import { InferSelectModel } from "drizzle-orm";
import * as schema from "./schema";

export type Story = InferSelectModel<typeof schema.stories>;
export type Character = InferSelectModel<typeof schema.characters>;
export type Location = InferSelectModel<typeof schema.locations>;
export type StyleGuide = InferSelectModel<typeof schema.storyStyleGuide>;
export type BookCover = InferSelectModel<typeof schema.bookCovers>;
