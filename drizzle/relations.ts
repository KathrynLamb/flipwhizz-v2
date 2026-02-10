import { relations } from "drizzle-orm/relations";
import { projects, chatSessions, readers, users, chatMessages, storyPages, pageImages, stories, storyProducts, orders, characters, storyStyleGuide, styleGuideImages, storySpreads, storyIntent, storySpreadScene, bookCovers, storySpreadPresence, locations, pageEntities, coverChatSessions, coverChatMessages, narrativeBeats, storyPageLocations, storyCharacters, storyPageCharacters, storyLocations, characterRelationships, sceneTransitions, storyEditSessions, storyEditMessages, storyWorkflowProgress } from "./schema";

export const chatSessionsRelations = relations(chatSessions, ({one, many}) => ({
	project: one(projects, {
		fields: [chatSessions.projectId],
		references: [projects.id]
	}),
	reader: one(readers, {
		fields: [chatSessions.readerId],
		references: [readers.id]
	}),
	user: one(users, {
		fields: [chatSessions.userId],
		references: [users.id]
	}),
	chatMessages: many(chatMessages),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	chatSessions: many(chatSessions),
	user: one(users, {
		fields: [projects.userId],
		references: [users.id]
	}),
	readers: many(readers),
	stories: many(stories),
}));

