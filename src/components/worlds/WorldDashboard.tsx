// WorldDashboard.tsx
// Drop into: src/components/worlds/WorldDashboard.tsx
//
// Main page component for /worlds — shows all user's worlds.
// Uses your existing design system tokens.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Book, Users, MapPin, ChevronRight, Sparkles } from "lucide-react";

interface WorldSummary {
  id: string;
  name: string;
  description: string | null;
  tonality: string | null;
  ageRange: string | null;
  themes: string[];
  coverImageUrl: string | null;
  bookCount: number;
  characterCount: number;
  readerCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function WorldDashboard() {
  const router = useRouter();
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/worlds")
      .then((res) => res.json())
      .then((data) => {
        setWorlds(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-[#2D2235]/40 text-lg">
          Loading your worlds...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-bold text-[#2D2235]"
            style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
          >
            Your Worlds
          </h1>
          <p className="text-[#2D2235]/60 mt-1">
            Series, characters, and stories that grow with your child
          </p>
        </div>
        <button
          onClick={() => router.push("/worlds/new")}
          className="flex items-center gap-2 px-5 py-3 bg-[#D94590] text-white 
                     rounded-[22px] font-semibold text-sm hover:bg-[#c13a7d] 
                     transition-colors shadow-md hover:shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Create a World
        </button>
      </div>

      {/* Empty state */}
      {worlds.length === 0 && (
        <div
          className="rounded-[22px] border-2 border-dashed border-[#D94590]/30 
                      bg-gradient-to-br from-[#FEFCFA] to-[#f5e6f0] p-12 text-center"
        >
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#D94590]/10 
                        flex items-center justify-center"
          >
            <Sparkles className="w-8 h-8 text-[#D94590]" />
          </div>
          <h2
            className="text-xl font-bold text-[#2D2235] mb-2"
            style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
          >
            Build your first world
          </h2>
          <p className="text-[#2D2235]/60 max-w-md mx-auto mb-6">
            A world is a universe for your child's stories — with characters
            that grow, places that feel like home, and adventures that build
            on each other.
          </p>
          <button
            onClick={() => router.push("/worlds/new")}
            className="px-6 py-3 bg-[#D94590] text-white rounded-[22px] 
                       font-semibold hover:bg-[#c13a7d] transition-colors"
          >
            Create a World
          </button>
        </div>
      )}

      {/* World cards */}
      <div className="space-y-4">
        {worlds.map((world) => (
          <button
            key={world.id}
            onClick={() => router.push(`/worlds/${world.id}`)}
            className="w-full text-left rounded-[22px] bg-white border border-[#2D2235]/8 
                       p-6 hover:border-[#D94590]/30 hover:shadow-lg transition-all 
                       group cursor-pointer"
          >
            <div className="flex items-start gap-4">
              {/* Cover image or gradient placeholder */}
              <div
                className="w-20 h-20 rounded-[14px] flex-shrink-0 overflow-hidden 
                            bg-gradient-to-br from-[#D94590]/20 to-[#7B5EA7]/20"
              >
                {world.coverImageUrl ? (
                  <img
                    src={world.coverImageUrl}
                    alt={world.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-[#D94590]/40" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className="text-lg font-bold text-[#2D2235] truncate"
                    style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
                  >
                    {world.name}
                  </h3>
                  {world.ageRange && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full bg-[#D94590]/10 
                                   text-[#D94590] font-medium flex-shrink-0"
                    >
                      Ages {world.ageRange}
                    </span>
                  )}
                </div>

                {world.description && (
                  <p className="text-sm text-[#2D2235]/60 mt-1 line-clamp-2">
                    {world.description}
                  </p>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-sm text-[#2D2235]/50">
                    <Book className="w-3.5 h-3.5" />
                    <span>
                      {world.bookCount} {world.bookCount === 1 ? "book" : "books"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-[#2D2235]/50">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {world.characterCount}{" "}
                      {world.characterCount === 1 ? "character" : "characters"}
                    </span>
                  </div>
                </div>

                {/* Theme pills */}
                {world.themes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {world.themes.slice(0, 4).map((theme) => (
                      <span
                        key={theme}
                        className="text-xs px-2 py-0.5 rounded-full 
                                   bg-[#7B5EA7]/8 text-[#7B5EA7]/70"
                      >
                        {theme}
                      </span>
                    ))}
                    {world.themes.length > 4 && (
                      <span className="text-xs text-[#2D2235]/40">
                        +{world.themes.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Arrow */}
              <ChevronRight
                className="w-5 h-5 text-[#2D2235]/20 group-hover:text-[#D94590] 
                             transition-colors flex-shrink-0 mt-1"
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}