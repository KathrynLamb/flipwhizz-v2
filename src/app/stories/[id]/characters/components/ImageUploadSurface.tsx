"use client";

import { useRef, useState } from "react";
import { Upload, Sparkles, Loader2, Lock } from "lucide-react";

type Props = {
  imageUrl: string | null;
  locked: boolean;
  accentFrom: string;   // e.g. "#f59e0b"
  accentTo: string;     // e.g. "#ef4444"
  fallbackLetter: string;
  uploading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onUseAi: () => Promise<void>;
};

export function ImageUploadSurface({
  imageUrl,
  locked,
  accentFrom,
  accentTo,
  fallbackLetter,
  uploading = false,
  onUpload,
  onUseAi,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [hovered, setHovered] = useState(false);

  const displayImage = localPreview || imageUrl;

  async function handleFile(file: File) {
    if (locked) return;
    setLocalPreview(URL.createObjectURL(file));
    try {
      await onUpload(file);
    } finally {
      setLocalPreview(null);
    }
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{ aspectRatio: "3 / 4", cursor: locked ? "default" : "pointer" }}
      onClick={() => { if (!locked) fileRef.current?.click(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── IMAGE or FALLBACK ── */}
      {displayImage ? (
        <img src={displayImage} alt="" className="w-full h-full object-cover" style={{ display: "block" }} />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${accentFrom}, ${accentTo})` }}
        >
          <span
            className="font-black select-none"
            style={{
              fontSize: "clamp(4rem, 18vw, 7rem)",
              color: "rgba(255,255,255,0.15)",
              lineHeight: 1,
            }}
          >
            {fallbackLetter}
          </span>
        </div>
      )}

      {/* ── hidden file input ── */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
      />

      {/* ── LOCKED overlay ── */}
      {locked && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.52)" }}
        >
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full"
            style={{ background: "rgba(124,92,252,0.25)", border: "1px solid rgba(124,92,252,0.4)" }}
          >
            <Lock className="w-3.5 h-3.5 text-white" />
            <span className="text-xs font-bold text-white">Locked</span>
          </div>
        </div>
      )}

      {/* ── MOBILE action pills (always visible when unlocked, not uploading) ── */}
      {!locked && !uploading && (
        <div
          className="absolute bottom-3 left-1/2 flex gap-2"
          style={{ transform: "translateX(-50%)" }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg md:hidden"
            style={{ background: "rgba(255,255,255,0.92)", color: "#1e1b2e" }}
          >
            <Upload className="w-3 h-3" />
            Photo
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onUseAi(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg md:hidden"
            style={{ background: "linear-gradient(135deg, #7c5cfc, #c25ef0)", color: "#fff" }}
          >
            <Sparkles className="w-3 h-3" />
            AI
          </button>
        </div>
      )}

      {/* ── DESKTOP hover overlay ── */}
      {!locked && !uploading && (
        <div
          className="absolute inset-0 hidden md:flex items-center justify-center gap-3 transition-opacity duration-200"
          style={{
            background: "rgba(0,0,0,0.42)",
            backdropFilter: "blur(2px)",
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? "auto" : "none",
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
            style={{ background: "rgba(255,255,255,0.95)", color: "#1e1b2e" }}
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); onUseAi(); }}
            className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95"
            style={{ background: "linear-gradient(135deg, #7c5cfc, #c25ef0)", color: "#fff" }}
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* ── UPLOADING overlay ── */}
      {uploading && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <Loader2 className="w-7 h-7 text-white animate-spin" />
          <span className="text-xs font-semibold text-white">Processing…</span>
        </div>
      )}
    </div>
  );
}