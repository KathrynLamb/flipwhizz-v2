"use client";

import { useState, useEffect } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { Loader2, Upload, Wand2, RefreshCw, Check, ImagePlus } from "lucide-react";
import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";
import { SampleImageLocationCard } from "@/components/SampleImageLocationCard";

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
  // Local State
  const [prompt, setPrompt] = useState(style.summary ?? "");
  const [styleRefUrl, setStyleRefUrl] = useState<string | null>(style.styleGuideImage);
  const [localCharacters, setLocalCharacters] = useState<Entity[]>(characters);
  const [localLocations, setLocalLocations] = useState<Entity[]>(locations);
  
  // UI State
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSample, setGeneratedSample] = useState<string | null>(style.sampleIllustrationUrl);

  /* -------------------------------------------
     1. Upload Style Reference
  ------------------------------------------- */
  async function handleUploadStyleRef(file: File) {
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userId", "anonymous"); // or generic folder

      const res = await fetch("/api/uploads/reference", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Update State
      setStyleRefUrl(data.url);

      // Persist immediately
      await fetch("/api/style-guide/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: style.storyId,
          styleGuideImage: data.url,
        }),
      });

    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload style reference.");
    } finally {
      setIsUploading(false);
    }
  }

  /* -------------------------------------------
     2. Update Character/Location
  ------------------------------------------- */
  function updateEntity(id: string, updates: Partial<Entity>, type: 'char' | 'loc') {
    if (type === 'char') {
      setLocalCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } else {
      setLocalLocations(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }
  }

  /* -------------------------------------------
     3. Generate Sample (FIXED FORMATTING)
  ------------------------------------------- */
 /* -------------------------------------------
     3. Generate Sample (Polling Implementation)
  ------------------------------------------- */
  async function handleGenerate() {
    setIsGenerating(true);
    setGeneratedSample(null);

    // Save prompt first
    await fetch("/api/style-guide/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storyId: style.storyId, summary: prompt }),
    });

    try {
      const references = [];
      // ... (your existing code to build references array) ...
      if (styleRefUrl) references.push({ url: styleRefUrl, type: "style", label: "Style" });
      localCharacters.forEach(c => c.referenceImageUrl && references.push({ url: c.referenceImageUrl, type: "character", label: c.name, notes: c.description }));

      // 1. Kick off the job
      await fetch("/api/style/generate", {
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

      // 2. Poll for the result (Check every 2s for 60s)
      let attempts = 0;
      while (attempts < 30) {
        // Wait 2 seconds
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Fetch current style guide state
        // You might need to create a simple GET endpoint or reuse the design page fetch logic
        // For now, assuming you have an endpoint or re-fetching the main story endpoint:
        const checkRes = await fetch(`/api/stories/${style.storyId}/style-poll`); 
        // ^ You need to create this simple GET endpoint!
        
        if (checkRes.ok) {
           const data = await checkRes.json();
           if (data.sampleUrl) {
              setGeneratedSample(data.sampleUrl);
              break;
           }
        }
        attempts++;
      }
      
    } catch (e: any) {
      console.error(e);
      alert("Something went wrong triggering the magic.");
    } finally {
      setIsGenerating(false);
    }
  }
  /* -------------------------------------------
     4. Payment Handler
  ------------------------------------------- */
  const handleApprovePayment = async (orderID: string) => {
    const res = await fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID, storyId: style.storyId }),
    });

    if (res.ok) {
      window.location.href = `/stories/${style.storyId}/studio`;
    } else {
      alert("Payment capture failed.");
    }
  };

  /* ===================== RENDER ===================== */

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* LEFT COLUMN: Controls */}
      <div className="lg:col-span-5 space-y-8">
        
        {/* Style Description */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4 text-amber-500 font-bold uppercase text-xs tracking-wider">
            <Wand2 className="w-4 h-4" /> Art Direction
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-32 bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder-white/20 focus:outline-none focus:border-amber-500/50 transition-colors resize-none"
            placeholder="Describe the art style..."
          />
        </div>

        {/* Style Reference Image */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4 text-amber-500 font-bold uppercase text-xs tracking-wider">
            <ImagePlus className="w-4 h-4" /> Style Reference
          </div>
          
          <div className="relative group w-full h-48 bg-black/40 border-2 border-dashed border-white/10 rounded-xl overflow-hidden flex flex-col items-center justify-center hover:border-amber-500/30 transition-colors">
            {styleRefUrl ? (
              <>
                <img src={styleRefUrl} alt="Style Ref" className="w-full h-full object-cover opacity-80" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60">
                  <span className="text-xs font-bold px-3 py-1 rounded-full border border-white/20">Change Image</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center text-white/30">
                {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6 mb-2" />}
                <span className="text-xs">Upload Reference</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => e.target.files?.[0] && handleUploadStyleRef(e.target.files[0])}
            />
          </div>
        </div>

        {/* Characters & Locations List */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white/90 uppercase tracking-widest">Cast & Locations</h3>
          <div className="grid gap-4">
            {localCharacters.map(char => (
         
              <SampleImageCharacterCard 
                key={char.id} 
                character={{...char, referenceImageUrl: char.referenceImageUrl ?? null, description: char.description ?? null}}
                onUpdated={(u) => updateEntity(char.id, u, 'char')}
              />
            ))}
             {localLocations.map(loc => (
              
              <SampleImageLocationCard 
                key={loc.id} 
                location={{
                  ...loc, 
                  referenceImageUrl: loc.referenceImageUrl ?? null, 
                  description: loc.description ?? null
                }}                onUpdated={(u) => updateEntity(loc.id, u, 'loc')} 
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Preview & Action */}
      <div className="lg:col-span-7 flex flex-col">
        
        {/* Story Text Context */}
        <div className="grid grid-cols-2 gap-6 mb-8 opacity-60 hover:opacity-100 transition-opacity">
          <div className="bg-white/5 p-4 rounded-lg text-sm font-serif leading-relaxed border border-white/5">
            <span className="text-xs text-amber-500/50 block mb-2 uppercase">Page 1</span>
            {leftText}
          </div>
          <div className="bg-white/5 p-4 rounded-lg text-sm font-serif leading-relaxed border border-white/5">
            <span className="text-xs text-amber-500/50 block mb-2 uppercase">Page 2</span>
            {rightText}
          </div>
        </div>

        {/* Generate Button / Result Area */}
        <div className="flex-1 bg-black/20 border border-white/10 rounded-3xl p-2 relative flex flex-col items-center justify-center min-h-[500px]">
          {!generatedSample ? (
            <div className="text-center p-8">
               <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-400">
                {isGenerating ? <Loader2 className="w-8 h-8 animate-spin" /> : <Wand2 className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-medium text-white mb-2">
                {isGenerating ? "Painting your story..." : "Ready to Visualize?"}
              </h3>
              
              {!isGenerating && (
                <button
                  onClick={handleGenerate}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-bold py-4 px-10 rounded-full shadow-lg shadow-orange-900/20 mt-4 transition-all transform hover:scale-105"
                >
                  Generate Sample Spread
                </button>
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center animate-in fade-in duration-700">
              <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl mb-6 group">
                <img src={generatedSample} alt="Generated Sample" className="w-full h-auto" />
                <button 
                  onClick={handleGenerate} 
                  className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="w-full max-w-md bg-[#1a1b26] p-6 rounded-xl border border-white/10 text-center">
                <p className="text-sm text-white/50 mb-4">Unlock the full studio to generate the rest of the book.</p>
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
          )}
        </div>
      </div>
    </div>
  );
}