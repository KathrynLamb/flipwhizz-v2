"use client";

import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { 
  Loader2, 
  Upload, 
  Wand2, 
  RefreshCw, 
  Check, 
  Image as ImageIcon,
  Palette,
  ChevronDown,
  ChevronUp,
  Users,
  Pencil,
  ArrowLeft,
  Sparkles
} from "lucide-react";
import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";
import { SampleImageLocationCard } from "@/components/SampleImageLocationCard";
import { motion, AnimatePresence } from "framer-motion";

/* ===================== Types ===================== */

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

export default function InitialStyleDesignEditor({
  style,
  leftText,
  rightText,
  characters,
  locations,
}: {
  style: ClientStyleGuide;
  leftText: string;
  rightText: string;
  characters: Entity[];
  locations: Entity[];
}) {
  // --- STATE ---
  const [prompt, setPrompt] = useState(style.summary ?? "");
  const [styleRefUrl, setStyleRefUrl] = useState<string | null>(style.styleGuideImage);
  const [isEditing, setIsEditing] = useState<boolean>(false)
  
  // 'default' = Show AI Text, 'edit' = Textarea, 'upload' = File Dropzone
  const [mode, setMode] = useState<'default' | 'edit' | 'upload'>('default');

  const [showCast, setShowCast] = useState(false);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generatedSample, setGeneratedSample] = useState<string | null>(style.sampleIllustrationUrl);

  // Helper to handle characters (passed to API)
  const [localCharacters, setLocalCharacters] = useState<Entity[]>(characters);
  const [localLocations, setLocalLocations] = useState<Entity[]>(locations);

  /* -------------------------------------------
     1. Upload Logic
  ------------------------------------------- */
  async function handleUploadStyleRef(file: File) {
    setIsUploadingRef(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads/reference", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStyleRefUrl(data.url);
      await fetch("/api/style-guide/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: style.storyId, styleGuideImage: data.url }),
      });
    } catch (err) {
      alert("Failed to upload.");
    } finally {
      setIsUploadingRef(false);
    }
  }

  function updateEntity(id: string, updates: Partial<Entity>, type: 'char' | 'loc') {
    if (type === 'char') setLocalCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    else setLocalLocations(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }

  /* -------------------------------------------
     2. Generate Logic
  ------------------------------------------- */
/* -------------------------------------------
     3. Generate Sample (Extended Polling)
  ------------------------------------------- */
  async function handleGenerate() {
    setIsGenerating(true);
    setGenerationStatus("Waking up the studio...");
    setGeneratedSample(null);
    setIsEditing(false); // Switch to loading view

    try {
      // 1. Save prompt & update DB first
      await fetch("/api/style-guide/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: style.storyId, summary: prompt }),
      });

      // 2. Prepare Payload
      const references = [];
      if (styleRefUrl) {
        references.push({ url: styleRefUrl, type: "style", label: "Art Style" });
      }
      localCharacters.forEach(c => {
        references.push({ url: c.referenceImageUrl || null, type: "character", label: c.name, notes: c.description || "" });
      });

      // 3. Dispatch Job
      const res = await fetch("/api/style/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: style.storyId,
          description: prompt,
          leftText,
          rightText,
          references,
        }),
      });

      if (!res.ok) throw new Error("Failed to start generation");

      // 4. Poll (Extended Duration)
      let attempts = 0;
      const maxAttempts = 90; // 90 * 2s = 3 minutes max
      
      const poll = setInterval(async () => {
        attempts++;
        
        // Dynamic Status Updates
        if (attempts === 2) setGenerationStatus("Reading your story...");
        if (attempts === 10) setGenerationStatus("Analyzing character photos...");
        if (attempts === 25) setGenerationStatus("Sketching the scene layout...");
        if (attempts === 40) setGenerationStatus("Mixing paints and colors...");
        if (attempts === 60) setGenerationStatus("Adding final magical details...");

        try {
            const checkRes = await fetch(`/api/stories/${style.storyId}/style-poll`);
            if (checkRes.ok) {
                const data = await checkRes.json();
                if (data.sampleUrl) {
                    clearInterval(poll);
                    setGeneratedSample(data.sampleUrl);
                    setIsGenerating(false);
                }
            }
        } catch (e) { /* ignore network blips */ }

        if (attempts >= maxAttempts) {
            clearInterval(poll);
            setIsGenerating(false);
            setIsEditing(true); 
            alert("This is taking longer than usual. The image might still appear in a moment, try refreshing the page.");
        }
      }, 2000); // Check every 2 seconds

    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
      setIsEditing(true);
      alert("Something went wrong starting the process.");
    }
  }

  const handleApprovePayment = async (orderID: string) => {
    const res = await fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID, storyId: style.storyId }),
    });
    if (res.ok) window.location.href = `/stories/${style.storyId}/studio`;
  };

  /* ===================== RENDER ===================== */

  // 1. RESULT VIEW (Image Generated)
  if (generatedSample && !isGenerating) {
    return (
        <div className="max-w-4xl mx-auto pb-40">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                {/* Result Image */}
                <div className="relative bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-stone-100 group">
                    <img src={generatedSample} alt="Sample" className="w-full h-auto" />
                    <button 
                        onClick={() => setGeneratedSample(null)} 
                        className="absolute top-4 right-4 bg-white/90 text-stone-800 px-4 py-2 rounded-full text-sm font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Try Again
                    </button>
                </div>

                {/* Unlock */}
                <div className="bg-white rounded-3xl p-8 shadow-xl border border-indigo-50 text-center max-w-xl mx-auto">
                    <h3 className="text-3xl font-serif text-indigo-900 mb-2">Love this look?</h3>
                    <p className="text-stone-500 mb-8">Unlock the full studio to generate the rest of your book.</p>
                    <div className="max-w-xs mx-auto">
                        <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "", currency: "GBP" }}>
                            <PayPalButtons 
                                style={{ layout: "horizontal", color: "gold", shape: "pill", label: "pay" }}
                                createOrder={async () => {
                                    const res = await fetch("/api/paypal/order", {
                                        method: "POST",
                                        body: JSON.stringify({ storyId: style.storyId })
                                    });
                                    const data = await res.json();
                                    return data.orderID;
                                }}
                                onApprove={(data) => handleApprovePayment(data.orderID)}
                            />
                        </PayPalScriptProvider>
                    </div>
                </div>
            </motion.div>
        </div>
    );
  }

  // 2. LOADING VIEW
  if (isGenerating) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl mb-8 animate-pulse">
                <Sparkles className="w-10 h-10 text-indigo-500" />
            </div>
            <h2 className="text-3xl font-serif text-indigo-900 mb-4">Painting your story...</h2>
            <p className="text-stone-500 text-lg">{generationStatus}</p>
        </div>
    );
  }

  // 3. EDIT VIEW (Style Selection)
  return (
    <div className="max-w-3xl mx-auto pb-40">
        
        {/* HEADER */}
        <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-4">
                <Palette className="w-4 h-4" /> Visual Style
            </div>
            <h1 className="text-4xl font-serif text-stone-900 mb-4">How should this story look?</h1>
            <p className="text-stone-500">Choose the AI suggestion, tweak it, or upload your own reference.</p>
        </div>

        {/* STYLE CARD */}
        <div className="bg-white rounded-3xl shadow-xl border border-stone-200 overflow-hidden relative">
            
            {/* CARD CONTENT AREA */}
            <div className="p-8 min-h-[240px] flex flex-col justify-center bg-stone-50/50">
                {mode === 'default' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <p className="text-lg font-serif text-indigo-900 leading-relaxed text-center italic">
                            &ldquo;{prompt}&rdquo;
                        </p>
                    </motion.div>
                )}

                {mode === 'edit' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
                        <label className="text-xs font-bold text-stone-400 uppercase mb-2 block">Edit AI Suggestion</label>
                        <textarea 
                            value={prompt} 
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-40 bg-white border border-stone-200 rounded-xl p-4 text-stone-800 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none shadow-inner"
                            autoFocus
                        />
                    </motion.div>
                )}

                {mode === 'upload' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full">
                        <label className="text-xs font-bold text-stone-400 uppercase mb-2 block">Upload Reference</label>
                        <div className="relative group w-full h-48 bg-white rounded-xl border-2 border-dashed border-stone-200 hover:border-indigo-400 cursor-pointer overflow-hidden flex flex-col items-center justify-center text-center">
                            {styleRefUrl ? (
                                <img src={styleRefUrl} className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-stone-400">
                                    {isUploadingRef ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : <Upload className="w-8 h-8 mx-auto mb-2" />}
                                    <span className="text-sm">Click to upload image</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" 
                                onChange={(e) => e.target.files?.[0] && handleUploadStyleRef(e.target.files[0])} 
                            />
                        </div>
                    </motion.div>
                )}
            </div>

            {/* ACTION FOOTER */}
            <div className="bg-white border-t border-stone-100 p-6 flex flex-col gap-4 items-center">
                
                {/* PRIMARY ACTION */}
                <button 
                    onClick={handleGenerate}
                    className="w-full sm:w-auto min-w-[300px] bg-[#4635B1] hover:bg-[#3b2d96] text-white text-lg font-bold py-4 px-8 rounded-full shadow-lg shadow-indigo-200 transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
                >
                    <Wand2 className="w-5 h-5" />
                    {mode === 'default' ? "Generate with this Style" : 
                     mode === 'edit' ? "Generate with Custom Style" : 
                     "Generate from Image"}
                </button>

                {/* SECONDARY OPTIONS (The Switchers) */}
                <div className="flex items-center gap-6 text-sm font-medium pt-2">
                    {mode !== 'edit' && (
                        <button onClick={() => setMode('edit')} className="text-stone-400 hover:text-indigo-600 flex items-center gap-2 transition-colors">
                            <Pencil className="w-4 h-4" /> Edit Text
                        </button>
                    )}
                    
                    {mode !== 'upload' && (
                        <button onClick={() => setMode('upload')} className="text-stone-400 hover:text-indigo-600 flex items-center gap-2 transition-colors">
                            <ImageIcon className="w-4 h-4" /> Use Image
                        </button>
                    )}

                    {mode !== 'default' && (
                        <button onClick={() => setMode('default')} className="text-stone-400 hover:text-indigo-600 flex items-center gap-2 transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Reset
                        </button>
                    )}
                </div>
            </div>
        </div>

        {/* CAST TOGGLE (Subtle at bottom) */}
        <div className="mt-12 text-center">
            <button 
                onClick={() => setShowCast(!showCast)}
                className="inline-flex items-center gap-2 text-stone-400 hover:text-stone-600 text-xs font-bold uppercase tracking-widest transition-colors"
            >
                {showCast ? "Hide Cast" : "View Cast & Locations"}
                {showCast ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <AnimatePresence>
                {showCast && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-6 text-left">
                        <div className="grid md:grid-cols-2 gap-4">
                            {localCharacters.map(char => (
                                <SampleImageCharacterCard key={char.id} character={{...char, referenceImageUrl: char.referenceImageUrl ?? null, description: char.description ?? null}} onUpdated={(u) => updateEntity(char.id, u, 'char')} />
                            ))}
                            {localLocations.map(loc => (
                                <SampleImageLocationCard key={loc.id} location={{...loc, referenceImageUrl: loc.referenceImageUrl ?? null, description: loc.description ?? null}} onUpdated={(u) => updateEntity(loc.id, u, 'loc')} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>

    </div>
  );
}