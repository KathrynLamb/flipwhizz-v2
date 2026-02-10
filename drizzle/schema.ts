import { pgTable, foreignKey, uuid, text, varchar, timestamp, unique, integer, boolean, jsonb, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const chatSessions = pgTable("chat_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id"),
	readerId: uuid("reader_id"),
	userId: text("user_id"),
	status: varchar({ length: 20 }).default('open'),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "chat_sessions_project_id_projects_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.readerId],
			foreignColumns: [readers.id],
			name: "chat_sessions_reader_id_readers_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "chat_sessions_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	name: varchar({ length: 200 }).notNull(),
	storyBrief: text("story_brief"),
	storyBasePrompt: text("story_base_prompt"),
	fullAiStory: text("full_ai_story"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "projects_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const readers = pgTable("readers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id"),
	projectId: uuid("project_id"),
	name: varchar({ length: 120 }),
	dob: varchar({ length: 40 }),
	relationship: varchar({ length: 80 }),
	gender: varchar({ length: 40 }),
	aiSummary: text("ai_summary"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "readers_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "readers_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const users = pgTable("users", {
	id: text().primaryKey().notNull(),
	name: varchar({ length: 120 }),
	email: varchar({ length: 255 }).notNull(),
	image: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const chatMessages = pgTable("chat_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	role: varchar({ length: 20 }).notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [chatSessions.id],
			name: "chat_messages_session_id_chat_sessions_id_fk"
		}).onDelete("cascade"),
]);

export const pageImages = pgTable("page_images", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	pageId: uuid("page_id").notNull(),
	url: text().notNull(),
	promptUsed: text("prompt_used"),
	seed: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.pageId],
			foreignColumns: [storyPages.id],
			name: "page_images_page_id_story_pages_id_fk"
		}).onDelete("cascade"),
]);

export const storyPages = pgTable("story_pages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	pageNumber: integer("page_number").notNull(),
	text: text().notNull(),
	illustrationPrompt: text("illustration_prompt"),
	imageId: uuid("image_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	imageUrl: text("image_url"),
	timeOfDay: varchar("time_of_day", { length: 40 }),
	weather: varchar({ length: 60 }),
	atmosphere: varchar({ length: 100 }),
	sceneType: varchar("scene_type", { length: 40 }),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_pages_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const storyProducts = pgTable("story_products", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	productType: varchar("product_type", { length: 30 }).default('undecided'),
	estimatedPrice: integer("estimated_price"),
	currency: varchar({ length: 10 }).default('GBP'),
	requiresShipping: boolean("requires_shipping").default(false),
	requiresPdf: boolean("requires_pdf").default(true),
	lockedAt: timestamp("locked_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	locked: boolean().default(false),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_products_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const orders = pgTable("orders", {
	id: text().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	userId: text("user_id").notNull(),
	paymentId: text("payment_id"),
	paymentStatus: text("payment_status").default('pending').notNull(),
	amount: text(),
	currency: text().default('USD'),
	pdfUrl: text("pdf_url"),
	shippingAddress: jsonb("shipping_address"),
	gelatoOrderId: text("gelato_order_id"),
	gelatoStatus: text("gelato_status"),
	status: text().default('pending').notNull(),
	submittedAt: timestamp("submitted_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	storyProductId: uuid("story_product_id"),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "orders_story_id_stories_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.storyProductId],
			foreignColumns: [storyProducts.id],
			name: "orders_story_product_id_story_products_id_fk"
		}).onDelete("cascade"),
]);

export const stories = pgTable("stories", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	projectId: uuid("project_id").notNull(),
	title: varchar({ length: 200 }).notNull(),
	description: text(),
	tone: varchar({ length: 80 }),
	length: integer(),
	fullDraft: text("full_draft"),
	status: varchar({ length: 30 }).default('planning'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	paymentStatus: text("payment_status").default('pending'),
	paymentId: text("payment_id"),
	storyConfirmed: boolean("story_confirmed").default(false).notNull(),
	pdfUrl: text("pdf_url"),
	pdfUpdatedAt: timestamp("pdf_updated_at", { mode: 'string' }),
	orderStatus: text("order_status").default('not_ready'),
	currentStep: integer("current_step").default(1),
	completedSteps: jsonb("completed_steps").default([]),
	authorLetter: jsonb("author_letter"),
	coverPlan: jsonb("cover_plan"),
	coverPlanLocked: boolean("cover_plan_locked").default(false),
	coverSpreadUrl: text("cover_spread_url"),
}, (table) => [
	foreignKey({
			columns: [table.projectId],
			foreignColumns: [projects.id],
			name: "stories_project_id_projects_id_fk"
		}).onDelete("cascade"),
]);

