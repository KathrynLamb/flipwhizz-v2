// schema-worlds.ts
// Drop into: src/db/schema-worlds.ts
//
// IMPORTANT: This does NOT include a readers table — your existing readers
// table in schema.ts is the source of truth. This file only adds the
// worlds-specific tables.
//
// userId is TEXT (not uuid) to match your existing users.id type.

import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  uuid,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Reference your existing tables — adjust if needed
// import { users, stories, characters, locations, readers } from "./schema";

// ============================================================================
// WORLDS — The series container
// ============================================================================

export const worlds = pgTable(
  "worlds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(), // TEXT to match users.id
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    styleGuideId: uuid("style_guide_id"),
    tonality: varchar("tonality", { length: 100 }),
    ageRange: varchar("age_range", { length: 50 }),
    themes: jsonb("themes").$type<string[]>().default([]),
    coverImageUrl: text("cover_image_url"),
    coverImagePublicId: text("cover_image_public_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("worlds_user_id_idx").on(table.userId),
  })
);

// ============================================================================
// WORLD READERS — Many-to-many join between worlds and your existing readers
// ============================================================================

export const worldReaders = pgTable(
  "world_readers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    readerId: uuid("reader_id").notNull(),
    // References readers.id from your main schema
    // .references(() => readers.id, { onDelete: "cascade" })
    role: varchar("role", { length: 100 }).default("protagonist"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    uniqueWorldReader: uniqueIndex("world_readers_unique_idx").on(
      table.worldId,
      table.readerId
    ),
    worldIdIdx: index("world_readers_world_id_idx").on(table.worldId),
    readerIdIdx: index("world_readers_reader_id_idx").on(table.readerId),
  })
);

// ============================================================================
// WORLD CHARACTERS — Characters promoted to world-level for reuse
// ============================================================================

export const worldCharacters = pgTable(
  "world_characters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    characterId: uuid("character_id").notNull(),
    // .references(() => characters.id, { onDelete: "cascade" })
    isRecurring: boolean("is_recurring").default(true),
    firstAppearanceStoryId: uuid("first_appearance_story_id"),
    characterArc: text("character_arc"),
    sortOrder: integer("sort_order").default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    worldIdIdx: index("world_characters_world_id_idx").on(table.worldId),
    uniqueWorldChar: uniqueIndex("world_characters_unique_idx").on(
      table.worldId,
      table.characterId
    ),
  })
);

// ============================================================================
// WORLD LOCATIONS — Locations promoted to world-level for reuse
// ============================================================================

export const worldLocations = pgTable(
  "world_locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    locationId: uuid("location_id").notNull(),
    // .references(() => locations.id, { onDelete: "cascade" })
    isRecurring: boolean("is_recurring").default(true),
    firstAppearanceStoryId: uuid("first_appearance_story_id"),
    notes: text("notes"),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    worldIdIdx: index("world_locations_world_id_idx").on(table.worldId),
    uniqueWorldLoc: uniqueIndex("world_locations_unique_idx").on(
      table.worldId,
      table.locationId
    ),
  })
);

// ============================================================================
// WORLD NARRATIVE MEMORY — Series continuity data
// ============================================================================

export const worldNarrativeMemory = pgTable(
  "world_narrative_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    worldId: uuid("world_id")
      .notNull()
      .references(() => worlds.id, { onDelete: "cascade" }),
    storyId: uuid("story_id").notNull(),
    // .references(() => stories.id, { onDelete: "cascade" })
    bookNumber: integer("book_number").notNull(),
    summary: text("summary").notNull(),
    characterDevelopments: jsonb("character_developments")
      .$type<Array<{ characterId: string; development: string }>>()
      .default([]),
    plotPoints: jsonb("plot_points")
      .$type<Array<{ point: string; isOngoing: boolean }>>()
      .default([]),
    callbacks: jsonb("callbacks")
      .$type<Array<{ reference: string; context: string }>>()
      .default([]),
    emotionalThemes: jsonb("emotional_themes")
      .$type<string[]>()
      .default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    worldIdIdx: index("narrative_memory_world_id_idx").on(table.worldId),
    worldBookIdx: uniqueIndex("narrative_memory_world_book_idx").on(
      table.worldId,
      table.bookNumber
    ),
  })
);

// ============================================================================
// RELATIONS
// ============================================================================

export const worldsRelations = relations(worlds, ({ many }) => ({
  worldReaders: many(worldReaders),
  worldCharacters: many(worldCharacters),
  worldLocations: many(worldLocations),
  narrativeMemory: many(worldNarrativeMemory),
}));

export const worldReadersRelations = relations(worldReaders, ({ one }) => ({
  world: one(worlds, {
    fields: [worldReaders.worldId],
    references: [worlds.id],
  }),
}));

export const worldCharactersRelations = relations(
  worldCharacters,
  ({ one }) => ({
    world: one(worlds, {
      fields: [worldCharacters.worldId],
      references: [worlds.id],
    }),
  })
);

export const worldLocationsRelations = relations(
  worldLocations,
  ({ one }) => ({
    world: one(worlds, {
      fields: [worldLocations.worldId],
      references: [worlds.id],
    }),
  })
);

export const worldNarrativeMemoryRelations = relations(
  worldNarrativeMemory,
  ({ one }) => ({
    world: one(worlds, {
      fields: [worldNarrativeMemory.worldId],
      references: [worlds.id],
    }),
  })
);