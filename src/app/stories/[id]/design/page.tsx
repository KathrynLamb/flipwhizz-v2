// src/app/stories/[id]/extract/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle, Loader2, Sparkles, BookOpen, Eye } from "lucide-react";

type Phase = "extracting" | "building_spreads" | "deciding_scenes" | "ready";

type ProgressData = {
  worldExtracted: boolean;
  spreadsBuilt: boolean;
  scenesDecided: boolean;
};

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  const [phase, setPhase] = useState<Phase>("extracting");
  const [progress, setProgress] = useState<ProgressData>({
    worldExtracted: false,
    spreadsBuilt: false,
    scenesDecided: false,
  });
  const [error, setError] = useState<string | null>(null);

  /* --------------------------------------------------
     Poll workflow status
  -------------------------------------------------- */
  useEffect(() => {
    if (!storyId) return;

    async function checkProgress() {
      try {
        const res = await fetch(`/api/stories/${storyId}/ensure-world`, {
          method: "POST",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (data.status === "complete") {
          setPhase("ready");
          setProgress({
            worldExtracted: true,
            spreadsBuilt: true,
            scenesDecided: true,
          });
          return;
        }

        if (data.status === "processing" && data.progress) {
          setPhase(data.mode);
          setProgress(data.progress);
        }
      } catch (err) {
        console.error("Error checking progress:", err);
        setError("Unable to check progress");
      }
    }

    checkProgress();
    const interval = setInterval(checkProgress, 2000);

    return () => clearInterval(interval);
  }, [storyId]);

  /* --------------------------------------------------
     Auto-redirect when complete
  -------------------------------------------------- */
  useEffect(() => {
    if (phase === "ready" && storyId) {
      setTimeout(() => {
        router.push(`/stories/${storyId}/characters`);
      }, 2000);
    }
  }, [phase, storyId, router]);

  /* --------------------------------------------------
     Phase configuration
  -------------------------------------------------- */
  const phaseConfig = {
    extracting: {
      title: "Building Your World",
      subtitle: "Discovering characters, locations, and style",
      icon: Sparkles,
      color: "from-purple-500 to-pink-500",
    },
    building_spreads: {
      title: "Structuring Your Book",
      subtitle: "Pairing pages into double-page spreads",
      icon: BookOpen,
      color: "from-blue-500 to-cyan-500",
    },
    deciding_scenes: {
      title: "Planning Illustrations",
      subtitle: "Deciding which characters appear on each spread",
      icon: Eye,
      color: "from-green-500 to-emerald-500",
    },
    ready: {
      title: "Your World Is Ready!",
      subtitle: "Redirecting...",
      icon: CheckCircle,
      color: "from-emerald-500 to-green-500",
    },
  };

  const currentPhase = phaseConfig[phase];
  const Icon = currentPhase.icon;

  const overallProgress = useMemo(() => {
    const phases = [
      progress.worldExtracted,
      progress.spreadsBuilt,
      progress.scenesDecided,
    ];
    return (phases.filter(Boolean).length / phases.length) * 100;
  }, [progress]);

  if (error) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <h1 className="text-2xl font-black text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-red-500 text-white font-bold rounded-full hover:scale-105 transition"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center">
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-semibold text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
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
                    <Icon className="w-10 h-10 text-gray-800" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-black text-gray-900">
                {currentPhase.title}
              </h1>
              <p className="text-lg text-gray-600">
                {currentPhase.subtitle}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full bg-gradient-to-r ${currentPhase.color}`}
                  initial={{ width: "0%" }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              <p className="text-center text-sm font-semibold text-gray-600">
                {Math.round(overallProgress)}% Complete
              </p>
            </div>

            {/* Progress Steps */}
            <div className="flex justify-center items-center gap-4">
              <Step label="World" complete={progress.worldExtracted} />
              <div className="w-12 h-0.5 bg-gray-300" />
              <Step label="Spreads" complete={progress.spreadsBuilt} />
              <div className="w-12 h-0.5 bg-gray-300" />
              <Step label="Scenes" complete={progress.scenesDecided} />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Step({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`w-3 h-3 rounded-full ${
          complete
            ? "bg-gradient-to-r from-green-500 to-emerald-500"
            : "bg-gray-300"
        }`}
      />
      <span
        className={`text-xs font-medium ${
          complete ? "text-gray-900" : "text-gray-400"
        }`}
      >
        {label}
      </span>
    </div>
  );
}