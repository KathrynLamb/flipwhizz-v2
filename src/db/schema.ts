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
  date
} from "drizzle-orm/pg-core";

/* ==================== USERS ==================== */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 120 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  hashedPassword: text("hashed_password"),  
  image: text("image"),
  tiktokAccessToken: text("tiktok_access_token"),
tiktokOpenId: text("tiktok_open_id"),
tiktokTokenExpiresAt: timestamp("tiktok_token_expires_at"),
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
  purchaseIntent: varchar("purchase_intent", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== STORIES ==================== */

export const stories = pgTable("stories", {
  id: uuid("id").primaryKey().defaultRandom(),

  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),

  // legacy columns still present in DB
  readerId: uuid("reader_id").references(() => readers.id, {
    onDelete: "set null",
  }),
  worldId: uuid("world_id"),
  bookNumber: integer("book_number"),

  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  tone: varchar("tone", { length: 80 }),
  length: integer("length"),
  fullDraft: text("full_draft"),

  status: varchar("status", { length: 30 }).default("planning"),
  storyConfirmed: boolean("story_confirmed").default(false).notNull(),
  public: boolean("public").default(false).notNull(),

  coverSpreadUrl: text("cover_spread_url"),
  coverPlan: jsonb("cover_plan"),
  coverPlanLocked: boolean("cover_plan_locked").default(false),

  authorLetter: jsonb("author_letter").$type<{
    opening: string;
    intention: string[];
    optionalTweaks: string[];
    invitation: string;
  }>(),

  paymentStatus: text("payment_status").default("pending"),
  paymentId: text("payment_id"),
  orderStatus: text("order_status").default("not_ready"),

  pdfUrl: text("pdf_url"),
  pdfUpdatedAt: timestamp("pdf_updated_at"),

  homePrintPdfUrl: text("home_print_pdf_url"),
  homePrintPdfUpdatedAt: timestamp("home_print_pdf_updated_at"),

  currentStep: integer("current_step").default(1),
  completedSteps: jsonb("completed_steps").default("[]"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== STORY PRODUCTS ==================== */

export const storyProducts = pgTable("story_products", {
  id: uuid("id").primaryKey().defaultRandom(),

  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),

  // What the user is intending to buy (can change)
  productType: varchar("product_type", { length: 30 }).default("undecided"),
  // 'undecided' | 'digital' | 'print' | 'gift'

  // Snapshot of pricing at time of checkout (not authoritative yet)
  estimatedPrice: integer("estimated_price"), // in cents
  currency: varchar("currency", { length: 10 }).default("GBP"),
  checkoutAddress: jsonb("checkout_address"),
  // Fulfilment flags
  requiresShipping: boolean("requires_shipping").default(false),
  requiresPdf: boolean("requires_pdf").default(true),

  locked: boolean("locked").default(false),
  // Lock once paid
  lockedAt: timestamp("locked_at"),

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
  imageUrl: text("image_url"),

  // Scene metadata
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

/* ==================== Story Edit Chat ==================== */

export const storyEditSessions = pgTable("story_edit_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),

  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull()
    .unique(), // One active edit session per story

  lastMessageAt: timestamp("last_message_at").defaultNow(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storyEditMessages = pgTable("story_edit_messages", {
  id: uuid("id").primaryKey().defaultRandom(),

  sessionId: uuid("session_id")
    .references(() => storyEditSessions.id, { onDelete: "cascade" })
    .notNull(),

  role: varchar("role", { length: 20 }).notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
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

  visualDetails: jsonb("visual_details"),
  personalityTraits: text("personality_traits"),

  locked: boolean("locked").default(false).notNull(),
  lockedAt: timestamp("locked_at"),

  // Reference images (URLs, not base64)
  portraitImageUrl: text("portrait_image_url"),
  portraitSource: varchar("portrait_source", { length: 20 }),

  fullBodyImageUrl: text("full_body_image_url"),
  referenceImageUrl: text("reference_image_url"),

  species: varchar("species", { length: 40 }).default("human"),
  // Values: "human", "dog", "cat", "rabbit", "horse", "bird", "fantasy", "other"
 
  breed: varchar("breed", { length: 100 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== CHARACTER OUTFITS (LEGACY - IMAGE BASED) ==================== */

/**
 * Legacy table for image-based outfit references.
 * Kept for backward compatibility.
 * For prompt-based outfit descriptions, use characterStoryOutfits instead.
 */
export const characterOutfits = pgTable("character_outfits", {
  id: uuid("id").primaryKey().defaultRandom(),

  characterId: uuid("character_id")
    .notNull()
    .references(() => characters.id, { onDelete: "cascade" }),

  outfitType: varchar("outfit_type", { length: 50 }).notNull(),
  // e.g., "casual", "winter", "swimwear", "formal", "custom-beach-party"

  name: varchar("name", { length: 100 }),
  // Optional friendly name: "Snow Gear", "Beach Outfit"

  description: text("description"),
  // What makes this outfit unique

  imageUrl: text("image_url").notNull(),
  // The actual portrait image

  isDefault: boolean("is_default").default(false),
  // Mark one as the fallback

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ==================== CHARACTER STORY OUTFITS (NEW - PROMPT BASED) ==================== */

/**
 * Story-specific outfit definitions for prompt injection.
 * These are TEXT DESCRIPTIONS designed to be injected into Gemini prompts.
 * Each character can have multiple outfit types per story (ski_gear, swimwear, etc.)
 */
export const characterStoryOutfits = pgTable(
  "character_story_outfits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    isDefault: boolean("is_default").default(false).notNull(),

    storyId: uuid("story_id")
      .references(() => stories.id, { onDelete: "cascade" })
      .notNull(),

    characterId: uuid("character_id")
      .references(() => characters.id, { onDelete: "cascade" })
      .notNull(),

    outfitKey: varchar("outfit_key", { length: 50 }).notNull(),
    // e.g., "ski_gear", "hot_tub", "indoor_casual", "sleeping", "default"

    outfitDescription: text("outfit_description").notNull(),
    // Detailed visual description for prompts, e.g.:
    // "Bright turquoise zip-up ski jacket with white trim, matching turquoise
    //  snow pants, pink knit beanie with white pom-pom, white ski gloves"

    triggerConditions: text("trigger_conditions"),
    // When this outfit should be used, e.g.:
    // "outdoor winter scenes, skiing, playing in snow, walking to ski lift"

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Ensure unique outfit key per character per story
    uniqueOutfitKey: uniqueIndex("character_story_outfits_unique_key").on(
      t.storyId,
      t.characterId,
      t.outfitKey
    ),
    // Fast lookup by story
    storyIdx: index("character_story_outfits_story_idx").on(t.storyId),
    // Fast lookup by character
    characterIdx: index("character_story_outfits_character_idx").on(
      t.characterId
    ),
  })
);

/* ==================== SPREAD CHARACTER OUTFITS (NEW) ==================== */

/**
 * Which outfit each character wears in each spread.
 * Links spreads to characterStoryOutfits via outfitKey.
 * outfitDescription is denormalized for fast prompt building.
 */
export const spreadCharacterOutfits = pgTable(
  "spread_character_outfits",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    spreadId: uuid("spread_id")
      .references(() => storySpreads.id, { onDelete: "cascade" })
      .notNull(),

    characterId: uuid("character_id")
      .references(() => characters.id, { onDelete: "cascade" })
      .notNull(),

    outfitKey: varchar("outfit_key", { length: 50 }).notNull(),
    // Links to characterStoryOutfits.outfitKey

    outfitDescription: text("outfit_description").notNull(),
    // Denormalized for fast prompt building - copied from characterStoryOutfits

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    // Ensure one outfit per character per spread
    uniqueCharacterSpread: uniqueIndex("spread_character_outfits_unique").on(
      t.spreadId,
      t.characterId
    ),
    // Fast lookup by spread
    spreadIdx: index("spread_character_outfits_spread_idx").on(t.spreadId),
  })
);

/* ==================== LOCATIONS ==================== */

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  aiSummary: text("ai_summary"),

  // Visual consistency fields
  visualDetails: jsonb("visual_details"), // { architecture, colors, lighting, keyFeatures, etc. }

  locked: boolean("locked").default(false).notNull(),
  lockedAt: timestamp("locked_at"),

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

  // Character arc tracking
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

  // Location significance
  significance: varchar("significance", { length: 40 }), // primary, secondary, minor
});

/* ==================== STORY STYLE GUIDE ==================== */

export const storyStyleGuide = pgTable("story_style_guide", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  summary: text("summary"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  sampleIllustrationUrl: text("sample_illustration_url"),
  negativePrompt: text("negative_prompt"),
  userNotes: text("user_notes"),
  typography: text("typography"), 
  styleGuideImage: text("style_guide_image"),
  artStyle: text("art_style"),
  colorPalette: jsonb("color_palette"),
  visualThemes: text("visual_themes"),
  generationId: text("generation_id"),
  approved: boolean("approved").default(false),
  feedback: text("feedback"),

});

/* ==================== STYLE GUIDE IMAGES ==================== */

// Add this to your schema.ts file, alongside the other table definitions

/* ==================== PROMO CODES ==================== */

export const promoCodes = pgTable(
  "promo_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    code: varchar("code", { length: 50 }).notNull(),
    label: varchar("label", { length: 100 }),

    // Discount rules
    discountType: varchar("discount_type", { length: 20 })
      .notNull()
      .default("percent"), // 'percent' | 'fixed'
    discountPercent: integer("discount_percent").default(0),
    discountFixedCents: integer("discount_fixed_cents").default(0),

    // Per-product overrides: null = use default, 0 = free (100% off)
    digitalOverride: integer("digital_override"),
    printOverride: integer("print_override"),
    giftOverride: integer("gift_override"),

    // Usage limits
    maxUses: integer("max_uses"),
    currentUses: integer("current_uses").notNull().default(0),
    maxUsesPerUser: integer("max_uses_per_user"),

    // Validity
    active: boolean("active").notNull().default(true),
    startsAt: timestamp("starts_at"),
    expiresAt: timestamp("expires_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ({
    codeUnique: uniqueIndex("promo_codes_code_unique").on(t.code),
    activeIdx: index("promo_codes_active_idx").on(t.active, t.code),
  })
);

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

/* ==================== PAGE CHARACTER PRESENCE ==================== */

export const storyPageCharacters = pgTable("story_page_characters", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),

  pageId: uuid("page_id")
    .references(() => storyPages.id, { onDelete: "cascade" })
    .notNull(),

  characterId: uuid("character_id")
    .references(() => characters.id, { onDelete: "cascade" })
    .notNull(),

  // LEGACY COLUMN — MUST EXIST
  canonical: boolean("canonical").default(true),

  source: varchar("source", { length: 20 }).default("ai"),

  emotionalState: varchar("emotional_state", { length: 60 }),
  action: text("action"),
  prominence: varchar("prominence", { length: 20 }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== PAGE LOCATION PRESENCE ==================== */

export const storyPageLocations = pgTable("story_page_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id").references(() => stories.id, {
    onDelete: "cascade",
  }),

  pageId: uuid("page_id")
    .references(() => storyPages.id, { onDelete: "cascade" })
    .notNull(),

  locationId: uuid("location_id")
    .references(() => locations.id, { onDelete: "cascade" })
    .notNull(),

  // LEGACY COLUMN — MUST EXIST
  canonical: boolean("canonical").default(true),

  source: varchar("source", { length: 20 }).default("ai"),

  specificArea: varchar("specific_area", { length: 100 }),
  visualFocus: text("visual_focus"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  name: varchar("name", { length: 120 }),
  dateOfBirth: varchar("dob", { length: 40 }),
  relationship: varchar("relationship", { length: 80 }),
  age: integer("age"),
  gender: varchar("gender", { length: 40 }),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").defaultNow(),
  // Add to your existing readers table definition:

  // Visual
  avatarUrl: text("avatar_url"),
  referenceImageUrl: text("reference_image_url"),

  // Identity (enhanced)
  pronouns: varchar("pronouns", { length: 50 }),
  dateOfBirthDate: date("date_of_birth"), // proper date type

  // Developmental companion
  personalityNotes: text("personality_notes"),
  interests: jsonb("interests").$type<string[]>().default([]),
  fears: jsonb("fears").$type<string[]>().default([]),
  readingLevel: varchar("reading_level", { length: 50 }),

  updatedAt: timestamp("updated_at").defaultNow(),
})

// New table:
export const readerInsights = pgTable("reader_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  readerId: uuid("reader_id")
    .notNull()
    .references(() => readers.id, { onDelete: "cascade" }),
  
  insightType: varchar("insight_type", { length: 50 }).notNull(),
  content: text("content").notNull(),
  confidence: integer("confidence").default(80),
  isActive: boolean("is_active").default(true),
  
  sourceType: varchar("source_type", { length: 30 }).default("chat"),
  sourceStoryId: uuid("source_story_id").references(() => stories.id, { onDelete: "set null" }),
  sourceConversationId: uuid("source_conversation_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
  resolvedReason: text("resolved_reason"),
}, (table) => ({
  readerIdx: index("reader_insights_reader_idx").on(table.readerId),
  activeIdx: index("reader_insights_active_idx").on(table.readerId, table.isActive),
  typeIdx: index("reader_insights_type_idx").on(table.insightType),
}));


/* ==================== CHAT ==================== */

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "cascade",
  }),
  readerId: uuid("reader_id").references(() => readers.id, {
    onDelete: "set null",
  }),
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

/* ==================== BOOK COVERS ==================== */

export const bookCovers = pgTable(
  "book_covers",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    storyId: uuid("story_id")
      .references(() => stories.id, { onDelete: "cascade" })
      .notNull(),

    /* ---------------- CORE IMAGE ---------------- */

    imageUrl: text("image_url").notNull(),

    // Full prompt used to generate THIS image
    promptUsed: text("prompt_used"),

    generationId: text("generation_id"),

    isSelected: boolean("is_selected").default(false).notNull(),

    /* ---------------- TEXT CONTENT ---------------- */

    titleText: varchar("title_text", { length: 200 }),
    subtitleText: varchar("subtitle_text", { length: 200 }),
    authorText: varchar("author_text", { length: 200 }),

    backCoverText: text("back_cover_text"),
    tagline: varchar("tagline", { length: 200 }),

    /* ---------------- DESIGN INTENT ---------------- */

    // Character IDs intentionally visible on the cover
    charactersShown: jsonb("characters_shown")
      .$type<string[]>() // character IDs
      .default([]),

    // Location IDs intentionally referenced on the cover
    locationsShown: jsonb("locations_shown").$type<string[]>().default([]),

    // Snapshot of style at time of generation
    styleSnapshot: jsonb("style_snapshot"),

    /* ---------------- LAYOUT / COMPOSITION ---------------- */

    layoutNotes: text("layout_notes"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    generationIdx: index("book_covers_generation_idx").on(t.generationId),
    storyIdx: index("book_covers_story_idx").on(t.storyId),
  })
);

/* ==================== COVER CHAT SESSIONS ==================== */

export const coverChatSessions = pgTable("cover_chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),

  // Latest structured plan (json)
  coverPlan: jsonb("cover_plan"),

  // Plan updated time
  planUpdatedAt: timestamp("plan_updated_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ==================== COVER CONVERSATIONS ==================== */

export const coverConversations = pgTable("cover_conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const coverChatMessages = pgTable("cover_chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => coverChatSessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ==================== ORDERS ==================== */

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

  storyProductId: uuid("story_product_id").references(() => storyProducts.id, {
    onDelete: "cascade",
  }),

  gelatoTrackingCode: text("gelato_tracking_code"),
  gelatoTrackingUrl: text("gelato_tracking_url"),
  gelatoMinDeliveryDate: date("gelato_min_delivery_date"),
  gelatoMaxDeliveryDate: date("gelato_max_delivery_date"),
  gelatoUpdatedAt: timestamp("gelato_updated_at"),

  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ==================== REVIEWS ==================== */

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),

  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),

  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Rating (1-5 emoji scale)
  rating: integer("rating").notNull(),

  // Guided text responses
  responses: jsonb("responses").$type<{
    bestMoment?: string;
    reaction?: string;
    recommend?: string;
  }>(),

  // Media URLs (uploaded to Cloudinary)
  mediaUrls: jsonb("media_urls").$type<
    {
      url: string;
      type: "photo" | "video";
      cloudinaryPublicId: string;
    }[]
  >().default([]),

  // Permissions
  permissions: jsonb("permissions").$type<{
    rightToShare: boolean;
    publishWebsite: boolean;
    publishSocial: boolean;
  }>().notNull(),

  // Linked promo code reward
  promoCodeId: uuid("promo_code_id").references(() => promoCodes.id, {
    onDelete: "set null",
  }),
  promoCode: varchar("promo_code", { length: 50 }),

  // Moderation
  published: boolean("published").default(false).notNull(),
  featured: boolean("featured").default(false).notNull(),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  storyIdx: index("reviews_story_idx").on(t.storyId),
  userIdx: index("reviews_user_idx").on(t.userId),
  publishedIdx: index("reviews_published_idx").on(t.published, t.featured),
}));

