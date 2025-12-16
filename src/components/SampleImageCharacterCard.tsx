"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { 
  Camera, 
  Loader2, 
  Sparkles, 
  Upload, 
  X, 
  Edit3 
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---
  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      // Optional: Add userId context if needed by your API
      const res = await fetch("/api/uploads/reference", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        onUpdated({ referenceImageUrl: data.url });
      } else {
        alert("Upload failed");
      }
    } catch (e) {
      console.error(e);
      alert("Error uploading image");
    } finally {
      setUploading(false);
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
        shadow-[0_2px_20px_rgba(0,0,0,0.04)] 
        hover:shadow-[0_12px_40px_rgba(70,53,177,0.15)]
        border border-stone-100
        overflow-hidden transition-all duration-300
        ${isFocused ? "ring-2 ring-[#4635B1] shadow-xl" : ""}
      `}
    >
      {/* --- 1. IMAGE AREA (The "Headshot") --- */}
      <div 
        className="relative aspect-[4/5] w-full bg-[#F5F5F0] overflow-hidden cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        {character.referenceImageUrl ? (
          <>
            <img 
              src={character.referenceImageUrl} 
              alt={character.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white backdrop-blur-sm">
               <Camera className="w-8 h-8 mb-2" />
               <span className="text-sm font-medium">Change Photo</span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[#4635B1]/40 hover:text-[#4635B1] transition-colors group-hover:bg-[#4635B1]/5">
            {uploading ? (
              <Loader2 className="w-10 h-10 animate-spin text-[#4635B1]" />
            ) : (
              <>
                 <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                   <Upload className="w-6 h-6 text-[#4635B1]" />
                 </div>
                 <span className="text-sm font-bold uppercase tracking-widest opacity-60">Upload Photo</span>
              </>
            )}
          </div>
        )}

        {/* Hidden Input */}
        <input 
          type="file" 
          ref={fileInputRef}
          className="hidden" 
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
      </div>

      {/* --- 2. DETAILS AREA (The "Casting Card") --- */}
      <div className="p-6 flex flex-col flex-1 relative bg-white">
        
        {/* Name Input */}
        <div className="relative mb-3">
          <input
            type="text"
            value={character.name}
            onChange={(e) => onUpdated({ name: e.target.value })}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full font-serif text-2xl font-bold text-[#261C15] bg-transparent border-none p-0 focus:ring-0 placeholder:text-stone-300"
            placeholder="Character Name"
          />
          <Edit3 className="w-4 h-4 text-stone-300 absolute right-0 top-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Description Input */}
        <div className="relative flex-1">
          <textarea
            value={character.description || ""}
            onChange={(e) => onUpdated({ description: e.target.value })}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full h-full min-h-[100px] resize-none text-sm leading-relaxed text-stone-500 bg-transparent border-none p-0 focus:ring-0 placeholder:text-stone-300"
            placeholder="Describe appearance, clothing, and vibe..."
          />
          {/* Subtle line to show it's editable */}
          <div className="absolute bottom-0 left-0 w-8 h-1 bg-[#AEEA94] rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Magic Wand (Decoration) */}
        <div className="absolute bottom-4 right-4">
           <Sparkles className="w-5 h-5 text-[#B771E5]/20 group-hover:text-[#B771E5] transition-colors" />
        </div>
      </div>
    </motion.div>
  );
}