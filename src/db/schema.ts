import { pgTable, text, varchar, timestamp, uuid, boolean, integer } from "drizzle-orm/pg-core";

/* -------------------- USERS (Auth) -------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------- PROJECTS -------------------- */

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  name: varchar("name", { length: 200 }).notNull(),
  storyBrief: text("story_brief"),          // JSON string of brief
  storyBasePrompt: text("story_base_prompt"),
  fullAiStory: text("full_ai_story"),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------- READERS -------------------- */

export const readers = pgTable("readers", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  projectId: uuid("project_id").references(() => projects.id),
  name: varchar("name", { length: 120 }),
  dateOfBirth: varchar("dob", { length: 40 }),
  relationship: varchar("relationship", { length: 80 }),
  gender: varchar("gender", { length: 40 }),
  aiSummary: text("ai_summary"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------- CHAT -------------------- */

export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  readerId: uuid("reader_id").references(() => readers.id),
  userId: uuid("user_id").references(() => users.id),
  status: varchar("status", { length: 20 }).default("open"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").references(() => chatSessions.id),
  role: varchar("role", { length: 20 }).notNull(),   // 'user'|'assistant'|'system'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* -------------------- MANUSCRIPTS -------------------- */

export const manuscripts = pgTable("manuscripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  version: integer("version").default(1),
  status: varchar("status", { length: 20 }).default("draft"),
  isLocked: boolean("is_locked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* -------------------- MANUSCRIPT PAGES -------------------- */

export const manuscriptPages = pgTable("manuscript_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  manuscriptId: uuid("manuscript_id").references(() => manuscripts.id),
  pageIndex: integer("page_index").notNull(),
  pageNumber: integer("page_number").notNull(),
  title: varchar("title", { length: 200 }),
  text: text("text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
