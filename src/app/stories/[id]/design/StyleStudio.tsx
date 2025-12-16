"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import {
  Wand2,
  Upload,
  RefreshCcw,
  BookOpen,
  Palette,
  Users,
  Lock,
  Loader,
  X
} from "lucide-react";

import CharacterCardDesign from "@/app/stories/[id]/design/components/CharacterCardDesign";
import LocationCardDesign from "@/app/stories/[id]/design/components/LocationCardDesign";
import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";
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
  characters: any[];
  locations: any[];
};

export default function StyleStudio({ data }: { data: StudioData }) {
    const [localCharacters, setLocalCharacters] = useState<Entity[]>(
        data.characters ?? []
      );
      
  const [activeTab, setActiveTab] = useState<"style" | "entities">("style");

  const [stylePrompt, setStylePrompt] = useState(data.style.summary);
  const [generatedImage, setGeneratedImage] = useState<string | null>(
    data.style.sampleUrl
  );

  const [showStory, setShowStory] =useState<boolean>(false)

  const [styleReferenceImageUrl, setStyleReferenceImageUrl] = useState()
  const [uploading, setUploading] = useState<boolean>(false)
  const [styleReferenceUrl, setStyleReferenceUrl] = useState()

  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState("");

  function updateCharacter(id: string, updates: Partial<Entity>) {
    setLocalCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  const viewPrompt = () => {
    console.log("storyId", data.storyId)
    console.log("SYORY PROMPT", stylePrompt)
    // Change 'pages' to 'data.pages'
    console.log("PAges", data.pages) 
  }

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedImage(null);

    await fetch("/api/style-guide/save", {
      method: "POST",
      body: JSON.stringify({
        storyId: data.storyId,
        summary: stylePrompt,
      }),
    });

    const steps = [
      "Analyzing characters...",
      "Scouting locations...",
      "Mixing watercolor...",
      "Adding magic details...",
    ];

    let idx = 0;
    const interval = setInterval(() => {
      setLoadingPhase(steps[idx]);
      idx = (idx + 1) % steps.length;
    }, 1500);

    try {
      const res = await fetch("/api/style/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: data.storyId,
          prompt: stylePrompt,
        }),
      });

      const result = await res.json();

      if (result.image) {
        setGeneratedImage(
          result.image.startsWith("data:")
            ? result.image
            : `data:image/png;base64,${result.image}`
        );
      }
    } catch {
      alert("Magic fizzled out. Please try again.");
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
    }
  };

