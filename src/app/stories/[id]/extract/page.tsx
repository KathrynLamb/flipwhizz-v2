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
  AlertCircle,
  XCircle,
} from "lucide-react";

/* ======================================================
   TYPES
====================================================== */

type WorldCharacter = { id: string; name: string; description: string | null };
type WorldLocation = { id: string; name: string; description: string | null };
type WorldStyle = { id: string; summary: string | null };

type WorldPayload = {
  story: { id: string; status: string | null } | null;
  characters: WorldCharacter[];
  locations: WorldLocation[];
  style: WorldStyle | null;
};

type Stage =
  | "extracting"
  | "fetching"
  | "building_spreads"
  | "deciding_scenes"
  | "ready"
  | "error";

/* ======================================================
   ANIMATION
====================================================== */

const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ======================================================
   PAGE
====================================================== */

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();

  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  const [stage, setStage] = useState<Stage>("fetching");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [characters, setCharacters] = useState<WorldCharacter[]>([]);
  const [locations, setLocations] = useState<WorldLocation[]>([]);
  const [style, setStyle] = useState<WorldStyle | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCount = useRef(0);
  const ensureSpreadsCalled = useRef(false);

  async function loadWorld(): Promise<WorldPayload | null> {
    if (!storyId) return null;
    try {
      const res = await fetch(`/api/stories/${storyId}/world`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      errorCount.current = 0; // Reset on success
      return res.json();
    } catch (err) {
      console.error("Error loading world:", err);
      errorCount.current++;
      if (errorCount.current > 5) {
        setError("Failed to load story data. Please refresh the page.");
        setStage("error");
      }
      return null;
    }
  }

  async function ensureWorld() {
    if (!storyId) return;
    try {
      const res = await fetch(`/api/stories/${storyId}/ensure-world`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("Error ensuring world:", err);
    }
  }

  async function ensureSpreads() {
    if (!storyId || ensureSpreadsCalled.current) return;
    ensureSpreadsCalled.current = true;
    
    try {
      const res = await fetch(`/api/stories/${storyId}/ensure-spreads`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("🧱 ensure-spreads response:", data);
    } catch (err) {
      console.error("❌ ensure-spreads failed:", err);
      setError("Failed to build story structure. Please try again.");
      setStage("error");
    }
  }

  /* ======================================================
     BOOTSTRAP + POLLING
  ====================================================== */

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    async function bootstrap() {
      await ensureWorld();
      await ensureSpreads();
      if (cancelled) return;

      pollRef.current = setInterval(async () => {
        if (cancelled) return;

        const data = await loadWorld();
        if (!data) return;

        const storyStatus = data.story?.status ?? null;

        setStatus(storyStatus);
        setCharacters(data.characters ?? []);
        setLocations(data.locations ?? []);
        setStyle(data.style ?? null);

        /* ---------- Stage mapping ---------- */
        if (storyStatus === "error") {
          setStage("error");
          setError("Something went wrong processing your story.");
          if (pollRef.current) clearInterval(pollRef.current);
        } else if (storyStatus === "extracting") {
          setStage("extracting");
        } else if (storyStatus === "building_spreads") {
          setStage("building_spreads");
        } else if (storyStatus === "deciding_scenes") {
          setStage("deciding_scenes");
        } else if (storyStatus === "scenes_ready" || storyStatus === "spreads_ready") {
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

  /* ======================================================
     AUTO-ADVANCE
  ====================================================== */

  useEffect(() => {
    if (stage === "ready" && storyId) {
      router.push(`/stories/${storyId}/characters`);
    }
  }, [stage, router, storyId]);

  /* ======================================================
     ACTIONS
  ====================================================== */

  async function reExtract() {
    if (!storyId) return;
    setError(null);
    setStage("extracting");
    errorCount.current = 0;
    ensureSpreadsCalled.current = false;
    await fetch(`/api/stories/${storyId}/extract-world`, { method: "POST" });
    window.location.reload();
  }

  async function retryFromError() {
    if (!storyId) return;
    setError(null);
    setStage("fetching");
    errorCount.current = 0;
    ensureSpreadsCalled.current = false;
    window.location.reload();
  }

  /* ======================================================
     PROGRESS
  ====================================================== */

  const progress = useMemo(() => {
    const steps = [
      characters.length > 0,
      locations.length > 0,
      Boolean(style?.summary),
      stage === "deciding_scenes" || stage === "ready",
    ];
    return (steps.filter(Boolean).length / steps.length) * 100;
  }, [characters, locations, style, stage]);

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between">
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 text-gray-600 hover:text-black font-semibold transition-colors"
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

      <main className="max-w-4xl mx-auto px-6 py-16 text-center">
        <AnimatePresence mode="wait">
          {/* ERROR STATE */}
          {stage === "error" && (
            <motion.div key="error" variants={fadeIn} initial="hidden" animate="visible">
              <div className="mx-auto w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>

              <h1 className="mt-10 text-5xl font-black text-red-600">
                Something Went Wrong
              </h1>

              <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto">
                {error || "We encountered an error processing your story."}
              </p>

              <div className="mt-10 flex gap-4 justify-center flex-wrap">
                <button
                  onClick={retryFromError}
                  className="px-8 py-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black shadow-lg hover:scale-105 transition"
                >
                  Try Again
                </button>

                <button
                  onClick={() => router.push(`/stories/${storyId}/hub`)}
                  className="px-8 py-4 rounded-full bg-white border-2 border-gray-300 text-gray-700 font-bold hover:scale-105 transition"
                >
                  Back to Hub
                </button>
              </div>

              <div className="mt-8 text-sm text-gray-500">
                Status: {status || "unknown"}
              </div>
            </motion.div>
          )}

          {/* PROCESSING STATES */}
          {stage !== "ready" && stage !== "error" && (
            <motion.div key={stage} variants={fadeIn} initial="hidden" animate="visible">
              <StageIcon stage={stage} />

              <h1 className="mt-10 text-5xl font-black bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                {stage === "extracting" && "Bringing Your Story to Life"}
                {stage === "fetching" && "Loading Your World"}
                {stage === "building_spreads" && "Structuring the Book"}
                {stage === "deciding_scenes" && "Planning the Visual Story"}
              </h1>

              <p className="mt-5 text-lg text-gray-600 max-w-2xl mx-auto">
                {stage === "extracting" &&
                  "Discovering characters, locations, and style."}
                {stage === "fetching" &&
                  "Loading previously created story data."}
                {stage === "building_spreads" &&
                  "Pairing pages and defining story structure."}
                {stage === "deciding_scenes" &&
                  "Deciding which characters and locations appear on each page."}
              </p>

              {/* Progress */}
              <div className="mt-10 max-w-md mx-auto">
                <div className="h-3 bg-white rounded-full overflow-hidden border border-gray-200 shadow-inner">
                  <motion.div
                    className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-gray-500">
                  {Math.round(progress)}% complete
                </p>
              </div>

              {/* Status Cards */}
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatusCard icon={Users} label="Characters" ok={characters.length > 0} />
                <StatusCard icon={MapPin} label="Locations" ok={locations.length > 0} />
                <StatusCard icon={Palette} label="Style" ok={Boolean(style?.summary)} />
              </div>

              {/* Debug info */}
              <div className="mt-10 text-xs text-gray-400">
                DB status: {status ?? "unknown"}
              </div>

              {/* Warning if stuck */}
              {errorCount.current > 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 max-w-md mx-auto bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-left">
                    <p className="font-bold text-yellow-900">Taking longer than expected</p>
                    <p className="text-yellow-700 mt-1">
                      This is unusual. Try refreshing the page or contact support if it persists.
                    </p>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* READY STATE */}
          {stage === "ready" && (
            <motion.div key="ready" variants={fadeIn} initial="hidden" animate="visible">
              <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-2xl shadow-emerald-500/50">
                <CheckCircle className="w-10 h-10 text-white" strokeWidth={3} />
              </div>
              
              <h1 className="mt-8 text-5xl font-black bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
                Your World Is Ready!
              </h1>
              
              <p className="mt-4 text-lg text-gray-600 max-w-xl mx-auto">
                We've planned where each character appears. Let's design them.
              </p>

              <button
                onClick={() => router.push(`/stories/${storyId}/characters`)}
                className="mt-10 px-10 py-5 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white font-black flex items-center gap-3 mx-auto shadow-2xl shadow-purple-500/30 hover:scale-105 transition"
              >
                Design Your Characters
                <Zap className="w-5 h-5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ======================================================
   COMPONENTS
====================================================== */

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
        rotate: [0, 360],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "linear",
      }}
      className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-pink-400 via-purple-500 to-blue-500 p-1"
    >
      <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
        <Icon className="w-10 h-10 text-purple-600" strokeWidth={2} />
      </div>
    </motion.div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  ok,
}: {
  icon: any;
  label: string;
  ok: boolean;
}) {
  return (
    <motion.div
      animate={
        !ok
          ? {
              scale: [1, 1.02, 1],
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
      className={`rounded-2xl p-6 border-2 text-center transition-all ${
        ok
          ? "bg-white border-emerald-300 shadow-lg"
          : "bg-white/60 border-gray-200 shadow-sm"
      }`}
    >
      <Icon
        className={`w-8 h-8 mx-auto mb-3 ${ok ? "text-emerald-500" : "text-gray-400"}`}
        strokeWidth={2}
      />
      <div className="font-bold text-gray-900 mb-1">{label}</div>
      <div className="text-sm font-semibold">
        {ok ? (
          <span className="text-emerald-600">Ready</span>
        ) : (
          <span className="text-gray-500">Working…</span>
        )}
      </div>
    </motion.div>
  );
}