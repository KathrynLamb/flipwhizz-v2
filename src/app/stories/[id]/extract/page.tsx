// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   Sparkles,
//   ChevronRight,
//   ArrowLeft,
//   Wand2,
//   Plus,
//   Search,
// } from "lucide-react";
// import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";
// import { SampleImageLocationCard } from "@/components/SampleImageLocationCard";

// /* ------------------------------------------------------------------
//    TYPES
// ------------------------------------------------------------------ */
// type Entity = {
//   id: string;
//   name: string;
//   description: string | null;
//   appearance?: string | null;
//   referenceImageUrl?: string | null;
// };

// type PageData = {
//   id: string;
//   pageNumber: number;
// };

// type PresenceData = {
//   pageId: string;
//   characterId: string;
// };

// /* ------------------------------------------------------------------
//    ANIMATION
// ------------------------------------------------------------------ */
// const fadeIn = {
//   hidden: { opacity: 0, y: 10 },
//   visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
// };

// /* ------------------------------------------------------------------
//    PAGE
// ------------------------------------------------------------------ */
// export default function ExtractWorldPage() {
//   const params = useParams();
//   const router = useRouter();

//   const storyId = useMemo(() => {
//     const raw = (params as any)?.id;
//     return typeof raw === "string"
//       ? raw
//       : Array.isArray(raw)
//       ? raw[0]
//       : null;
//   }, [params]);

//   /* ---------------- STATE ---------------- */
//   const [step, setStep] = useState<"loading" | "characters" | "locations">(
//     "loading"
//   );

//   const [allCharacters, setAllCharacters] = useState<Entity[]>([]);
//   const [localLocations, setLocalLocations] = useState<Entity[]>([]);

//   const [visibleCharacterIds, setVisibleCharacterIds] = useState<Set<string>>(
//     new Set()
//   );
//   const [isDropdownOpen, setIsDropdownOpen] = useState(false);
//   const [isReExtracting, setIsReExtracting] = useState(false);

//   /* ------------------------------------------------------------------
//      SINGLE UNIFIED LOAD EFFECT
//   ------------------------------------------------------------------ */
//   useEffect(() => {
//     if (!storyId) return;

//     let cancelled = false;
//     let pollInterval: NodeJS.Timeout | null = null;
//     const startTime = Date.now();
//     const TIMEOUT = 60000; // 60 second timeout

//     async function loadWorld() {
//       try {
//         // 1️⃣ Ensure world extraction is triggered (idempotent)
//         console.log("🔵 Calling ensure-world...");
//         const ensureRes = await fetch(`/api/stories/${storyId}/ensure-world`, {
//           method: "POST",
//         });
//         const ensureData = await ensureRes.json();
//         console.log("📊 Ensure-world response:", ensureData);

//         // 2️⃣ Poll for completion
//         console.log("🔄 Starting polling...");
//         pollInterval = setInterval(async () => {
//           if (cancelled) return;

//           // Check timeout
//           if (Date.now() - startTime > TIMEOUT) {
//             console.error("❌ Timeout reached!");
//             if (pollInterval) clearInterval(pollInterval);
//             alert("World extraction is taking too long. Please check if Inngest is running.");
//             return;
//           }
//           if (cancelled) return;

//           try {
//             const res = await fetch(`/api/stories/${storyId}/world`);
//             if (!res.ok) {
//               console.error("World fetch failed:", res.status);
//               return;
//             }

//             const data = await res.json();
//             console.log("Polled data:", {
//               charCount: data.characters?.length,
//               locCount: data.locations?.length,
//               presenceCount: data.presence?.length,
//             });

//             // Only proceed if we have actual data
//             if (
//               data.characters?.length > 0 &&
//               data.locations?.length > 0 &&
//               data.presence?.length > 0
//             ) {
//               if (cancelled) return;

//               setAllCharacters(data.characters);
//               setLocalLocations(data.locations);

//               // Intelligent filtering for visible characters
//               const firstTwoPageIds = new Set(
//                 (data.pages as PageData[])
//                   .filter((p) => p.pageNumber <= 2)
//                   .map((p) => p.id)
//               );

//               const presentCharIds = new Set<string>();
//               (data.presence as PresenceData[]).forEach((row) => {
//                 if (firstTwoPageIds.has(row.pageId)) {
//                   presentCharIds.add(row.characterId);
//                 }
//               });

//               if (presentCharIds.size > 0) {
//                 setVisibleCharacterIds(presentCharIds);
//               } else {
//                 // Fallback to first 3 characters
//                 setVisibleCharacterIds(
//                   new Set(data.characters.slice(0, 3).map((c: Entity) => c.id))
//                 );
//               }

//               setStep("characters");
              
//               // Stop polling
//               if (pollInterval) {
//                 clearInterval(pollInterval);
//                 pollInterval = null;
//               }
//             }
//           } catch (error) {
//             console.error("Error polling world:", error);
//           }
//         }, 1500);
//       } catch (error) {
//         console.error("Error in loadWorld:", error);
//       }
//     }