export const characters = pgTable("characters", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	appearance: text(),
	aiSummary: text("ai_summary"),
	portraitImageUrl: text("portrait_image_url"),
	referenceImageUrl: text("reference_image_url"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	visualDetails: jsonb("visual_details"),
	personalityTraits: text("personality_traits"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	locked: boolean().default(false).notNull(),
	lockedAt: timestamp("locked_at", { mode: 'string' }),
	fullBodyImageUrl: text("full_body_image_url"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "characters_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const styleGuideImages = pgTable("style_guide_images", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	styleGuideId: uuid("style_guide_id").notNull(),
	url: text().notNull(),
	type: varchar({ length: 20 }).notNull(),
	label: varchar({ length: 200 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	notes: text(),
}, (table) => [
	foreignKey({
			columns: [table.styleGuideId],
			foreignColumns: [storyStyleGuide.id],
			name: "style_guide_images_style_guide_id_story_style_guide_id_fk"
		}).onDelete("cascade"),
]);

export const storySpreads = pgTable("story_spreads", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	spreadIndex: integer("spread_index").notNull(),
	leftPageId: uuid("left_page_id"),
	rightPageId: uuid("right_page_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	sceneSummary: text("scene_summary"),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_spreads_story_id_stories_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.leftPageId],
			foreignColumns: [storyPages.id],
			name: "story_spreads_left_page_id_story_pages_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.rightPageId],
			foreignColumns: [storyPages.id],
			name: "story_spreads_right_page_id_story_pages_id_fk"
		}).onDelete("set null"),
]);

export const storyIntent = pgTable("story_intent", {
	id: uuid().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	primaryPurpose: text("primary_purpose").notNull(),
	intendedRecipient: text("intended_recipient").notNull(),
	emotionalTone: jsonb("emotional_tone").notNull(),
	occasion: text(),
	permanenceLevel: text("permanence_level").notNull(),
	thingsToEmphasise: jsonb("things_to_emphasise").notNull(),
	thingsToAvoid: jsonb("things_to_avoid").notNull(),
	authorPerspective: text("author_perspective"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_intent_story_id_stories_id_fk"
		}).onDelete("cascade"),
	unique("story_intent_story_id_unique").on(table.storyId),
]);

export const storySpreadScene = pgTable("story_spread_scene", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	spreadId: uuid("spread_id").notNull(),
	sceneSummary: text("scene_summary").notNull(),
	illustrationPrompt: text("illustration_prompt").notNull(),
	compositionNotes: jsonb("composition_notes").default([]),
	mood: varchar({ length: 80 }),
	doNotInclude: jsonb("do_not_include").default([]),
	negativePrompt: text("negative_prompt"),
	source: varchar({ length: 20 }).default('claude'),
	locked: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.spreadId],
			foreignColumns: [storySpreads.id],
			name: "story_spread_scene_spread_id_story_spreads_id_fk"
		}).onDelete("cascade"),
	unique("story_spread_scene_spread_id_unique").on(table.spreadId),
]);

