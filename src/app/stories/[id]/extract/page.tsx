"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  ArrowLeft,
  Wand2,
  Plus,
  Search,
} from "lucide-react";
import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";
import { SampleImageLocationCard } from "@/components/SampleImageLocationCard";

/* ------------------------------------------------------------------
   TYPES
------------------------------------------------------------------ */

type Entity = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  referenceImageUrl?: string | null;
};

type PageData = {
  id: string;
  pageNumber: number;
};

type PresenceData = {
  pageId: string;
  characterId: string;
};

type WorldStage = "loading" | "characters" | "locations";

/* ------------------------------------------------------------------
   STAGE DERIVATION (SINGLE SOURCE OF TRUTH)  
------------------------------------------------------------------ */

function stageFromStatus(status: string | null): WorldStage {
  if (!status) return "loading";

  switch (status) {
    case "extracting":
      return "loading";

    case "world_ready":
    case "characters_ready":
      return "characters";

    case "locations_ready":
    case "style_ready":
    case "paid":
    case "generating":
    case "done":
      return "locations";

    default:
      return "loading";
  }
}

/* ------------------------------------------------------------------
   ANIMATION
------------------------------------------------------------------ */

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/* ------------------------------------------------------------------
   PAGE
------------------------------------------------------------------ */

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();

  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string"
      ? raw
      : Array.isArray(raw)
      ? raw[0]
      : null;
  }, [params]);

  /* ---------------- STATE ---------------- */

  const [storyStatus, setStoryStatus] = useState<string | null>(null);

  const stage = useMemo(
    () => stageFromStatus(storyStatus),
    [storyStatus]
  );

  const [allCharacters, setAllCharacters] = useState<Entity[]>([]);
  const [localLocations, setLocalLocations] = useState<Entity[]>([]);

  const [visibleCharacterIds, setVisibleCharacterIds] = useState<Set<string>>(
    new Set()
  );

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);

  /* ------------------------------------------------------------------
     LOAD + POLL (WORLD IS SOURCE OF TRUTH)
  ------------------------------------------------------------------ */

  useEffect(() => {
    if (!storyId) return;

    let cancelled = false;
    let pollInterval: NodeJS.Timeout | null = null;
    const startTime = Date.now();
    const TIMEOUT = 60_000;

    async function load() {
      try {
        // Ensure extraction (idempotent)
        console.log("🔵 Ensuring world extraction...");
        await fetch(`/api/stories/${storyId}/ensure-world`, {
          method: "POST",
        });

        console.log("🔄 Starting poll...");
        pollInterval = setInterval(async () => {
          if (cancelled) return;

          if (Date.now() - startTime > TIMEOUT) {
            clearInterval(pollInterval!);
            alert("World extraction is taking too long.");
            return;
          }

          try {
            const res = await fetch(`/api/stories/${storyId}/world`);
            if (!res.ok) return;

            const data = await res.json();
            
            console.log("📊 Poll data:", {
              status: data.story?.status,
              charCount: data.characters?.length,
              locCount: data.locations?.length,
            });

            // CRITICAL FIX: Set status FIRST
            if (data.story?.status) {
              setStoryStatus(data.story.status);
            }

            // Then check if we have complete data
            if (
              data.characters?.length &&
              data.locations?.length &&
              data.presence?.length
            ) {
              console.log("✅ World data complete!");
              
              setAllCharacters(data.characters);
              setLocalLocations(data.locations);

              // Characters appearing early in story
              const firstTwoPageIds = new Set(
                (data.pages as PageData[])
                  .filter((p) => p.pageNumber <= 2)
                  .map((p) => p.id)
              );

              const present = new Set<string>();
              (data.presence as PresenceData[]).forEach((p) => {
                if (firstTwoPageIds.has(p.pageId)) {
                  present.add(p.characterId);
                }
              });

              setVisibleCharacterIds(
                present.size > 0
                  ? present
                  : new Set(data.characters.slice(0, 3).map((c: Entity) => c.id))
              );

              // Stop polling
              clearInterval(pollInterval!);
              pollInterval = null;
            }
          } catch (err) {
            console.error("❌ Polling error:", err);
          }
        }, 1500);
      } catch (err) {
        console.error("❌ Load error:", err);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [storyId]);

  /* ------------------------------------------------------------------
     ACTIONS
  ------------------------------------------------------------------ */

  function updateEntity(
    id: string,
    updates: Partial<Entity>,
    type: "char" | "loc"
  ) {
    if (type === "char") {
      setAllCharacters((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
      );
    } else {
      setLocalLocations((prev) =>
        prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
      );
    }
  }

  function addCharacterToView(id: string) {
    const next = new Set(visibleCharacterIds);
    next.add(id);
    setVisibleCharacterIds(next);
    setIsDropdownOpen(false);
  }

  async function confirmCharacters() {
    await fetch(`/api/stories/${storyId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "characters_ready" }),
    });

    setStoryStatus("characters_ready");
  }

  async function confirmLocations() {
    await fetch(`/api/stories/${storyId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "locations_ready" }),
    });

    router.push(`/stories/${storyId}/design`);
  }

  async function reExtractWorld() {
    if (!storyId) return;

    setIsReExtracting(true);

    await fetch(`/api/stories/${storyId}/extract-world`, {
      method: "POST",
    });

    window.location.reload();
  }

  /* ------------------------------------------------------------------
     DERIVED
  ------------------------------------------------------------------ */

  const visibleCharacters = allCharacters.filter((c) =>
    visibleCharacterIds.has(c.id)
  );

  const hiddenCharacters = allCharacters.filter(
    (c) => !visibleCharacterIds.has(c.id)
  );

  /* ------------------------------------------------------------------
     DEBUG INFO
  ------------------------------------------------------------------ */
  console.log("🎯 Current stage:", stage, "Status:", storyStatus);

  /* ------------------------------------------------------------------
     LOADING
  ------------------------------------------------------------------ */

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [0.9, 1.05, 0.9] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6 border border-indigo-400/30"
        >
          <Sparkles className="w-12 h-12 text-indigo-300" />
        </motion.div>
        <h2 className="text-3xl font-serif text-white mb-2">
          Building your world…
        </h2>
        <p className="text-indigo-200/60">
          Discovering characters and places
        </p>
        <p className="text-indigo-400/40 text-xs mt-4">
          Status: {storyStatus || "initializing"}
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------------
     MAIN
  ------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-stone-50 text-stone-800">
      {/* HEADER */}
      <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Wand2 className="w-4 h-4" />
            </div>
            <span className="font-serif font-bold text-lg">
              FlipWhizz Studio
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={reExtractWorld}
              disabled={isReExtracting}
              className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
            >
              Re-extract world
            </button>

            <button
              onClick={
                stage === "characters"
                  ? confirmCharacters
                  : confirmLocations
              }
              className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 hover:bg-stone-800 transition-colors"
            >
              {stage === "characters"
                ? "Lock Characters"
                : "Continue to Style"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="pt-32 pb-40 px-6 max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {stage === "characters" && (
            <motion.div
              key="characters"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-5xl font-serif mb-4">
                  Casting Call
                </h1>
                <p className="text-xl text-stone-500">
                  Characters appearing early in your story
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleCharacters.map((char) => (
                  <SampleImageCharacterCard
                    key={char.id}
                    character={{
                      ...char,
                      description: char.description ?? null,
                      referenceImageUrl: char.referenceImageUrl ?? null,
                    }}
                    onUpdated={(u) =>
                      updateEntity(char.id, u, "char")
                    }
                  />
                ))}

                {/* Add Character Dropdown */}
                <div className="relative min-h-[400px]">
                  <button
                    onClick={() =>
                      setIsDropdownOpen(!isDropdownOpen)
                    }
                    className="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-stone-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors"
                  >
                    <Plus className="w-8 h-8 mb-4" />
                    <span className="text-sm font-medium">Add supporting cast</span>
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 bg-white rounded-2xl shadow-xl border z-10"
                      >
                        <div className="p-4 border-b flex items-center gap-2">
                          <Search className="w-4 h-4 text-stone-400" />
                          <span className="text-sm font-bold">
                            Available characters
                          </span>
                        </div>

                        <div className="p-2 overflow-y-auto max-h-96">
                          {hiddenCharacters.length === 0 ? (
                            <div className="p-8 text-center text-stone-400">
                              All characters are visible
                            </div>
                          ) : (
                            hiddenCharacters.map((char) => (
                              <button
                                key={char.id}
                                onClick={() =>
                                  addCharacterToView(char.id)
                                }
                                className="w-full text-left p-3 hover:bg-indigo-50 rounded-xl transition-colors"
                              >
                                <div className="font-bold text-stone-800">
                                  {char.name}
                                </div>
                                <div className="text-xs text-stone-400 line-clamp-2">
                                  {char.description}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}

          {stage === "locations" && (
            <motion.div
              key="locations"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-12"
            >
              <button
                onClick={() => setStoryStatus("world_ready")}
                className="flex items-center gap-2 text-stone-500 hover:text-stone-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Cast
              </button>

              <div className="text-center max-w-2xl mx-auto">
                <h1 className="text-5xl font-serif mb-4">
                  Scene Settings
                </h1>
                <p className="text-xl text-stone-500">
                  Where your story takes place
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {localLocations.map((loc) => (
                  <SampleImageLocationCard
                    key={loc.id}
                    location={{
                      ...loc,
                      description: loc.description ?? null,
                      referenceImageUrl:
                        loc.referenceImageUrl ?? null,
                    }}
                    onUpdated={(u) =>
                      updateEntity(loc.id, u, "loc")
                    }
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}