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

// type WorldStage = "loading" | "characters" | "locations";

// /* ------------------------------------------------------------------
//    STAGE (STATUS IS SECONDARY TO DATA)
// ------------------------------------------------------------------ */

// function stageFromStatus(status: string | null): WorldStage {
//   switch (status) {
//     case "characters_ready":
//     case "world_ready":
//       return "characters";

//     case "locations_ready":
//     case "style_ready":
//     case "paid":
//     case "generating":
//     case "done":
//       return "locations";

//     default:
//       return "loading";
//   }
// }

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

//   const [storyStatus, setStoryStatus] = useState<string | null>(null);
//   const [allCharacters, setAllCharacters] = useState<Entity[]>([]);
//   const [localLocations, setLocalLocations] = useState<Entity[]>([]);
//   const [visibleCharacterIds, setVisibleCharacterIds] = useState<Set<string>>(new Set());

//   const [isDropdownOpen, setIsDropdownOpen] = useState(false);
//   const [isReExtracting, setIsReExtracting] = useState(false);

//   /* ------------------------------------------------------------------
//      DERIVED — THIS IS THE TRUTH
//   ------------------------------------------------------------------ */

//   const hasWorld =
//     allCharacters.length > 0 &&
//     localLocations.length > 0 &&
//     visibleCharacterIds.size > 0;

//   const stage: WorldStage = hasWorld
//     ? stageFromStatus(storyStatus)
//     : "loading";

//   /* ------------------------------------------------------------------
//      LOAD + POLL
//   ------------------------------------------------------------------ */

//   useEffect(() => {
//     if (!storyId) return;

//     let cancelled = false;
//     let poll: NodeJS.Timeout | null = null;
//     const start = Date.now();
//     const TIMEOUT = 90_000;

//     async function run() {
//       await fetch(`/api/stories/${storyId}/ensure-world`, { method: "POST" });

//       poll = setInterval(async () => {
//         if (cancelled) return;

//         if (Date.now() - start > TIMEOUT) {
//           clearInterval(poll!);
//           alert("World extraction timed out.");
//           return;
//         }

//         try {
//           const res = await fetch(`/api/stories/${storyId}/world`);
//           if (!res.ok) return;

//           const data = await res.json();

//           if (data.story?.status) {
//             setStoryStatus(data.story.status);
//           }

//           const chars = data.characters ?? [];
//           const locs = data.locations ?? [];
//           const presence = data.presence ?? [];
//           const pages: PageData[] = data.pages ?? [];

//           if (chars.length && locs.length && presence.length) {
//             setAllCharacters(chars);
//             setLocalLocations(locs);

//             const earlyPages = new Set(
//               pages.filter(p => p.pageNumber <= 2).map(p => p.id)
//             );

//             const visible = new Set<string>();
//             presence.forEach((p: PresenceData) => {
//               if (earlyPages.has(p.pageId)) visible.add(p.characterId);
//             });

//             setVisibleCharacterIds(
//               visible.size ? visible : new Set(chars.slice(0, 3).map((c: Entity) => c.id))
//             );

//             clearInterval(poll!);
//           }
//         } catch (err) {
//           console.error("Polling error:", err);
//         }
//       }, 1500);
//     }

//     run();

//     return () => {
//       cancelled = true;
//       if (poll) clearInterval(poll);
//     };
//   }, [storyId]);

//   /* ------------------------------------------------------------------
//      ACTIONS
//   ------------------------------------------------------------------ */

//   function updateEntity(id: string, updates: Partial<Entity>, type: "char" | "loc") {
//     if (type === "char") {
//       setAllCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
//     } else {
//       setLocalLocations(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
//     }
//   }

//   function addCharacterToView(id: string) {
//     setVisibleCharacterIds(prev => new Set(prev).add(id));
//     setIsDropdownOpen(false);
//   }

//   async function confirmCharacters() {
//     await fetch(`/api/stories/${storyId}/status`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ status: "characters_ready" }),
//     });
//     setStoryStatus("characters_ready");
//   }

//   async function confirmLocations() {
//     await fetch(`/api/stories/${storyId}/status`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ status: "locations_ready" }),
//     });
//     router.push(`/stories/${storyId}/design`);
//   }

//   async function reExtractWorld() {
//     setIsReExtracting(true);
//     await fetch(`/api/stories/${storyId}/ensure-world`, { method: "POST" });
//     window.location.reload();
//   }

//   /* ------------------------------------------------------------------
//      LOADING
//   ------------------------------------------------------------------ */

