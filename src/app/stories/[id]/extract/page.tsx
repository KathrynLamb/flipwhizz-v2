// "use client";

// import { useEffect, useMemo, useRef, useState } from "react";
// import { useParams, useRouter } from "next/navigation";
// import { motion, AnimatePresence } from "framer-motion";
// import {
//   Sparkles,
//   CheckCircle,
//   Users,
//   MapPin,
//   Palette,
//   RefreshCcw,
//   ArrowLeft,
//   Layers,
//   Database,
// } from "lucide-react";

// /* ======================================================
//    TYPES
// ====================================================== */

// type WorldCharacter = { id: string; name: string; description: string | null };
// type WorldLocation = { id: string; name: string; description: string | null };
// type WorldStyle = { id: string; summary: string | null };

// type EnsureWorldResponse = {
//   status: "processing" | "complete";
//   mode: "extracting" | "fetching";
//   hasCharacters: boolean;
//   hasLocations: boolean;
//   hasPresence: boolean;
//   hasStyleText: boolean;
// };

// type WorldPayload = {
//   story: { id: string; status: string | null } | null;
//   characters: WorldCharacter[];
//   locations: WorldLocation[];
//   style: WorldStyle | null;
// };

// type Stage = "extracting" | "fetching" | "building_spreads" | "ready";

// const fadeIn = {
//   hidden: { opacity: 0, y: 10 },
//   visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
// };

// export default function ExtractWorldPage() {
//   const params = useParams();
//   const router = useRouter();

//   const storyId = useMemo(() => {
//     const raw = (params as any)?.id;
//     return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
//   }, [params]);

//   const [stage, setStage] = useState<Stage>("fetching");
//   const [status, setStatus] = useState<string | null>(null);

//   const [characters, setCharacters] = useState<WorldCharacter[]>([]);
//   const [locations, setLocations] = useState<WorldLocation[]>([]);
//   const [style, setStyle] = useState<WorldStyle | null>(null);

//   const spreadsTriggered = useRef(false);
//   const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

//   async function ensureWorld(): Promise<EnsureWorldResponse | null> {
//     if (!storyId) return null;
//     const res = await fetch(`/api/stories/${storyId}/ensure-world`, {
//       method: "POST",
//     });
//     if (!res.ok) return null;
//     return res.json();
//   }

//   async function buildSpreads() {
//     if (!storyId) return;
//     await fetch(`/api/stories/${storyId}/build-spreads`, { method: "POST" });
//   }

//   async function loadWorld(): Promise<WorldPayload | null> {
//     if (!storyId) return null;
//     const res = await fetch(`/api/stories/${storyId}/world`, {
//       cache: "no-store",
//     });
//     if (!res.ok) return null;
//     return res.json();
//   }

//   useEffect(() => {
//     if (!storyId) return;
//     let cancelled = false;

//     async function bootstrap() {
//       const ensure = await ensureWorld();
//       if (!ensure || cancelled) return;

//       setStage(ensure.mode);

//       // Clear any previous interval (safety)
//       if (pollRef.current) clearInterval(pollRef.current);

//       pollRef.current = setInterval(async () => {
//         if (cancelled) return;

//         const data = await loadWorld();
//         if (!data) return;

//         setStatus(data.story?.status ?? null);
//         setCharacters(data.characters ?? []);
//         setLocations(data.locations ?? []);
//         setStyle(data.style ?? null);

//         // Decide readiness for spreads planning
//         const worldReady =
//           (data.characters?.length ?? 0) > 0 &&
//           (data.locations?.length ?? 0) > 0 &&
//           Boolean(data.style?.summary);

//         const storyStatus = data.story?.status;

//         // Stage correction from DB truth
//         if (storyStatus === "extracting") setStage("extracting");

//         // Build spreads ONCE after world is ready
//         if (
//           worldReady &&
//           storyStatus !== "building_spreads" &&
//           storyStatus !== "spreads_ready" &&
//           !spreadsTriggered.current
//         ) {
//           spreadsTriggered.current = true;
//           setStage("building_spreads");
//           await buildSpreads();
//         }

