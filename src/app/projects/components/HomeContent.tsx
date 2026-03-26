// src/app/projects/components/HomeContent.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  BookOpen,
  Sparkles,
  Globe2,
  User,
  Clock,
  Pencil,
  Check,
  X,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface Story {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  paymentStatus: string;
  readerId: string | null;
  worldId: string | null;
  bookNumber: number | null;
  coverImageUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface WorldData {
  id: string;
  name: string;
  description: string | null;
  tonality: string | null;
  themes: string[];
  coverImageUrl: string | null;
  role: string | null;
  stories: Story[];
}

interface ReaderData {
  id: string;
  name: string | null;
  gender: string | null;
  aiSummary: string | null;
  worlds: WorldData[];
  standaloneStories: Story[];
}

interface HomeContentProps {
  readers: ReaderData[];
  orphanStories: Story[];
  totalStories: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function HomeContent({
  readers,
  orphanStories,
  totalStories,
}: HomeContentProps) {
  const hasContent = readers.length > 0 || orphanStories.length > 0;

  return (
    <div className="relative z-10">
      {/* Hero */}
      <section className="px-5 lg:px-8 pt-10 lg:pt-14 pb-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-3xl lg:text-5xl font-extrabold tracking-tight leading-tight"
                style={{
                  color: "#2D2235",
                  fontFamily: "Bricolage Grotesque, sans-serif",
                }}
              >
                Your Stories
              </h1>
              <p className="mt-2 text-base lg:text-lg text-gray-500 max-w-lg font-medium">
                Every adventure starts here. What will you create next?
              </p>
            </div>
            {totalStories > 0 && (
              <p
                className="text-sm font-semibold px-3 py-1.5 rounded-full"
                style={{
                  background: "rgba(217,69,144,0.08)",
                  color: "#D94590",
                }}
              >
                {totalStories} {totalStories === 1 ? "story" : "stories"}
              </p>
            )}
          </div>
          <div
            className="mt-6 h-[3px] rounded-full w-32"
            style={{
              background:
                "linear-gradient(90deg, #F28B7B, #F5A862, #F5CE62, #7DD4A8, #6DBCE0, #A78BDA)",
            }}
          />
        </div>
      </section>

      {/* Content */}
      <section className="px-5 lg:px-8 pb-24">
        <div className="mx-auto max-w-7xl">
          {!hasContent ? (
            <EmptyState />
          ) : (
            <div className="mt-4 space-y-8">
              {/* Readers with their worlds and books */}
              {readers.map((reader) => (
                <ReaderSection key={reader.id} reader={reader} />
              ))}

              {/* Orphan stories (no reader, no world) */}
              {orphanStories.length > 0 && (
                <div>
                  <h2
                    className="text-sm font-semibold uppercase tracking-wide mb-4"
                    style={{ color: "#2D2235", opacity: 0.4 }}
                  >
                    Earlier Stories
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {orphanStories.map((story) => (
                      <StoryCard key={story.id} story={story} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// READER SECTION
// ============================================================================

function ReaderSection({ reader }: { reader: ReaderData }) {
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(reader.name || "");

  const totalBooks =
    reader.worlds.reduce((sum, w) => sum + w.stories.length, 0) +
    reader.standaloneStories.length;

  const totalWorlds = reader.worlds.length;

  // Parse interests from aiSummary if present
  const interests = reader.aiSummary
    ?.split("|")
    .find((s) => s.trim().startsWith("Interests:"))
    ?.replace("Interests:", "")
    .trim()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  async function saveReaderName() {
    if (!nameValue.trim()) return;
    try {
      await fetch(`/api/readers/${reader.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      setEditingName(false);
    } catch {
      // Silently fail — name will revert on refresh
      setEditingName(false);
    }
  }

  return (
    <div>
      {/* Reader header */}
      <div
      onClick={() => setExpanded(!expanded)}
      className="w-full flex items-center gap-3 group mb-4 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
    >
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #D94590, #7B5EA7)",
          }}
        >
          <User className="w-5 h-5 text-white" />
        </div>

        {/* Name + stats */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            {editingName ? (
              <div
                className="flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveReaderName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="text-xl font-bold text-[#2D2235] bg-transparent border-b-2 
                             border-[#D94590] outline-none w-40"
                  style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
                  autoFocus
                />
                <button
                  onClick={saveReaderName}
                  className="p-1 hover:bg-[#D94590]/10 rounded-full"
                >
                  <Check className="w-4 h-4 text-[#D94590]" />
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="p-1 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ) : (
              <>
                <h2
                  className="text-xl font-bold text-[#2D2235] truncate"
                  style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
                >
                  {reader.name || "Unnamed Reader"}
                </h2>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingName(true);
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 
                             rounded-full transition-opacity"
                >
                  <Pencil className="w-3 h-3 text-gray-400" />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-400">
              {totalWorlds} {totalWorlds === 1 ? "world" : "worlds"}
            </span>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">
              {totalBooks} {totalBooks === 1 ? "book" : "books"}
            </span>
            {interests && interests.length > 0 && (
              <>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400 truncate">
                  Loves {interests.slice(0, 3).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Expand chevron */}
        <div className="flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-300" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-300" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="ml-14 space-y-6">
          {/* Worlds */}
          {reader.worlds.map((world) => (
            <WorldSection
              key={world.id}
              world={world}
              readerName={reader.name}
            />
          ))}

          {/* Standalone stories (reader but no world) */}
          {reader.standaloneStories.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Standalone Stories
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reader.standaloneStories.map((story) => (
                  <StoryCard key={story.id} story={story} />
                ))}
              </div>
            </div>
          )}

          {/* Create new book for this reader */}
          <Link
            href={`/projects/new`}
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 
                       rounded-[14px] border-2 border-dashed border-[#D94590]/20 
                       text-[#D94590] hover:bg-[#D94590]/5 hover:border-[#D94590]/30 
                       transition-all"
          >
            <Plus className="w-4 h-4" />
            New story for {reader.name || "this reader"}
          </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WORLD SECTION
// ============================================================================

function WorldSection({
  world,
  readerName,
}: {
  world: WorldData;
  readerName: string | null;
}) {
  const [expanded, setExpanded] = useState(true);

  const nextBookNumber =
    world.stories.length > 0
      ? Math.max(...world.stories.map((s) => s.bookNumber ?? 0)) + 1
      : 1;

  return (
    <div>
      {/* World header */}
      <div
      onClick={() => setExpanded(!expanded)}
      className="w-full flex items-center gap-2.5 group mb-3 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
    >
        {/* World icon */}
        <div
          className="w-8 h-8 rounded-[10px] flex-shrink-0 flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, rgba(123,94,167,0.12), rgba(217,69,144,0.12))",
          }}
        >
          <Globe2 className="w-4 h-4 text-[#7B5EA7]" />
        </div>

        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <h3
              className="text-base font-bold text-[#2D2235] truncate"
              style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
            >
              {world.name}
            </h3>
            <span className="text-xs text-gray-400">
              {world.stories.length}{" "}
              {world.stories.length === 1 ? "book" : "books"}
            </span>
          </div>
          {world.description && (
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {world.description}
            </p>
          )}
        </div>

        {/* Theme pills */}
        <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
          {world.themes.slice(0, 2).map((theme) => (
            <span
              key={theme}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: "rgba(123,94,167,0.08)",
                color: "#7B5EA7",
              }}
            >
              {theme}
            </span>
          ))}
        </div>

        <div className="flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-300" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-300" />
          )}
        </div>
      </div>

      {/* Books in this world */}
      {expanded && (
        <div className="ml-10">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {world.stories.map((story) => (
              <StoryCard
                key={story.id}
                story={story}
                showBookNumber
              />
            ))}

            {/* Add next book */}
            <Link
              href={`/projects/new?worldId=${world.id}&bookNumber=${nextBookNumber}`}
              className="flex items-center justify-center gap-2 p-6 rounded-[18px] 
                         border-2 border-dashed border-[#D94590]/15 text-[#D94590]/60 
                         hover:border-[#D94590]/30 hover:text-[#D94590] hover:bg-[#D94590]/3 
                         transition-all min-h-[140px] group"
            >
              <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="text-sm font-medium">
                Book {nextBookNumber}
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STORY CARD
// ============================================================================

function StoryCard({
  story,
  showBookNumber = false,
}: {
  story: Story;
  showBookNumber?: boolean;
}) {
  const statusColors: Record<string, { bg: string; text: string; label: string }> = {
    planning: { bg: "rgba(245,168,98,0.1)", text: "#B87A3D", label: "Planning" },
    paged: { bg: "rgba(109,188,224,0.1)", text: "#4A8FB0", label: "Story Ready" },
    pages_ready: { bg: "rgba(109,188,224,0.1)", text: "#4A8FB0", label: "Pages Ready" },
    illustrating: { bg: "rgba(167,139,218,0.1)", text: "#7B5EA7", label: "Illustrating" },
    complete: { bg: "rgba(125,212,168,0.1)", text: "#2D6A4F", label: "Complete" },
  };

  const statusInfo = statusColors[story.status] ?? statusColors.planning;

  return (
    <Link
      href={`/stories/${story.id}`}
      className="block rounded-[18px] bg-white border border-gray-100 overflow-hidden 
                 hover:border-[#D94590]/20 hover:shadow-lg transition-all group"
    >
      {/* Cover image */}
      <div className="relative h-36 bg-gradient-to-br from-[#D94590]/8 to-[#7B5EA7]/8 overflow-hidden">
        {story.coverImageUrl ? (
          <img
            src={story.coverImageUrl}
            alt={story.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-[#D94590]/20" />
          </div>
        )}

        {/* Book number badge */}
        {showBookNumber && story.bookNumber && (
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold 
                        bg-white/90 backdrop-blur-sm shadow-sm"
            style={{ color: "#D94590" }}
          >
            Book {story.bookNumber}
          </div>
        )}

        {/* Status badge */}
        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] 
                      font-semibold uppercase tracking-wide backdrop-blur-sm"
          style={{ background: statusInfo.bg, color: statusInfo.text }}
        >
          {statusInfo.label}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h4
          className="font-bold text-[#2D2235] text-sm truncate group-hover:text-[#D94590] 
                     transition-colors"
          style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
        >
          {story.title}
        </h4>
        {story.description && (
          <p className="text-xs text-gray-400 mt-1 line-clamp-2">
            {story.description}
          </p>
        )}
        {story.updatedAt && (
          <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-300">
            <Clock className="w-3 h-3" />
            {new Date(story.updatedAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </div>
        )}
      </div>
    </Link>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  return (
    <div className="mt-8 rounded-[22px] overflow-hidden border-2 border-gray-100">
      <div className="bg-white px-8 py-16 lg:py-24 text-center">
        <div
          className="w-20 h-20 rounded-[18px] flex items-center justify-center mx-auto mb-8 text-4xl"
          style={{
            background: "linear-gradient(135deg, #D94590, #7B5EA7)",
            boxShadow: "0 8px 24px rgba(217,69,144,0.25)",
          }}
        >
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h2
          className="text-3xl lg:text-4xl font-extrabold mb-3 tracking-tight"
          style={{
            color: "#2D2235",
            fontFamily: "Bricolage Grotesque, sans-serif",
          }}
        >
          No stories yet
        </h2>
        <p className="text-gray-500 max-w-sm mx-auto mb-10 text-base leading-relaxed">
          Ready to create something magical? Tell us about your little one
          and we'll build a world just for them.
        </p>
        <Link
          href="/projects/new"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-[14px] 
                     text-white font-semibold shadow-lg hover:shadow-xl transition-all"
          style={{
            background: "linear-gradient(135deg, #D94590, #7B5EA7)",
          }}
        >
          <Sparkles className="w-4 h-4" />
          Create Your First Story
        </Link>
      </div>
    </div>
  );
}