//   if (stage === "loading") {
//     return (
//       <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center">
//         <motion.div
//           animate={{ scale: [0.9, 1.05, 0.9] }}
//           transition={{ repeat: Infinity, duration: 2 }}
//           className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6"
//         >
//           <Sparkles className="w-12 h-12 text-indigo-300" />
//         </motion.div>
//         <h2 className="text-3xl font-serif text-white mb-2">
//           Building your world…
//         </h2>
//         <p className="text-indigo-300/70 text-sm">
//           {storyStatus ?? "initializing"}
//         </p>
//       </div>
//     );
//   }

//   /* ------------------------------------------------------------------
//      MAIN UI (UNCHANGED UX)
//   ------------------------------------------------------------------ */

//   const visibleCharacters = allCharacters.filter(c =>
//     visibleCharacterIds.has(c.id)
//   );

//   const hiddenCharacters = allCharacters.filter(
//     c => !visibleCharacterIds.has(c.id)
//   );

//   return (
//     <div className="min-h-screen bg-stone-50 text-stone-800">
//       {/* HEADER */}
//       <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b px-6 py-4">
//         <div className="max-w-6xl mx-auto flex items-center justify-between">
//           <div className="flex items-center gap-2">
//             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
//               <Wand2 className="w-4 h-4" />
//             </div>
//             <span className="font-serif font-bold text-lg">FlipWhizz Studio</span>
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
//               onClick={stage === "characters" ? confirmCharacters : confirmLocations}
//               className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2"
//             >
//               {stage === "characters" ? "Lock Characters" : "Continue to Style"}
//               <ChevronRight className="w-4 h-4" />
//             </button>
//           </div>
//         </div>
//       </header>

//       {/* CONTENT */}
//       <main className="pt-32 pb-40 px-6 max-w-6xl mx-auto">
//         <AnimatePresence mode="wait">
//           {stage === "characters" && (
//             <motion.div variants={fadeIn} initial="hidden" animate="visible">
//               <h1 className="text-5xl font-serif text-center mb-10">
//                 Casting Call
//               </h1>

//               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
//                 {visibleCharacters.map(char => (
//                   <SampleImageCharacterCard
//                     key={char.id}
//                     character={char}
//                     onUpdated={u => updateEntity(char.id, u, "char")}
//                   />
//                 ))}

//                 {/* Add character */}
//                 <div className="relative min-h-[400px]">
//                   <button
//                     onClick={() => setIsDropdownOpen(v => !v)}
//                     className="w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-stone-400 hover:border-indigo-300"
//                   >
//                     <Plus className="w-8 h-8 mb-4" />
//                     <span className="text-sm font-medium">Add supporting cast</span>
//                   </button>

//                   {isDropdownOpen && (
//                     <div className="absolute inset-0 bg-white rounded-2xl shadow-xl border z-10">
//                       <div className="p-4 border-b font-bold text-sm flex gap-2">
//                         <Search className="w-4 h-4" /> Available characters
//                       </div>
//                       <div className="p-2 max-h-96 overflow-y-auto">
//                         {hiddenCharacters.map(char => (
//                           <button
//                             key={char.id}
//                             onClick={() => addCharacterToView(char.id)}
//                             className="w-full text-left p-3 hover:bg-indigo-50 rounded-xl"
//                           >
//                             <div className="font-bold">{char.name}</div>
//                             <div className="text-xs text-stone-400 line-clamp-2">
//                               {char.description}
//                             </div>
//                           </button>
//                         ))}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             </motion.div>
//           )}

//           {stage === "locations" && (
//             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
//               <button
//                 onClick={() => setStoryStatus("world_ready")}
//                 className="flex items-center gap-2 text-stone-500 mb-6"
//               >
//                 <ArrowLeft className="w-4 h-4" /> Back to Cast
//               </button>

//               <h1 className="text-5xl font-serif text-center mb-10">
//                 Scene Settings
//               </h1>

//               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
//                 {localLocations.map(loc => (
//                   <SampleImageLocationCard
//                     key={loc.id}
//                     location={loc}
//                     onUpdated={u => updateEntity(loc.id, u, "loc")}
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
  ArrowLeft,
  Plus,
  Search,
  Users,
  MapPin,
  Zap,
  CheckCircle,
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
   STAGE
------------------------------------------------------------------ */

