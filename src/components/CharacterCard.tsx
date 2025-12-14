"use client";

import { useRef, useState } from "react";

type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  age?: string | null;
  referenceImageUrl?: string | null;
  _localPreview?: string | null;
};

interface CharacterCardProps {
  character: Character;
  onUpdate?: (id: string, patch: Partial<Character>) => void;
  onSave?: (c: Character) => Promise<void>;
  onUpload?: (file: File) => Promise<string>; // returns URL
  onNormalize?: (file: File) => Promise<File>;
}

export function CharacterCard({
  character: c,
  onUpdate,
  onSave,
  onUpload,
  onNormalize,
}: CharacterCardProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const safeUpdate = (patch: Partial<Character>) => {
    onUpdate?.(c.id, patch);
  };

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(c);
    } catch (err: any) {
      alert(err?.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.files?.[0];
    if (!raw) return;

    setIsUploading(true);

    try {
      if (!onNormalize || !onUpload) {
        throw new Error("Upload not wired: missing onNormalize or onUpload");
      }

      // 1) Normalize (HEIC -> JPG) if needed
      const safeFile = await onNormalize(raw);

      // 2) Local preview
      const preview = URL.createObjectURL(safeFile);
      safeUpdate({ _localPreview: preview });

      // 3) Upload
      const url = await onUpload(safeFile);

      // 4) Update local data
      const nextAppearance = (c.appearance || "").includes(url)
        ? c.appearance ?? ""
        : `${c.appearance ?? ""}\n\n[Ref: ${url}]`.trim();

      safeUpdate({
        referenceImageUrl: url,
        _localPreview: null,
        appearance: nextAppearance,
      });

      // 5) Auto-save after upload (only if provided)
      if (onSave) {
        await onSave({
          ...c,
          referenceImageUrl: url,
          appearance: nextAppearance,
        });
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Upload failed");
      safeUpdate({ _localPreview: null });
    } finally {
      setIsUploading(false);

      // allow re-selecting same file
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="group relative w-full max-w-sm mx-auto bg-[#1a1a1d] rounded-2xl p-3 shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-purple-900/20 border border-white/10 hover:border-yellow-400/50">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-2xl pointer-events-none opacity-50" />

      {/* Header */}
      <div className="flex justify-between items-center mb-2 px-1 relative z-10">
        <input
          value={c.name}
          onChange={(e) => safeUpdate({ name: e.target.value })}
          className="bg-transparent text-lg font-bold text-white tracking-wide border-b border-transparent focus:border-yellow-400 focus:outline-none w-3/4 placeholder-white/20"
          placeholder="CHARACTER NAME"
        />

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-yellow-400 font-bold uppercase tracking-wider">
            Lvl.
          </span>
          <input
            value={c.age ?? ""}
            onChange={(e) => safeUpdate({ age: e.target.value })}
            className="w-8 text-right bg-transparent text-sm font-bold text-white border-b border-transparent focus:border-yellow-400 focus:outline-none placeholder-white/20"
            placeholder="Age"
          />
        </div>
      </div>

      {/* Image */}
      <div
        className="relative aspect-square w-full bg-[#0b0b0e] rounded-lg border-4 border-[#2a2a30] shadow-inner overflow-hidden cursor-pointer group/image"
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

        {c._localPreview || c.referenceImageUrl ? (
          <>
            <img
              src={c._localPreview ?? c.referenceImageUrl ?? ""}
              alt={c.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/image:scale-110"
            />
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity">
              <span className="text-xs font-bold text-white uppercase tracking-widest mb-1">
                {isUploading ? "Uploading..." : "Change Image"}
              </span>
              <svg
                className="w-6 h-6 text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white/20 group-hover/image:text-white/40 transition-colors">
            <svg
              className="w-12 h-12 mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest">
              Upload Reference
            </span>
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400" />
          </div>
        )}
      </div>

      {/* Text areas */}
      <div className="mt-3 space-y-3 relative z-10">
        <div className="bg-[#25252b] rounded p-2 border-l-2 border-purple-500">
          <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">
            Character Lore / Description
          </label>
          <textarea
            value={c.description ?? ""}
            onChange={(e) => safeUpdate({ description: e.target.value })}
            className="w-full bg-transparent text-xs text-white/90 focus:outline-none resize-none placeholder-white/10 leading-relaxed"
            rows={3}
            placeholder="Who is this character?"
          />
        </div>

        <div className="bg-[#25252b] rounded p-2 border-l-2 border-blue-500">
          <label className="block text-[9px] font-bold text-white/40 uppercase mb-1">
            Visual Traits
          </label>
          <textarea
            value={c.appearance ?? ""}
            onChange={(e) => safeUpdate({ appearance: e.target.value })}
            className="w-full bg-transparent text-xs text-white/90 focus:outline-none resize-none placeholder-white/10 leading-relaxed"
            rows={2}
            placeholder="Hair color, clothes, accessories..."
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-2 border-t border-white/5 flex justify-end relative z-10">
        <button
          onClick={handleSave}
          disabled={isSaving || !onSave}
          className={`
            px-6 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all
            ${isSaving || !onSave
              ? "bg-white/10 text-white/50 cursor-not-allowed"
              : "bg-yellow-500 text-black hover:bg-yellow-400 hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]"
            }
          `}
          title={!onSave ? "Save handler not provided" : undefined}
        >
          {isSaving ? "Saving..." : "Save Card"}
        </button>
      </div>
    </div>
  );
}
