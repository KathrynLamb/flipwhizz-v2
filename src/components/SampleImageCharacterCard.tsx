"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  Loader2,
  Sparkles,
  Upload,
  Edit3,
} from "lucide-react";

type Entity = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl?: string | null;
};

interface Props {
  character: Entity;
  onUpdated: (updates: Partial<Entity>) => void;
}



export function SampleImageCharacterCard({ character, onUpdated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function AIButton({ regenerate = false }: { regenerate?: boolean }) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          generateImage();
        }}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-full
                   bg-white/90 backdrop-blur px-4 py-2
                   text-sm font-semibold text-[#4635B1]
                   shadow hover:bg-white transition
                   disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Illustrating…
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            {regenerate ? "Re-illustrate" : "Generate with AI"}
          </>
        )}
      </button>
    );
  }
  

  /* ---------------- Upload ---------------- */
  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
  
      const res = await fetch("/api/uploads/reference", {
        method: "POST",
        body: fd,
      });
  
      const data = await res.json();
      if (!res.ok) throw new Error("Upload failed");
  
      // 1️⃣ Update local UI immediately
      onUpdated({ referenceImageUrl: data.url });
  
      // 2️⃣ 🔥 PERSIST TO DATABASE (THIS WAS MISSING)
      await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceImageUrl: data.url,
        }),
      });
  
    } catch (err) {
      console.error(err);
      alert("Error uploading image");
    } finally {
      setUploading(false);
    }
  }
  

  /* ---------------- AI Generate ---------------- */
  async function generateImage() {
    try {
      setIsLoading(true);
  
      const res = await fetch(
        `/api/characters/${character.id}/generate-image-gemini`,
        { method: "POST" }
      );
  
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Generation failed");
      }
  
      const data = await res.json();
  
      if (data.imageUrl) {
        onUpdated({ referenceImageUrl: data.imageUrl });
      }
    } catch (err) {
      console.error(err);
      alert("Generation failed. Check console.");
    } finally {
      setIsLoading(false);
    }
  }
  

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
      className={`
        group relative flex flex-col
        bg-white rounded-3xl
        border border-stone-100
        shadow-[0_2px_20px_rgba(0,0,0,0.04)]
        hover:shadow-[0_12px_40px_rgba(70,53,177,0.15)]
        overflow-hidden transition-all
        ${isFocused ? "ring-2 ring-[#4635B1]" : ""}
      `}
    >
      {/* ---------------- IMAGE AREA ---------------- */}
      <div
        className="relative aspect-[4/5] w-full bg-[#F5F5F0] overflow-hidden cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        {/* Existing Image */}
        {character.referenceImageUrl && (
          <>
            <img
              src={character.referenceImageUrl}
              alt={character.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100
                            transition-opacity flex flex-col items-center justify-center
                            text-white backdrop-blur-sm">
              <Camera className="w-8 h-8 mb-2" />
              <span className="text-sm font-medium">Change Photo</span>
            </div>
          </>
        )}

        {/* Empty / Upload State */}
   {/* Empty state */}
{!character.referenceImageUrl && !uploading && (
  <div className="absolute inset-0 flex flex-col items-center justify-center text-[#4635B1]/60">
    <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4">
      <Upload className="w-6 h-6 text-[#4635B1]" />
    </div>

    <span className="text-xs font-bold uppercase tracking-widest mb-3">
      Upload Photo
    </span>

    <AIButton />
  </div>
)}

{/* Image exists → show regenerate button */}
{character.referenceImageUrl && !uploading && (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20">
    <AIButton regenerate />
  </div>
)}


        {/* Upload Spinner */}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-[#4635B1]" />
          </div>
        )}

        {/* AI Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-sm
                          flex flex-col items-center justify-center text-[#4635B1]">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm font-medium">Illustrating…</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) =>
            e.target.files?.[0] && handleUpload(e.target.files[0])
          }
        />
      </div>

      {/* ---------------- DETAILS ---------------- */}
      <div className="p-6 flex flex-col flex-1 relative bg-white">
        <div className="relative mb-3">
          <input
            value={character.name}
            onChange={(e) => onUpdated({ name: e.target.value })}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full font-serif text-2xl font-bold text-[#261C15]
                       bg-transparent border-none p-0 focus:ring-0"
          />
          <Edit3 className="w-4 h-4 text-stone-300 absolute right-0 top-1.5
                            opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <textarea
          value={character.description || ""}
          onChange={(e) => onUpdated({ description: e.target.value })}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="flex-1 resize-none text-sm leading-relaxed text-stone-500
                     bg-transparent border-none p-0 focus:ring-0"
          placeholder="Describe appearance, clothing, and vibe..."
        />

        <div className="absolute bottom-4 right-4">
          <Sparkles className="w-5 h-5 text-[#B771E5]/20
                               group-hover:text-[#B771E5] transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}