//         // Final state
//         const spreadsReady =
//         storyStatus === "spreads_ready" &&
//         (data as any).spreadCount > 0;
      
//       if (spreadsReady) {
//         if (pollRef.current) clearInterval(pollRef.current);
//         setStage("ready");
//       }
      
        
//       }, 1200);
//     }

//     bootstrap();

//     return () => {
//       cancelled = true;
//       if (pollRef.current) clearInterval(pollRef.current);
//     };
//   }, [storyId]);

//   useEffect(() => {
//     if (
//       stage === "ready" &&
//       storyId &&
//       characters.length > 0 &&
//       locations.length > 0
//     ) {
//       router.push(`/stories/${storyId}/characters`);
//     }
    
//   }, [stage, router, storyId]);

//   async function reExtract() {
//     if (!storyId) return;
//     await fetch(`/api/stories/${storyId}/extract-world`, { method: "POST" });
//     window.location.reload();
//   }

//   return (
//     <div className="min-h-screen bg-white">
//       <header className="sticky top-0 z-50 bg-white border-b">
//         <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between">
//           <button
//             onClick={() => router.push(`/stories/${storyId}/hub`)}
//             className="flex items-center gap-2 text-gray-600 hover:text-black"
//           >
//             <ArrowLeft className="w-4 h-4" />
//             Back to Hub
//           </button>

//           <button
//             onClick={reExtract}
//             className="flex items-center gap-2 text-sm font-bold text-red-500"
//           >
//             <RefreshCcw className="w-4 h-4" />
//             Re-extract
//           </button>
//         </div>
//       </header>

//       <main className="max-w-6xl mx-auto px-6 py-12">
//         <AnimatePresence mode="wait">
//           {stage !== "ready" && (
//             <motion.div
//               key={stage}
//               variants={fadeIn}
//               initial="hidden"
//               animate="visible"
//               className="text-center pt-12"
//             >
//               <StageIcon stage={stage} />

//               <h1 className="mt-8 text-5xl font-black">
//                 {stage === "extracting" && "Extracting your world"}
//                 {stage === "fetching" && "Loading existing world"}
//                 {stage === "building_spreads" && "Planning your spreads"}
//               </h1>

//               <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
//                 {stage === "extracting" &&
//                   "We’re analysing the story to extract characters, locations, and style."}
//                 {stage === "fetching" &&
//                   "This story has already been analysed. Loading saved data."}
//                 {stage === "building_spreads" &&
//                   "We’re deciding what appears visually on each page and spread."}
//               </p>

//               <div className="mt-10 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
//                 <StatusCard icon={Users} label="Characters" ok={characters.length > 0} />
//                 <StatusCard icon={MapPin} label="Locations" ok={locations.length > 0} />
//                 <StatusCard icon={Palette} label="Style" ok={Boolean(style?.summary)} />
//               </div>

//               <div className="mt-6 text-sm text-gray-400">
//                 DB status: {status ?? "unknown"}
//               </div>
//             </motion.div>
//           )}

//           {stage === "ready" && (
//             <motion.div
//               key="ready"
//               variants={fadeIn}
//               initial="hidden"
//               animate="visible"
//               className="text-center pt-12"
//             >
//               <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
//                 <CheckCircle className="w-9 h-9" />
//               </div>

//               <h1 className="mt-8 text-5xl font-black">World & spreads ready</h1>

//               <p className="mt-4 text-gray-600 max-w-xl mx-auto">
//                 Characters, locations, style, and presence are ready.
//               </p>

//               <button
//                 onClick={() => router.push(`/stories/${storyId}/characters`)}
//                 className="mt-10 bg-black text-white px-8 py-4 rounded-2xl font-black"
//               >
//                 Continue to Characters
//               </button>
//             </motion.div>
//           )}
//         </AnimatePresence>
//       </main>
//     </div>
//   );
// }

// function StageIcon({ stage }: { stage: Stage }) {
//   const Icon = stage === "extracting" ? Sparkles : stage === "fetching" ? Database : Layers;
//   return (
//     <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-r from-pink-500 to-blue-500 flex items-center justify-center text-white">
//       <Icon className="w-8 h-8" />
//     </div>
//   );
// }