export const bookCovers = pgTable("book_covers", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	imageUrl: text("image_url").notNull(),
	promptUsed: text("prompt_used"),
	generationId: text("generation_id"),
	isSelected: boolean("is_selected").default(false).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	titleText: varchar("title_text", { length: 200 }),
	subtitleText: varchar("subtitle_text", { length: 200 }),
	authorText: varchar("author_text", { length: 200 }),
	backCoverText: text("back_cover_text"),
	tagline: varchar({ length: 200 }),
	charactersShown: jsonb("characters_shown").default([]),
	locationsShown: jsonb("locations_shown").default([]),
	styleSnapshot: jsonb("style_snapshot"),
	layoutNotes: text("layout_notes"),
}, (table) => [
	index("book_covers_generation_idx").using("btree", table.generationId.asc().nullsLast().op("text_ops")),
	index("book_covers_story_idx").using("btree", table.storyId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "book_covers_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const storySpreadPresence = pgTable("story_spread_presence", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	spreadId: uuid("spread_id").notNull(),
	primaryLocationId: uuid("primary_location_id"),
	characters: jsonb(),
	excludedCharacters: jsonb("excluded_characters"),
	reasoning: text(),
	source: varchar({ length: 20 }).default('claude'),
	locked: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.spreadId],
			foreignColumns: [storySpreads.id],
			name: "story_spread_presence_spread_id_story_spreads_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.primaryLocationId],
			foreignColumns: [locations.id],
			name: "story_spread_presence_primary_location_id_locations_id_fk"
		}).onDelete("set null"),
	unique("story_spread_presence_spread_id_unique").on(table.spreadId),
]);

export const pageEntities = pgTable("page_entities", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	pageId: uuid("page_id").notNull(),
	entityType: varchar("entity_type", { length: 20 }).notNull(),
	entityId: uuid("entity_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.pageId],
			foreignColumns: [storyPages.id],
			name: "page_entities_page_id_story_pages_id_fk"
		}).onDelete("cascade"),
]);

export const locations = pgTable("locations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	name: varchar({ length: 200 }).notNull(),
	description: text(),
	aiSummary: text("ai_summary"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	portraitImageUrl: text("portrait_image_url"),
	referenceImageUrl: text("reference_image_url"),
	visualDetails: jsonb("visual_details"),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	locked: boolean().default(false).notNull(),
	lockedAt: timestamp("locked_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "locations_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const coverChatSessions = pgTable("cover_chat_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	coverPlan: jsonb("cover_plan"),
	planUpdatedAt: timestamp("plan_updated_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "cover_chat_sessions_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const coverChatMessages = pgTable("cover_chat_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	role: varchar({ length: 20 }).notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [coverChatSessions.id],
			name: "cover_chat_messages_session_id_cover_chat_sessions_id_fk"
		}).onDelete("cascade"),
]);

export const narrativeBeats = pgTable("narrative_beats", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	startPage: integer("start_page").notNull(),
	endPage: integer("end_page").notNull(),
	beatType: varchar("beat_type", { length: 40 }).notNull(),
	description: text(),
	emotionalTone: varchar("emotional_tone", { length: 60 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "narrative_beats_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const storyPageLocations = pgTable("story_page_locations", {
	pageId: uuid("page_id").notNull(),
	locationId: uuid("location_id").notNull(),
	source: varchar({ length: 20 }).default('ai'),
	id: uuid().defaultRandom().primaryKey().notNull(),
	specificArea: varchar("specific_area", { length: 100 }),
	visualFocus: text("visual_focus"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	canonical: boolean().default(true),
	storyId: uuid("story_id"),
}, (table) => [
	foreignKey({
			columns: [table.pageId],
			foreignColumns: [storyPages.id],
			name: "story_page_locations_page_id_story_pages_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [locations.id],
			name: "story_page_locations_location_id_locations_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_page_locations_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const storyCharacters = pgTable("story_characters", {
	storyId: uuid("story_id").notNull(),
	characterId: uuid("character_id").notNull(),
	role: varchar({ length: 40 }),
	arcSummary: text("arc_summary"),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_characters_story_id_stories_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.characterId],
			foreignColumns: [characters.id],
			name: "story_characters_character_id_characters_id_fk"
		}).onDelete("cascade"),
]);

export const storyPageCharacters = pgTable("story_page_characters", {
	pageId: uuid("page_id").notNull(),
	characterId: uuid("character_id").notNull(),
	source: varchar({ length: 20 }).default('ai'),
	id: uuid().defaultRandom().primaryKey().notNull(),
	emotionalState: varchar("emotional_state", { length: 60 }),
	action: text(),
	prominence: varchar({ length: 20 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	canonical: boolean().default(true),
	storyId: uuid("story_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.pageId],
			foreignColumns: [storyPages.id],
			name: "story_page_characters_page_id_story_pages_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.characterId],
			foreignColumns: [characters.id],
			name: "story_page_characters_character_id_characters_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_page_characters_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const storyLocations = pgTable("story_locations", {
	storyId: uuid("story_id").notNull(),
	locationId: uuid("location_id").notNull(),
	significance: varchar({ length: 40 }),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_locations_story_id_stories_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.locationId],
			foreignColumns: [locations.id],
			name: "story_locations_location_id_locations_id_fk"
		}).onDelete("cascade"),
]);

export const characterRelationships = pgTable("character_relationships", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	characterId: uuid("character_id").notNull(),
	relatedCharacterId: uuid("related_character_id").notNull(),
	relationshipType: varchar("relationship_type", { length: 40 }).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "character_relationships_story_id_stories_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.characterId],
			foreignColumns: [characters.id],
			name: "character_relationships_character_id_characters_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.relatedCharacterId],
			foreignColumns: [characters.id],
			name: "character_relationships_related_character_id_characters_id_fk"
		}).onDelete("cascade"),
]);

