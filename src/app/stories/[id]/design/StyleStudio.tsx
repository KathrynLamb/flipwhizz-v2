// src/app/stories/[id]/design/DesignClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wand2,
  Upload,
  Sparkles,
  ChevronLeft,
  Palette,
  BookOpen,
  Check,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

/* -----------------------------
   TYPES
------------------------------ */

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

/* -----------------------------
   COMPONENT
------------------------------ */

export default function DesignPage({ data }: { data: StudioData }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"style" | "preview">("style");
  const [stylePrompt, setStylePrompt] = useState(data.style.summary || "");
  const [uploading, setUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadReference(file: File) {
    setUploading(true);
    setError(null);
    
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("storyId", data.storyId);

      const res = await fetch("/api/uploads/reference", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error("Upload failed");
      
      router.refresh();
    } catch (err) {
      setError("Failed to upload reference image");
    } finally {
      setUploading(false);
    }
  }

  async function generateStyleSample() {
    setIsGenerating(true);
    setError(null);
    
    try {
      const references = [
        ...data.characters.map(c => ({
          type: "character" as const,
          name: c.name,
          ...(c.portraitImageUrl || c.referenceImageUrl 
            ? { url: c.portraitImageUrl || c.referenceImageUrl }
            : { description: c.appearance || c.description || `A character named ${c.name}` }
          ),
        })),
        ...data.locations.map(l => ({
          type: "location" as const,
          name: l.name,
          ...(l.portraitImageUrl || l.referenceImageUrl
            ? { url: l.portraitImageUrl || l.referenceImageUrl }
            : { description: l.description || `A location called ${l.name}` }
          ),
        })),
      ];

      const leftText = data.pages[0] || "";
      const rightText = data.pages[1] || "";

      const res = await fetch("/api/style/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: data.storyId,
          description: stylePrompt,
          leftText,
          rightText,
          references,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Generation failed");
      }

      // Poll for results
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setError("Generation timed out. Please refresh the page.");
          return;
        }
        
        // Check if sample is ready
        const checkRes = await fetch(`/api/stories/${data.storyId}`);
        if (checkRes.ok) {
          const storyData = await checkRes.json();
          if (storyData.style?.sampleUrl) {
            clearInterval(pollInterval);
            setIsGenerating(false);
            router.refresh();
          }
        }
      }, 1000);
      
    } catch (err: any) {
      setError(err.message || "Failed to generate style sample");
      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Back Button */}
            <Link 
              href={`/stories/${data.storyId}/locations`}
              className="flex items-center gap-2 text-gray-700 hover:text-purple-600 transition-colors font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back to Locations</span>
            </Link>

            {/* Tabs */}
            <div className="flex gap-2 bg-purple-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("style")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "style"
                    ? "bg-white text-purple-700 shadow-sm"
                    : "text-purple-600 hover:text-purple-700"
                }`}
              >
                <Palette className="w-4 h-4 inline mr-2" />
                Style
              </button>
              <button
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === "preview"
                    ? "bg-white text-purple-700 shadow-sm"
                    : "text-purple-600 hover:text-purple-700"
                }`}
              >
                <BookOpen className="w-4 h-4 inline mr-2" />
                Preview
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => router.refresh()}
              className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-purple-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section - Compact */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm border border-purple-200 mb-3">
            <Sparkles className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-semibold text-purple-700">Design Your Style</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-black mb-2 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent leading-tight">
            Visual Style Guide
          </h1>
          
          <p className="text-gray-600 max-w-2xl mx-auto">
            Define the look and feel of your story's illustrations ✨
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 text-sm">
              {error}
            </div>
          </div>
        )}

        {/* Content */}
        {activeTab === "style" ? (
          <div className="space-y-6">
            
            {/* Generated Sample - Show First if exists */}
            {data.style.sampleUrl && (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    <h2 className="text-xl font-black text-gray-900">
                      Generated Style Sample
                    </h2>
                  </div>
                  <button
                    onClick={generateStyleSample}
                    disabled={isGenerating}
                    className="text-sm text-purple-600 hover:text-purple-700 font-semibold"
                  >
                    Regenerate
                  </button>
                </div>
                <img
                  src={data.style.sampleUrl}
                  alt="Generated style sample"
                  className="w-full"
                />
              </div>
            )}

            {/* Style Description */}
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <h2 className="text-xl font-black text-gray-900 mb-3">
                Style Description
              </h2>
              <textarea
                value={stylePrompt}
                onChange={(e) => setStylePrompt(e.target.value)}
                rows={4}
                className="w-full rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none px-4 py-3 text-gray-900 resize-none text-sm"
                placeholder="e.g., Whimsical watercolor style with soft pastel colors, dreamy atmosphere, gentle brush strokes..."
              />
            </div>

            {/* Reference Image Upload - Compact */}
            <div className="bg-white rounded-3xl shadow-xl p-6">
              <h2 className="text-xl font-black text-gray-900 mb-3">
                Reference Image
                <span className="text-sm text-gray-500 font-normal ml-2">(Optional)</span>
              </h2>

              <div className="relative h-48 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl overflow-hidden border-2 border-dashed border-purple-300 hover:border-purple-400 transition-colors">
                {data.style.referenceImages?.[0] ? (
                  <img
                    src={data.style.referenceImages[0]}
                    alt="Style reference"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-purple-50/50 transition-colors">
                    {uploading ? (
                      <>
                        <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                        <span className="text-sm font-semibold text-purple-700">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-purple-400 mb-2" />
                        <span className="text-sm font-semibold text-purple-700">Click to upload</span>
                        <span className="text-xs text-purple-600 mt-1">PNG, JPG up to 10MB</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files && uploadReference(e.target.files[0])}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <div className="text-center pt-4">
              <button
                onClick={generateStyleSample}
                disabled={isGenerating || !stylePrompt.trim()}
                className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white rounded-2xl font-black text-lg hover:scale-105 transition-transform shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Magic...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    {data.style.sampleUrl ? "Regenerate Style Sample" : "Generate Style Sample"}
                  </>
                )}
              </button>
              
              {isGenerating && (
                <p className="text-sm text-purple-600 mt-3">
                  This may take 30-60 seconds...
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <h2 className="text-2xl font-black text-gray-900 mb-6">
              {data.title}
            </h2>

            <div className="space-y-4">
              {data.pages.slice(0, 4).map((text, i) => (
                <div
                  key={i}
                  className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100"
                >
                  <div className="text-xs font-bold text-purple-600 mb-2">
                    Page {i + 1}
                  </div>
                  <p className="text-base text-gray-800 leading-relaxed">
                    {text}
                  </p>
                </div>
              ))}
              
              {data.pages.length > 4 && (
                <p className="text-center text-sm text-gray-500 pt-2">
                  + {data.pages.length - 4} more pages
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}