export const readersRelations = relations(readers, ({one, many}) => ({
	chatSessions: many(chatSessions),
	user: one(users, {
		fields: [readers.userId],
		references: [users.id]
	}),
	project: one(projects, {
		fields: [readers.projectId],
		references: [projects.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	chatSessions: many(chatSessions),
	projects: many(projects),
	readers: many(readers),
	characters: many(characters),
	locations: many(locations),
}));

export const chatMessagesRelations = relations(chatMessages, ({one}) => ({
	chatSession: one(chatSessions, {
		fields: [chatMessages.sessionId],
		references: [chatSessions.id]
	}),
}));

export const pageImagesRelations = relations(pageImages, ({one}) => ({
	storyPage: one(storyPages, {
		fields: [pageImages.pageId],
		references: [storyPages.id]
	}),
}));

export const storyPagesRelations = relations(storyPages, ({one, many}) => ({
	pageImages: many(pageImages),
	story: one(stories, {
		fields: [storyPages.storyId],
		references: [stories.id]
	}),
	storySpreads_leftPageId: many(storySpreads, {
		relationName: "storySpreads_leftPageId_storyPages_id"
	}),
	storySpreads_rightPageId: many(storySpreads, {
		relationName: "storySpreads_rightPageId_storyPages_id"
	}),
	pageEntities: many(pageEntities),
	storyPageLocations: many(storyPageLocations),
	storyPageCharacters: many(storyPageCharacters),
}));

export const storiesRelations = relations(stories, ({one, many}) => ({
	storyPages: many(storyPages),
	storyProducts: many(storyProducts),
	orders: many(orders),
	project: one(projects, {
		fields: [stories.projectId],
		references: [projects.id]
	}),
	storySpreads: many(storySpreads),
	storyIntents: many(storyIntent),
	bookCovers: many(bookCovers),
	coverChatSessions: many(coverChatSessions),
	narrativeBeats: many(narrativeBeats),
	storyPageLocations: many(storyPageLocations),
	storyCharacters: many(storyCharacters),
	storyPageCharacters: many(storyPageCharacters),
	storyLocations: many(storyLocations),
	characterRelationships: many(characterRelationships),
	sceneTransitions: many(sceneTransitions),
	storyEditSessions: many(storyEditSessions),
	storyWorkflowProgresses: many(storyWorkflowProgress),
	storyStyleGuides: many(storyStyleGuide),
}));

export const storyProductsRelations = relations(storyProducts, ({one, many}) => ({
	story: one(stories, {
		fields: [storyProducts.storyId],
		references: [stories.id]
	}),
	orders: many(orders),
}));

export const ordersRelations = relations(orders, ({one}) => ({
	story: one(stories, {
		fields: [orders.storyId],
		references: [stories.id]
	}),
	storyProduct: one(storyProducts, {
		fields: [orders.storyProductId],
		references: [storyProducts.id]
	}),
}));

export const charactersRelations = relations(characters, ({one, many}) => ({
	user: one(users, {
		fields: [characters.userId],
		references: [users.id]
	}),
	storyCharacters: many(storyCharacters),
	storyPageCharacters: many(storyPageCharacters),
	characterRelationships_characterId: many(characterRelationships, {
		relationName: "characterRelationships_characterId_characters_id"
	}),
	characterRelationships_relatedCharacterId: many(characterRelationships, {
		relationName: "characterRelationships_relatedCharacterId_characters_id"
	}),
}));

export const styleGuideImagesRelations = relations(styleGuideImages, ({one}) => ({
	storyStyleGuide: one(storyStyleGuide, {
		fields: [styleGuideImages.styleGuideId],
		references: [storyStyleGuide.id]
	}),
}));

export const storyStyleGuideRelations = relations(storyStyleGuide, ({one, many}) => ({
	styleGuideImages: many(styleGuideImages),
	story: one(stories, {
		fields: [storyStyleGuide.storyId],
		references: [stories.id]
	}),
}));

export const storySpreadsRelations = relations(storySpreads, ({one, many}) => ({
	story: one(stories, {
		fields: [storySpreads.storyId],
		references: [stories.id]
	}),
	storyPage_leftPageId: one(storyPages, {
		fields: [storySpreads.leftPageId],
		references: [storyPages.id],
		relationName: "storySpreads_leftPageId_storyPages_id"
	}),
	storyPage_rightPageId: one(storyPages, {
		fields: [storySpreads.rightPageId],
		references: [storyPages.id],
		relationName: "storySpreads_rightPageId_storyPages_id"
	}),
	storySpreadScenes: many(storySpreadScene),
	storySpreadPresences: many(storySpreadPresence),
}));

export const storyIntentRelations = relations(storyIntent, ({one}) => ({
	story: one(stories, {
		fields: [storyIntent.storyId],
		references: [stories.id]
	}),
}));

export const storySpreadSceneRelations = relations(storySpreadScene, ({one}) => ({
	storySpread: one(storySpreads, {
		fields: [storySpreadScene.spreadId],
		references: [storySpreads.id]
	}),
}));

export const bookCoversRelations = relations(bookCovers, ({one}) => ({
	story: one(stories, {
		fields: [bookCovers.storyId],
		references: [stories.id]
	}),
}));

export const storySpreadPresenceRelations = relations(storySpreadPresence, ({one}) => ({
	storySpread: one(storySpreads, {
		fields: [storySpreadPresence.spreadId],
		references: [storySpreads.id]
	}),
	location: one(locations, {
		fields: [storySpreadPresence.primaryLocationId],
		references: [locations.id]
	}),
}));

export const locationsRelations = relations(locations, ({one, many}) => ({
	storySpreadPresences: many(storySpreadPresence),
	user: one(users, {
		fields: [locations.userId],
		references: [users.id]
	}),
	storyPageLocations: many(storyPageLocations),
	storyLocations: many(storyLocations),
}));

export const pageEntitiesRelations = relations(pageEntities, ({one}) => ({
	storyPage: one(storyPages, {
		fields: [pageEntities.pageId],
		references: [storyPages.id]
	}),
}));

export const coverChatSessionsRelations = relations(coverChatSessions, ({one, many}) => ({
	story: one(stories, {
		fields: [coverChatSessions.storyId],
		references: [stories.id]
	}),
	coverChatMessages: many(coverChatMessages),
}));

export const coverChatMessagesRelations = relations(coverChatMessages, ({one}) => ({
	coverChatSession: one(coverChatSessions, {
		fields: [coverChatMessages.sessionId],
		references: [coverChatSessions.id]
	}),
}));

export const narrativeBeatsRelations = relations(narrativeBeats, ({one}) => ({
	story: one(stories, {
		fields: [narrativeBeats.storyId],
		references: [stories.id]
	}),
}));

export const storyPageLocationsRelations = relations(storyPageLocations, ({one}) => ({
	storyPage: one(storyPages, {
		fields: [storyPageLocations.pageId],
		references: [storyPages.id]
	}),
	location: one(locations, {
		fields: [storyPageLocations.locationId],
		references: [locations.id]
	}),
	story: one(stories, {
		fields: [storyPageLocations.storyId],
		references: [stories.id]
	}),
}));

export const storyCharactersRelations = relations(storyCharacters, ({one}) => ({
	story: one(stories, {
		fields: [storyCharacters.storyId],
		references: [stories.id]
	}),
	character: one(characters, {
		fields: [storyCharacters.characterId],
		references: [characters.id]
	}),
}));

export const storyPageCharactersRelations = relations(storyPageCharacters, ({one}) => ({
	storyPage: one(storyPages, {
		fields: [storyPageCharacters.pageId],
		references: [storyPages.id]
	}),
	character: one(characters, {
		fields: [storyPageCharacters.characterId],
		references: [characters.id]
	}),
	story: one(stories, {
		fields: [storyPageCharacters.storyId],
		references: [stories.id]
	}),
}));

export const storyLocationsRelations = relations(storyLocations, ({one}) => ({
	story: one(stories, {
		fields: [storyLocations.storyId],
		references: [stories.id]
	}),
	location: one(locations, {
		fields: [storyLocations.locationId],
		references: [locations.id]
	}),
}));

export const characterRelationshipsRelations = relations(characterRelationships, ({one}) => ({
	story: one(stories, {
		fields: [characterRelationships.storyId],
		references: [stories.id]
	}),
	character_characterId: one(characters, {
		fields: [characterRelationships.characterId],
		references: [characters.id],
		relationName: "characterRelationships_characterId_characters_id"
	}),
	character_relatedCharacterId: one(characters, {
		fields: [characterRelationships.relatedCharacterId],
		references: [characters.id],
		relationName: "characterRelationships_relatedCharacterId_characters_id"
	}),
}));

export const sceneTransitionsRelations = relations(sceneTransitions, ({one}) => ({
	story: one(stories, {
		fields: [sceneTransitions.storyId],
		references: [stories.id]
	}),
}));

export const storyEditSessionsRelations = relations(storyEditSessions, ({one, many}) => ({
	story: one(stories, {
		fields: [storyEditSessions.storyId],
		references: [stories.id]
	}),
	storyEditMessages: many(storyEditMessages),
}));

export const storyEditMessagesRelations = relations(storyEditMessages, ({one}) => ({
	storyEditSession: one(storyEditSessions, {
		fields: [storyEditMessages.sessionId],
		references: [storyEditSessions.id]
	}),
}));

export const storyWorkflowProgressRelations = relations(storyWorkflowProgress, ({one}) => ({
	story: one(stories, {
		fields: [storyWorkflowProgress.storyId],
		references: [stories.id]
	}),
}));