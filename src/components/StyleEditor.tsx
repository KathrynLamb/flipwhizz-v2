"use client";

import { useState } from "react";

type Entity = { id: string; name: string; referenceImageUrl?: string | null };

export function StyleEditor({
  style,
  setStyle,
  onSave,
  pages,
  characters = [],
  locations = [],
  setSampleIllustrationUrl
}: {
  style: any;
  setStyle: (s: any) => void;
  onSave: () => Promise<void>;
  pages: string[];
  characters: Entity[];
  locations: Entity[];
  setSampleIllustrationUrl: (s: any) => void;
}) {
  const [localDesc, setLocalDesc] = useState(style?.summary ?? "");
  const [localNotes, setLocalNotes] = useState(style?.userNotes ?? "");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);

  // Context Selection
  const [selectedCharIds, setSelectedCharIds] = useState<Set<string>>(new Set());
  const [selectedLocId, setSelectedLocId] = useState<string | null>(null);

  const toggleChar = (id: string) => {
    const next = new Set(selectedCharIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedCharIds(next);
  };

  // 1. Upload User Reference Image (Fixed with userId)
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      // Get Session for User ID
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Please log in to upload.");

      const fd = new FormData();
      fd.append("file", f);
      fd.append("userId", userId); 
      
      const res = await fetch("/api/uploads/reference", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStyle((prev: any) => ({ ...prev, referenceImageUrl: data.url }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  }

  // 2. Generate Sample (The Missing Function)
  async function generateSampleImage() {
    setGenerating(true);
    setGeneratedImageBase64(null);

    try {
      const references = [];
      // Style Ref
      if (style?.referenceImageUrl) {
        references.push({ url: style.referenceImageUrl, type: "style", label: "Main Art Style" });
      }
      // Characters
      characters.forEach(c => {
        if (selectedCharIds.has(c.id) && c.referenceImageUrl) {
          references.push({ url: c.referenceImageUrl, type: "character", label: c.name });
        }
      });
      // Location
      const loc = locations.find(l => l.id === selectedLocId);
      if (loc && loc.referenceImageUrl) {
        references.push({ url: loc.referenceImageUrl, type: "location", label: loc.name });
      }

      const res = await fetch("/api/style/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          references,
          description: localDesc,
          pages: pages,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Save Base64 locally to preview
      setGeneratedImageBase64(`data:${data.image.mimeType};base64,${data.image.data}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGenerating(false);
    }
  }

  // 3. Handle Save (Fixed with userId)
  async function handleSaveSequence() {
    setUploading(true);
    try {
      let finalSampleUrl = style?.sampleIllustrationUrl;

      // If we have a NEW generated image sitting in base64, upload it first
      if (generatedImageBase64) {
         const sessionRes = await fetch("/api/auth/session");
         const session = await sessionRes.json();
         const userId = session?.user?.id;
         if (!userId) throw new Error("Please log in to save.");

         // Convert Base64 back to Blob for upload
         const res = await fetch(generatedImageBase64);
         const blob = await res.blob();
         const file = new File([blob], "sample_illustration.png", { type: "image/png" });
         
         const fd = new FormData();
         fd.append("file", file);
         fd.append("userId", userId);
         
         const uploadRes = await fetch("/api/uploads/reference", { method: "POST", body: fd });
         const uploadData = await uploadRes.json();
         if (!uploadRes.ok) throw new Error("Failed to save generated image");
         
         finalSampleUrl = uploadData.url;
      }

      // Update parent state with final text and URL
      const updatedStyle = {
          ...style,
          summary: localDesc,
          userNotes: localNotes,
          sampleIllustrationUrl: finalSampleUrl
      };
      
      setStyle(updatedStyle);
      
      await onSave(); 
      alert("Style saved!");
    } catch (e: any) {
      alert("Error saving: " + e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-8 bg-white/5 border border-white/10 p-6 rounded-3xl">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div className="font-semibold text-sm">Illustration Style</div>
        <button 
          onClick={handleSaveSequence} 
          disabled={uploading || generating}
          className="bg-white text-black px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-50"
        >
          {uploading ? "Saving..." : "Save Style"}
        </button>
      </div>

      {/* 1. STYLE SUMMARY */}
      <div className="mb-4">
        <label className="block text-[10px] uppercase text-white/40 mb-1 font-bold">AI Style Instructions</label>
        <textarea
          className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm w-full focus:outline-none focus:border-white/30"
          placeholder="Describe the style for the AI (e.g. 'Watercolor, soft edges')"
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          rows={2}
        />
      </div>

      {/* 2. USER NOTES */}
      <div className="mb-4">
        <label className="block text-[10px] uppercase text-white/40 mb-1 font-bold">Your Notes</label>
        <textarea
          className="rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-sm w-full focus:outline-none focus:border-white/30"
          placeholder="Private notes about this style..."
          value={localNotes}
          onChange={(e) => setLocalNotes(e.target.value)}
          rows={2}
        />
      </div>

      {/* 3. REFERENCE UPLOAD */}
      <div className="flex gap-4 items-center mb-6">
        <label className="cursor-pointer bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-xs font-medium hover:bg-white/20">
          {style?.referenceImageUrl ? "Replace Reference Image" : "Upload Reference Image"}
          <input type="file" onChange={handleFileChange} className="hidden" disabled={uploading} />
        </label>
        {style?.referenceImageUrl && (
          <img src={style.referenceImageUrl} className="w-12 h-12 object-cover rounded-lg border border-white/20" />
        )}
      </div>

      {/* 4. SCENE CONTEXT (Characters/Locations) */}
      <div className="pt-4 border-t border-white/10">
        <h3 className="text-xs font-semibold text-white/80 mb-3">Generate Sample</h3>
        
         <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Character Selector */}
          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] uppercase text-white/40 mb-2 font-bold">Characters</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {characters.length === 0 && <span className="text-xs text-white/30">No characters yet</span>}
              {characters.map(c => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedCharIds.has(c.id)}
                    onChange={() => toggleChar(c.id)}
                    className="rounded bg-white/10 border-white/20"
                  />
                  {c.referenceImageUrl && (
                    <img src={c.referenceImageUrl} className="w-6 h-6 rounded object-cover" />
                  )}
                  <span className={`text-xs ${selectedCharIds.has(c.id) ? 'text-white' : 'text-white/50'}`}>
                    {c.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Location Selector */}
          <div className="bg-black/20 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] uppercase text-white/40 mb-2 font-bold">Location</div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="loc" 
                  checked={selectedLocId === null}
                  onChange={() => setSelectedLocId(null)}
                  className="bg-white/10 border-white/20"
                />
                <span className="text-xs text-white/50">Generic / None</span>
              </label>
              {locations.map(l => (
                <label key={l.id} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="loc"
                    checked={selectedLocId === l.id}
                    onChange={() => setSelectedLocId(l.id)}
                    className="bg-white/10 border-white/20"
                  />
                  {l.referenceImageUrl && (
                    <img src={l.referenceImageUrl} className="w-6 h-6 rounded object-cover" />
                  )}
                  <span className={`text-xs ${selectedLocId === l.id ? 'text-white' : 'text-white/50'}`}>
                    {l.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={generateSampleImage}
          disabled={generating}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-xl text-sm font-bold disabled:opacity-50"
        >
          {generating ? "Generating Sample..." : "Generate Sample Illustration"}
        </button>
      </div>

      {/* 5. DISPLAY GENERATED IMAGE */}
      {(generatedImageBase64 || style?.sampleIllustrationUrl) && (
        <div className="mt-6">
          <div className="text-xs font-semibold mb-2">Sample Result</div>
          <img 
            src={generatedImageBase64 || style.sampleIllustrationUrl} 
            className="w-full rounded-xl border border-white/20 shadow-2xl" 
          />
          {generatedImageBase64 && (
            <p className="text-[10px] text-yellow-400 mt-2 text-center">
              * Click "Save Style" to confirm this image.
            </p>
          )}
        </div>
      )}
    </div>
  );
}