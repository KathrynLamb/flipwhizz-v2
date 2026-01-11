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
  Database,
} from "lucide-react";

/* ======================================================
   TYPES
====================================================== */

type WorldCharacter = {
  id: string;
  name: string;
  description: string | null;
};

type WorldLocation = {
  id: string;
  name: string;
  description: string | null;
};

type WorldStyle = {
  id: string;
  summary: string | null;
};

type EnsureWorldResponse = {
  status: "processing" | "complete";
  mode: "extracting" | "fetching";
  hasCharacters: boolean;
  hasLocations: boolean;
  hasPresence: boolean;
  hasStyleText: boolean;
};

type WorldPayload = {
  story: { id: string; status: string | null };
  characters: WorldCharacter[];
  locations: WorldLocation[];
  style: WorldStyle | null;
};

type Stage =
  | "extracting"
  | "fetching"
  | "building_spreads"
  | "ready";

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
    return typeof raw === "string"
      ? raw
      : Array.isArray(raw)
      ? raw[0]
      : null;
  }, [params]);

  const [stage, setStage] = useState<Stage>("fetching");
  const [status, setStatus] = useState<string | null>(null);

  const [characters, setCharacters] = useState<WorldCharacter[]>([]);
  const [locations, setLocations] = useState<WorldLocation[]>([]);
  const [style, setStyle] = useState<WorldStyle | null>(null);

  const spreadsTriggered = useRef(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  /* ======================================================
     API HELPERS
  ====================================================== */

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
    await fetch(`/api/stories/${storyId}/build-spreads`, {
      method: "POST",
    });
  }

  async function loadWorld(): Promise<WorldPayload | null> {
    if (!storyId) return null;
    const res = await fetch(`/api/stories/${storyId}/world`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  }

  /* ======================================================
     ORCHESTRATION LOOP
  ====================================================== */

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    async function bootstrap() {
      const ensure = await ensureWorld();
      if (!ensure) return;

      setStage(ensure.mode);

      pollRef.current = setInterval(async () => {
        if (cancelled) return;

        const data = await loadWorld();
        if (!data) return;

        setStatus(data.story.status);
        setCharacters(data.characters ?? []);
        setLocations(data.locations ?? []);
        setStyle(data.style ?? null);

        const worldReady =
          data.characters.length > 0 &&
          data.locations.length > 0 &&
          Boolean(data.style?.summary);

        // 🔁 Stage correction from DB truth
        if (data.story.status === "extracting") {
          setStage("extracting");
        }

        // 🚀 Build spreads ONCE
        if (
          worldReady &&
          data.story.status !== "building_spreads" &&
          data.story.status !== "spreads_ready" &&
          !spreadsTriggered.current
        ) {
          spreadsTriggered.current = true;
          setStage("building_spreads");
          await buildSpreads();
        }

        // ✅ Final state
        if (data.story.status === "spreads_ready") {
          clearInterval(pollRef.current!);
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
    if (stage === 'ready'){
      router.push(`/stories/${storyId}/characters`)
    }
  }, [stage])

  /* ======================================================
     ACTIONS
  ====================================================== */

  async function reExtract() {
    if (!storyId) return;
    await fetch(`/api/stories/${storyId}/extract-world`, { method: "POST" });
    window.location.reload();
  }

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between">
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 text-gray-600 hover:text-black"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Hub
          </button>

          <button
            onClick={reExtract}
            className="flex items-center gap-2 text-sm font-bold text-red-500"
          >
            <RefreshCcw className="w-4 h-4" />
            Re-extract
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {stage !== "ready" && (
            <motion.div
              key={stage}
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="text-center pt-12"
            >
              <StageIcon stage={stage} />

              <h1 className="mt-8 text-5xl font-black">
                {stage === "extracting" && "Extracting your world"}
                {stage === "fetching" && "Loading existing world"}
                {stage === "building_spreads" && "Planning your spreads"}
              </h1>

              <p className="mt-4 text-gray-600 max-w-2xl mx-auto">
                {stage === "extracting" &&
                  "We’re analysing the story to extract characters, locations, and style."}
                {stage === "fetching" &&
                  "This story has already been analysed. Loading saved data."}
                {stage === "building_spreads" &&
                  "We’re deciding which characters and locations appear in each double-page spread."}
              </p>

              <div className="mt-10 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
                <StatusCard icon={Users} label="Characters" ok={characters.length > 0} />
                <StatusCard icon={MapPin} label="Locations" ok={locations.length > 0} />
                <StatusCard icon={Palette} label="Style" ok={Boolean(style?.summary)} />
              </div>
            </motion.div>
          )}

          {stage === "ready" && (
            <motion.div
              key="ready"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="text-center pt-12"
            >
              <div className="mx-auto w-20 h-20 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
                <CheckCircle className="w-9 h-9" />
              </div>

              <h1 className="mt-8 text-5xl font-black">
                World & spreads ready
              </h1>

              <p className="mt-4 text-gray-600 max-w-xl mx-auto">
                Characters, locations, style, and spread-by-spread presence are ready.
              </p>

              <button
                onClick={() => router.push(`/stories/${storyId}/characters`)}
                className="mt-10 bg-black text-white px-8 py-4 rounded-2xl font-black"
              >
                Continue to Characters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

/* ======================================================
   SMALL UI
====================================================== */

function StageIcon({ stage }: { stage: Stage }) {
  const Icon =
    stage === "extracting"
      ? Sparkles
      : stage === "fetching"
      ? Database
      : Layers;

  return (
    <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-r from-pink-500 to-blue-500 flex items-center justify-center text-white">
      <Icon className="w-8 h-8" />
    </div>
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
    <div className="rounded-2xl border p-4 text-center">
      <Icon
        className={`w-6 h-6 mx-auto ${
          ok ? "text-green-500" : "text-gray-300"
        }`}
      />
      <div className="mt-2 font-semibold">{label}</div>
      <div className="text-sm text-gray-500">
        {ok ? "Ready" : "Working…"}
      </div>
    </div>
  );
}
