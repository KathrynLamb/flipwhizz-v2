import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  uuid,
  boolean
} from "drizzle-orm/pg-core";

/* ==================== USERS ==================== */

export const users = pgTable("users", {
  id: text("id").primaryKey(), // auth provider ID
  name: varchar("name", { length: 120 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== PROJECTS ==================== */

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),

  storyBrief: text("story_brief"),
  storyBasePrompt: text("story_base_prompt"),
  fullAiStory: text("full_ai_story"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== STORIES ==================== */

export const stories = pgTable("stories", {
  id: uuid("id").primaryKey().defaultRandom(),

  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),

  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  tone: varchar("tone", { length: 80 }),
  length: integer("length"),
  fullDraft: text("full_draft"),

  status: varchar("status", { length: 20 }).default("planning"),
  storyConfirmed: boolean("story_confirmed").default(false).notNull(),
  paymentStatus: text("payment_status").default("pending"),
  paymentId: text("payment_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== STORY PAGES ==================== */

export const storyPages = pgTable("story_pages", {
  id: uuid("id").primaryKey().defaultRandom(),

  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),

  pageNumber: integer("page_number").notNull(),
  text: text("text").notNull(),

  illustrationPrompt: text("illustration_prompt"),
  imageId: uuid("image_id"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== PAGE IMAGES ==================== */

export const pageImages = pgTable("page_images", {
  id: uuid("id").primaryKey().defaultRandom(),

  pageId: uuid("page_id")
    .references(() => storyPages.id, { onDelete: "cascade" })
    .notNull(),

  url: text("url").notNull(),
  promptUsed: text("prompt_used"),
  seed: text("seed"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== CHARACTERS ==================== */

export const characters = pgTable("characters", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  appearance: text("appearance"),
  aiSummary: text("ai_summary"),

  portraitImageUrl: text("portrait_image_url"),
  referenceImageUrl: text("reference_image_url"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== LOCATIONS ==================== */

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),

  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  aiSummary: text("ai_summary"),

  portraitImageUrl: text("portrait_image_url"),
  referenceImageUrl: text("reference_image_url"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== STORY ↔ CHARACTERS ==================== */

export const storyCharacters = pgTable("story_characters", {
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),

  characterId: uuid("character_id")
    .references(() => characters.id, { onDelete: "cascade" })
    .notNull(),
});

/* ==================== STORY ↔ LOCATIONS ==================== */

export const storyLocations = pgTable("story_locations", {
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),

  locationId: uuid("location_id")
    .references(() => locations.id, { onDelete: "cascade" })
    .notNull(),
});

/* ==================== STORY STYLE GUIDE (1:1) ==================== */

export const storyStyleGuide = pgTable("story_style_guide", {
  id: uuid("id").primaryKey().defaultRandom(),

  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  summary: text("summary"),
  negativePrompt: text("negative_prompt"),
  userNotes: text("user_notes"),

  sampleIllustrationUrl: text("sample_illustration_url"),
  styleGuideImage: text("style_guide_image"), // Add this to keep the "one true style" ref handy

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== STYLE GUIDE IMAGES ==================== */

export const styleGuideImages = pgTable("style_guide_images", {
  id: uuid("id").primaryKey().defaultRandom(),

  styleGuideId: uuid("style_guide_id")
    .references(() => storyStyleGuide.id, { onDelete: "cascade" })
    .notNull(),

  url: text("url").notNull(),
  type: varchar("type", { length: 20 }).notNull(), // style | character | location
  label: varchar("label", { length: 200 }),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== READERS ==================== */

export const readers = pgTable("readers", {
  id: uuid("id").primaryKey().defaultRandom(),

  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),

  name: varchar("name", { length: 120 }),
  dateOfBirth: varchar("dob", { length: 40 }),
  relationship: varchar("relationship", { length: 80 }),
  gender: varchar("gender", { length: 40 }),
  aiSummary: text("ai_summary"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== CHAT ==================== */

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),

  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" }),

  readerId: uuid("reader_id").references(() => readers.id, { onDelete: "set null" }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),

  status: varchar("status", { length: 20 }).default("open"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),

  sessionId: uuid("session_id")
    .references(() => chatSessions.id, { onDelete: "cascade" })
    .notNull(),

  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pageEntities = pgTable("page_entities", {
  id: uuid("id").primaryKey().defaultRandom(),

  pageId: uuid("page_id")
    .references(() => storyPages.id, { onDelete: "cascade" })
    .notNull(),

  entityType: varchar("entity_type", { length: 20 }).notNull(), 
  // "character" | "location"

  entityId: uuid("entity_id").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
});

export const storyPageCharacters = pgTable("story_page_characters", {
  pageId: uuid("page_id")
    .references(() => storyPages.id, { onDelete: "cascade" })
    .notNull(),

  characterId: uuid("character_id")
    .references(() => characters.id, { onDelete: "cascade" })
    .notNull(),

  // optional but VERY useful later
  source: varchar("source", { length: 20 }).default("ai"), // ai | manual
});

export const storyPageLocations = pgTable("story_page_locations", {
  pageId: uuid("page_id")
    .references(() => storyPages.id, { onDelete: "cascade" })
    .notNull(),

  locationId: uuid("location_id")
    .references(() => locations.id, { onDelete: "cascade" })
    .notNull(),

  source: varchar("source", { length: 20 }).default("ai"),
});



