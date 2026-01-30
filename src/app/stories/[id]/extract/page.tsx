"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle,
  Loader2,
  AlertCircle,
  Sparkles,
  Users,
  MapPin,
  Palette,
  BookOpen,
  Eye,
  XCircle,
} from "lucide-react";

/* ======================================================
   TYPES
====================================================== */

type Phase = "extracting" | "building_spreads" | "deciding_scenes" | "ready";

type ProgressData = {
  phase: Phase;
  worldExtracted: boolean;
  spreadsBuilt: boolean;
  scenesDecided: boolean;
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
  const [phase, setPhase] = useState<Phase>("extracting");
  const [progress, setProgress] = useState<ProgressData>({
    phase: "extracting",
    worldExtracted: false,
    spreadsBuilt: false,
    scenesDecided: false,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState(Date.now());

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const errorCount = useRef(0);

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
    setActivity((prev) => [item, ...prev].slice(0, 5)); // Keep last 5
  };

  /* ======================================================
     POLL WORKFLOW STATUS
  ====================================================== */

  async function checkProgress() {
    if (!storyId) return;

    try {
      const res = await fetch(`/api/stories/${storyId}/ensure-world`, {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.status === "complete") {
        setPhase("ready");
        setProgress({
          phase: "ready",
          worldExtracted: true,
          spreadsBuilt: true,
          scenesDecided: true,
        });
        addActivity("All phases complete! 🎉", "success");
        if (pollRef.current) clearInterval(pollRef.current);
        return;
      }

      if (data.status === "processing" && data.progress) {
        const newProgress: ProgressData = {
          phase: data.mode,
          worldExtracted: data.progress.worldExtracted,
          spreadsBuilt: data.progress.spreadsBuilt,
          scenesDecided: data.progress.scenesDecided,
        };

        // Detect phase changes and add activity
        if (newProgress.phase !== progress.phase) {
          if (newProgress.phase === "building_spreads") {
            addActivity("World extracted successfully", "success");
            addActivity("Building page spreads...", "loading");
          } else if (newProgress.phase === "deciding_scenes") {
            addActivity("Spreads built successfully", "success");
            addActivity("Planning illustrations with Claude...", "loading");
          }
        }

        setPhase(newProgress.phase);
        setProgress(newProgress);
      }

      errorCount.current = 0; // Reset on success
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
     BOOTSTRAP
  ====================================================== */

  useEffect(() => {
    if (!storyId) return;

    addActivity("Starting workflow...", "loading");

    // Initial call
    checkProgress();

    // Poll every 1.5 seconds
    pollRef.current = setInterval(checkProgress, 1500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [storyId]);

  /* ======================================================
     AUTO-REDIRECT ON COMPLETE
  ====================================================== */

  useEffect(() => {
    if (phase === "ready" && storyId) {
      setTimeout(() => {
        router.push(`/stories/${storyId}/characters`);
      }, 2000);
    }
  }, [phase, storyId, router]);

  /* ======================================================
     PHASE CONFIG
  ====================================================== */

  const phaseConfig = {
    extracting: {
      title: "Building Your World",
      subtitle: "Discovering characters, locations, and style",
      icon: Sparkles,
      color: "from-purple-500 to-pink-500",
      estimate: "1-2 minutes",
    },
    building_spreads: {
      title: "Structuring Your Book",
      subtitle: "Pairing pages into double-page spreads",
      icon: BookOpen,
      color: "from-blue-500 to-cyan-500",
      estimate: "30 seconds",
    },
    deciding_scenes: {
      title: "Planning Illustrations",
      subtitle: "Claude is deciding which characters appear on each spread",
      icon: Eye,
      color: "from-green-500 to-emerald-500",
      estimate: "2-3 minutes",
    },
    ready: {
      title: "Your World Is Ready!",
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
      progress.worldExtracted,
      progress.spreadsBuilt,
      progress.scenesDecided,
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
                    <Icon className="w-10 h-10 text-gray-800" strokeWidth={2} />
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
                  Estimated: {currentPhase.estimate}
                </p>
              )}
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center items-center gap-3">
              <PhaseStep
                label="World"
                complete={progress.worldExtracted}
                active={phase === "extracting"}
              />
              <div className="w-8 h-0.5 bg-gray-300">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                  initial={{ width: "0%" }}
                  animate={{
                    width: progress.worldExtracted ? "100%" : "0%",
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <PhaseStep
                label="Spreads"
                complete={progress.spreadsBuilt}
                active={phase === "building_spreads"}
              />
              <div className="w-8 h-0.5 bg-gray-300">
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  initial={{ width: "0%" }}
                  animate={{
                    width: progress.spreadsBuilt ? "100%" : "0%",
                  }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <PhaseStep
                label="Scenes"
                complete={progress.scenesDecided}
                active={phase === "deciding_scenes"}
              />
            </div>

            {/* Progress Bar */}
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

            {/* Activity Feed */}
            {activity.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h3 className="text-sm font-bold text-gray-900">
                    Activity
                  </h3>
                </div>
                <div className="divide-y divide-gray-100">
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

            {/* Info Cards (only show during processing) */}
            {phase !== "ready" && (
              <div className="grid grid-cols-3 gap-3">
                <InfoCard
                  icon={Users}
                  label="Characters"
                  status={progress.worldExtracted ? "done" : "pending"}
                />
                <InfoCard
                  icon={MapPin}
                  label="Locations"
                  status={progress.worldExtracted ? "done" : "pending"}
                />
                <InfoCard
                  icon={Palette}
                  label="Style"
                  status={progress.worldExtracted ? "done" : "pending"}
                />
              </div>
            )}

            {/* Warning for slow progress */}
            {elapsedTime > 120 && phase !== "ready" && (
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
                    Large stories can take 3-5 minutes. Hang tight!
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

function PhaseStep({
  label,
  complete,
  active,
}: {
  label: string;
  complete: boolean;
  active: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        animate={{
          scale: active ? [1, 1.1, 1] : 1,
        }}
        transition={{
          duration: 2,
          repeat: active ? Infinity : 0,
          ease: "easeInOut",
        }}
        className={`w-3 h-3 rounded-full ${
          complete
            ? "bg-gradient-to-r from-green-500 to-emerald-500"
            : active
            ? "bg-gradient-to-r from-blue-500 to-purple-500"
            : "bg-gray-300"
        }`}
      />
      <span
        className={`text-xs font-medium ${
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
      className={`rounded-xl p-3 text-center transition-all ${
        status === "done"
          ? "bg-green-50 border-2 border-green-200"
          : "bg-gray-50 border-2 border-gray-200"
      }`}
    >
      <Icon
        className={`w-6 h-6 mx-auto mb-1 ${
          status === "done" ? "text-green-600" : "text-gray-400"
        }`}
        strokeWidth={2}
      />
      <div className="text-xs font-semibold text-gray-900">{label}</div>
      <div
        className={`text-xs font-medium mt-0.5 ${
          status === "done" ? "text-green-600" : "text-gray-500"
        }`}
      >
        {status === "done" ? "Ready" : "..."}
      </div>
    </div>
  );
}