

import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  uuid,
  boolean,
  jsonb
} from "drizzle-orm/pg-core";

/* ==================== USERS ==================== */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
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
  coverImageUrl: text("cover_image_url"),
  status: varchar("status", { length: 20 }).default("planning"),
  storyConfirmed: boolean("story_confirmed").default(false).notNull(),
  paymentStatus: text("payment_status").default("pending"),
  paymentId: text("payment_id"),
  frontCoverPrompt: text("front_cover_prompt"),
  backCoverPrompt: text("back_cover_prompt"),
  frontCoverUrl: text("front_cover_url"),
  backCoverUrl: text("back_cover_url"),
  pdfUrl: text("pdf_url"),
  pdfUpdatedAt: timestamp("pdf_updated_at"),
  orderStatus: text("order_status").default("not_ready"), 
  currentStep: integer("current_step").default(1),
  completedSteps: jsonb("completed_steps").default('[]'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== STORY PAGES ==================== */


export const storyProducts = pgTable("story_products", {
  id: uuid("id").primaryKey().defaultRandom(),

  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),

  // What the user is intending to buy (can change)
  productType: varchar("product_type", { length: 30 })
    .default("undecided"), 
    // 'undecided' | 'digital' | 'print' | 'gift'

  // Snapshot of pricing at time of checkout (not authoritative yet)
  estimatedPrice: integer("estimated_price"), // in cents
  currency: varchar("currency", { length: 10 }).default("GBP"),

  // Fulfilment flags
  requiresShipping: boolean("requires_shipping").default(false),
  requiresPdf: boolean("requires_pdf").default(true),
  
  locked: boolean("locked").default(false),
  // Lock once paid
  lockedAt: timestamp("locked_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


export const storyPages = pgTable("story_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),
  pageNumber: integer("page_number").notNull(),
  text: text("text").notNull(),
  illustrationPrompt: text("illustration_prompt"),
  imageId: uuid("image_id"),
  imageUrl: text("image_url"),
  
  // NEW: Scene metadata
  timeOfDay: varchar("time_of_day", { length: 40 }), // morning, afternoon, evening, night, etc.
  weather: varchar("weather", { length: 60 }), // sunny, rainy, stormy, etc.
  atmosphere: varchar("atmosphere", { length: 100 }), // tense, joyful, mysterious, etc.
  sceneType: varchar("scene_type", { length: 40 }), // action, dialogue, transition, climax, etc.
  
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
  
  // NEW: Visual consistency fields
  visualDetails: jsonb("visual_details"), // { hairColor, eyeColor, clothing, age, height, etc. }
  personalityTraits: text("personality_traits"),


  
  portraitImageUrl: text("portrait_image_url"),
  referenceImageUrl: text("reference_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  
  // NEW: Visual consistency fields
  visualDetails: jsonb("visual_details"), // { architecture, colors, lighting, keyFeatures, etc. }
  
  portraitImageUrl: text("portrait_image_url"),
  referenceImageUrl: text("reference_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== CHARACTER RELATIONSHIPS ==================== */

export const characterRelationships = pgTable("character_relationships", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),
  characterId: uuid("character_id")
    .references(() => characters.id, { onDelete: "cascade" })
    .notNull(),
  relatedCharacterId: uuid("related_character_id")
    .references(() => characters.id, { onDelete: "cascade" })
    .notNull(),
  relationshipType: varchar("relationship_type", { length: 40 }).notNull(), // friend, enemy, family, rival, mentor, etc.
  description: text("description"),
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
  
  // NEW: Character arc tracking
  role: varchar("role", { length: 40 }), // protagonist, antagonist, supporting, etc.
  arcSummary: text("arc_summary"), // Overall character journey in this story
});

/* ==================== STORY ↔ LOCATIONS ==================== */

export const storyLocations = pgTable("story_locations", {
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),
  locationId: uuid("location_id")
    .references(() => locations.id, { onDelete: "cascade" })
    .notNull(),
  
  // NEW: Location significance
  significance: varchar("significance", { length: 40 }), // primary, secondary, minor
});

/* ==================== STORY STYLE GUIDE ==================== */

export const storyStyleGuide = pgTable("story_style_guide", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  summary: text("summary"),
  negativePrompt: text("negative_prompt"),
  userNotes: text("user_notes"),
  
  // NEW: Enhanced style tracking
  artStyle: varchar("art_style", { length: 100 }), // watercolor, digital, cartoon, realistic, etc.
  colorPalette: jsonb("color_palette"), // { primary: [], secondary: [], accent: [] }
  visualThemes: text("visual_themes"), // recurring visual motifs
  
  sampleIllustrationUrl: text("sample_illustration_url"),
  styleGuideImage: text("style_guide_image"),
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
  type: varchar("type", { length: 20 }).notNull(),
  label: varchar("label", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== PAGE CHARACTER PRESENCE (enhanced) ==================== */

export const storyPageCharacters = pgTable("story_page_characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id")
    .references(() => storyPages.id, { onDelete: "cascade" })
    .notNull(),
  characterId: uuid("character_id")
    .references(() => characters.id, { onDelete: "cascade" })
    .notNull(),
  source: varchar("source", { length: 20 }).default("ai"),
  
  // NEW: Character state on this page
  emotionalState: varchar("emotional_state", { length: 60 }), // happy, scared, angry, determined, etc.
  action: text("action"), // What the character is doing on this page
  prominence: varchar("prominence", { length: 20 }), // primary, secondary, background
  
  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== PAGE LOCATION PRESENCE (enhanced) ==================== */

export const storyPageLocations = pgTable("story_page_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  pageId: uuid("page_id")
    .references(() => storyPages.id, { onDelete: "cascade" })
    .notNull(),
  locationId: uuid("location_id")
    .references(() => locations.id, { onDelete: "cascade" })
    .notNull(),
  source: varchar("source", { length: 20 }).default("ai"),
  
  // NEW: Location state on this page
  specificArea: varchar("specific_area", { length: 100 }), // "the kitchen", "front gate", etc.
  visualFocus: text("visual_focus"), // What aspect of location to emphasize visually
  
  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== NARRATIVE BEATS ==================== */

export const narrativeBeats = pgTable("narrative_beats", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),
  startPage: integer("start_page").notNull(),
  endPage: integer("end_page").notNull(),
  beatType: varchar("beat_type", { length: 40 }).notNull(), // setup, conflict, climax, resolution, etc.
  description: text("description"),
  emotionalTone: varchar("emotional_tone", { length: 60 }),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== SCENE TRANSITIONS ==================== */

export const sceneTransitions = pgTable("scene_transitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),
  fromPage: integer("from_page").notNull(),
  toPage: integer("to_page").notNull(),
  transitionType: varchar("transition_type", { length: 40 }), // cut, fade, time_jump, location_change, etc.
  description: text("description"),
  timeDelta: varchar("time_delta", { length: 60 }), // "moments later", "the next day", etc.
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
  entityId: uuid("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const coverChatSessions = pgTable("cover_chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const coverChatMessages = pgTable("cover_chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => coverChatSessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),

  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),

  userId: text("user_id").notNull(),

  paymentId: text("payment_id"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  amount: text("amount"),
  currency: text("currency").default("USD"),

  pdfUrl: text("pdf_url"),

  shippingAddress: jsonb("shipping_address"),

  gelatoOrderId: text("gelato_order_id"),
  gelatoStatus: text("gelato_status"),

  storyProductId: uuid("story_product_id")
  .references(() => storyProducts.id, { onDelete: "cascade" }),
  // .notNull(),


  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
