"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import {
  Wand2,
  Upload,
  BookOpen,
  Palette,
  Users,
  Lock,
  Loader,
  X,
} from "lucide-react";

import LocationCardDesign from "@/app/stories/[id]/design/components/LocationCardDesign";
import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";

/* -----------------------------
   TYPES
------------------------------ */

type Entity = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  referenceImageUrl?: string | null;
};

type StudioData = {
  storyId: string;
  title: string;
  pages: string[];
  style: {
    summary: string;
    negativePrompt: string;
    referenceImages: any[];
    sampleUrl: string | null;
  };
  characters: Entity[];
  locations: any[];
  presenceReady: boolean;
};

/* -----------------------------
   COMPONENT
------------------------------ */

export default function StyleStudio({ data }: { data: StudioData }) {
  const [localCharacters, setLocalCharacters] = useState<Entity[]>(
    data.characters ?? []
  );

  const [activeTab, setActiveTab] = useState<"style" | "entities">("style");
  const [stylePrompt, setStylePrompt] = useState(data.style.summary);
  const [generatedImage, setGeneratedImage] = useState<string | null>(
    data.style.sampleUrl
  );
  const [showStory, setShowStory] = useState(false);

  const [styleReferenceUrl, setStyleReferenceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");

  /* -----------------------------
     PRESENCE HINT
  ------------------------------ */

  const [showPresenceHint, setShowPresenceHint] = useState(
    Boolean(data.presenceReady)
  );

  useEffect(() => {
    if (!data.presenceReady) return;
    const t = setTimeout(() => setShowPresenceHint(false), 3000);
    return () => clearTimeout(t);
  }, [data.presenceReady]);

  /* -----------------------------
     HELPERS
  ------------------------------ */

  function updateCharacter(id: string, updates: Partial<Entity>) {
    setLocalCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  async function uploadReference(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/uploads/reference", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      setStyleReferenceUrl(data.url);

      await fetch("/api/style-guide/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: data.storyId,
          styleGuideImage: data.url,
        }),
      });
    } catch {
      alert("Failed to upload reference image");
    } finally {
      setUploading(false);
    }
  }

  /* -----------------------------
     RENDER
  ------------------------------ */

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0b0b10] to-black">
      {/* LEFT – STORY */}
      {!showStory && (
        <button
          className="text-sm text-slate-300 hover:text-white"
          onClick={() => setShowStory(true)}
        >
          Show Story Sample Pages
        </button>
      )}

      {showStory && (
        <div className="lg:w-1/3 p-6 border-r border-white/5 overflow-y-auto">
          <button onClick={() => setShowStory(false)}>
            <X className="text-white mb-4" />
          </button>

          <h1 className="font-serif text-3xl text-white mb-6">
            {data.title}
          </h1>

          {data.pages.map((text, i) => (
            <div
              key={i}
              className="bg-white/5 border border-white/10 p-6 rounded-md mb-4"
            >
              <div className="text-xs text-white/40 mb-2">
                Page {i + 1}
              </div>
              <p className="font-serif text-lg text-white whitespace-pre-line">
                {text}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* RIGHT – STUDIO */}
      <div className="lg:w-2/3 flex flex-col h-full">
        <header className="h-20 border-b border-white/5 flex items-center px-8 gap-6">
          <button
            onClick={() => setActiveTab("style")}
            className={activeTab === "style" ? "text-white" : "text-white/40"}
          >
            <Palette className="inline w-4 h-4 mr-2" />
            Visual Style
          </button>

          <button
            onClick={() => setActiveTab("entities")}
            className={activeTab === "entities" ? "text-white" : "text-white/40"}
          >
            <Users className="inline w-4 h-4 mr-2" />
            Cast & Locations
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-10">
          <AnimatePresence mode="wait">
            {activeTab === "style" && (
              <motion.div
                key="style"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                <textarea
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-4 text-white"
                />

                <div className="relative bg-black/10 h-48 rounded-xl flex items-center justify-center">
                  {styleReferenceUrl ? (
                    <img
                      src={styleReferenceUrl}
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <label className="cursor-pointer text-white/50 hover:text-white">
                      {uploading ? (
                        <Loader className="animate-spin" />
                      ) : (
                        <Upload />
                      )}
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) =>
                          e.target.files &&
                          uploadReference(e.target.files[0])
                        }
                      />
                    </label>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === "entities" && (
              <motion.div
                key="entities"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto"
              >
                {showPresenceHint && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="inline-flex mb-4 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 text-xs"
                  >
                    ✨ Cast & locations prepared from this spread
                  </motion.div>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  {localCharacters.map((c) => (
                    <SampleImageCharacterCard
                      key={c.id}
                      character={c}
                      onUpdated={(u) => updateCharacter(c.id, u)}
                    />
                  ))}

                  {data.locations.map((loc) => (
                    <LocationCardDesign key={loc.id} location={loc} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* BOTTOM */}
        <div className="border-t border-white/10 p-6">
          <button className="ml-auto flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 rounded-full text-white font-bold">
            <Wand2 />
            Generate Sample Magic
          </button>
        </div>
      </div>
    </div>
  );
}