// function StatusCard({
//   icon: Icon,
//   label,
//   ok,
// }: {
//   icon: any;
//   label: string;
//   ok: boolean;
// }) {
//   return (
//     <div className="rounded-2xl border p-4 text-center">
//       <Icon className={`w-6 h-6 mx-auto ${ok ? "text-green-500" : "text-gray-300"}`} />
//       <div className="mt-2 font-semibold">{label}</div>
//       <div className="text-sm text-gray-500">{ok ? "Ready" : "Working…"}</div>
//     </div>
//   );
// }
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle,
  Users,
  MapPin,
  Palette,
  RefreshCcw,
  ArrowLeft,
  Layers,
  Wand2,
  Book,
  Zap,
} from "lucide-react";

/* ======================================================
   TYPES
====================================================== */

type WorldCharacter = { id: string; name: string; description: string | null };
type WorldLocation = { id: string; name: string; description: string | null };
type WorldStyle = { id: string; summary: string | null };

type EnsureWorldResponse = {
  status: "processing" | "complete";
  mode: "extracting" | "fetching";
  hasCharacters: boolean;
  hasLocations: boolean;
  hasPresence: boolean;
  hasStyleText: boolean;
};

type WorldPayload = {
  story: { id: string; status: string | null } | null;
  characters: WorldCharacter[];
  locations: WorldLocation[];
  style: WorldStyle | null;
};