//     loadWorld();

//     return () => {
//       cancelled = true;
//       if (pollInterval) {
//         clearInterval(pollInterval);
//       }
//     };
//   }, [storyId]);

//   /* ------------------------------------------------------------------
//      HANDLERS
//   ------------------------------------------------------------------ */
//   function updateEntity(
//     id: string,
//     updates: Partial<Entity>,
//     type: "char" | "loc"
//   ) {
//     if (type === "char") {
//       setAllCharacters((prev) =>
//         prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
//       );
//     } else {
//       setLocalLocations((prev) =>
//         prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
//       );
//     }
//   }

//   function addCharacterToView(id: string) {
//     const next = new Set(visibleCharacterIds);
//     next.add(id);
//     setVisibleCharacterIds(next);
//     setIsDropdownOpen(false);
//   }

//   async function reExtractWorld() {
//     if (!storyId) return;
//     setIsReExtracting(true);
//     setStep("loading");

//     await fetch(`/api/stories/${storyId}/extract-world`, {
//       method: "POST",
//     });

//     // Reload to restart the entire flow
//     window.location.reload();
//   }

//   /* ------------------------------------------------------------------
//      DERIVED
//   ------------------------------------------------------------------ */
//   const visibleCharacters = allCharacters.filter((c) =>
//     visibleCharacterIds.has(c.id)
//   );
//   const hiddenCharacters = allCharacters.filter(
//     (c) => !visibleCharacterIds.has(c.id)
//   );

//   /* ------------------------------------------------------------------
//      LOADING
//   ------------------------------------------------------------------ */
//   if (step === "loading") {
//     return (
//       <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center relative overflow-hidden">
//         <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0F172A] to-[#0F172A]" />
//         <motion.div
//           initial={{ scale: 0.8, opacity: 0 }}
//           animate={{ scale: 1, opacity: 1 }}
//           transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
//           className="relative z-10 w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mb-8 border border-indigo-400/30 backdrop-blur-xl shadow-[0_0_50px_rgba(99,102,241,0.3)]"
//         >
//           <Sparkles className="w-12 h-12 text-indigo-300" />
//         </motion.div>
//         <div className="z-10 text-center max-w-md px-6">
//           <h2 className="text-3xl font-serif text-white mb-3">
//             Summoning your story…
//           </h2>
//           <p className="text-indigo-200/60">
//             Gathering characters and places.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   /* ------------------------------------------------------------------
//      MAIN
//   ------------------------------------------------------------------ */
//   return (
//     <div className="min-h-screen bg-stone-50 text-stone-800">
//       {/* HEADER */}
//       <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b px-6 py-4">
//         <div className="max-w-6xl mx-auto flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
//               <Wand2 className="w-4 h-4" />
//             </div>
//             <span className="font-serif font-bold text-lg">
//               FlipWhizz Studio
//             </span>
//           </div>

//           <div className="flex items-center gap-4">
//             <button
//               onClick={reExtractWorld}
//               disabled={isReExtracting}
//               className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50"
//             >
//               Re-extract world
//             </button>

//             <button
//               onClick={() =>
//                 step === "characters"
//                   ? setStep("locations")
//                   : router.push(`/stories/${storyId}/design`)
//               }
//               className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2"
//             >
//               {step === "characters" ? "Next: Locations" : "Finish & Design"}
//               <ChevronRight className="w-4 h-4" />
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* CONTENT */}
//       <main className="pt-32 pb-40 px-6 max-w-6xl mx-auto">
//         <AnimatePresence mode="wait">
//           {/* ---------------- CHARACTERS ---------------- */}
//           {step === "characters" && (
//             <motion.div
//               key="characters"
//               variants={fadeIn}
//               initial="hidden"
//               animate="visible"
//               className="space-y-12"
//             >
//               <div className="text-center max-w-2xl mx-auto">
//                 <h1 className="text-5xl font-serif mb-6">Casting Call</h1>
//                 <p className="text-xl text-stone-500">
//                   Characters appearing early in the story.
//                 </p>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//                 {visibleCharacters.map((char) => (
//                   <SampleImageCharacterCard
//                     key={char.id}
//                     character={{
//                       ...char,
//                       description: char.description ?? null,
//                       referenceImageUrl: char.referenceImageUrl ?? null,
//                     }}
//                     onUpdated={(u) => updateEntity(char.id, u, "char")}
//                   />
//                 ))}

//                 {/* ADD CHARACTER */}
//                 <div className="relative min-h-[400px]">
//                   <button
//                     onClick={() => setIsDropdownOpen(!isDropdownOpen)}
//                     className="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-stone-400 hover:border-indigo-300"
//                   >
//                     <Plus className="w-8 h-8 mb-4" />
//                     Add supporting cast
//                   </button>

