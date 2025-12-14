"use client";

import { useState, useRef } from "react";

// Types matching your schema/parent
type Location = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  referenceImageUrl?: string | null;
  _localPreview?: string | null;
};

interface LocationCardProps {
  location: Location;
  onUpdate: (id: string, patch: Partial<Location>) => void;
  onSave: (l: Location) => Promise<void>;
  onUpload: (file: File) => Promise<string>;
  onNormalize: (file: File) => Promise<File>;
}

export function LocationCard({
  location: l,
  onUpdate,
  onSave,
  onUpload,
  onNormalize,
}: LocationCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(l);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;

    setIsUploading(true);
    try {
      const safe = await onNormalize(raw);
      const preview = URL.createObjectURL(safe);
      
      // Update local preview immediately
      onUpdate(l.id, { _localPreview: preview });

      const url = await onUpload(safe);

      // Update actual data
      onUpdate(l.id, {
        referenceImageUrl: url,
        _localPreview: null,
        // Append ref link to visual notes if not present
        appearance: (l.appearance || "").includes(url)
          ? l.appearance
          : `${l.appearance ?? ""}\n\n[Ref: ${url}]`.trim(),
      });

      // Auto-save
      await onSave({
        ...l,
        referenceImageUrl: url,
        appearance: `${l.appearance ?? ""}\n\n[Ref: ${url}]`.trim(),
      });

    } catch (err) {
      console.error(err);
      alert("Upload failed");
      onUpdate(l.id, { _localPreview: null });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="group relative w-full max-w-sm mx-auto bg-[#1a1a1d] rounded-2xl p-3 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-emerald-900/20 border border-white/10 hover:border-emerald-400/50">
      
      {/* Background Gradient (Green/Teal for Locations) */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-2xl pointer-events-none opacity-50" />

      {/* --- HEADER --- */}
      <div className="flex justify-between items-center mb-2 px-1 relative z-10">
        <input
          value={l.name}
          onChange={(e) => onUpdate(l.id, { name: e.target.value })}
          className="bg-transparent text-lg font-bold text-white tracking-wide border-b border-transparent focus:border-emerald-400 focus:outline-none w-full placeholder-white/20"
          placeholder="LOCATION NAME"
        />
        {/* Type Icon/Label */}
        <div className="ml-2 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">
            <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Zone</span>
        </div>
      </div>

      {/* --- IMAGE FRAME --- */}
      <div 
        className="relative aspect-video w-full bg-[#0b0b0e] rounded-lg border-4 border-[#2a2a30] shadow-inner overflow-hidden cursor-pointer group/image"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif"
          className="hidden"
          onChange={handleFileSelect}
          disabled={isUploading}
        />

        {l._localPreview || l.referenceImageUrl ? (
          <>
            <img
              src={l._localPreview ?? l.referenceImageUrl ?? ""}
              alt={l.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-105"
            />
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
               <span className="text-xs font-bold text-white uppercase tracking-widest mb-1">
                 {isUploading ? "Uploading..." : "Change Image"}
               </span>
               <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
               </svg>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20 group-hover/image:text-white/40 transition-colors">
            <svg className="w-10 h-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-[9px] font-bold uppercase tracking-widest">Add Environment</span>
          </div>
        )}
        
        {isUploading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-400"></div>
          </div>
        )}
      </div>

      {/* --- DETAILS --- */}
      <div className="mt-3 space-y-3 relative z-10">
        
        {/* Description Box */}
        <div className="bg-[#25252b] rounded p-2 border-l-2 border-orange-500/80">
          <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Setting Description</label>
          <textarea
            value={l.description ?? ""}
            onChange={(e) => onUpdate(l.id, { description: e.target.value })}
            className="w-full bg-transparent text-xs text-white/90 focus:outline-none resize-none placeholder-white/10 leading-relaxed"
            rows={3}
            placeholder="Describe this place..."
          />
        </div>

        {/* Visuals Box */}
        <div className="bg-[#25252b] rounded p-2 border-l-2 border-cyan-500/80">
          <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">Atmosphere & Light</label>
          <textarea
            value={l.appearance ?? ""}
            onChange={(e) => onUpdate(l.id, { appearance: e.target.value })}
            className="w-full bg-transparent text-xs text-white/90 focus:outline-none resize-none placeholder-white/10 leading-relaxed"
            rows={2}
            placeholder="Lighting, colors, mood..."
          />
        </div>
      </div>

      {/* --- FOOTER --- */}
      <div className="mt-4 pt-2 border-t border-white/5 flex justify-end relative z-10">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`
            px-6 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all
            ${isSaving 
              ? "bg-white/10 text-white/50 cursor-not-allowed" 
              : "bg-emerald-500 text-black hover:bg-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            }
          `}
        >
          {isSaving ? "Saving..." : "Save Location"}
        </button>
      </div>
    </div>
  );
}