type Stage = "extracting" | "fetching" | "building_spreads" | "ready";

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();

  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  const [stage, setStage] = useState<Stage>("fetching");
  const [status, setStatus] = useState<string | null>(null);

  const [characters, setCharacters] = useState<WorldCharacter[]>([]);
  const [locations, setLocations] = useState<WorldLocation[]>([]);
  const [style, setStyle] = useState<WorldStyle | null>(null);

  const spreadsTriggered = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function ensureWorld(): Promise<EnsureWorldResponse | null> {
    if (!storyId) return null;
    const res = await fetch(`/api/stories/${storyId}/ensure-world`, {
      method: "POST",
    });
    if (!res.ok) return null;
    return res.json();
  }

  async function buildSpreads() {
    if (!storyId) return;
    await fetch(`/api/stories/${storyId}/build-spreads`, { method: "POST" });
  }

  async function loadWorld(): Promise<WorldPayload | null> {
    if (!storyId) return null;
    const res = await fetch(`/api/stories/${storyId}/world`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  }

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    async function bootstrap() {
      const ensure = await ensureWorld();
      if (!ensure || cancelled) return;

      setStage(ensure.mode);

      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        if (cancelled) return;

        const data = await loadWorld();
        if (!data) return;

        setStatus(data.story?.status ?? null);
        setCharacters(data.characters ?? []);
        setLocations(data.locations ?? []);
        setStyle(data.style ?? null);

        const worldReady =
          (data.characters?.length ?? 0) > 0 &&
          (data.locations?.length ?? 0) > 0 &&
          Boolean(data.style?.summary);

        const storyStatus = data.story?.status;

        if (storyStatus === "extracting") setStage("extracting");

        if (
          worldReady &&
          storyStatus !== "building_spreads" &&
          storyStatus !== "spreads_ready" &&
          !spreadsTriggered.current
        ) {
          spreadsTriggered.current = true;
          setStage("building_spreads");
          await buildSpreads();
        }

        const spreadsReady =
          storyStatus === "spreads_ready" && (data as any).spreadCount > 0;

        if (spreadsReady) {
          if (pollRef.current) clearInterval(pollRef.current);
          setStage("ready");
        }
      }, 1200);
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [storyId]);

  useEffect(() => {
    if (
      stage === "ready" &&
      storyId &&
      characters.length > 0 &&
      locations.length > 0
    ) {
      router.push(`/stories/${storyId}/characters`);
    }
  }, [stage, router, storyId]);

  async function reExtract() {
    if (!storyId) return;
    await fetch(`/api/stories/${storyId}/extract-world`, { method: "POST" });
    window.location.reload();
  }

  const progress = useMemo(() => {
    const checks = [
      characters.length > 0,
      locations.length > 0,
      Boolean(style?.summary),
    ];
    const complete = checks.filter(Boolean).length;
    return (complete / 3) * 100;
  }, [characters, locations, style]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, -50, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-purple-300/30 to-pink-300/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -80, 0],
            y: [0, 100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-blue-300/30 to-purple-300/30 rounded-full blur-3xl"
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Hub
          </button>

          <button
            onClick={reExtract}
            className="flex items-center gap-2 text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Re-extract
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-16">
        <AnimatePresence mode="wait">
          {stage !== "ready" && (
            <motion.div
              key={stage}
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="text-center"
            >
              {/* Animated Icon */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="mx-auto relative"
              >
                <motion.div
                  animate={{
                    rotate: 360,
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className="w-28 h-28 mx-auto rounded-full bg-gradient-to-tr from-pink-400 via-purple-500 to-blue-500 p-1"
                >
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    <StageIcon stage={stage} />
                  </div>
                </motion.div>

                {/* Orbiting sparkles */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      rotate: 360,
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "linear",
                      delay: i * 0.8,
                    }}
                    className="absolute inset-0"
                  >
                    <Sparkles className="w-5 h-5 text-yellow-400 absolute -top-2 left-1/2 -translate-x-1/2" />
                  </motion.div>
                ))}
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-10 text-5xl md:text-6xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent"
              >
                {stage === "extracting" && "Bringing Your Story to Life"}
                {stage === "fetching" && "Loading Your World"}
                {stage === "building_spreads" && "Planning the Perfect Pages"}
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed"
              >
                {stage === "extracting" &&
                  "AI is discovering the characters, places, and visual style that make your story magical."}
                {stage === "fetching" &&
                  "Retrieving your previously created world. This'll just take a moment!"}
                {stage === "building_spreads" &&
                  "Designing the visual layout for each page—deciding what readers will see and when."}
              </motion.p>

              {/* Progress Bar */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-10 max-w-md mx-auto"
              >
                <div className="bg-white rounded-full h-3 overflow-hidden shadow-inner border border-gray-200">
                  <motion.div
                    className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-full"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-500">
                  {Math.round(progress)}% complete
                </p>
              </motion.div>

              {/* Status Cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                <StatusCard
                  icon={Users}
                  label="Characters"
                  count={characters.length}
                  ok={characters.length > 0}
                  delay={0.6}
                />
                <StatusCard
                  icon={MapPin}
                  label="Locations"
                  count={locations.length}
                  ok={locations.length > 0}
                  delay={0.7}
                />
                <StatusCard
                  icon={Palette}
                  label="Visual Style"
                  ok={Boolean(style?.summary)}
                  delay={0.8}
                />
              </motion.div>

              {/* Fun waiting message */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="mt-12 p-6 bg-white/60 backdrop-blur-sm rounded-3xl border border-gray-200 max-w-md mx-auto"
              >
                <Wand2 className="w-6 h-6 mx-auto text-purple-500 mb-3" />
                <p className="text-sm text-gray-600 leading-relaxed">
                  <strong className="text-gray-800">Did you know?</strong> Our AI reads your
                  entire story to understand each character's personality and the mood of
                  every scene!
                </p>
              </motion.div>
            </motion.div>
          )}

          {stage === "ready" && (
            <motion.div
              key="ready"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="text-center"
            >
              {/* Success animation */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                }}
                className="mx-auto relative"
              >
                <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-tr from-emerald-400 to-green-500 flex items-center justify-center shadow-2xl shadow-emerald-500/50">
                  <CheckCircle className="w-16 h-16 text-white" strokeWidth={2.5} />
                </div>

                {/* Confetti burst effect */}
                {[...Array(12)].map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ scale: 0, x: 0, y: 0 }}
                    animate={{
                      scale: [0, 1, 1],
                      x: Math.cos((i * 30 * Math.PI) / 180) * 100,
                      y: Math.sin((i * 30 * Math.PI) / 180) * 100,
                      opacity: [1, 1, 0],
                    }}
                    transition={{ duration: 1, delay: 0.1 }}
                    className="absolute top-1/2 left-1/2"
                  >
                    <Sparkles
                      className={`w-4 h-4 ${
                        i % 3 === 0
                          ? "text-pink-500"
                          : i % 3 === 1
                          ? "text-purple-500"
                          : "text-blue-500"
                      }`}
                    />
                  </motion.div>
                ))}
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-10 text-5xl md:text-6xl font-black bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent"
              >
                Your World Is Ready!
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-5 text-lg text-gray-600 max-w-xl mx-auto"
              >
                Everything is set up perfectly. Let's bring your characters to life with
                beautiful illustrations.
              </motion.p>

              {/* Summary cards */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-10 grid grid-cols-3 gap-4 max-w-lg mx-auto"
              >
                <div className="bg-white rounded-2xl p-6 border-2 border-emerald-200">
                  <Users className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-3xl font-black text-gray-800">{characters.length}</p>
                  <p className="text-sm text-gray-600 font-semibold">Characters</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border-2 border-emerald-200">
                  <MapPin className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-3xl font-black text-gray-800">{locations.length}</p>
                  <p className="text-sm text-gray-600 font-semibold">Locations</p>
                </div>
                <div className="bg-white rounded-2xl p-6 border-2 border-emerald-200">
                  <Book className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-3xl font-black text-gray-800">
                    <CheckCircle className="w-8 h-8 mx-auto" />
                  </p>
                  <p className="text-sm text-gray-600 font-semibold">Style Set</p>
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(`/stories/${storyId}/characters`)}
                className="mt-12 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white px-10 py-5 rounded-full font-black text-lg shadow-2xl shadow-purple-500/50 hover:shadow-purple-500/70 transition-all flex items-center gap-3 mx-auto"
              >
                Continue to Design Studio
                <Zap className="w-5 h-5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function StageIcon({ stage }: { stage: Stage }) {
  const Icon =
    stage === "extracting"
      ? Sparkles
      : stage === "fetching"
      ? Book
      : Layers;
  return (
    <motion.div
      animate={{
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <Icon className="w-12 h-12 text-purple-600" strokeWidth={2} />
    </motion.div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  count,
  ok,
  delay,
}: {
  icon: any;
  label: string;
  count?: number;
  ok: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className={`relative rounded-3xl p-6 transition-all duration-500 ${
        ok
          ? "bg-white border-2 border-emerald-200 shadow-lg"
          : "bg-white/50 backdrop-blur-sm border-2 border-gray-200"
      }`}
    >
      {/* Animated check badge when complete */}
      <AnimatePresence>
        {ok && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg"
          >
            <CheckCircle className="w-5 h-5 text-white" strokeWidth={3} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Icon with pulse animation when working */}
      <motion.div
        animate={
          !ok
            ? {
                scale: [1, 1.1, 1],
                opacity: [0.5, 1, 0.5],
              }
            : {}
        }
        transition={
          !ok
            ? {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }
            : {}
        }
      >
        <Icon
          className={`w-10 h-10 mx-auto transition-colors ${
            ok ? "text-emerald-600" : "text-gray-400"
          }`}
          strokeWidth={2}
        />
      </motion.div>

      <div className="mt-4 font-bold text-gray-800 text-lg">{label}</div>

      {count !== undefined ? (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: ok ? 1 : 0 }}
          className="mt-2 text-3xl font-black bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
        >
          {count}
        </motion.div>
      ) : (
        <div className="mt-2 text-sm font-semibold">
          {ok ? (
            <span className="text-emerald-600">Complete</span>
          ) : (
            <span className="text-gray-500">Analyzing...</span>
          )}
        </div>
      )}

      {/* Loading bar when working */}
      {!ok && (
        <div className="mt-4 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-pink-400 to-purple-400 rounded-full"
            animate={{
              x: ["-100%", "100%"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{ width: "50%" }}
          />
        </div>
      )}
    </motion.div>
  );
}