export const sceneTransitions = pgTable("scene_transitions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	fromPage: integer("from_page").notNull(),
	toPage: integer("to_page").notNull(),
	transitionType: varchar("transition_type", { length: 40 }),
	description: text(),
	timeDelta: varchar("time_delta", { length: 60 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "scene_transitions_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const storyEditSessions = pgTable("story_edit_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	lastMessageAt: timestamp("last_message_at", { mode: 'string' }).defaultNow(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_edit_sessions_story_id_stories_id_fk"
		}).onDelete("cascade"),
	unique("story_edit_sessions_story_id_unique").on(table.storyId),
]);

export const storyEditMessages = pgTable("story_edit_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	role: varchar({ length: 20 }).notNull(),
	content: text().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [storyEditSessions.id],
			name: "story_edit_messages_session_id_story_edit_sessions_id_fk"
		}).onDelete("cascade"),
]);

export const storyWorkflowProgress = pgTable("story_workflow_progress", {
	storyId: uuid("story_id").primaryKey().notNull(),
	worldExtracted: boolean("world_extracted").default(false).notNull(),
	scenesDecided: boolean("scenes_decided").default(false).notNull(),
	worldExtractedAt: timestamp("world_extracted_at", { mode: 'string' }),
	scenesDecidedAt: timestamp("scenes_decided_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	charactersExtracted: boolean("characters_extracted").default(false).notNull(),
	charactersExtractedAt: timestamp("characters_extracted_at", { mode: 'string' }),
	locationsExtracted: boolean("locations_extracted").default(false).notNull(),
	locationsExtractedAt: timestamp("locations_extracted_at", { mode: 'string' }),
	styleExtracted: boolean("style_extracted").default(false).notNull(),
	styleExtractedAt: timestamp("style_extracted_at", { mode: 'string' }),
	spreadsBuilt: boolean("spreads_built").default(false).notNull(),
	spreadsBuiltAt: timestamp("spreads_built_at", { mode: 'string' }),
	charactersAssigned: boolean("characters_assigned").default(false).notNull(),
	charactersAssignedAt: timestamp("characters_assigned_at", { mode: 'string' }),
	locationsAssigned: boolean("locations_assigned").default(false).notNull(),
	locationsAssignedAt: timestamp("locations_assigned_at", { mode: 'string' }),
	worldComplete: boolean("world_complete").default(false).notNull(),
	worldCompleteAt: timestamp("world_complete_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_workflow_progress_story_id_stories_id_fk"
		}).onDelete("cascade"),
]);

export const storyStyleGuide = pgTable("story_style_guide", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	storyId: uuid("story_id").notNull(),
	summary: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
	sampleIllustrationUrl: text("sample_illustration_url"),
	negativePrompt: text("negative_prompt"),
	userNotes: text("user_notes"),
	styleGuideImage: text("style_guide_image"),
	artStyle: varchar("art_style", { length: 100 }),
	colorPalette: jsonb("color_palette"),
	visualThemes: text("visual_themes"),
	generationId: text("generation_id"),
	approved: boolean().default(false),
	feedback: text(),
}, (table) => [
	foreignKey({
			columns: [table.storyId],
			foreignColumns: [stories.id],
			name: "story_style_guide_story_id_stories_id_fk"
		}).onDelete("cascade"),
	unique("story_style_guide_story_id_unique").on(table.storyId),
]);
