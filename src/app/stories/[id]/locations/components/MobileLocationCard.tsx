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
  MapPin,
} from "lucide-react";
import { useRouter } from "next/navigation";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type Location = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  portraitImageUrl: string | null;
  locked: boolean;
};

/* Vibrant accent gradients */
const LOCATION_ACCENTS = [
  { from: "#f59e0b", to: "#ef4444" }, // amber → red
  { from: "#ec4899", to: "#8b5cf6" }, // pink → violet
  { from: "#8b5cf6", to: "#06b6d4" }, // violet → cyan
  { from: "#06b6d4", to: "#10b981" }, // cyan → emerald
  { from: "#84cc16", to: "#06b6d4" }, // lime → cyan
  { from: "#f59e0b", to: "#ec4899" }, // amber → pink
  { from: "#d946ef", to: "#ec4899" }, // fuchsia → pink
  { from: "#14b8a6", to: "#06b6d4" }, // teal → cyan
];

const LOCATION_EMOJIS = ["🏰", "🌳", "🏔️", "🏖️", "🌆", "🎪", "🏡", "🌋"];

/* ------------------------------------------------------------------ */
/* MOBILE TINDER-STYLE CARD                                           */
/* ------------------------------------------------------------------ */

export function MobileLocationCard({
  location,
  index,
  onDelete,
  onLockToggle,
}: {
  location: Location;
  index: number;
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
}) {
  const router = useRouter();
  const accent = LOCATION_ACCENTS[index % LOCATION_ACCENTS.length];
  const emoji = LOCATION_EMOJIS[index % LOCATION_EMOJIS.length];

  const [locked, setLocked] = useState(location.locked);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;

  /* ── Actions ── */
  async function handleLock() {
    const endpoint = locked ? "/api/locations/unlock" : "/api/locations/lock";
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: location.id }),
    });
    const newLocked = !locked;
    setLocked(newLocked);
    onLockToggle?.(location.id, newLocked);
  }

  async function handleDelete() {
    if (!confirm(`Delete ${location.name}?`)) return;
    setDeleting(true);
    onDelete?.(location.id);
    await fetch(`/api/locations/${location.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function uploadReference(file: File) {
    if (locked) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("locationId", location.id);
      const res = await fetch("/api/locations/upload-reference", { method: "POST", body: fd });
      if (res.ok) router.refresh();
    } finally {
      setUploading(false);
    }
  }

  async function useAiImage() {
    if (locked) return;
    setUploading(true);
    try {
      const res = await fetch("/api/locations/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id }),
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
            <img src={imageUrl} alt={location.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center relative"
              style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
            >
              <span className="text-9xl font-black text-white/20">
                {location.name.charAt(0)}
              </span>
              {/* Floating emoji */}
              <motion.div
                animate={{ y: [0, -20, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute text-8xl opacity-30"
              >
                {emoji}
              </motion.div>
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
        <div className="absolute bottom-0 left-0 right-0 z-10 p-5 space-y-3">
          
          {/* Location icon + Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center">
              <MapPin className="w-5 h-5 text-stone-900" />
            </div>
            <h2 className="text-3xl font-bold text-white drop-shadow-lg flex-1">
              {location.name}
            </h2>
          </div>

          {/* Description Preview */}
          {location.description && (
            <p className="text-sm text-white/90 line-clamp-2 drop-shadow-md">
              {location.description}
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
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
          
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
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-6 space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-stone-900">Edit Location</h3>
              <button onClick={() => setShowEdit(false)} className="p-2 hover:bg-stone-100 rounded-full">
                <X className="w-5 h-5 text-stone-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 mb-2 block">Description</label>
                <textarea
                  defaultValue={location.description || ""}
                  rows={6}
                  className="w-full rounded-xl p-3 text-sm border border-stone-200 focus:border-violet-400 focus:outline-none resize-none"
                  placeholder="Describe this location's atmosphere, key features, and significance..."
                />
              </div>

              <button
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 active:scale-[0.98] transition-transform"
                onClick={() => setShowEdit(false)}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* MOBILE CARD STACK CONTAINER                                        */
/* ------------------------------------------------------------------ */

export function MobileLocationStack({
  locations,
  onDelete,
  onLockToggle,
}: {
  locations: Location[];
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const visibleCards = locations.slice(currentIndex, currentIndex + 3);
  
  const handleDelete = (id: string) => {
    onDelete?.(id);
    setCurrentIndex(prev => Math.min(prev, locations.length - 2));
  };

  const handleLockToggle = (id: string, locked: boolean) => {
    onLockToggle?.(id, locked);
    if (locked) {
      // Move to next card after locking
      setTimeout(() => {
        setCurrentIndex(prev => Math.min(prev + 1, locations.length - 1));
      }, 300);
    }
  };
  
  return (
    <div className="relative w-full mx-auto max-w-md" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
      {visibleCards.map((location, idx) => {
        const isTop = idx === 0;
        
        return (
          <div
            key={`${location.id}-${currentIndex}-${idx}`}
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
                <MobileLocationCard
                  location={location}
                  index={currentIndex + idx}
                  onDelete={handleDelete}
                  onLockToggle={handleLockToggle}
                />
              ) : (
                <LocationPreview location={location} index={currentIndex + idx} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LOCATION PREVIEW (for cards behind)                                */
/* ------------------------------------------------------------------ */

function LocationPreview({ location, index }: { location: Location; index: number }) {
  const accent = LOCATION_ACCENTS[index % LOCATION_ACCENTS.length];
  const emoji = LOCATION_EMOJIS[index % LOCATION_EMOJIS.length];
  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white">
      <div className="absolute inset-0 z-0">
        {imageUrl ? (
          <img src={imageUrl} alt={location.name} className="w-full h-full object-cover" />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center relative"
            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
          >
            <span className="text-9xl font-black text-white/20">
              {location.name.charAt(0)}
            </span>
            <motion.div
              animate={{ y: [0, -20, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute text-8xl opacity-30"
            >
              {emoji}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}