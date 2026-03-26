// WorldDetailPage.tsx
// Drop into: src/components/worlds/WorldDetailPage.tsx
//
// The main view for a single world — shows the reader, character roster,
// locations, series timeline, and narrative memory.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Book,
  Users,
  MapPin,
  Clock,
  Sparkles,
  Settings,
  ChevronRight,
} from "lucide-react";
import ReaderProfileCard from "./ReaderProfileCard";

interface WorldDetail {
  id: string;
  name: string;
  description: string | null;
  tonality: string | null;
  ageRange: string | null;
  themes: string[];
  coverImageUrl: string | null;
  readers: Array<{
    role: string;
    reader: {
      id: string;
      name: string;
      age: number | null;
      pronouns: string | null;
      referenceImageUrl: string | null;
    };
  }>;
  characters: Array<{
    id: string;
    characterId: string;
    isRecurring: boolean;
    characterArc: string | null;
    notes: string | null;
    character?: {
      name: string;
      imageUrl: string | null;
    };
  }>;
  locations: Array<{
    id: string;
    locationId: string;
    isRecurring: boolean;
    location?: {
      name: string;
      imageUrl: string | null;
    };
  }>;
  stories: Array<{
    id: string;
    title: string;
    book_number: number | null;
    status: string;
    created_at: string;
  }>;
  narrativeMemory: Array<{
    bookNumber: number;
    summary: string;
    emotionalThemes: string[];
  }>;
}

interface WorldDetailPageProps {
  worldId: string;
}

