"use client";

import { useEffect, useState } from "react";
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
  Sparkles,
  Rocket, 
  ArrowRight,
  Settings2
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
  storyStatus,
  orderId,
  paymentStatus
}: {
  style: ClientStyleGuide;
  leftText: string;
  rightText: string;
  characters: Entity[];
  locations: Entity[];
  storyStatus: string | null;
  orderId: string | null;
  paymentStatus: string | null;

}) {
  // --- STATE ---
  const [prompt, setPrompt] = useState(style.summary ?? "");
  const [styleRefUrl, setStyleRefUrl] = useState<string | null>(style.styleGuideImage);
  
  // 'default' = Show AI Text, 'edit' = Textarea, 'upload' = File Dropzone
  const [mode, setMode] = useState<'default' | 'edit' | 'upload'>('default');

  const [showCast, setShowCast] = useState(false);
  const [isUploadingRef, setIsUploadingRef] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  
  // Initialize sample from props, but allow local updates
  const [generatedSample, setGeneratedSample] = useState<string | null>(style.sampleIllustrationUrl);

  // Helper to handle characters (passed to API)
  const [localCharacters, setLocalCharacters] = useState<Entity[]>(characters);
  const [localLocations, setLocalLocations] = useState<Entity[]>(locations);

  // Payment Flow
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isStartingJob, setIsStartingJob] = useState(false);

