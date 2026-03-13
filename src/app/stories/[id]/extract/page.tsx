"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  AlertCircle,
  Users,
  MapPin,
  Palette,
  BookOpen,
  XCircle,
  UserCheck,
  MapPinned,
  Shirt,
  Sparkles,
} from "lucide-react";
import { getNextStepHref, type StepKey } from "@/lib/storySteps";

/* ======================================================
   TYPES
====================================================== */

type Phase =
  | "checking"
  | "extracting_characters"
  | "extracting_locations"
  | "extracting_style"
  | "building_spreads"
  | "assigning_characters"
  | "assigning_locations"
  | "extracting_outfits"
  | "assigning_outfits"
  | "ready";

type ProgressData = {
  phase: Phase;
  charactersExtracted: boolean;
  locationsExtracted: boolean;
  styleExtracted: boolean;
  spreadsBuilt: boolean;
  charactersAssigned: boolean;
  locationsAssigned: boolean;
  outfitsExtracted: boolean;
  outfitsAssigned: boolean;
  worldComplete: boolean;
};

type ActivityItem = {
  id: string;
  text: string;
  type: "success" | "loading" | "info";
  timestamp: number;
};

/* ======================================================
   HELPERS (pure — no closures over state)
====================================================== */

function getCurrentPhase(prog: ProgressData): Phase {
  if (prog.worldComplete) return "ready";
  if (!prog.charactersExtracted) return "extracting_characters";
  if (!prog.locationsExtracted) return "extracting_locations";
  if (!prog.styleExtracted) return "extracting_style";
  if (!prog.spreadsBuilt) return "building_spreads";
  if (!prog.charactersAssigned) return "assigning_characters";
  if (!prog.locationsAssigned) return "assigning_locations";
  if (!prog.outfitsExtracted) return "extracting_outfits";
  if (!prog.outfitsAssigned) return "assigning_outfits";
  return "ready";
}

function needsWork(p: ProgressData) {
  if (p.worldComplete) return false;
  return !(
    p.charactersExtracted &&
    p.locationsExtracted &&
    p.styleExtracted &&
    p.spreadsBuilt &&
    p.charactersAssigned &&
    p.locationsAssigned &&
    p.outfitsExtracted &&
    p.outfitsAssigned
  );
}

function parseProgress(incoming: any): ProgressData {
  const built: ProgressData = {
    phase: "checking",
    charactersExtracted: !!incoming.charactersExtracted,
    locationsExtracted: !!incoming.locationsExtracted,
    styleExtracted: !!incoming.styleExtracted,
    spreadsBuilt: !!incoming.spreadsBuilt,
    charactersAssigned: !!incoming.charactersAssigned,
    locationsAssigned: !!incoming.locationsAssigned,
    outfitsExtracted: !!incoming.outfitsExtracted,
    outfitsAssigned: !!incoming.outfitsAssigned,
    worldComplete: !!incoming.worldComplete,
  };
  built.phase = getCurrentPhase(built);
  return built;
}