export default function WorldDetailPage({ worldId }: WorldDetailPageProps) {
  const router = useRouter();
  const [world, setWorld] = useState<WorldDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "characters" | "locations" | "series"
  >("overview");

  useEffect(() => {
    fetch(`/api/worlds/${worldId}`)
      .then((res) => res.json())
      .then((data) => {
        setWorld(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [worldId]);

  if (loading || !world) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#2D2235]/40">Loading world...</div>
      </div>
    );
  }

  const nextBookNumber =
    world.stories.length > 0
      ? Math.max(...world.stories.map((s) => s.book_number ?? 0)) + 1
      : 1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Back nav */}
      <button
        onClick={() => router.push("/worlds")}
        className="flex items-center gap-1.5 text-sm text-[#2D2235]/50 
                   hover:text-[#D94590] transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        All Worlds
      </button>

      {/* World header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1
              className="text-3xl font-bold text-[#2D2235]"
              style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
            >
              {world.name}
            </h1>
            {world.description && (
              <p className="text-[#2D2235]/60 mt-1 max-w-2xl">
                {world.description}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              {world.themes.map((theme) => (
                <span
                  key={theme}
                  className="text-xs px-2.5 py-1 rounded-full bg-[#7B5EA7]/10 
                             text-[#7B5EA7]"
                >
                  {theme}
                </span>
              ))}
              {world.tonality && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-[#A8D5BA]/15 text-[#2D6A4F]">
                  {world.tonality}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => router.push(`/worlds/${worldId}/settings`)}
            className="p-2 rounded-full hover:bg-[#2D2235]/5 transition-colors"
          >
            <Settings className="w-5 h-5 text-[#2D2235]/40" />
          </button>
        </div>
      </div>

      {/* CTA: Create next book */}
      <button
        onClick={() =>
          router.push(`/create?worldId=${worldId}&bookNumber=${nextBookNumber}`)
        }
        className="w-full mb-6 p-4 rounded-[22px] bg-gradient-to-r from-[#D94590] 
                   to-[#7B5EA7] text-white flex items-center justify-between 
                   hover:shadow-lg transition-shadow"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="font-semibold">
              Create Book {nextBookNumber}
            </p>
            <p className="text-sm text-white/70">
              {world.stories.length === 0
                ? "Start your first adventure"
                : "Continue the series"}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-white/60" />
      </button>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 bg-[#2D2235]/5 rounded-[14px] p-1">
        {(
          [
            { key: "overview", label: "Overview", icon: Sparkles },
            { key: "characters", label: "Characters", icon: Users },
            { key: "locations", label: "Places", icon: MapPin },
            { key: "series", label: "Series", icon: Book },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 
                        rounded-[10px] text-sm font-medium transition-all
                        ${
                          activeTab === key
                            ? "bg-white text-[#2D2235] shadow-sm"
                            : "text-[#2D2235]/50 hover:text-[#2D2235]/70"
                        }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Reader(s) */}
          <section>
            <h2
              className="text-sm font-semibold text-[#2D2235]/40 uppercase 
                         tracking-wide mb-3"
            >
              The Reader
            </h2>
            {world.readers.map(({ reader, role }) => (
              <ReaderProfileCard
                key={reader.id}
                reader={{
                  ...reader,
                  personalityNotes: null,
                  interests: [],
                  fears: [],
                  readingLevel: null,
                }}
                role={role}
                onEdit={(id) => router.push(`/readers/${id}/edit`)}
              />
            ))}
          </section>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[14px] bg-white border border-[#2D2235]/8 p-4 text-center">
              <p className="text-2xl font-bold text-[#D94590]">
                {world.stories.length}
              </p>
              <p className="text-xs text-[#2D2235]/50 mt-0.5">
                {world.stories.length === 1 ? "Book" : "Books"}
              </p>
            </div>
            <div className="rounded-[14px] bg-white border border-[#2D2235]/8 p-4 text-center">
              <p className="text-2xl font-bold text-[#7B5EA7]">
                {world.characters.length}
              </p>
              <p className="text-xs text-[#2D2235]/50 mt-0.5">Characters</p>
            </div>
            <div className="rounded-[14px] bg-white border border-[#2D2235]/8 p-4 text-center">
              <p className="text-2xl font-bold text-[#2D6A4F]">
                {world.locations.length}
              </p>
              <p className="text-xs text-[#2D2235]/50 mt-0.5">Places</p>
            </div>
          </div>

          {/* Recent narrative memory */}
          {world.narrativeMemory.length > 0 && (
            <section>
              <h2
                className="text-sm font-semibold text-[#2D2235]/40 uppercase 
                           tracking-wide mb-3"
              >
                Story so far
              </h2>
              <div className="space-y-2">
                {world.narrativeMemory.map((mem) => (
                  <div
                    key={mem.bookNumber}
                    className="rounded-[14px] bg-white border border-[#2D2235]/8 p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-bold text-[#D94590] bg-[#D94590]/10 
                                     px-2 py-0.5 rounded-full"
                      >
                        Book {mem.bookNumber}
                      </span>
                      <div className="flex gap-1">
                        {mem.emotionalThemes.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="text-xs text-[#2D2235]/40"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-[#2D2235]/70">{mem.summary}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === "characters" && (
        <div className="space-y-3">
          {world.characters.length === 0 ? (
            <div
              className="rounded-[22px] border-2 border-dashed border-[#2D2235]/10 
                          p-8 text-center"
            >
              <Users className="w-8 h-8 text-[#2D2235]/20 mx-auto mb-2" />
              <p className="text-sm text-[#2D2235]/50">
                Characters will appear here as you create books in this world.
              </p>
            </div>
          ) : (
            world.characters.map((wc) => (
              <div
                key={wc.id}
                className="flex items-center gap-3 p-4 rounded-[14px] bg-white 
                           border border-[#2D2235]/8"
              >
                <div
                  className="w-12 h-12 rounded-[10px] overflow-hidden flex-shrink-0 
                              bg-gradient-to-br from-[#D94590]/15 to-[#7B5EA7]/15"
                >
                  {wc.character?.imageUrl ? (
                    <img
                      src={wc.character.imageUrl}
                      alt={wc.character.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#D94590]/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#2D2235] text-sm">
                      {wc.character?.name ?? "Character"}
                    </span>
                    {wc.isRecurring && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-full 
                                     bg-[#D94590]/10 text-[#D94590]"
                      >
                        recurring
                      </span>
                    )}
                  </div>
                  {wc.characterArc && (
                    <p className="text-xs text-[#2D2235]/50 mt-0.5 line-clamp-1">
                      {wc.characterArc}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "locations" && (
        <div className="space-y-3">
          {world.locations.length === 0 ? (
            <div
              className="rounded-[22px] border-2 border-dashed border-[#2D2235]/10 
                          p-8 text-center"
            >
              <MapPin className="w-8 h-8 text-[#2D2235]/20 mx-auto mb-2" />
              <p className="text-sm text-[#2D2235]/50">
                Locations will appear here as your world grows.
              </p>
            </div>
          ) : (
            world.locations.map((wl) => (
              <div
                key={wl.id}
                className="flex items-center gap-3 p-4 rounded-[14px] bg-white 
                           border border-[#2D2235]/8"
              >
                <div
                  className="w-12 h-12 rounded-[10px] overflow-hidden flex-shrink-0 
                              bg-gradient-to-br from-[#A8D5BA]/20 to-[#7B5EA7]/15"
                >
                  {wl.location?.imageUrl ? (
                    <img
                      src={wl.location.imageUrl}
                      alt={wl.location.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-[#2D6A4F]/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-[#2D2235] text-sm">
                    {wl.location?.name ?? "Location"}
                  </span>
                  {wl.isRecurring && (
                    <span
                      className="ml-2 text-xs px-1.5 py-0.5 rounded-full 
                                   bg-[#A8D5BA]/20 text-[#2D6A4F]"
                    >
                      recurring
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === "series" && (
        <div className="space-y-3">
          {world.stories.length === 0 ? (
            <div
              className="rounded-[22px] border-2 border-dashed border-[#2D2235]/10 
                          p-8 text-center"
            >
              <Book className="w-8 h-8 text-[#2D2235]/20 mx-auto mb-2" />
              <p className="text-sm text-[#2D2235]/50 mb-3">
                No books yet. Start your first adventure!
              </p>
              <button
                onClick={() =>
                  router.push(
                    `/create?worldId=${worldId}&bookNumber=1`
                  )
                }
                className="px-4 py-2 bg-[#D94590] text-white text-sm rounded-[14px] 
                           font-semibold hover:bg-[#c13a7d] transition-colors"
              >
                Create Book 1
              </button>
            </div>
          ) : (
            <>
              {/* Series timeline */}
              <div className="relative pl-6">
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[#D94590]/15" />
                {world.stories
                  .sort((a, b) => (a.book_number ?? 0) - (b.book_number ?? 0))
                  .map((story, i) => (
                    <div key={story.id} className="relative mb-4 last:mb-0">
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-6 top-3 w-[10px] h-[10px] rounded-full 
                                    border-2 ${
                                      story.status === "complete"
                                        ? "bg-[#D94590] border-[#D94590]"
                                        : "bg-white border-[#D94590]/40"
                                    }`}
                      />
                      <button
                        onClick={() => router.push(`/stories/${story.id}`)}
                        className="w-full text-left p-4 rounded-[14px] bg-white 
                                   border border-[#2D2235]/8 hover:border-[#D94590]/30 
                                   hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="text-xs font-bold text-[#D94590] bg-[#D94590]/10 
                                         px-2 py-0.5 rounded-full"
                          >
                            Book {story.book_number ?? i + 1}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              story.status === "complete"
                                ? "bg-[#A8D5BA]/20 text-[#2D6A4F]"
                                : "bg-amber-50 text-amber-600"
                            }`}
                          >
                            {story.status}
                          </span>
                        </div>
                        <p className="font-semibold text-[#2D2235]">
                          {story.title}
                        </p>
                        <p className="text-xs text-[#2D2235]/40 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(story.created_at).toLocaleDateString()}
                        </p>
                      </button>
                    </div>
                  ))}
              </div>

              {/* Add next book */}
              <div className="relative pl-6">
                <div
                  className="absolute -left-[13px] top-3 w-[10px] h-[10px] rounded-full 
                              border-2 border-dashed border-[#D94590]/30 bg-[#FEFCFA]"
                />
                <button
                  onClick={() =>
                    router.push(
                      `/create?worldId=${worldId}&bookNumber=${nextBookNumber}`
                    )
                  }
                  className="w-full p-4 rounded-[14px] border-2 border-dashed 
                             border-[#D94590]/20 text-[#D94590] text-sm font-medium 
                             hover:border-[#D94590]/40 hover:bg-[#D94590]/5 transition-all 
                             flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create Book {nextBookNumber}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}