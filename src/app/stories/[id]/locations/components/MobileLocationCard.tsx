"use client";

import { useState } from "react";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  PanInfo,
  AnimatePresence,
} from "framer-motion";
import {
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

const LOCATION_ACCENTS = [
  { from: "#f59e0b", to: "#ef4444" },
  { from: "#ec4899", to: "#8b5cf6" },
  { from: "#8b5cf6", to: "#06b6d4" },
  { from: "#06b6d4", to: "#10b981" },
  { from: "#84cc16", to: "#06b6d4" },
  { from: "#f59e0b", to: "#ec4899" },
  { from: "#d946ef", to: "#ec4899" },
  { from: "#14b8a6", to: "#06b6d4" },
];

const LOCATION_EMOJIS = ["🏰", "🌳", "🏔️", "🏖️", "🌆", "🎪", "🏡", "🌋"];

/* ------------------------------------------------------------------ */
/* MOBILE CARD                                                         */
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
  const [isDragging, setIsDragging] = useState(false);
  const [description, setDescription] = useState(location.description || "");
  const [prevDescription, setPrevDescription] = useState(location.description || "");

  const isDirty = description.trim() !== (location.description || "").trim();
  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;

  // Motion values
  const controls = useAnimationControls();
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotate = useTransform(x, [-250, 0, 250], [-22, 0, 22]);
  const skipOpacity = useTransform(x, [-150, -30, 0], [1, 0.3, 0]);
  const lockOpacity = useTransform(x, [0, 30, 150], [0, 0.3, 1]);

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

  async function saveChanges() {
    setPrevDescription(location.description || "");
    setShowEdit(false);
    try {
      const res = await fetch("/api/locations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id, description }),
      });
      if (!res.ok) throw new Error("Failed to save");
      router.refresh();
    } catch {
      setDescription(prevDescription);
      alert("Failed to save changes. Please try again.");
    }
  }

  // Throw card off screen, then fire action
  async function throwCard(direction: "left" | "right") {
    const xTarget = direction === "right" ? 600 : -600;
    const rotateTarget = direction === "right" ? 30 : -30;
    await controls.start({
      x: xTarget,
      y: 60,
      rotate: rotateTarget,
      opacity: 0,
      transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
    });
    if (direction === "right") {
      await handleLock();
    }
    controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 });
  }

  // Spring snap back to centre
  async function snapBack() {
    await controls.start({
      x: 0,
      y: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 400, damping: 30, mass: 0.8 },
    });
  }

  async function handleDragEnd(event: any, info: PanInfo) {
    setIsDragging(false);
    const SWIPE_DISTANCE = 100;
    const SWIPE_VELOCITY = 500;

    const swipedRight = info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY;
    const swipedLeft = info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY;

    if (swipedRight) {
      await throwCard("right");
    } else if (swipedLeft) {
      await throwCard("left");
    } else {
      await snapBack();
    }
  }

  // Programmatic swipe from buttons
  async function swipeLeft() {
    await controls.start({
      x: -600,
      y: 60,
      rotate: -30,
      opacity: 0,
      transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
    });
    handleDelete();
  }

  async function swipeRight() {
    await throwCard("right");
  }

  return (
    <motion.div
      animate={controls}
      drag="x"
      dragElastic={0.15}
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      style={{ x, y, rotate }}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      whileTap={{ scale: 0.98 }}
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
              <span className="text-9xl font-black text-white/20 select-none">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* ── Swipe Overlays ── */}

        {/* SKIP (left) */}
        <motion.div
          style={{ opacity: skipOpacity }}
          className="absolute inset-0 z-20 pointer-events-none"
        >
          <div
            className="absolute top-10 left-6 px-5 py-2.5 rounded-2xl rotate-[-20deg]"
            style={{
              background: "rgba(239,68,68,0.92)",
              border: "3px solid white",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            }}
          >
            <span className="text-white font-extrabold text-2xl tracking-wide">SKIP</span>
          </div>
        </motion.div>

        {/* LOCK (right) */}
        <motion.div
          style={{ opacity: lockOpacity }}
          className="absolute inset-0 z-20 pointer-events-none"
        >
          <div
            className="absolute top-10 right-6 px-5 py-2.5 rounded-2xl rotate-[20deg]"
            style={{
              background: "rgba(16,185,129,0.92)",
              border: "3px solid white",
              boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            }}
          >
            <span className="text-white font-extrabold text-2xl tracking-wide">LOCK ✓</span>
          </div>
        </motion.div>

        {/* ── Locked Badge ── */}
        {locked && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-violet-600 text-white shadow-lg">
            <Lock className="w-3 h-3" />
            Locked
          </div>
        )}

        {/* ── Upload Buttons — hidden while dragging ── */}
        {!locked && !uploading && !isDragging && (
          <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
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
              <Upload className="w-3 h-3" /> Photo
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); useAiImage(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-violet-600 text-white shadow-lg active:scale-95 transition-transform"
            >
              <Sparkles className="w-3 h-3" /> AI
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

        {/* ── Info Overlay ── */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pt-5 pb-28 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 text-stone-900" />
            </div>
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">
              {location.name}
            </h2>
          </div>

          {description && (
            <p className="text-sm text-white/90 line-clamp-2 drop-shadow-md">
              {description}
            </p>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); setShowEdit(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md text-white text-sm font-semibold border border-white/20 active:scale-95 transition-transform"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Details
          </button>
        </div>

        {/* ── Action Buttons ── */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
          <button
            onClick={(e) => { e.stopPropagation(); swipeLeft(); }}
            disabled={deleting}
            className="w-14 h-14 rounded-full bg-white shadow-xl flex items-center justify-center text-red-500 hover:scale-110 active:scale-95 transition-transform disabled:opacity-40"
          >
            {deleting ? <Loader2 className="w-6 h-6 animate-spin" /> : <X className="w-7 h-7" strokeWidth={2.5} />}
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); swipeRight(); }}
            className="w-16 h-16 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
            style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
          >
            {locked
              ? <Unlock className="w-7 h-7" strokeWidth={2.5} />
              : <Lock className="w-7 h-7" strokeWidth={2.5} />}
          </button>

          {locked && (
            <button
              className="w-14 h-14 rounded-full bg-emerald-500 shadow-xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <Check className="w-7 h-7" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* ── Edit Modal ── */}
      <AnimatePresence>
        {showEdit && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(20,8,40,0.55)", backdropFilter: "blur(4px)" }}
            onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-h-[85vh] overflow-y-auto"
              style={{ background: "white", borderRadius: "24px 24px 0 0" }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-stone-200" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-violet-500" />
                  <h3 className="text-lg font-extrabold text-stone-900">Edit {location.name}</h3>
                </div>
                <button
                  onClick={() => setShowEdit(false)}
                  className="p-1.5 rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <div className="px-6 py-5 space-y-5">
                <div>
                  <label className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-widest text-stone-500">
                    <span className="text-base">📝</span> Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    placeholder="Describe this location's atmosphere, key features, and significance..."
                    className="w-full rounded-2xl p-4 text-stone-800 text-sm leading-relaxed border-2 border-stone-100 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/15 focus:outline-none resize-none transition-all placeholder:text-stone-400"
                  />
                </div>
              </div>

              {/* Save */}
              <div className="px-6 pb-10 pt-2">
                <button
                  onClick={saveChanges}
                  disabled={!isDirty}
                  className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
                  style={{
                    background: "linear-gradient(135deg, #8b5cf6, #d946ef)",
                    boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
                  }}
                >
                  <Check className="w-5 h-5" /> Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* STACK CONTAINER                                                     */
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
    setCurrentIndex((prev) => Math.min(prev, locations.length - 2));
  };

  const handleLockToggle = (id: string, locked: boolean) => {
    onLockToggle?.(id, locked);
    if (locked) {
      setTimeout(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, locations.length - 1));
      }, 350);
    }
  };

  if (locations.length === 0) return null;

  return (
    <div
      className="relative w-full mx-auto max-w-md"
      style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
    >
      <AnimatePresence>
        {visibleCards.map((location, idx) => {
          const isTop = idx === 0;

          return (
            <div
              key={`${location.id}-${currentIndex}-${idx}`}
              className="absolute inset-0"
              style={{
                zIndex: 10 - idx,
                pointerEvents: isTop ? "auto" : "none",
                isolation: "isolate",
              }}
            >
              <motion.div
                initial={isTop ? { scale: 0.95, opacity: 0 } : false}
                animate={{
                  scale: 1 - idx * 0.03,
                  y: -idx * 8,
                  opacity: isTop ? 1 : 0.7,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
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
              </motion.div>
            </div>
          );
        })}
      </AnimatePresence>

      {/* Done state */}
      {currentIndex >= locations.length && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="text-center space-y-3">
            <div className="text-5xl">🗺️</div>
            <p className="text-lg font-bold text-stone-700">All locations reviewed!</p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* LOCATION PREVIEW (cards behind top)                                */
/* ------------------------------------------------------------------ */

function LocationPreview({ location, index }: { location: Location; index: number }) {
  const accent = LOCATION_ACCENTS[index % LOCATION_ACCENTS.length];
  const emoji = LOCATION_EMOJIS[index % LOCATION_EMOJIS.length];
  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;

  return (
    <div
      className="w-full h-full rounded-3xl overflow-hidden shadow-2xl"
      style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={location.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center relative">
          <span className="text-9xl font-black text-white/20 select-none">
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
  );
}