/* ======================================================
   EXTRACT WORLD PAGE
====================================================== */

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();

  const storyIdRef = useRef<string | null>(null);

  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    const id =
      typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
    storyIdRef.current = id;
    return id;
  }, [params]);

  // State
  const [phase, setPhase] = useState<Phase>("checking");
  const [progress, setProgress] = useState<ProgressData>({
    phase: "checking",
    charactersExtracted: false,
    locationsExtracted: false,
    styleExtracted: false,
    spreadsBuilt: false,
    charactersAssigned: false,
    locationsAssigned: false,
    outfitsExtracted: false,
    outfitsAssigned: false,
    worldComplete: false,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(Date.now());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCount = useRef(0);
  const lastPhaseRef = useRef<Phase>("checking");

  // Guard refs — these MUST be reset in cleanup for React Strict Mode
  const hasBootstrapped = useRef(false);
  const workflowTriggered = useRef(false);
  const pollingStarted = useRef(false);

  /* ======================================================
     ADD ACTIVITY ITEM
  ====================================================== */

  const addActivity = useCallback(
    (text: string, type: ActivityItem["type"] = "info") => {
      const item: ActivityItem = {
        id: `${Date.now()}-${Math.random()}`,
        text,
        type,
        timestamp: Date.now(),
      };
      setActivity((prev) => [item, ...prev].slice(0, 10));
    },
    []
  );

  /* ======================================================
     APPLY PROGRESS — ref-stable
  ====================================================== */

  const applyProgressRef = useRef<(p: ProgressData) => void>();

  applyProgressRef.current = (newProgress: ProgressData) => {
    const currentPhase = getCurrentPhase(newProgress);

    if (currentPhase !== lastPhaseRef.current) {
      const transitions: Record<string, [string, string]> = {
        extracting_locations: [
          "\u2705 Characters discovered",
          "\uD83D\uDDFA\uFE0F Mapping locations...",
        ],
        extracting_style: [
          "\u2705 Locations mapped",
          "\uD83C\uDFA8 Creating style guide...",
        ],
        building_spreads: [
          "\u2705 Style guide ready",
          "\uD83D\uDCD6 Building page spreads...",
        ],
        assigning_characters: [
          "\u2705 Spreads built",
          "\uD83D\uDC64 Placing characters in scenes...",
        ],
        assigning_locations: [
          "\u2705 Characters placed",
          "\uD83D\uDCCD Setting scene locations...",
        ],
        extracting_outfits: [
          "\u2705 Locations set",
          "\uD83D\uDC57 Designing character outfits...",
        ],
        assigning_outfits: [
          "\u2705 Outfits designed",
          "\uD83D\uDC54 Assigning outfits to scenes...",
        ],
      };

      const t = transitions[currentPhase];
      if (t) {
        addActivity(t[0], "success");
        addActivity(t[1], "loading");
      } else if (
        currentPhase === "ready" &&
        lastPhaseRef.current !== "checking"
      ) {
        addActivity("\uD83C\uDF89 World building complete!", "success");
      }

      lastPhaseRef.current = currentPhase;
    }

    setPhase(currentPhase);
    setProgress(newProgress);

    if (newProgress.worldComplete) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  };

  /* ======================================================
     CHECK PROGRESS — ref-stable
  ====================================================== */

  const checkProgressRef = useRef<() => Promise<void>>();

  checkProgressRef.current = async () => {
    const id = storyIdRef.current;
    if (!id) return;

    try {
      const res = await fetch(`/api/stories/${id}/workflow-progress`, {
        cache: "no-store",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      if (!data?.progress) {
        console.log("[poll] No progress data yet, will retry...");
        return;
      }

      const built = parseProgress(data.progress);
      applyProgressRef.current?.(built);
      errorCount.current = 0;
    } catch (err) {
      console.error("[poll] Error:", err);
      errorCount.current++;

      if (errorCount.current > 10) {
        setError("Unable to check progress. Please refresh the page.");
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }
    }
  };

  /* ======================================================
     START POLLING helper
  ====================================================== */

  const doStartPolling = useCallback(() => {
    if (pollingStarted.current) return;
    pollingStarted.current = true;

    console.log("[extract] Polling started");

    const tick = () => checkProgressRef.current?.();
    tick();
    pollRef.current = setInterval(tick, 2000);
  }, []);

  /* ======================================================
     BOOTSTRAP — the main useEffect
  ====================================================== */

  useEffect(() => {
    if (!storyId || hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    let cancelled = false;

    console.log("[extract] Bootstrap starting for story:", storyId);

    const fetchInitialProgress = async (): Promise<ProgressData | null> => {
      const res = await fetch(
        `/api/stories/${storyId}/workflow-progress`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data?.progress) return null;
      return parseProgress(data.progress);
    };

    const triggerWorkflow = async () => {
      if (workflowTriggered.current) return;
      workflowTriggered.current = true;

      console.log("[extract] Triggering ensure-world...");
      const res = await fetch(`/api/stories/${storyId}/ensure-world`, {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error(`[extract] ensure-world failed: ${res.status}`, text);
        throw new Error(`Failed to start workflow: ${res.status}`);
      }

      console.log("[extract] ensure-world triggered OK");
    };

    const run = async () => {
      try {
        setPhase("checking");
        lastPhaseRef.current = "checking";
        errorCount.current = 0;

        let p: ProgressData | null = null;

        try {
          p = await fetchInitialProgress();
          console.log("[extract] Initial progress:", p?.phase);
        } catch (e) {
          console.warn("[extract] Initial check failed, proceeding:", e);
        }

        if (cancelled) return;

        if (p && !needsWork(p)) {
          console.log("[extract] Already complete, setting ready");
          setProgress(p);
          setPhase("ready");
          return;
        }

        if (p) {
          setProgress(p);
          const cp = getCurrentPhase(p);
          setPhase(cp);
          lastPhaseRef.current = cp;
          setActivity([]);
          addActivity("\uD83D\uDE80 Continuing world building...", "loading");
        } else {
          addActivity("\u2728 Preparing your world...", "loading");
        }

        try {
          await triggerWorkflow();
        } catch (e) {
          console.warn("[extract] Trigger failed (may already be running):", e);
        }

        if (cancelled) return;

        console.log("[extract] Starting polling after bootstrap");
        doStartPolling();
      } catch (err) {
        console.error("[extract] Fatal bootstrap error:", err);
        if (!cancelled) {
          setError("Failed to start world building. Please refresh.");
        }
      }
    };

    run();

    const safetyTimer = setTimeout(() => {
      if (!pollingStarted.current && !cancelled) {
        console.warn("[extract] SAFETY: forcing polling start after 8s");
        doStartPolling();
      }
    }, 8000);

    return () => {
      console.log("[extract] Cleanup running");
      cancelled = true;

      hasBootstrapped.current = false;
      workflowTriggered.current = false;
      pollingStarted.current = false;

      lastPhaseRef.current = "checking";
      errorCount.current = 0;

      clearTimeout(safetyTimer);
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [storyId, addActivity, doStartPolling]);

  /* ======================================================
     AUTO-REDIRECT ON COMPLETE
     
     Uses shared getNextStepHref from @/lib/storySteps which
     handles both camelCase (Drizzle) and snake_case field names.
  ====================================================== */

  useEffect(() => {
    if (phase !== "ready" || !storyId) return;

    let cancelled = false;

    const redirect = async () => {
      try {
        const res = await fetch(`/api/stories/${storyId}`, {
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // API returns { story: { ... }, pages, characters, locations }
        const story = data.story ?? data;

        if (cancelled) return;

        const href = getNextStepHref(storyId, story);

        console.log("[extract] Redirecting to next incomplete step:", href);

        setTimeout(() => {
          if (!cancelled) router.push(href);
        }, 1500);
      } catch (err) {
        console.error("[extract] Failed to fetch story for redirect:", err);
        if (!cancelled) {
          setTimeout(() => {
            if (!cancelled)
              router.push(`/stories/${storyId}/illustration-style`);
          }, 1500);
        }
      }
    };

    redirect();

    return () => {
      cancelled = true;
    };
  }, [phase, storyId, router]);

  /* ======================================================
     PHASE CONFIG
  ====================================================== */

  const phaseConfig: Record<
    Phase,
    {
      title: string;
      subtitle: string;
      icon: any;
      color: string;
      estimate: string;
    }
  > = {
    checking: {
      title: "Checking Your World",
      subtitle: "Seeing if anything still needs building",
      icon: Sparkles,
      color: "from-slate-500 to-gray-600",
      estimate: "Just a moment\u2026",
    },
    extracting_characters: {
      title: "Discovering Characters",
      subtitle: "Finding every person in your story",
      icon: Users,
      color: "from-purple-500 to-pink-500",
      estimate: "~30 seconds",
    },
    extracting_locations: {
      title: "Mapping Locations",
      subtitle: "Identifying all the places in your world",
      icon: MapPin,
      color: "from-blue-500 to-cyan-500",
      estimate: "~30 seconds",
    },
    extracting_style: {
      title: "Creating Style Guide",
      subtitle: "Defining the visual look and feel",
      icon: Palette,
      color: "from-pink-500 to-orange-500",
      estimate: "~30 seconds",
    },
    building_spreads: {
      title: "Building Spreads",
      subtitle: "Organizing pages into double-page spreads",
      icon: BookOpen,
      color: "from-indigo-500 to-purple-500",
      estimate: "~45 seconds",
    },
    assigning_characters: {
      title: "Placing Characters",
      subtitle: "Deciding who appears on each page",
      icon: UserCheck,
      color: "from-green-500 to-emerald-500",
      estimate: "~45 seconds",
    },
    assigning_locations: {
      title: "Setting Scenes",
      subtitle: "Determining where each page takes place",
      icon: MapPinned,
      color: "from-teal-500 to-cyan-500",
      estimate: "~45 seconds",
    },
    extracting_outfits: {
      title: "Designing Outfits",
      subtitle: "Creating unique clothing for each character",
      icon: Shirt,
      color: "from-rose-500 to-pink-500",
      estimate: "~60 seconds",
    },
    assigning_outfits: {
      title: "Dressing Characters",
      subtitle: "Matching outfits to each scene",
      icon: Sparkles,
      color: "from-amber-500 to-orange-500",
      estimate: "~45 seconds",
    },
    ready: {
      title: "World Complete!",
      subtitle: "Taking you to the next step...",
      icon: CheckCircle,
      color: "from-emerald-500 to-green-500",
      estimate: "",
    },
  };

  const currentPhase = phaseConfig[phase];
  const Icon = currentPhase.icon;

  /* ======================================================
     OVERALL PROGRESS
  ====================================================== */

  const overallProgress = useMemo(() => {
    const phases = [
      progress.charactersExtracted,
      progress.locationsExtracted,
      progress.styleExtracted,
      progress.spreadsBuilt,
      progress.charactersAssigned,
      progress.locationsAssigned,
      progress.outfitsExtracted,
      progress.outfitsAssigned,
    ];
    return (phases.filter(Boolean).length / phases.length) * 100;
  }, [progress]);

  /* ======================================================
     ELAPSED TIME
  ====================================================== */

  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /* ======================================================
     ERROR STATE
  ====================================================== */

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">
            Something Went Wrong
          </h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-full hover:scale-105 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  /* ======================================================
     RENDER
  ====================================================== */

  const showChecklist = phase !== "ready" && phase !== "checking";
  const showActivity = activity.length > 0 && phase !== "checking";
  const showInfoCards = phase !== "ready" && phase !== "checking";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="text-xs font-medium text-gray-500">
            {formatTime(elapsedTime)}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-8"
          >
            {/* Icon */}
            <div className="flex justify-center">
              {phase === "ready" ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className={`w-20 h-20 rounded-full bg-gradient-to-br ${currentPhase.color} flex items-center justify-center shadow-2xl`}
                >
                  <Icon className="w-10 h-10 text-white" strokeWidth={2.5} />
                </motion.div>
              ) : (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  className={`w-20 h-20 rounded-full bg-gradient-to-br ${currentPhase.color} p-1 shadow-2xl`}
                >
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    {phase === "checking" ? (
                      <Loader2
                        className="w-10 h-10 text-gray-800 animate-spin"
                        strokeWidth={2}
                      />
                    ) : (
                      <Icon
                        className="w-10 h-10 text-gray-800"
                        strokeWidth={2}
                      />
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900">
                {currentPhase.title}
              </h1>
              <p className="text-base sm:text-lg text-gray-600 max-w-md mx-auto">
                {currentPhase.subtitle}
              </p>
              {currentPhase.estimate && (
                <p className="text-sm text-gray-500">
                  {currentPhase.estimate}
                </p>
              )}
              {phase === "ready" && progress.worldComplete && (
                <p className="text-sm text-gray-500">
                  All done — jumping you to the next step ✨
                </p>
              )}
            </div>

            {/* Checking state */}
            {phase === "checking" && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">
                      Checking existing progress…
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      If everything's already built, we'll skip straight ahead.
                    </p>
                  </div>
                  <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                </div>
              </div>
            )}

            {/* Progress Steps */}
            {showChecklist && (
              <div className="flex flex-col gap-2">
                <ProgressStep label="Extract Characters" complete={progress.charactersExtracted} active={phase === "extracting_characters"} />
                <ProgressStep label="Extract Locations" complete={progress.locationsExtracted} active={phase === "extracting_locations"} />
                <ProgressStep label="Extract Style" complete={progress.styleExtracted} active={phase === "extracting_style"} />
                <ProgressStep label="Build Spreads" complete={progress.spreadsBuilt} active={phase === "building_spreads"} />
                <ProgressStep label="Assign Characters" complete={progress.charactersAssigned} active={phase === "assigning_characters"} />
                <ProgressStep label="Assign Locations" complete={progress.locationsAssigned} active={phase === "assigning_locations"} />
                <ProgressStep label="Design Outfits" complete={progress.outfitsExtracted} active={phase === "extracting_outfits"} />
                <ProgressStep label="Assign Outfits" complete={progress.outfitsAssigned} active={phase === "assigning_outfits"} />
              </div>
            )}

            {/* Progress Bar */}
            {phase !== "checking" && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full bg-gradient-to-r ${currentPhase.color}`}
                    initial={{ width: "0%" }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  />
                </div>
                <p className="text-center text-sm font-semibold text-gray-600">
                  {Math.round(overallProgress)}% Complete
                </p>
              </div>
            )}

            {/* Activity Feed */}
            {showActivity && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900">Activity Log</h3>
                </div>
                <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  <AnimatePresence>
                    {activity.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="px-4 py-3 flex items-start gap-3"
                      >
                        {item.type === "success" && <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />}
                        {item.type === "loading" && <Loader2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5 animate-spin" />}
                        {item.type === "info" && <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />}
                        <span className="text-sm text-gray-700 flex-1">{item.text}</span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Info Cards */}
            {showInfoCards && (
              <div className="grid grid-cols-4 gap-2">
                <InfoCard icon={Users} label="Characters" status={progress.charactersExtracted ? "done" : "pending"} />
                <InfoCard icon={MapPin} label="Locations" status={progress.locationsExtracted ? "done" : "pending"} />
                <InfoCard icon={Palette} label="Style" status={progress.styleExtracted ? "done" : "pending"} />
                <InfoCard icon={Shirt} label="Outfits" status={progress.outfitsExtracted ? "done" : "pending"} />
              </div>
            )}

            {/* Slow warning */}
            {elapsedTime > 240 && phase !== "ready" && phase !== "checking" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-yellow-900">Taking longer than usual</p>
                  <p className="text-yellow-700 mt-1">Complex stories with many characters can take 5–6 minutes. Hang tight!</p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ======================================================
   COMPONENTS
====================================================== */

function ProgressStep({ label, complete, active }: { label: string; complete: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <motion.div
        animate={{ scale: active ? [1, 1.15, 1] : 1 }}
        transition={{ duration: 2, repeat: active ? Infinity : 0, ease: "easeInOut" }}
        className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
          complete
            ? "bg-gradient-to-r from-green-500 to-emerald-500"
            : active
              ? "bg-gradient-to-r from-blue-500 to-purple-500"
              : "bg-gray-300"
        }`}
      >
        {complete && <CheckCircle className="w-4 h-4 text-white" />}
        {active && <Loader2 className="w-4 h-4 text-white animate-spin" />}
      </motion.div>
      <span className={`text-sm font-medium ${complete || active ? "text-gray-900" : "text-gray-400"}`}>
        {label}
      </span>
    </div>
  );
}

function InfoCard({ icon: Icon, label, status }: { icon: any; label: string; status: "done" | "pending" }) {
  return (
    <div className={`rounded-xl p-2 sm:p-3 text-center transition-all ${status === "done" ? "bg-green-50 border-2 border-green-200" : "bg-gray-50 border-2 border-gray-200"}`}>
      <Icon className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 ${status === "done" ? "text-green-600" : "text-gray-400"}`} strokeWidth={2} />
      <div className="text-xs font-semibold text-gray-900 truncate">{label}</div>
      <div className={`text-xs font-medium mt-0.5 ${status === "done" ? "text-green-600" : "text-gray-500"}`}>
        {status === "done" ? "\u2713" : "..."}
      </div>
    </div>
  );
}