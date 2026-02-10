// src/app/stories/[id]/design/DesignClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Wand2,
  Upload,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Users,
  MapPin,
  BookOpen,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";

/* -----------------------------
   TYPES
------------------------------ */

type Entity = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  referenceImageUrl?: string | null;
  portraitImageUrl?: string | null;
};

type StudioData = {
  storyId: string;
  title: string;
  pages: string[];
  style: {
    summary: string;
    negativePrompt: string;
    referenceImages: any[];
    sampleIllustrationUrl: string | null;
  };
  characters: Entity[];
  locations: Entity[];
};

/* -----------------------------
   COMPONENT
------------------------------ */

// To:
export default function DesignClient({ data }: { data: StudioData }) {
  const router = useRouter();
  
  // State
  const [stylePrompt, setStylePrompt] = useState(data.style.summary || "");
  const [uploading, setUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Show/hide configuration panel
  const [showConfig, setShowConfig] = useState(!data.style.sampleIllustrationUrl);

  // Feedback reference upload
  const [feedbackReferenceUrl, setFeedbackReferenceUrl] = useState<string | null>(null);
  const [uploadingFeedbackRef, setUploadingFeedbackRef] = useState(false);
  
  // Spread selection
  const [selectedSpreadIndex, setSelectedSpreadIndex] = useState(0);
  const spreads = [];
  for (let i = 0; i < data.pages.length; i += 2) {
    spreads.push({
      index: i,
      leftPage: i,
      rightPage: i + 1,
      leftText: data.pages[i] || "",
      rightText: data.pages[i + 1] || "",
    });
  }
  const currentSpread = spreads[selectedSpreadIndex];
  
  // Feedback
  const [feedbackType, setFeedbackType] = useState<"approve" | "revise" | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // Get entities that would appear in selected spread
  const getEntitiesForSpread = () => {
    const spreadText = `${currentSpread.leftText} ${currentSpread.rightText}`.toLowerCase();
    
    const relevantCharacters = data.characters.filter(c => 
      spreadText.includes(c.name.toLowerCase())
    );
    
    const relevantLocations = data.locations.filter(l => 
      spreadText.includes(l.name.toLowerCase())
    );
    
    return { characters: relevantCharacters, locations: relevantLocations };
  };

  const { characters: spreadCharacters, locations: spreadLocations } = getEntitiesForSpread();

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
      
      const result = await res.json();
      
      // ✅ SAVE TO DATABASE - This was missing!
      await fetch(`/api/stories/${data.storyId}/style-guide`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleGuideImage: result.url,
        }),
      });
      
      router.refresh();
    } catch (err) {
      setError("Failed to upload reference image");
    } finally {
      setUploading(false);
    }
  }

  async function generateStyleSample() {
    console.log("style prompt", stylePrompt)
    setIsGenerating(true);
    setError(null);
    
    try {
      const references = [
        ...spreadCharacters.map(c => ({
          type: "character" as const,
          name: c.name,
          ...(c.portraitImageUrl || c.referenceImageUrl 
            ? { url: c.portraitImageUrl || c.referenceImageUrl }
            : { description: c.appearance || c.description || `A character named ${c.name}` }
          ),
        })),
        ...spreadLocations.map(l => ({
          type: "location" as const,
          name: l.name,
          ...(l.portraitImageUrl || l.referenceImageUrl
            ? { url: l.portraitImageUrl || l.referenceImageUrl }
            : { description: l.description || `A location called ${l.name}` }
          ),
        })),
      ];

      const res = await fetch("/api/style/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId: data.storyId,
          description: stylePrompt,
          leftText: currentSpread.leftText,
          rightText: currentSpread.rightText,
          references,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Generation failed");
      }

      // Poll for results
      let attempts = 0;
      const maxAttempts = 60;
      
      const pollInterval = setInterval(async () => {
        attempts++;
        
        if (attempts > maxAttempts) {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setError("Generation timed out. Please refresh the page.");
          return;
        }
        
        router.refresh();
        
        if (data.style.sampleIllustrationUrl && attempts > 5) {
          clearInterval(pollInterval);
          setIsGenerating(false);
          setShowConfig(false); // Hide config after successful generation
        }
      }, 2000);
      
    } catch (err: any) {
      setError(err.message || "Failed to generate style sample");
      setIsGenerating(false);
    }
  }

  async function submitFeedback() {
    setSubmittingFeedback(true);
    
    try {
      if (feedbackType === "approve") {
        // Save approval
        await fetch("/api/style-guide/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId: data.storyId,
            approved: true,
          }),
        });
        
        router.push(`/stories/${data.storyId}/studio`);
        
      } else {
        // Process feedback and update style
        const res = await fetch("/api/style-guide/process-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyId: data.storyId,
            feedback: feedbackText,
            referenceImageUrl: feedbackReferenceUrl,
          }),
        });
        
        if (!res.ok) throw new Error("Failed to process feedback");
        
        const result = await res.json();
        
        // Update the style prompt with the analyzed/updated version
        if (result.updatedStyleDescription) {
          setStylePrompt(result.updatedStyleDescription);
        }
        
        // Show config panel for review and regeneration
        setShowConfig(true);
        setFeedbackType(null);
        setFeedbackText("");
        setFeedbackReferenceUrl(null);
        
        // Scroll to top so user sees updated style
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError("Failed to submit feedback");
    } finally {
      setSubmittingFeedback(false);
    }
  }

  const hasSample = Boolean(data.style.sampleIllustrationUrl);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            <Link 
              href={`/stories/${data.storyId}/locations`}
              className="flex items-center gap-2 text-gray-700 hover:text-purple-600 transition-colors font-medium"
            >
              <ChevronLeft className="w-5 h-5" />
              <span>Back to Locations</span>
            </Link>

            <h1 className="text-lg font-black bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
              Style Design
            </h1>

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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-red-700 text-sm">
              {error}
            </div>
          </div>
        )}

        <div className={`grid gap-8 ${showConfig && hasSample ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
          
          {/* LEFT COLUMN - Configuration (show if no sample OR if user wants to edit) */}
          {(!hasSample || showConfig) && (
            <div className="space-y-6">
              
              {/* Close button when editing */}
              {hasSample && showConfig && (
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowConfig(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Close
                  </button>
                </div>
              )}
              
              {/* Style Description */}
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Style Description
                </h2>
                <textarea
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none px-4 py-3 text-gray-900 resize-none text-sm"
                  placeholder="e.g., Whimsical watercolor style with soft pastel colors, dreamy atmosphere, gentle brush strokes..."
                />
              </div>

              {/* Reference Image Upload */}
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-500" />
                  Reference Image
                  <span className="text-sm text-gray-500 font-normal">(Optional)</span>
                </h2>

                <div className="relative h-48 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl overflow-hidden border-2 border-dashed border-purple-300 hover:border-purple-400 transition-colors">
                  {data.style.referenceImages?.[0] ? (
                    <div className="relative w-full h-full">
                      <img
                        src={data.style.referenceImages[0]}
                        alt="Style reference"
                        className="w-full h-full object-cover"
                      />
                    </div>
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

              {/* Spread Selector */}
              <div className="bg-white rounded-3xl shadow-xl p-6">
                <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-500" />
                  Select Spread to Sample
                </h2>
                
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setSelectedSpreadIndex(Math.max(0, selectedSpreadIndex - 1))}
                    disabled={selectedSpreadIndex === 0}
                    className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  
                  <div className="flex-1 text-center">
                    <p className="text-sm font-semibold text-gray-900">
                      Pages {currentSpread.leftPage + 1}-{currentSpread.rightPage + 1}
                    </p>
                    <p className="text-xs text-gray-500">
                      Spread {selectedSpreadIndex + 1} of {spreads.length}
                    </p>
                  </div>
                  
                  <button
                    onClick={() => setSelectedSpreadIndex(Math.min(spreads.length - 1, selectedSpreadIndex + 1))}
                    disabled={selectedSpreadIndex === spreads.length - 1}
                    className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Preview of selected spread */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                    <p className="text-xs font-bold text-purple-600 mb-1">Left Page</p>
                    <p className="text-xs text-gray-700 line-clamp-3">{currentSpread.leftText}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-pink-50 border border-pink-100">
                    <p className="text-xs font-bold text-pink-600 mb-1">Right Page</p>
                    <p className="text-xs text-gray-700 line-clamp-3">{currentSpread.rightText}</p>
                  </div>
                </div>

                {/* Entities in this spread */}
                <div className="space-y-3">
                  {spreadCharacters.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Characters in this spread ({spreadCharacters.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {spreadCharacters.map(c => (
                          <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700">
                            {c.portraitImageUrl ? (
                              <img src={c.portraitImageUrl} className="w-4 h-4 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-purple-400 flex items-center justify-center text-white text-[8px] font-bold">
                                {c.name.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs font-semibold">{c.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {spreadLocations.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Locations in this spread ({spreadLocations.length})
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {spreadLocations.map(l => (
                          <div key={l.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-700">
                            {l.portraitImageUrl ? (
                              <img src={l.portraitImageUrl} className="w-4 h-4 rounded object-cover" alt="" />
                            ) : (
                              <div className="w-4 h-4 rounded bg-orange-400 flex items-center justify-center text-white text-[8px] font-bold">
                                {l.name.charAt(0)}
                              </div>
                            )}
                            <span className="text-xs font-semibold">{l.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {spreadCharacters.length === 0 && spreadLocations.length === 0 && (
                    <p className="text-xs text-gray-500 italic">No characters or locations detected in this spread</p>
                  )}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={generateStyleSample}
                disabled={isGenerating || !stylePrompt.trim()}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white rounded-2xl font-black text-lg hover:scale-[1.02] transition-transform shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating Magic...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-5 h-5" />
                    {hasSample ? "Regenerate Sample" : "Generate Style Sample"}
                  </>
                )}
              </button>
              
              {isGenerating && (
                <p className="text-sm text-center text-purple-600">
                  This may take 30-60 seconds...
                </p>
              )}
            </div>
          )}

          {/* RIGHT COLUMN - Generated Sample & Feedback */}
          <div className={`space-y-6 ${!showConfig && hasSample ? 'lg:col-span-1 max-w-4xl mx-auto' : ''}`}>
            
            {hasSample && data.style.sampleIllustrationUrl ? (
              <>
                {/* Generated Sample */}
                <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
                      Generated Style Sample
                    </h2>
                  </div>
                  <img
                    src={data.style.sampleIllustrationUrl}
                    alt="Generated style sample"
                    className="w-full"
                  />
                </div>

                {/* Feedback Section */}
                {!feedbackType && (
                  <div className="bg-white rounded-3xl shadow-xl p-6">
                    <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-purple-500" />
                      What do you think?
                    </h2>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <button
                        onClick={() => setFeedbackType("approve")}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-all"
                      >
                        <ThumbsUp className="w-8 h-8 text-green-600" />
                        <span className="font-bold text-green-900">Love it!</span>
                        <span className="text-xs text-green-700 text-center">This style is perfect</span>
                      </button>
                      
                      <button
                        onClick={() => setFeedbackType("revise")}
                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 hover:border-orange-300 transition-all"
                      >
                        <ThumbsDown className="w-8 h-8 text-orange-600" />
                        <span className="font-bold text-orange-900">Need changes</span>
                        <span className="text-xs text-orange-700 text-center">Let's refine it</span>
                      </button>
                    </div>

                    {/* Edit Style Button */}
                    <button
                      onClick={() => setShowConfig(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Edit Style Settings
                    </button>
                  </div>
                )}

                {/* Feedback Form */}
                {feedbackType && (
                  <div className="bg-white rounded-3xl shadow-xl p-6">
                    <h2 className="text-xl font-black text-gray-900 mb-4">
                      {feedbackType === "approve" ? "Confirm & Continue" : "What needs to change?"}
                    </h2>
                    
                    {feedbackType === "revise" && (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            Describe the changes you'd like
                          </label>
                          <textarea
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            rows={4}
                            className="w-full rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none px-4 py-3 text-gray-900 resize-none text-sm"
                            placeholder="e.g., Make the colors more vibrant, add more detail to the characters, softer lighting..."
                          />
                        </div>

                        {/* Reference Image Upload for Feedback */}
                        <div className="mb-4">
                          <label className="block text-sm font-bold text-gray-700 mb-2">
                            Have a reference image? (Optional)
                          </label>
                          <p className="text-xs text-gray-600 mb-3">
                            Upload an example of the style you're looking for and we'll analyze it to update your style guide
                          </p>
                          
                          <div className="relative h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl overflow-hidden border-2 border-dashed border-purple-300 hover:border-purple-400 transition-colors">
                            {feedbackReferenceUrl ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={feedbackReferenceUrl}
                                  alt="Feedback reference"
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  onClick={() => setFeedbackReferenceUrl(null)}
                                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center text-sm font-bold"
                                >
                                  ×
                                </button>
                              </div>
                            ) : (
                              <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-purple-50/50 transition-colors">
                                {uploadingFeedbackRef ? (
                                  <>
                                    <Loader2 className="w-6 h-6 text-purple-500 animate-spin mb-2" />
                                    <span className="text-xs font-semibold text-purple-700">Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-6 h-6 text-purple-400 mb-2" />
                                    <span className="text-xs font-semibold text-purple-700">Click to upload reference</span>
                                    <span className="text-[10px] text-purple-600 mt-1">PNG, JPG up to 10MB</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const selectedFile = e.target.files?.[0];
                                    if (!selectedFile) return;
                                    
                                    setUploadingFeedbackRef(true);
                                    setError(null);
                                    
                                    try {
                                      const fd = new FormData();
                                      fd.append("file", selectedFile);
                                      fd.append("storyId", data.storyId);
                                      
                                      const res = await fetch("/api/uploads/reference", {
                                        method: "POST",
                                        body: fd,
                                      });
                                      
                                      if (!res.ok) {
                                        const errorData = await res.json();
                                        throw new Error(errorData.error || "Upload failed");
                                      }
                                      
                                      const result = await res.json();
                                      setFeedbackReferenceUrl(result.url);
                                    } catch (err: any) {
                                      setError(err.message || "Failed to upload reference");
                                    } finally {
                                      setUploadingFeedbackRef(false);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {/* Helper text */}
                        <div className="p-3 rounded-xl bg-purple-50 border border-purple-100 mb-4">
                          <p className="text-xs text-purple-800">
                            💡 <strong>Tip:</strong> Your feedback {feedbackReferenceUrl && "and reference image "}will be used to automatically update your style description before regenerating.
                          </p>
                        </div>
                      </>
                    )}
                    
                    {feedbackType === "approve" && (
                      <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200">
                        <p className="text-sm text-green-800">
                          Great! This style will be used for all illustrations in your story. You can always regenerate if needed.
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setFeedbackType(null);
                          setFeedbackText("");
                          setFeedbackReferenceUrl(null);
                        }}
                        className="flex-1 px-6 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors"
                      >
                        Back
                      </button>
                      <button
                        onClick={submitFeedback}
                        disabled={submittingFeedback || (feedbackType === "revise" && !feedbackText.trim() && !feedbackReferenceUrl)}
                        className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submittingFeedback ? (
                          <>
                            <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                            Processing...
                          </>
                        ) : feedbackType === "approve" ? (
                          "Continue to Studio →"
                        ) : (
                          "Update Style & Regenerate"
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-3xl shadow-xl p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center mb-6">
                  <Sparkles className="w-10 h-10 text-purple-400" />
                </div>
                <h3 className="text-2xl font-black text-gray-900 mb-3">
                  No Sample Yet
                </h3>
                <p className="text-gray-600 max-w-sm">
                  Configure your style settings and generate a sample to see how your story will look!
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}