function stageFromStatus(status: string | null): WorldStage {
  switch (status) {
    case "characters_ready":
    case "world_ready":
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
  const [allCharacters, setAllCharacters] = useState<Entity[]>([]);
  const [localLocations, setLocalLocations] = useState<Entity[]>([]);
  const [visibleCharacterIds, setVisibleCharacterIds] = useState<Set<string>>(new Set());

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isReExtracting, setIsReExtracting] = useState(false);

  /* ------------------------------------------------------------------
     DERIVED
  ------------------------------------------------------------------ */

  const hasWorld =
    allCharacters.length > 0 &&
    localLocations.length > 0 &&
    visibleCharacterIds.size > 0;

  const stage: WorldStage = hasWorld
    ? stageFromStatus(storyStatus)
    : "loading";

  /* ------------------------------------------------------------------
     LOAD + POLL
  ------------------------------------------------------------------ */

  useEffect(() => {
    if (!storyId) return;

    let cancelled = false;
    let poll: NodeJS.Timeout | null = null;
    const start = Date.now();
    const TIMEOUT = 90_000;

    async function run() {
      await fetch(`/api/stories/${storyId}/ensure-world`, { method: "POST" });

      poll = setInterval(async () => {
        if (cancelled) return;

        if (Date.now() - start > TIMEOUT) {
          clearInterval(poll!);
          alert("World extraction timed out.");
          return;
        }

        try {
          const res = await fetch(`/api/stories/${storyId}/world`);
          if (!res.ok) return;

          const data = await res.json();

          if (data.story?.status) {
            setStoryStatus(data.story.status);
          }

          const chars = data.characters ?? [];
          const locs = data.locations ?? [];
          const presence = data.presence ?? [];
          const pages: PageData[] = data.pages ?? [];

          if (chars.length && locs.length && presence.length) {
            setAllCharacters(chars);
            setLocalLocations(locs);

            const earlyPages = new Set(
              pages.filter(p => p.pageNumber <= 2).map(p => p.id)
            );

            const visible = new Set<string>();
            presence.forEach((p: PresenceData) => {
              if (earlyPages.has(p.pageId)) visible.add(p.characterId);
            });

            setVisibleCharacterIds(
              visible.size ? visible : new Set(chars.slice(0, 3).map((c: Entity) => c.id))
            );

            clearInterval(poll!);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 1500);
    }

    run();

    return () => {
      cancelled = true;
      if (poll) clearInterval(poll);
    };
  }, [storyId]);

  /* ------------------------------------------------------------------
     ACTIONS
  ------------------------------------------------------------------ */

  function updateEntity(id: string, updates: Partial<Entity>, type: "char" | "loc") {
    if (type === "char") {
      setAllCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } else {
      setLocalLocations(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }
  }

  function addCharacterToView(id: string) {
    setVisibleCharacterIds(prev => new Set(prev).add(id));
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
    setIsReExtracting(true);
    await fetch(`/api/stories/${storyId}/ensure-world`, { method: "POST" });
    window.location.reload();
  }

  /* ------------------------------------------------------------------
     LOADING
  ------------------------------------------------------------------ */

  if (stage === "loading") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="inline-flex items-center gap-2 mb-8">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
              className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
            />
          ))}
        </div>

        <h2 className="text-5xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent mb-4">
          Building Your World
        </h2>
        
        <p className="text-gray-600 text-lg font-medium">
          Discovering characters and locations... ✨
        </p>
      </div>
    );
  }

  /* ------------------------------------------------------------------
     MAIN UI
  ------------------------------------------------------------------ */

  const visibleCharacters = allCharacters.filter(c =>
    visibleCharacterIds.has(c.id)
  );

  const hiddenCharacters = allCharacters.filter(
    c => !visibleCharacterIds.has(c.id)
  );

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="fixed top-0 w-full z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Hub</span>
          </button>

          <div className="flex items-center gap-3">
            {stage === "characters" && (
              <div className="flex items-center gap-2 px-4 py-2 bg-pink-100 rounded-full">
                <Users className="w-4 h-4 text-pink-600" />
                <span className="text-sm font-bold text-pink-900">
                  {visibleCharacters.length} characters
                </span>
              </div>
            )}

            {stage === "locations" && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-900">
                  {localLocations.length} locations
                </span>
              </div>
            )}

            <button
              onClick={stage === "characters" ? confirmCharacters : confirmLocations}
              className="
                bg-black text-white
                text-sm font-black px-6 py-3 rounded-2xl
                hover:scale-105 transition-transform
                active:scale-95 shadow-lg
                flex items-center gap-2
              "
            >
              {stage === "characters" ? (
                <>
                  <span>Lock Characters</span>
                  <CheckCircle className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Continue to Design</span>
                  <Sparkles className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="pt-24 pb-32 px-6">
        <div className="max-w-7xl mx-auto">
          
          <AnimatePresence mode="wait">
            {stage === "characters" && (
              <motion.div variants={fadeIn} initial="hidden" animate="visible">
                
                {/* Hero */}
                <div className="text-center mb-16">
                  <div className="inline-flex items-center gap-2 mb-6">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                      />
                    ))}
                  </div>

                  <h1 className="text-7xl md:text-8xl font-black mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
                    Meet Your Cast
                  </h1>
                  
                  <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                    These are the stars of your story! Review and refine them before moving forward.
                  </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleCharacters.map(char => (
                    <SampleImageCharacterCard
                      key={char.id}
                      character={char}
                      onUpdated={u => updateEntity(char.id, u, "char")}
                    />
                  ))}

                  {/* Add Character */}
                  {hiddenCharacters.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setIsDropdownOpen(v => !v)}
                        className="
                          w-full h-full min-h-[400px]
                          border-4 border-dashed border-gray-300
                          rounded-3xl
                          flex flex-col items-center justify-center
                          text-gray-400
                          hover:border-purple-400 hover:bg-purple-50
                          transition-all
                        "
                      >
                        <Plus className="w-12 h-12 mb-3" />
                        <span className="text-lg font-bold">Add Character</span>
                        <span className="text-sm mt-1">
                          {hiddenCharacters.length} more available
                        </span>
                      </button>

                      {isDropdownOpen && (
                        <div className="absolute inset-0 bg-white rounded-3xl shadow-2xl border-4 border-black z-10 flex flex-col">
                          <div className="p-4 border-b border-gray-200 flex items-center gap-2 font-bold">
                            <Search className="w-5 h-5 text-purple-500" />
                            <span>Available Characters</span>
                            <button
                              onClick={() => setIsDropdownOpen(false)}
                              className="ml-auto text-gray-400 hover:text-black"
                            >
                              ✕
                            </button>
                          </div>
                          
                          <div className="flex-1 overflow-y-auto p-3">
                            {hiddenCharacters.map(char => (
                              <button
                                key={char.id}
                                onClick={() => addCharacterToView(char.id)}
                                className="
                                  w-full text-left p-4 mb-2
                                  rounded-2xl
                                  hover:bg-purple-50
                                  border-2 border-transparent
                                  hover:border-purple-300
                                  transition-all
                                "
                              >
                                <div className="font-black text-lg mb-1">{char.name}</div>
                                <div className="text-sm text-gray-600 line-clamp-2">
                                  {char.description}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Re-extract option */}
                <div className="mt-12 text-center">
                  <button
                    onClick={reExtractWorld}
                    disabled={isReExtracting}
                    className="
                      text-sm font-bold text-red-500 hover:text-red-600
                      underline disabled:opacity-50
                      flex items-center gap-2 mx-auto
                    "
                  >
                    <Zap className="w-4 h-4" />
                    {isReExtracting ? "Re-extracting..." : "Re-extract world from story"}
                  </button>
                </div>
              </motion.div>
            )}

            {stage === "locations" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                
                {/* Back button */}
                <button
                  onClick={() => setStoryStatus("world_ready")}
                  className="flex items-center gap-2 text-gray-600 hover:text-black font-medium mb-8"
                >
                  <ArrowLeft className="w-5 h-5" />
                  <span>Back to Characters</span>
                </button>

                {/* Hero */}
                <div className="text-center mb-16">
                  <div className="inline-flex items-center gap-2 mb-6">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500"
                      />
                    ))}
                  </div>

                  <h1 className="text-7xl md:text-8xl font-black mb-6 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500 bg-clip-text text-transparent">
                    Your Locations
                  </h1>
                  
                  <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                    Where the magic happens! Review and refine these settings for your story.
                  </p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {localLocations.map(loc => (
                    <SampleImageLocationCard
                      key={loc.id}
                      location={loc}
                      onUpdated={u => updateEntity(loc.id, u, "loc")}
                    />
                  ))}
                </div>

                {/* Re-extract option */}
                <div className="mt-12 text-center">
                  <button
                    onClick={reExtractWorld}
                    disabled={isReExtracting}
                    className="
                      text-sm font-bold text-red-500 hover:text-red-600
                      underline disabled:opacity-50
                      flex items-center gap-2 mx-auto
                    "
                  >
                    <Zap className="w-4 h-4" />
                    {isReExtracting ? "Re-extracting..." : "Re-extract world from story"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}