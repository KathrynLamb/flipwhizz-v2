"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2,
  Upload,
  Pencil,
  ArrowRight,
  Check,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import { buildCharacterReferences } from "@/lib/buildCharacterreferences";

/* ======================================================
   TYPES
====================================================== */

export type Entity = {
  id: string;
  name: string;
  referenceImageUrl?: string | null;
  description?: string | null;
};

export type ClientStyleGuide = {
  id: string;
  storyId: string;
  summary: string | null;
  styleGuideImage: string | null;
  negativePrompt: string | null;
  sampleIllustrationUrl: string | null;
};

type SpreadUI = {
  leftText: string;
  rightText: string;
  sceneSummary?: string | null;
  characters: Entity[];
  locations: Entity[];
};

type StoryStatus =
  | "world_ready"
  | "style_ready"
  | "awaiting_payment"
  | "awaiting_generation_choice"
  | "generating";

/* ======================================================
   COMPONENT
====================================================== */

export default function InitialStyleDesignEditor({
  style,
  spreads,
  initialSpreadIndex,
  storyStatus,
  sampleImage,
}: {
  style: ClientStyleGuide;
  spreads: SpreadUI[];
  initialSpreadIndex: number;
  storyStatus: StoryStatus;
  sampleImage?: string | null;
}) {
  /* ---------------- STATE ---------------- */


  // const spread = spreads[spreadIndex];

  const [prompt, setPrompt] = useState(style.summary ?? "");
  const [styleRefUrl, setStyleRefUrl] = useState(style.styleGuideImage);
  const [mode, setMode] = useState<"view" | "edit" | "upload">("view");

  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleUrl, setSampleUrl] = useState(
    style.sampleIllustrationUrl || sampleImage || null
  );
  const [generationProgress, setGenerationProgress] = useState("");

  const safeInitialIndex =
  typeof initialSpreadIndex === "number" ? initialSpreadIndex : 0;

const [spreadIndex, setSpreadIndex] = useState(safeInitialIndex);

// Clamp index if spreads change
useEffect(() => {
  console.log("spreads", spreads)
  if (!Array.isArray(spreads) || spreads.length === 0) return;

  if (spreadIndex < 0) setSpreadIndex(0);
  if (spreadIndex > spreads.length - 1) {
    setSpreadIndex(spreads.length - 1);
  }
}, [spreads, spreadIndex]);

// HARD GUARD
if (!Array.isArray(spreads) || spreads.length === 0) {
  return (
    <div className="min-h-screen flex items-center justify-center text-stone-500">
      Preparing spreads…
    </div>
  );
}

const spread = spreads[spreadIndex];