//                   <AnimatePresence>
//                     {isDropdownOpen && (
//                       <motion.div
//                         initial={{ opacity: 0, scale: 0.95 }}
//                         animate={{ opacity: 1, scale: 1 }}
//                         exit={{ opacity: 0, scale: 0.95 }}
//                         className="absolute inset-0 bg-white rounded-2xl shadow-xl border"
//                       >
//                         <div className="p-4 border-b flex items-center gap-2">
//                           <Search className="w-4 h-4" />
//                           <span className="text-sm font-bold">
//                             Available characters
//                           </span>
//                         </div>

//                         <div className="p-2 overflow-y-auto max-h-96">
//                           {hiddenCharacters.length === 0 ? (
//                             <div className="p-4 text-center text-stone-400">
//                               All characters are already visible
//                             </div>
//                           ) : (
//                             hiddenCharacters.map((char) => (
//                               <button
//                                 key={char.id}
//                                 onClick={() => addCharacterToView(char.id)}
//                                 className="w-full text-left p-3 hover:bg-indigo-50 rounded-xl"
//                               >
//                                 <div className="font-bold">{char.name}</div>
//                                 <div className="text-xs text-stone-400 line-clamp-2">
//                                   {char.description}
//                                 </div>
//                               </button>
//                             ))
//                           )}
//                         </div>
//                       </motion.div>
//                     )}
//                   </AnimatePresence>
//                 </div>
//               </div>
//             </motion.div>
//           )}

//           {/* ---------------- LOCATIONS ---------------- */}
//           {step === "locations" && (
//             <motion.div
//               key="locations"
//               initial={{ opacity: 0, x: 20 }}
//               animate={{ opacity: 1, x: 0 }}
//               className="space-y-12"
//             >
//               <button
//                 onClick={() => setStep("characters")}
//                 className="flex items-center gap-2 text-stone-500"
//               >
//                 <ArrowLeft className="w-4 h-4" /> Back to Cast
//               </button>

//               <div className="text-center max-w-2xl mx-auto mb-12">
//                 <h1 className="text-5xl font-serif mb-6">Scene Settings</h1>
//                 <p className="text-xl text-stone-500">
//                   Where your story takes place.
//                 </p>
//               </div>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//                 {localLocations.map((loc) => (
//                   <SampleImageLocationCard
//                     key={loc.id}
//                     location={{
//                       ...loc,
//                       description: loc.description ?? null,
//                       referenceImageUrl: loc.referenceImageUrl ?? null,
//                     }}
//                     onUpdated={(u) => updateEntity(loc.id, u, "loc")}
//                   />
//                 ))}
//               </div>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </main>
//     </div>
//   );
// }

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
      // Ensure extraction (idempotent)
      await fetch(`/api/stories/${storyId}/ensure-world`, {
        method: "POST",
      });

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

          setStoryStatus(data.story.status);

          if (
            data.characters?.length &&
            data.locations?.length &&
            data.presence?.length
          ) {
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

            clearInterval(pollInterval!);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 1500);
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
     LOADING
  ------------------------------------------------------------------ */

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center">
        <motion.div
          animate={{ scale: [0.9, 1.05, 0.9] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6"
        >
          <Sparkles className="w-12 h-12 text-indigo-300" />
        </motion.div>
        <h2 className="text-3xl font-serif text-white mb-2">
          Building your world…
        </h2>
        <p className="text-indigo-200/60">
          Discovering characters and places
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
              className="text-xs font-bold text-red-600 hover:underline"
            >
              Re-extract world
            </button>

            <button
              onClick={
                stage === "characters"
                  ? confirmCharacters
                  : confirmLocations
              }
              className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2"
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
              <h1 className="text-5xl font-serif text-center">
                Casting Call
              </h1>

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

                <div className="relative min-h-[400px]">
                  <button
                    onClick={() =>
                      setIsDropdownOpen(!isDropdownOpen)
                    }
                    className="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-stone-400"
                  >
                    <Plus className="w-8 h-8 mb-4" />
                    Add supporting cast
                  </button>

                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 bg-white rounded-2xl shadow-xl border"
                      >
                        <div className="p-4 border-b flex items-center gap-2">
                          <Search className="w-4 h-4" />
                          <span className="text-sm font-bold">
                            Available characters
                          </span>
                        </div>

                        <div className="p-2 overflow-y-auto max-h-96">
                          {hiddenCharacters.map((char) => (
                            <button
                              key={char.id}
                              onClick={() =>
                                addCharacterToView(char.id)
                              }
                              className="w-full text-left p-3 hover:bg-indigo-50 rounded-xl"
                            >
                              <div className="font-bold">
                                {char.name}
                              </div>
                              <div className="text-xs text-stone-400 line-clamp-2">
                                {char.description}
                              </div>
                            </button>
                          ))}
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
                onClick={() => confirmCharacters()}
                className="flex items-center gap-2 text-stone-500"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Cast
              </button>

              <h1 className="text-5xl font-serif text-center">
                Scene Settings
              </h1>

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
