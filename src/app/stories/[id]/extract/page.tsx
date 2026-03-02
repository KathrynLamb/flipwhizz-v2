"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
   MOBILE-FIRST EXTRACT PAGE
====================================================== */

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();

  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
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

  // Gate: we do a quick “check” first, and only trigger/poll if work is needed
  const hasBootstrapped = useRef(false);
  const workflowTriggered = useRef(false);
  const pollingStarted = useRef(false);

  /* ======================================================
     ADD ACTIVITY ITEM
  ====================================================== */

  const addActivity = (text: string, type: ActivityItem["type"] = "info") => {
    const item: ActivityItem = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      type,
      timestamp: Date.now(),
    };
    setActivity((prev) => [item, ...prev].slice(0, 10)); // Keep last 10
  };

  /* ======================================================
     DETERMINE CURRENT PHASE FROM PROGRESS
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
    // If worldComplete isn’t set but any step is missing, we need work.
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

  /* ======================================================
     FETCH WORKFLOW STATUS
  ====================================================== */

  async function fetchProgress(): Promise<ProgressData | null> {
    if (!storyId) return null;

    const res = await fetch(`/api/stories/${storyId}/workflow-progress`, {
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();

    if (!data?.progress) return null;

    const incoming = data.progress;

    // Build a safe ProgressData object
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
     UPDATE UI + ACTIVITY ON PHASE CHANGES
  ====================================================== */

  function applyProgress(newProgress: ProgressData) {
    const currentPhase = getCurrentPhase(newProgress);

    // Detect phase changes and add activity (only once we're actually running)
    if (currentPhase !== lastPhaseRef.current) {
      if (currentPhase === "extracting_locations") {
        addActivity("✅ Characters discovered", "success");
        addActivity("🗺️ Mapping locations...", "loading");
      } else if (currentPhase === "extracting_style") {
        addActivity("✅ Locations mapped", "success");
        addActivity("🎨 Creating style guide...", "loading");
      } else if (currentPhase === "building_spreads") {
        addActivity("✅ Style guide ready", "success");
        addActivity("📖 Building page spreads...", "loading");
      } else if (currentPhase === "assigning_characters") {
        addActivity("✅ Spreads built", "success");
        addActivity("👤 Placing characters in scenes...", "loading");
      } else if (currentPhase === "assigning_locations") {
        addActivity("✅ Characters placed", "success");
        addActivity("📍 Setting scene locations...", "loading");
      } else if (currentPhase === "extracting_outfits") {
        addActivity("✅ Locations set", "success");
        addActivity("👗 Designing character outfits...", "loading");
      } else if (currentPhase === "assigning_outfits") {
        addActivity("✅ Outfits designed", "success");
        addActivity("👔 Assigning outfits to scenes...", "loading");
      } else if (currentPhase === "ready") {
        // If we were running, celebrate. If we were just checking and found it done,
        // we’ll show a lighter message in the “checking” UI below.
        if (lastPhaseRef.current !== "checking") {
          addActivity("🎉 World building complete!", "success");
        }
      }

      lastPhaseRef.current = currentPhase;
    }

    setPhase(currentPhase);
    setProgress(newProgress);

    // Stop polling if complete
    if (newProgress.worldComplete) {
      if (pollRef.current) clearInterval(pollRef.current);
    }
  }

  /* ======================================================
     POLL LOOP
  ====================================================== */

  async function checkProgress() {
    try {
      const p = await fetchProgress();
      if (!p) return;

      applyProgress(p);
      errorCount.current = 0;
    } catch (err) {
      console.error("Error checking progress:", err);
      errorCount.current++;

      if (errorCount.current > 5) {
        setError("Unable to check progress. Please refresh the page.");
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }
  }

  /* ======================================================
     BOOTSTRAP FLOW
     1) QUICK CHECK
     2) IF NEEDED, TRIGGER WORKFLOW
     3) START POLLING
  ====================================================== */

  useEffect(() => {
    if (!storyId || hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    let cancelled = false;

    const run = async () => {
      try {
        setPhase("checking");
        lastPhaseRef.current = "checking";

        // Lightweight check UI
        // (Don’t add the big extraction activity log yet)
        const p = await fetchProgress();

        if (cancelled) return;

        if (!p) {
          // No progress row yet — assume we need to run workflow.
          // Start workflow + polling.
          addActivity("✨ Preparing your world...", "loading");
          await triggerWorkflow();
          startPolling();
          return;
        }

        // If already complete, do NOT show checklist; just redirect after a beat.
        if (!needsWork(p)) {
          // Keep UI simple: show “All set” and bounce.
          setProgress(p);
          setPhase("ready");
          return;
        }

        // Not complete -> show full UI + activity
        setProgress(p);
        setPhase(getCurrentPhase(p));

        // Add initial activity now that we know there is work to do
        setActivity([]);
        addActivity("🚀 Starting world building...", "loading");

        await triggerWorkflow();
        startPolling();
      } catch (err) {
        console.error("Bootstrap error:", err);
        setError("Failed to check world status. Please refresh and try again.");
      }
    };

    const triggerWorkflow = async () => {
      if (!storyId || workflowTriggered.current) return;
      workflowTriggered.current = true;

      const res = await fetch(`/api/stories/${storyId}/ensure-world`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(`Failed to start workflow: ${res.status}`);
      }
    };

    const startPolling = () => {
      if (pollingStarted.current) return;
      pollingStarted.current = true;

      // Initial call
      checkProgress();

      // Poll every 2 seconds
      pollRef.current = setInterval(checkProgress, 2000);
    };

    run();

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [storyId]);

  /* ======================================================
     AUTO-REDIRECT ON COMPLETE
  ====================================================== */

  useEffect(() => {
    if (phase === "ready" && storyId) {
      const t = setTimeout(() => {
        router.push(`/stories/${storyId}/illustration-style`);
      }, 1500);
      return () => clearTimeout(t);
    }
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
      estimate: "Just a moment…",
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
      subtitle: "Redirecting to character design...",
      icon: CheckCircle,
      color: "from-emerald-500 to-green-500",
      estimate: "",
    },
  };

  const currentPhase = phaseConfig[phase];
  const Icon = currentPhase.icon;

  /* ======================================================
     CALCULATE OVERALL PROGRESS
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
      {/* Mobile-First Header */}
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

      {/* Main Content */}
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
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className={`w-20 h-20 rounded-full bg-gradient-to-br ${currentPhase.color} p-1 shadow-2xl`}
                >
                  <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                    {phase === "checking" ? (
                      <Loader2
                        className="w-10 h-10 text-gray-800 animate-spin"
                        strokeWidth={2}
                      />
                    ) : (
                      <Icon className="w-10 h-10 text-gray-800" strokeWidth={2} />
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
                <p className="text-sm text-gray-500">{currentPhase.estimate}</p>
              )}

              {/* If we checked and it’s already done, give a nicer one-liner */}
              {phase === "ready" &&
                progress.charactersExtracted &&
                progress.locationsExtracted &&
                progress.styleExtracted &&
                progress.spreadsBuilt && (
                  <p className="text-sm text-gray-500">
                    All done already — jumping you to the next step ✨
                  </p>
                )}
            </div>

            {/* During CHECKING: show a minimal loader card, not the whole checklist */}
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
                      If everything’s already built, we’ll skip straight ahead.
                    </p>
                  </div>
                  <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
                </div>
              </div>
            )}

            {/* Progress Steps (only show if there is actual work to do) */}
            {showChecklist && (
              <div className="flex flex-col gap-2">
                <ProgressStep
                  label="Extract Characters"
                  complete={progress.charactersExtracted}
                  active={phase === "extracting_characters"}
                />
                <ProgressStep
                  label="Extract Locations"
                  complete={progress.locationsExtracted}
                  active={phase === "extracting_locations"}
                />
                <ProgressStep
                  label="Extract Style"
                  complete={progress.styleExtracted}
                  active={phase === "extracting_style"}
                />
                <ProgressStep
                  label="Build Spreads"
                  complete={progress.spreadsBuilt}
                  active={phase === "building_spreads"}
                />
                <ProgressStep
                  label="Assign Characters"
                  complete={progress.charactersAssigned}
                  active={phase === "assigning_characters"}
                />
                <ProgressStep
                  label="Assign Locations"
                  complete={progress.locationsAssigned}
                  active={phase === "assigning_locations"}
                />
                <ProgressStep
                  label="Design Outfits"
                  complete={progress.outfitsExtracted}
                  active={phase === "extracting_outfits"}
                />
                <ProgressStep
                  label="Assign Outfits"
                  complete={progress.outfitsAssigned}
                  active={phase === "assigning_outfits"}
                />
              </div>
            )}

            {/* Progress Bar (hide during checking; optional during ready) */}
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
                  <h3 className="text-sm font-bold text-gray-900">
                    Activity Log
                  </h3>
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
                        {item.type === "success" && (
                          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        )}
                        {item.type === "loading" && (
                          <Loader2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5 animate-spin" />
                        )}
                        {item.type === "info" && (
                          <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                        )}
                        <span className="text-sm text-gray-700 flex-1">
                          {item.text}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Info Cards (only show during processing, not during checking) */}
            {showInfoCards && (
              <div className="grid grid-cols-4 gap-2">
                <InfoCard
                  icon={Users}
                  label="Characters"
                  status={progress.charactersExtracted ? "done" : "pending"}
                />
                <InfoCard
                  icon={MapPin}
                  label="Locations"
                  status={progress.locationsExtracted ? "done" : "pending"}
                />
                <InfoCard
                  icon={Palette}
                  label="Style"
                  status={progress.styleExtracted ? "done" : "pending"}
                />
                <InfoCard
                  icon={Shirt}
                  label="Outfits"
                  status={progress.outfitsExtracted ? "done" : "pending"}
                />
              </div>
            )}

            {/* Warning for slow progress */}
            {elapsedTime > 240 && phase !== "ready" && phase !== "checking" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-bold text-yellow-900">
                    Taking longer than usual
                  </p>
                  <p className="text-yellow-700 mt-1">
                    Complex stories with many characters can take 5–6 minutes.
                    Hang tight!
                  </p>
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

function ProgressStep({
  label,
  complete,
  active,
}: {
  label: string;
  complete: boolean;
  active: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <motion.div
        animate={{
          scale: active ? [1, 1.15, 1] : 1,
        }}
        transition={{
          duration: 2,
          repeat: active ? Infinity : 0,
          ease: "easeInOut",
        }}
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
      <span
        className={`text-sm font-medium ${
          complete || active ? "text-gray-900" : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  status,
}: {
  icon: any;
  label: string;
  status: "done" | "pending";
}) {
  return (
    <div
      className={`rounded-xl p-2 sm:p-3 text-center transition-all ${
        status === "done"
          ? "bg-green-50 border-2 border-green-200"
          : "bg-gray-50 border-2 border-gray-200"
      }`}
    >
      <Icon
        className={`w-5 h-5 sm:w-6 sm:h-6 mx-auto mb-1 ${
          status === "done" ? "text-green-600" : "text-gray-400"
        }`}
        strokeWidth={2}
      />
      <div className="text-xs font-semibold text-gray-900 truncate">{label}</div>
      <div
        className={`text-xs font-medium mt-0.5 ${
          status === "done" ? "text-green-600" : "text-gray-500"
        }`}
      >
        {status === "done" ? "✓" : "..."}
      </div>
    </div>
  );
}