if (!spread) {
  return (
    <div className="min-h-screen flex items-center justify-center text-stone-500">
      Loading spread…
    </div>
  );
}


  /* ======================================================
     ACTIONS
  ====================================================== */

  async function savePrompt() {
    await fetch("/api/style-guide/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: style.storyId,
        summary: prompt,
      }),
    });
    setMode("view");
  }

  async function generateSample() {
    setIsGeneratingSample(true);
    setSampleUrl(null);
    setGenerationProgress("Preparing spread…");

    const references = [
      ...(styleRefUrl
        ? [{ url: styleRefUrl, type: "style", label: "Style" }]
        : []),
      ...buildCharacterReferences(spread.characters),
    ];

    const res = await fetch("/api/style/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: style.storyId,
        description: prompt,
        leftText: spread.leftText,
        rightText: spread.rightText,
        references,
        force: true,
      }),
    });

    const { generationId } = await res.json();

    let ticks = 0;
    const poll = setInterval(async () => {
      ticks++;

      if (ticks === 3) setGenerationProgress("Illustrating scene…");
      if (ticks === 6) setGenerationProgress("Refining details…");

      const res = await fetch(
        `/api/stories/${style.storyId}/style-poll`
      );
      if (!res.ok) return;

      const data = await res.json();
      if (data.sampleUrl && data.generationId === generationId) {
        clearInterval(poll);
        setSampleUrl(data.sampleUrl);
        setIsGeneratingSample(false);
        setGenerationProgress("");
      }

      if (ticks > 60) {
        clearInterval(poll);
        setIsGeneratingSample(false);
        setGenerationProgress("");
        alert("Sample timed out");
      }
    }, 2000);
  }

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-fuchsia-50 px-6 py-20">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10">

        {/* LEFT */}
        <div className="space-y-6">

          {/* SPREAD SELECTOR */}
          <div className="flex items-center justify-between bg-white rounded-2xl p-4 shadow">
            <button
              disabled={spreadIndex === 0}
              onClick={() => setSpreadIndex(i => i - 1)}
              className="p-2 disabled:opacity-30"
            >
              <ChevronLeft />
            </button>

            <div className="text-center">
              <p className="font-black">
                Spread {spreadIndex + 1} of {spreads.length}
              </p>
              {spread.sceneSummary && (
                <p className="text-sm italic text-stone-500 mt-1">
                  “{spread.sceneSummary}”
                </p>
              )}
            </div>

            <button
              disabled={spreadIndex === spreads.length - 1}
              onClick={() => setSpreadIndex(i => i + 1)}
              className="p-2 disabled:opacity-30"
            >
              <ChevronRight />
            </button>
          </div>

          {/* TEXT PREVIEW */}
          <div className="bg-white rounded-3xl p-6 shadow space-y-3">
            <p className="italic text-stone-600">Left page</p>
            <p>{spread.leftText}</p>
            <p className="italic text-stone-600 mt-4">Right page</p>
            <p>{spread.rightText}</p>
          </div>

          {/* STYLE PROMPT */}
          <div className="bg-white rounded-3xl p-6 shadow">

            <div className="flex justify-between mb-3">
              <h3 className="font-bold">Art style</h3>
              {mode === "view" && (
                <button onClick={() => setMode("edit")}>
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>

            {mode === "view" ? (
              <p className="italic">{prompt}</p>
            ) : (
              <>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-32 border rounded-xl p-3"
                />
                <button
                  onClick={savePrompt}
                  className="mt-3 px-4 py-2 rounded-full bg-violet-600 text-white font-bold"
                >
                  Save
                </button>
              </>
            )}
          </div>
          <ReferencesPanel
          styleRefUrl={styleRefUrl}
          characters={spread.characters}
          locations={spread.locations}
        />
        </div>

        {/* RIGHT */}
        <div className="bg-white rounded-3xl p-6 shadow space-y-6">
          <h3 className="font-bold text-xl">Sample Preview</h3>

          {isGeneratingSample && (
            <div className="aspect-[4/3] flex flex-col items-center justify-center">
              <Loader2 className="animate-spin w-10 h-10 mb-4" />
              <p>{generationProgress}</p>
            </div>
          )}

          {!isGeneratingSample && !sampleUrl && (
            <div className="aspect-[4/3] flex flex-col items-center justify-center border-2 border-dashed rounded-2xl">
              <ImageIcon className="w-10 h-10 mb-3" />
              <p>No sample yet</p>
            </div>
          )}

          {!isGeneratingSample && sampleUrl && (
            <img
              src={sampleUrl}
              className="rounded-2xl shadow cursor-zoom-in"
            />
          )}

          <button
            onClick={generateSample}
            disabled={isGeneratingSample || mode !== "view"}
            className="w-full py-4 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-black"
          >
            <Wand2 className="inline w-5 h-5 mr-2" />
            Generate sample from this spread
          </button>
        </div>
      </div>
    </div>
  );
}

function ReferencesPanel({
  styleRefUrl,
  characters,
  locations,
}: {
  styleRefUrl: string | null;
  characters: Entity[];
  locations: Entity[];
}) {
  const hasAnything =
    Boolean(styleRefUrl) ||
    characters.length > 0 ||
    locations.length > 0;

  if (!hasAnything) return null;

  console.log('chaarc', characters, 'locations', locations)

  return (
    <div className="bg-white rounded-3xl p-6 shadow space-y-5">
      <h3 className="font-bold text-lg flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-violet-600" />
        References for this spread
      </h3>

      {/* STYLE */}
      {styleRefUrl && (
        <div>
          <p className="text-sm font-semibold text-stone-600 mb-2">
            Art style
          </p>
          <img
            src={styleRefUrl}
            alt="Style reference"
            className="w-full max-w-xs rounded-xl shadow"
          />
        </div>
      )}

      {/* CHARACTERS */}
      {characters.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-stone-600 mb-2">
            Characters
          </p>
          <div className="flex flex-wrap gap-3">
            {characters.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 bg-stone-50 rounded-xl p-2 pr-3"
              >
                {c.referenceImageUrl ? (
                  <img
                    src={c.referenceImageUrl}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-violet-200 flex items-center justify-center font-bold text-violet-700">
                    {c.name[0]}
                  </div>
                )}
                <span className="text-sm font-medium">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOCATIONS */}
      {locations.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-stone-600 mb-2">
            Locations
          </p>
          <div className="flex flex-wrap gap-3">
            {locations.map((l) => (
              <div
                key={l.id}
                className="flex items-center gap-2 bg-stone-50 rounded-xl p-2 pr-3"
              >
                {l.referenceImageUrl ? (
                  <img
                    src={l.referenceImageUrl}
                    className="w-10 h-10 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-amber-200 flex items-center justify-center font-bold text-amber-700">
                    {l.name[0]}
                  </div>
                )}
                <span className="text-sm font-medium">{l.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
