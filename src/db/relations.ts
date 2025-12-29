// src/db/relations.ts
import { relations } from "drizzle-orm";

import {
  users,
  projects,
  stories,
  storyPages,
  storyStyleGuide,
  styleGuideImages,
  characters,
  locations,
  storyCharacters,
  storyLocations,
} from "./schema";


/* ---------------- USERS ---------------- */

export const userRelations = relations(users, ({ many }) => ({
  // one user → many projects
  projects: many(projects),
}));

/* ---------------- PROJECTS ---------------- */

export const projectRelations = relations(projects, ({ one, many }) => ({
  // many projects → one user
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),

  // one project → many stories
  stories: many(stories),
}));

/* ---------------- STORIES ---------------- */

export const storyRelations = relations(stories, ({ one, many }) => ({
  // many stories → one project
  project: one(projects, {
    fields: [stories.projectId],
    references: [projects.id],
  }),

  // one story → many pages
  pages: many(storyPages),
}));

/* ---------------- STORY PAGES ---------------- */

export const storyPageRelations = relations(storyPages, ({ one }) => ({
  // many pages → one story
  story: one(stories, {
    fields: [storyPages.storyId],
    references: [stories.id],
  }),
}));

export const storyStyleGuideRelations = relations(storyStyleGuide, ({ many }) => ({
  referenceImages: many(styleGuideImages),
}));

// 👇 Add this relation for the CHILD (styleGuideImages)
export const styleGuideImagesRelations = relations(styleGuideImages, ({ one }) => ({
  styleGuide: one(storyStyleGuide, {
    fields: [styleGuideImages.styleGuideId],
    references: [storyStyleGuide.id],
  }),
}));

export const storyCharactersRelations = relations(storyCharacters, ({ one }) => ({
  story: one(stories, {
    fields: [storyCharacters.storyId],
    references: [stories.id],
  }),
  character: one(characters, {
    fields: [storyCharacters.characterId],
    references: [characters.id],
  }),
}));


export const storyLocationsRelations = relations(storyLocations, ({ one }) => ({
  story: one(stories, {
    fields: [storyLocations.storyId],
    references: [stories.id],
  }),
  location: one(locations, {
    fields: [storyLocations.locationId],
    references: [locations.id],
  }),
}));

export const storyStyleGuideToStoryRelations = relations(storyStyleGuide, ({ one }) => ({
  story: one(stories, {
    fields: [storyStyleGuide.storyId],
    references: [stories.id],
  }),
}));


