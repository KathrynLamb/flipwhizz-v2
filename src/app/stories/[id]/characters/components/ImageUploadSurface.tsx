"use client";

import { useRef, useState } from "react";
import { Upload, Sparkles, Loader2, Lock } from "lucide-react";

type Props = {
  imageUrl: string | null;
  locked: boolean;
  gradient: string;
  fallbackLetter: string;
  uploading?: boolean;
  onUpload: (file: File) => Promise<void>;
  onUseAi: () => Promise<void>;
};

export function ImageUploadSurface({
  imageUrl,
  locked,
  gradient,
  fallbackLetter,
  uploading = false,
  onUpload,
  onUseAi,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

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
      className="relative aspect-[3/4] overflow-hidden cursor-pointer"
      onClick={() => {
        if (!locked) fileRef.current?.click();
      }}
    >
      {/* IMAGE / FALLBACK */}
      {displayImage ? (
        <img
          src={displayImage}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
        >
          <div className="text-8xl font-black text-white/20">
            {fallbackLetter}
          </div>
        </div>
      )}

      {/* FILE INPUT */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) =>
          e.target.files && handleFile(e.target.files[0])
        }
      />

      {/* LOCKED OVERLAY */}
      {locked && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="w-4 h-4" />
            Locked
          </div>
        </div>
      )}

      {/* MOBILE / TOUCH ACTION BAR */}
      {!locked && !uploading && (
        <div className="
          absolute bottom-3 left-1/2 -translate-x-1/2
          flex gap-2
          md:hidden
        ">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
            className="
              px-3 py-2 rounded-full
              bg-white/95 text-slate-900
              text-xs font-semibold
              flex items-center gap-1
              shadow
            "
          >
            <Upload className="w-3 h-3" />
            Add photo
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onUseAi();
            }}
            className="
              px-3 py-2 rounded-full
              bg-violet-500 text-white
              text-xs font-semibold
              flex items-center gap-1
              shadow
            "
          >
            <Sparkles className="w-3 h-3" />
            AI
          </button>
        </div>
      )}

      {/* DESKTOP HOVER OVERLAY */}
      {!locked && !uploading && (
        <div className="
          absolute inset-0
          bg-black/40 backdrop-blur-[2px]
          opacity-0 md:group-hover:opacity-100
          transition-all duration-200
          hidden md:flex
          items-center justify-center gap-3
        ">
          <button
            onClick={(e) => {
              e.stopPropagation();
              fileRef.current?.click();
            }}
            className="
              p-3 rounded-xl
              bg-white/95 text-slate-900
              hover:scale-110 active:scale-95
              transition-all shadow-lg
            "
          >
            <Upload className="w-5 h-5" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onUseAi();
            }}
            className="
              p-3 rounded-xl
              bg-violet-500 text-white
              hover:scale-110 active:scale-95
              transition-all shadow-lg
            "
          >
            <Sparkles className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* UPLOADING */}
      {uploading && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white">
          <Loader2 className="w-8 h-8 animate-spin mb-2" />
          <p className="text-sm font-semibold">Processing…</p>
        </div>
      )}
    </div>
  );
}
