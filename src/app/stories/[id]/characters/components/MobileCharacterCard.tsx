"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import {
  Trash2,
  Lock,
  Unlock,
  Loader2,
  X,
  Check,
  Sparkles,
  Upload,
  Edit3,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  personalityTraits: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  locked: boolean;
};

/* Vibrant accent gradients */
const CARD_ACCENTS = [
  { from: "#f59e0b", to: "#ef4444" },
  { from: "#ec4899", to: "#8b5cf6" },
  { from: "#8b5cf6", to: "#06b6d4" },
  { from: "#06b6d4", to: "#10b981" },
  { from: "#84cc16", to: "#06b6d4" },
  { from: "#f59e0b", to: "#ec4899" },
  { from: "#d946ef", to: "#ec4899" },
  { from: "#14b8a6", to: "#06b6d4" },
];

/* ------------------------------------------------------------------ */
/* MOBILE TINDER-STYLE CARD                                           */
/* ------------------------------------------------------------------ */

export function MobileCharacterCard({
  storyId,
  character,
  index,
  onDelete,
  onLockToggle,
}: {
  storyId: string;
  character: Character;
  index: number;
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
}) {
  const router = useRouter();
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

  const [locked, setLocked] = useState(character.locked);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const imageUrl = character.portraitImageUrl || character.referenceImageUrl;
  const traits = character.personalityTraits
    ? character.personalityTraits.split(",").map((t) => t.trim()).slice(0, 3)
    : [];

  /* ── Actions ── */
  async function handleLock() {
    const endpoint = locked ? "/api/characters/unlock" : "/api/characters/lock";
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: character.id }),
    });
    const newLocked = !locked;
    setLocked(newLocked);
    onLockToggle?.(character.id, newLocked);
  }

  async function handleDelete() {
    if (!confirm(`Delete ${character.name}?`)) return;
    setDeleting(true);
    onDelete?.(character.id);
    await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function uploadReference(file: File) {
    if (locked) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("characterId", character.id);
      const res = await fetch("/api/characters/upload-reference", { method: "POST", body: fd });
      if (res.ok) router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function useAiImage() {
    if (locked) return;
    setUploading(true);
    try {
      const res = await fetch("/api/characters/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id }),
      });
      if (res.ok) router.refresh();
    } finally {
      setUploading(false);
    }
  }

  function handleDragEnd(event: any, info: PanInfo) {
    if (Math.abs(info.offset.x) > 150) {
      // Swiped far enough - lock/unlock
      handleLock();
    }
  }

  /* ── Render ── */
  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity }}
      className="w-full h-full cursor-grab active:cursor-grabbing"
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white isolate">
        
        {/* ── Image Background ── */}
        <div className="absolute inset-0 z-0">
          {imageUrl ? (
            <img src={imageUrl} alt={character.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
            >
              <span className="text-9xl font-black text-white/20">
                {character.name.charAt(0)}
              </span>
            </div>
          )}
          
          {/* Dark gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* ── Locked Badge ── */}
        {locked && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-violet-600 text-white shadow-lg">
            <Lock className="w-3 h-3" />
            Locked
          </div>
        )}

        {/* ── Upload Buttons (when unlocked) ── */}
        {!locked && !uploading && (
          <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) uploadReference(file);
                };
                input.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/90 text-stone-900 shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
            >
              <Upload className="w-3 h-3" />
              Photo
            </button>
            
            <button
              onClick={useAiImage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-violet-600 text-white shadow-lg active:scale-95 transition-transform"
            >
              <Sparkles className="w-3 h-3" />
              AI
            </button>
          </div>
        )}

        {/* ── Uploading Overlay ── */}
        {uploading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <span className="text-sm font-semibold text-white">Processing…</span>
            </div>
          </div>
        )}

        {/* ── Info Overlay (Bottom) ── */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pt-5 pb-28 space-y-3">
          
          {/* Name */}
          <h2 className="text-3xl font-bold text-white drop-shadow-lg">
            {character.name}
          </h2>

          {/* Traits */}
          {traits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {traits.map((t, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full text-xs font-semibold bg-white/90 text-stone-900 backdrop-blur-sm"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Description Preview */}
          {character.description && (
            <p className="text-sm text-white/90 line-clamp-2 drop-shadow-md">
              {character.description}
            </p>
          )}

          {/* Edit button */}
          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-semibold border border-white/20 active:scale-95 transition-transform"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Details
          </button>
        </div>

        {/* ── Action Buttons (Bottom Fixed) ── */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
          
          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-14 h-14 rounded-full bg-white shadow-xl flex items-center justify-center text-red-500 hover:scale-110 active:scale-95 transition-transform disabled:opacity-40"
          >
            {deleting ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <X className="w-7 h-7 stroke-[2.5]" />
            )}
          </button>

          {/* Lock/Unlock */}
          <button
            onClick={handleLock}
            className="w-16 h-16 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
          >
            {locked ? (
              <Unlock className="w-7 h-7 stroke-[2.5]" />
            ) : (
              <Lock className="w-7 h-7 stroke-[2.5]" />
            )}
          </button>

          {/* Confirm (checkmark for locked) */}
          {locked && (
            <button
              className="w-14 h-14 rounded-full bg-emerald-500 shadow-xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <Check className="w-7 h-7 stroke-[2.5]" />
            </button>
          )}
        </div>

        {/* ── Swipe Indicators ── */}
        <motion.div
          style={{
            opacity: useTransform(x, [-200, -50, 0], [1, 0.5, 0]),
          }}
          className="absolute top-1/3 left-8 z-10 px-6 py-3 rounded-2xl bg-red-500 text-white font-bold text-xl rotate-[-20deg] shadow-2xl border-4 border-white"
        >
          SKIP
        </motion.div>

        <motion.div
          style={{
            opacity: useTransform(x, [0, 50, 200], [0, 0.5, 1]),
          }}
          className="absolute top-1/3 right-8 z-10 px-6 py-3 rounded-2xl bg-emerald-500 text-white font-bold text-xl rotate-[20deg] shadow-2xl border-4 border-white"
        >
          LOCK
        </motion.div>
      </div>

      {/* ── Edit Modal (Full Screen) ── */}
 {/* ── Edit Modal (Redesigned) ── */}
 {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-stone-100">
              <h3 className="text-xl font-extrabold text-stone-900">Edit {character.name}</h3>
              <button
                onClick={() => setShowEdit(false)}
                className="p-2 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-stone-600" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="p-6 space-y-6">
              {/* Description Field */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-stone-800 mb-3">
                  <span className="text-lg">💭</span> Description
                </label>
                <textarea
                  defaultValue={character.description || ""}
                  rows={3}
                  className="w-full rounded-2xl p-4 text-stone-800 border-2 border-stone-100 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 focus:outline-none resize-none transition-all placeholder:text-stone-400"
                  placeholder="A cheerful little bee..."
                />
              </div>

              {/* Appearance Field */}
              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-stone-800 mb-3">
                  <span className="text-lg">🪞</span> Appearance
                </label>
                <textarea
                  defaultValue={character.appearance || ""}
                  rows={3}
                  className="w-full rounded-2xl p-4 text-stone-800 border-2 border-stone-100 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/20 focus:outline-none resize-none transition-all placeholder:text-stone-400"
                  placeholder="Yellow and black stripes..."
                />
              </div>

              {/* Save Button */}
              <button
                className="w-full py-4 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 active:scale-[0.98] transition-all shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2"
                onClick={() => setShowEdit(false)}
              >
                <Check className="w-5 h-5" />
                Save Changes
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* MOBILE CARD STACK CONTAINER                                        */
/* ------------------------------------------------------------------ */

export function MobileCharacterStack({
  storyId,
  characters,
  onDelete,
  onLockToggle,
}: {
  storyId: string;
  characters: Character[];
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const visibleCards = characters.slice(currentIndex, currentIndex + 3);
  
  const handleDelete = (id: string) => {
    onDelete?.(id);
    setCurrentIndex(prev => Math.min(prev, characters.length - 2));
  };

  const handleLockToggle = (id: string, locked: boolean) => {
    onLockToggle?.(id, locked);
    if (locked) {
      // Move to next card after locking
      setTimeout(() => {
        setCurrentIndex(prev => Math.min(prev + 1, characters.length - 1));
      }, 300);
    }
  };
  
  return (
    <div className="relative w-full mx-auto max-w-md" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
      {visibleCards.map((char, idx) => {
        const isTop = idx === 0;
        
        return (
          <div
            key={`${char.id}-${currentIndex}-${idx}`}
            className="absolute inset-0"
            style={{
              zIndex: 10 - idx,
              pointerEvents: isTop ? 'auto' : 'none',
              isolation: 'isolate',
            }}
          >
            <div
              style={{
                transform: `scale(${1 - idx * 0.03}) translateY(${-idx * 8}px)`,
                opacity: isTop ? 1 : 0.7,
                transition: 'transform 0.3s ease, opacity 0.3s ease',
              }}
              className="w-full h-full"
            >
              {isTop ? (
                <MobileCharacterCard
                  storyId={storyId}
                  character={char}
                  index={currentIndex + idx}
                  onDelete={handleDelete}
                  onLockToggle={handleLockToggle}
                />
              ) : (
                <CardPreview character={char} index={currentIndex + idx} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CARD PREVIEW (for cards behind)                                    */
/* ------------------------------------------------------------------ */

function CardPreview({ character, index }: { character: Character; index: number }) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const imageUrl = character.portraitImageUrl || character.referenceImageUrl;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white">
      {imageUrl ? (
        <img src={imageUrl} alt={character.name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
        >
          <span className="text-9xl font-black text-white/20">
            {character.name.charAt(0)}
          </span>
        </div>
      )}
    </div>
  );
}