/* ==================== STORY SPREADS ==================== */

export const storySpreads = pgTable("story_spreads", {
  id: uuid("id").primaryKey().defaultRandom(),

  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull(),

  spreadIndex: integer("spread_index").notNull(), // 1-based

  sceneSummary: text("scene_summary"),

  leftPageId: uuid("left_page_id").references(() => storyPages.id, {
    onDelete: "set null",
  }),

  rightPageId: uuid("right_page_id").references(() => storyPages.id, {
    onDelete: "set null",
  }),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ==================== STORY WORKFLOW PROGRESS ==================== */

export const storyWorkflowProgress = pgTable("story_workflow_progress", {
  storyId: uuid("story_id")
    .primaryKey()
    .references(() => stories.id, { onDelete: "cascade" }),

  /* ========== Phase 1: World Extraction ========== */

  charactersExtracted: boolean("characters_extracted").notNull().default(false),
  charactersExtractedAt: timestamp("characters_extracted_at"),

  locationsExtracted: boolean("locations_extracted").notNull().default(false),
  locationsExtractedAt: timestamp("locations_extracted_at"),

  styleExtracted: boolean("style_extracted").notNull().default(false),
  styleExtractedAt: timestamp("style_extracted_at"),

  /* ========== Phase 2: Spread Building ========== */

  spreadsBuilt: boolean("spreads_built").notNull().default(false),
  spreadsBuiltAt: timestamp("spreads_built_at"),

  /* ========== Phase 3: Scene Composition ========== */

  charactersAssigned: boolean("characters_assigned").notNull().default(false),
  charactersAssignedAt: timestamp("characters_assigned_at"),

  locationsAssigned: boolean("locations_assigned").notNull().default(false),
  locationsAssignedAt: timestamp("locations_assigned_at"),

  /* ========== Phase 4: Outfit Management (NEW) ========== */

  outfitsExtracted: boolean("outfits_extracted").notNull().default(false),
  outfitsExtractedAt: timestamp("outfits_extracted_at"),

  outfitsAssigned: boolean("outfits_assigned").notNull().default(false),
  outfitsAssignedAt: timestamp("outfits_assigned_at"),

  /* ========== Phase 5: Spread Prompt Building ========== */
 
    promptsBuilt: boolean("prompts_built").notNull().default(false),
    promptsBuiltAt: timestamp("prompts_built_at"),
   

  /* ========== Overall Status ========== */

  worldComplete: boolean("world_complete").notNull().default(false),
  worldCompleteAt: timestamp("world_complete_at"),

  /* ========== LEGACY: Keep for backward compatibility ========== */

  worldExtracted: boolean("world_extracted").notNull().default(false),
  worldExtractedAt: timestamp("world_extracted_at"),
  scenesDecided: boolean("scenes_decided").notNull().default(false),
  scenesDecidedAt: timestamp("scenes_decided_at"),

  /* ========== Timestamps ========== */

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ==================== STORY INTENT ==================== */

export const storyIntent = pgTable("story_intent", {
  id: uuid("id").primaryKey(),
  storyId: uuid("story_id")
    .references(() => stories.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  primaryPurpose: text("primary_purpose").notNull(),
  intendedRecipient: text("intended_recipient").notNull(),

  emotionalTone: jsonb("emotional_tone").$type<string[]>().notNull(),

  occasion: text("occasion"),

  permanenceLevel: text("permanence_level")
    .$type<"playful" | "keepsake" | "legacy">()
    .notNull(),

  thingsToEmphasise: jsonb("things_to_emphasise").$type<string[]>().notNull(),

  thingsToAvoid: jsonb("things_to_avoid").$type<string[]>().notNull(),

  authorPerspective: text("author_perspective"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/* ==================== STORY SPREAD PRESENCE ==================== */

export const storySpreadPresence = pgTable("story_spread_presence", {
  id: uuid("id").primaryKey().defaultRandom(),

  spreadId: uuid("spread_id")
    .references(() => storySpreads.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  // Backward-compat primary location
  primaryLocationId: uuid("primary_location_id").references(
    () => locations.id,
    { onDelete: "set null" }
  ),

  // New multi-location model
  locations: jsonb("locations").$type<
    {
      locationId: string;
      role: "primary" | "secondary" | "background" | "referenced" | "memory";
      confidence: number;
      reason: string;
    }[]
  >(),

  characters: jsonb("characters").$type<
    {
      characterId: string;
      role: "primary" | "secondary" | "background";
      confidence: number;
      reason: string;
    }[]
  >(),

  excludedCharacters: jsonb("excluded_characters").$type<
    {
      characterId: string;
      reason: string;
    }[]
  >(),

  reasoning: text("reasoning"),

  source: varchar("source", { length: 20 }).default("claude"),

  locked: boolean("locked").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ==================== STORY SPREAD SCENE ==================== */

export const storySpreadScene = pgTable("story_spread_scene", {
  id: uuid("id").primaryKey().defaultRandom(),

  spreadId: uuid("spread_id")
    .references(() => storySpreads.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  // Human-readable description
  sceneSummary: text("scene_summary").notNull(),

  // This is what Gemini will receive
  illustrationPrompt: text("illustration_prompt").notNull(),

  compositionNotes: jsonb("composition_notes").$type<string[]>().default([]),

  mood: varchar("mood", { length: 80 }),

  doNotInclude: jsonb("do_not_include").$type<string[]>().default([]),

  // Safety + continuity
  negativePrompt: text("negative_prompt"),

  source: varchar("source", { length: 20 }).default("claude"),

  locked: boolean("locked").default(false),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