/* ----------------------------
   Upload reference image
----------------------------- */
async function uploadReference(file: File) {
  setUploading(true);

  try {
    const session = await (await fetch("/api/auth/session")).json();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Not logged in");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("userId", userId);

    const res = await fetch("/api/uploads/reference", {
      method: "POST",
      body: fd,
    });

    const resultData = await res.json();
    if (!res.ok) throw new Error(resultData.error);
    console.log("result", resultData)
    // 1. UPDATE UI STATE
    // Your UI uses 'styleReferenceUrl' in the render section, so we update that.
    setStyleReferenceUrl(resultData.url); 
    setStyleReferenceImageUrl(resultData.url); // Keeping this if you use it elsewhere

    // 2. PERSIST TO DB (Story/Style Guide)
    // We reuse the endpoint you use for saving prompts, or a specific PATCH endpoint for the story
    await fetch("/api/style-guide/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: data.storyId,
        styleGuideImage: resultData.url, // Saving as styleGuideImage as requested
      }),
    });

  } catch (error) {
    console.error("Upload failed", error);
    alert("Failed to upload reference image");
  } finally {
    setUploading(false);
  }
}
  const handleApprovePayment = async (orderID: string) => {
    const res = await fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID, storyId: data.storyId }),
    });

    if (res.ok) {
      window.location.href = `/stories/${data.storyId}/studio`;
    } else {
      alert("Payment capture failed.");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0b0b10] to-black">
      {/* ================= LEFT ================= */}
      {!showStory && (
        <button className="hover:text-white text-sm cursor-pointer text-slate-300" onClick={() => setShowStory(!showStory)}>
          Show Story Sample Pages
        </button>
      )}
      {showStory && (
      <div className="lg:w-1/3 p-6 lg:p-10 border-r border-white/5 overflow-y-auto">
        <div className="sticky top-0 bg-[#0b0b10]/80 backdrop-blur-md pb-4 mb-6 border-b border-white/5">
          <div className="flex w-full space-between">
              <button onClick={() => setShowStory(!showStory)}>
              <X className="text-white" />
              </button>
       
          <div className="text-xs font-bold tracking-widest text-amber-500 uppercase mb-2">
            The Story So Far
          </div>
          </div>
          <h1 className="font-serif text-3xl text-white">{data.title}</h1>
        </div>

        <div className="space-y-8">
          {data.pages.map((text, i) => (
            <div
              key={i}
              className="bg-white/5 border border-white/10 p-6 rounded-md"
            >
              <div className="text-xs text-white/40 italic mb-3">
                Page {i + 1}
              </div>
              <p className="font-serif text-lg text-white/90 whitespace-pre-line">
                {text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl flex gap-3">
          <BookOpen className="w-5 h-5 text-indigo-400 mt-1" />
          <p className="text-sm text-indigo-200">
            The AI reads these pages to match illustration style.
          </p>
        </div>
      </div>
      )}

      {/* ================= RIGHT ================= */}
      <div className="lg:w-2/3 flex flex-col h-full relative">
        {/* Header */}
        <header className="h-20 border-b border-white/5 flex items-center px-8 bg-black/20 gap-6">
          <button
            onClick={() => setActiveTab("style")}
            className={`text-sm font-medium flex items-center gap-2 ${
              activeTab === "style"
                ? "text-white"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Palette className="w-4 h-4" />
            Visual Style
          </button>

          <button
            onClick={() => setActiveTab("entities")}
            className={`text-sm font-medium flex items-center gap-2 ${
              activeTab === "entities"
                ? "text-white"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Cast & Locations
          </button>
        </header>

        {/* Scrollable */}
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 pb-40">
          <AnimatePresence mode="wait">
            {activeTab === "style" && (
              <motion.div
                key="style"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-2xl mx-auto space-y-8"
              >
                <div>
                  <label className="text-sm font-bold text-white/80 uppercase">
                    Art Direction
                  </label>
                  <textarea
                    value={stylePrompt}
                    onChange={(e) => setStylePrompt(e.target.value)}
                    className="w-full h-32 mt-2 bg-white/5 border border-white/10 rounded-xl p-4 text-white resize-none"
                  />
                </div>

                {/* <div>
                  <label className="text-sm font-bold text-white/80 uppercase">
                    Style Reference
                  </label>
                  <div className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center mt-2">
                    <Upload className="w-5 h-5 text-white/60 mb-2" />
                    <p className="text-sm text-white/60">
                      Drop an image to copy its vibe
                    </p>
                  </div>
                </div> */}

<div className="relative bg-black/10 ">
        {styleReferenceUrl ? (
          <img
            src={styleReferenceUrl}
            alt='/'
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          <label className="flex flex-col items-center justify-center h-full text-white/50 cursor-pointer hover:text-white transition">
            {uploading ? (
              <Loader className="animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
            <span className="text-xs mt-2">Upload photo</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) =>
                e.target.files && uploadReference(e.target.files[0])
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-3xl mx-auto"
              >
                <p className="text-white/60 mb-6 text-sm">
                  Characters and places from the opening pages.
                </p>

                <div className="grid md:grid-cols-2 gap-4">
                {localCharacters.map((c) => (
                    // <CharacterCardDesign key={char.id} char={char} />
                    <SampleImageCharacterCard
                    key={c.id}
                    character={{
                      ...c,
                      description: c.description ?? null,
                      referenceImageUrl: c.referenceImageUrl ?? null,
                    }}
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

        {/* ================= BOTTOM BAR ================= */}
        <div className="absolute bottom-0 w-full bg-[#0b0b10]/95 backdrop-blur-xl border-t border-white/10 p-6">
          {!generatedImage && !isGenerating && (
            <div className="flex justify-end">
              <button
                // onClick={handleGenerate}
                onClick={viewPrompt}
                className="flex items-center gap-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-8 py-4 rounded-full font-bold"
              >
                <Wand2 className="w-5 h-5" />
                Generate Sample Magic
              </button>
            </div>
          )}

          {isGenerating && (
            <div className="text-center text-amber-200 italic">
              {loadingPhase}
            </div>
          )}

          {generatedImage && (
            <div className="flex gap-8 items-center">
              <img
                src={generatedImage}
                alt="Generated Sample"
                className="w-1/2 rounded-xl"
              />

              <PayPalScriptProvider
                options={{
                  clientId:
                    process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
                  currency: "GBP",
                }}
              >
                <PayPalButtons
                  onApprove={(data) =>
                    handleApprovePayment(data.orderID)
                  }
                />
              </PayPalScriptProvider>

              <div className="flex items-center gap-2 text-xs text-white/40">
                <Lock className="w-3 h-3" />
                Secure payment via PayPal
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