console.log("payment success", paymentStatus, paymentSuccess, orderId)

    useEffect(() => {
      if (storyStatus === 'paid' && paymentStatus === 'paid' && orderId !== null) {
        console.log("story status", storyStatus)
        console.log("payment status", paymentStatus)
        console.log("order id ", orderId)
         // Redirect straight to studio if they are past the payment/choice phase
         setPaymentSuccess(true)
        //  window.location.href = `/stories/${style.storyId}/studio?mode=live`;
      }

  }, [storyStatus, paymentStatus, orderId]);


  /* -------------------------------------------
     1. Upload Logic
  ------------------------------------------- */
  async function handleUploadStyleRef(file: File) {
    setIsUploadingRef(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Optional: Add userId if available contextually
      const res = await fetch("/api/uploads/reference", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStyleRefUrl(data.url);
      
      // Save immediately so it persists even if they don't generate yet
      await fetch("/api/style-guide/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: style.storyId, styleGuideImage: data.url }),
      });
    } catch (err) {
      alert("Failed to upload reference image.");
    } finally {
      setIsUploadingRef(false);
    }
  }

  function updateEntity(id: string, updates: Partial<Entity>, type: 'char' | 'loc') {
    if (type === 'char') setLocalCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    else setLocalLocations(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }

  /* -------------------------------------------
     2. Generate Logic (Extended Polling)
  ------------------------------------------- */
  async function handleGenerate() {
    setIsGenerating(true);
    setGenerationStatus("Waking up the studio...");
    setGeneratedSample(null);

    try {
      // 1. Save prompt & update DB first
      await fetch("/api/style-guide/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: style.storyId, summary: prompt }),
      });

      // 2. Prepare Payload
      const references = [];
      
      // Logic: If user uploaded a ref, send it.
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

      // 4. Poll (Extended Duration: 3 mins)
      let attempts = 0;
      const maxAttempts = 90; // 90 * 2s = 180s
      
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
            alert("This is taking longer than usual. The image might still appear in a moment, try refreshing the page.");
        }
      }, 2000); 

    } catch (e: any) {
      console.error(e);
      setIsGenerating(false);
      alert("Something went wrong starting the process.");
    }
  }

  /* -------------------------------------------
     3. Payment Logic
  ------------------------------------------- */
  const handleApprovePayment = async (orderID: string) => {
    try {
        const res = await fetch("/api/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderID, storyId: style.storyId }),
        });

        if (res.ok) {
            setPaymentSuccess(true);
        } else {
            alert("Payment capture failed.");
        }
    } catch (e) {
        console.error(e);
    }
  };

  async function handleOptionGenerateNow() {
    setIsStartingJob(true);
    await fetch(`/api/stories/${style.storyId}/start-generation`, { method: "POST" });
    window.location.href = `/stories/${style.storyId}/studio?mode=live`;
  }

  function handleOptionEditFirst() {
    window.location.href = `/stories/${style.storyId}/studio?mode=edit`;
  }

  /* ===================== RENDER ===================== */

  // --- VIEW 1: PAYMENT SUCCESS (The Choice) ---
  if (paymentSuccess) {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center text-center pb-20"
        >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-100/50">
                <Check className="w-10 h-10 text-green-600" />
            </div>
            
            <h1 className="text-4xl font-serif text-stone-900 mb-4">You&apos;re officially an author!</h1>
            <p className="text-stone-500 mb-12 text-lg max-w-xl mx-auto">
                Your story slot is secured. How would you like to proceed with the illustration process?
            </p>

            <div className="grid md:grid-cols-2 gap-6 w-full max-w-2xl">
                {/* OPTION 1: FAST */}
                <button 
                    onClick={handleOptionGenerateNow}
                    disabled={isStartingJob}
                    className="group relative bg-white p-8 rounded-[2rem] border-2 border-indigo-100 hover:border-[#4635B1] shadow-xl hover:shadow-2xl transition-all text-left flex flex-col h-full"
                >
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#4635B1] transition-colors">
                        <Rocket className="w-6 h-6 text-[#4635B1] group-hover:text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-stone-900 mb-2">Generate Full Book</h3>
                    <p className="text-stone-500 text-sm mb-6 flex-1">
                        I love the sample! Start generating illustrations for every page right now.
                    </p>
                    <div className="flex items-center gap-2 text-[#4635B1] font-bold text-sm uppercase tracking-widest group-hover:gap-4 transition-all">
                        {isStartingJob ? "Starting..." : "Start Magic"} <ArrowRight className="w-4 h-4" />
                    </div>
                </button>

                {/* OPTION 2: SLOW */}
                <button 
                    onClick={handleOptionEditFirst}
                    className="group relative bg-white p-8 rounded-[2rem] border-2 border-stone-100 hover:border-stone-400 shadow-xl hover:shadow-2xl transition-all text-left flex flex-col h-full"
                >
                    <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-stone-800 transition-colors">
                        <Settings2 className="w-6 h-6 text-stone-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-stone-900 mb-2">Enter Studio Mode</h3>
                    <p className="text-stone-500 text-sm mb-6 flex-1">
                        I want to tweak the text, add more character details, or adjust locations before generating.
                    </p>
                    <div className="flex items-center gap-2 text-stone-600 font-bold text-sm uppercase tracking-widest group-hover:gap-4 transition-all">
                        Go to Studio <ArrowRight className="w-4 h-4" />
                    </div>
                </button>
            </div>
        </motion.div>
    );
  }

  // --- VIEW 2: LOADING ---
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

  // --- VIEW 3: RESULT + PAYPAL ---
  if (generatedSample  && !paymentSuccess) {
    return (
        <div className="max-w-4xl mx-auto pb-40">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-8">
                {/* Result Image */}
                <div className="relative bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-stone-100 group">
                    <img src={generatedSample} alt="Sample" className="w-full h-auto" />
                    <button 
                        onClick={() => setGeneratedSample(null)} 
                        className="absolute top-4 right-4 bg-white/90 text-stone-800 px-4 py-2 rounded-full text-sm font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 hover:scale-105"
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
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ 
                                            storyId: style.storyId,
                                            price: "29.99", // Ensure this matches your expected format
                                            product: "Full Book Generation" 
                                        })
                                    });
                                    
                                    if (!res.ok) {
                                        const err = await res.json();
                                        throw new Error(err.error || "Order failed");
                                    }
                                    
                                    const data = await res.json();
                                    return data.orderID;
                                }}
                                onApprove={(data) => handleApprovePayment(data.orderID)}
                            />
                        </PayPalScriptProvider>
                    </div>
                    <p className="text-[10px] text-stone-400 mt-4 uppercase tracking-widest font-bold">100% Satisfaction Guarantee</p>
                </div>
            </motion.div>
        </div>
    );
  }

  // --- VIEW 4: EDITOR (Default) ---
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
            
            {/* CONTENT */}
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

                {/* SECONDARY OPTIONS */}
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

        {/* CAST TOGGLE */}
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