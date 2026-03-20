"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  PanInfo,
  AnimatePresence,
  useDragControls,
} from "framer-motion";
import {
  Lock,
  Loader2,
  X,
  Check,
  Sparkles,
  Upload,
  PenLine,
  MapPin,
  ArrowLeft,
  ImageIcon,
  Eye,
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

type SwipeAction = "lock" | "edit";

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
  storyId,
  onDelete,
  onLockToggle,
  onSwiped,
}: {
  location: Location;
  index: number;
  storyId: string;
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
  onSwiped?: (id: string, action: SwipeAction) => void;
}) {
  const router = useRouter();
  const accent = LOCATION_ACCENTS[index % LOCATION_ACCENTS.length];
  const emoji = LOCATION_EMOJIS[index % LOCATION_EMOJIS.length];

  const [locked, setLocked] = useState(location.locked);
  const [uploading, setUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;

  const controls = useAnimationControls();
  const dragControls = useDragControls();

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-18, 0, 18]);
  const editOpacity = useTransform(x, [-150, -35, 0], [1, 0.35, 0]);
  const lockOpacity = useTransform(x, [0, 35, 150], [0, 0.35, 1]);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /* ── Always lock, never toggle ── */
  async function lockLocation(): Promise<boolean> {
    if (locked) return true;
    try {
      const res = await fetch("/api/locations/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id }),
      });
      if (!res.ok) return false;
      setLocked(true);
      onLockToggle?.(location.id, true);
      return true;
    } catch {
      return false;
    }
  }

  async function uploadReference(file: File) {
    if (locked) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("locationId", location.id);
      const res = await fetch("/api/locations/upload-reference", {
        method: "POST",
        body: fd,
      });
      if (res.ok) router.refresh();
    } finally {
      if (isMountedRef.current) setUploading(false);
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
      if (isMountedRef.current) setUploading(false);
    }
  }

  async function throwCardRight() {
    const success = await lockLocation();
    if (!success) return;

    await controls.start({
      x: 650,
      rotate: 28,
      opacity: 0,
      transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] },
    });

    onSwiped?.(location.id, "lock");
  }

  async function openEditViaSwipe() {
    await controls.start({
      x: -80,
      rotate: -6,
      transition: { duration: 0.15, ease: "easeOut" },
    });

    await controls.start({
      x: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 420, damping: 32, mass: 0.85 },
    });

    setShowEdit(true);
  }

  async function snapBack() {
    await controls.start({
      x: 0,
      rotate: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 420, damping: 32, mass: 0.85 },
    });
  }

  async function handleDragEnd(_event: any, info: PanInfo) {
    setIsDragging(false);

    const SWIPE_DISTANCE = 120;
    const SWIPE_VELOCITY = 650;

    const swipedRight =
      info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY;
    const swipedLeft =
      info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY;

    if (swipedRight) return throwCardRight();
    if (swipedLeft) return openEditViaSwipe();
    return snapBack();
  }

  const descriptionPreview = location.description
    ? location.description.length > 120
      ? location.description.slice(0, 120) + "…"
      : location.description
    : null;

  return (
    <>
      <motion.div
        animate={controls}
        drag="x"
        dragControls={dragControls}
        dragListener={false}
        dragDirectionLock
        dragElastic={0.14}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        className="w-full h-full select-none"
      >
        <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white isolate flex flex-col">
          {/* ── Image area (top portion) ── */}
          <div className="relative w-full" style={{ flex: "0 0 55%" }}>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={location.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center relative"
                style={{
                  background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                }}
              >
                <span className="text-9xl font-black text-white/20 select-none">
                  {location.name.charAt(0)}
                </span>
                <motion.div
                  animate={{ y: [0, -20, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute text-8xl opacity-30"
                >
                  {emoji}
                </motion.div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

            {/* Swipe overlays */}
            <motion.div
              style={{ opacity: editOpacity }}
              className="absolute inset-0 z-20 pointer-events-none"
            >
              <div
                className="absolute top-10 left-6 px-5 py-2.5 rounded-2xl rotate-[-20deg]"
                style={{
                  background: "rgba(176,92,230,0.92)",
                  border: "3px solid white",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                }}
              >
                <span className="text-white font-extrabold text-2xl tracking-wide">
                  EDIT
                </span>
              </div>
            </motion.div>

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
                <span className="text-white font-extrabold text-2xl tracking-wide">
                  LOCK ✓
                </span>
              </div>
            </motion.div>

            {/* Locked badge */}
            {locked && (
              <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-violet-600 text-white shadow-lg">
                <Lock className="w-3 h-3" />
                Locked
              </div>
            )}

            {/* Upload buttons */}
            {!locked && !uploading && !isDragging && (
              <div className="absolute top-4 left-4 z-10 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = async (ev) => {
                      const file = (ev.target as HTMLInputElement).files?.[0];
                      if (!file) return;
                      await uploadReference(file);
                    };
                    input.click();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/90 text-stone-900 shadow-lg backdrop-blur-sm active:scale-95 transition-transform"
                >
                  <Upload className="w-3 h-3" /> Photo
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    useAiImage();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-violet-600 text-white shadow-lg active:scale-95 transition-transform"
                >
                  <Sparkles className="w-3 h-3" /> AI
                </button>
              </div>
            )}

            {/* Uploading overlay */}
            {uploading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 pointer-events-none">
                <div className="flex flex-col items-center gap-2 rounded-2xl px-4 py-3 bg-black/35 backdrop-blur-sm">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                  <span className="text-sm font-semibold text-white">
                    Processing…
                  </span>
                </div>
              </div>
            )}

            {/* Name overlay at bottom of image */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-stone-900" />
                </div>
                <h2 className="text-3xl font-bold text-white drop-shadow-lg">
                  {location.name}
                </h2>
              </div>
            </div>
          </div>

          {/* ── Info area (bottom portion with description) ── */}
          <div
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
            style={{ background: "#FDFBFF" }}
          >
            {descriptionPreview ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Eye
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "#8b5cf6" }}
                  />
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#A897BD" }}
                  >
                    Description
                  </span>
                </div>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "#5A4D6B" }}
                >
                  {descriptionPreview}
                </p>
              </div>
            ) : (
              <p
                className="text-[13px] leading-relaxed italic"
                style={{ color: "#A897BD" }}
              >
                No description yet — swipe left or tap edit to add one.
              </p>
            )}
          </div>

          {/* ── Drag handle + edit button row ── */}
          {!showEdit && (
            <div
              className="flex-shrink-0 px-5 pb-5 pt-2 flex items-center gap-3"
              style={{ background: "#FDFBFF" }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEdit(true);
                }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                style={{
                  background: "rgba(139,92,246,0.08)",
                  border: "1.5px solid rgba(139,92,246,0.15)",
                  color: "#8b5cf6",
                }}
              >
                <PenLine className="w-5 h-5" />
              </button>

              <div
                className="flex-1 rounded-2xl bg-white border flex items-center justify-center gap-2 py-3 cursor-grab active:cursor-grabbing"
                style={{
                  borderColor: "rgba(180,150,210,0.15)",
                  touchAction: "none",
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                  dragControls.start(e);
                }}
              >
                <div className="w-10 h-1.5 rounded-full bg-stone-200" />
                <span
                  className="text-xs font-semibold"
                  style={{ color: "#A897BD" }}
                >
                  {uploading
                    ? "Processing…"
                    : locked
                      ? "Swipe → unlock"
                      : "← edit · lock →"}
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Edit sheet — portalled to body to escape stacking context */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {showEdit && (
              <MobileLocationEditSheet
                location={location}
                storyId={storyId}
                accent={accent}
                onClose={() => setShowEdit(false)}
                onSave={() => {
                  setShowEdit(false);
                  router.refresh();
                }}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* MOBILE EDIT SHEET                                                    */
/* ------------------------------------------------------------------ */

function MobileLocationEditSheet({
  location,
  storyId,
  accent,
  onClose,
  onSave,
}: {
  location: Location;
  storyId: string;
  accent: { from: string; to: string };
  onClose: () => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [description, setDescription] = useState(location.description || "");

  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;
  const isDirty = description.trim() !== (location.description || "").trim();

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/locations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id, description }),
      });
      if (res.ok) onSave();
      else throw new Error("Failed to save");
    } catch {
      alert("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{
        background: "rgba(20,8,40,0.55)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-h-[92vh] flex flex-col"
        style={{
          background: "#F9F5FF",
          borderRadius: "24px 24px 0 0",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(180,150,210,0.25)" }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: imageUrl
              ? "rgba(0,0,0,0.35)"
              : "rgba(180,150,210,0.08)",
            backdropFilter: "blur(8px)",
            border: "none",
            color: imageUrl ? "white" : "#8B7BA0",
          }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Hero */}
        <div
          className="relative flex-shrink-0 overflow-hidden"
          style={{ borderRadius: "20px 20px 0 0" }}
        >
          {imageUrl ? (
            <div
              className="relative w-full"
              style={{ aspectRatio: "4 / 3", maxHeight: 260 }}
            >
              <img
                src={imageUrl}
                alt={location.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-5 h-5 text-white/80" />
                  <h3 className="text-2xl font-extrabold text-white drop-shadow-lg">
                    {location.name}
                  </h3>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="relative w-full flex items-end"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
                height: 140,
              }}
            >
              <span
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-8xl font-black select-none"
                style={{ color: "rgba(255,255,255,0.15)" }}
              >
                {location.name.charAt(0)}
              </span>
              <div className="relative px-5 pb-4">
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-5 h-5 text-white/80" />
                  <h3 className="text-2xl font-extrabold text-white drop-shadow-lg">
                    {location.name}
                  </h3>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable edit fields */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          <div>
            <label
              className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-widest"
              style={{ color: "#A897BD" }}
            >
              <span className="text-base">📝</span> Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Describe this location's atmosphere, key features, and significance..."
              className="w-full rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed outline-none resize-none transition-all"
              style={{
                border: "2px solid rgba(180,150,210,0.15)",
                background: "white",
                color: "#2D2235",
                fontFamily: "inherit",
              }}
            />
          </div>
        </div>

        {/* Save bar */}
        <div
          className="flex-shrink-0 px-5 pt-3 pb-8"
          style={{
            background: "rgba(249,245,255,0.95)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid rgba(180,150,210,0.1)",
          }}
        >
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #d946ef)",
              boxShadow: "0 4px 16px rgba(139,92,246,0.25)",
              border: "none",
              fontFamily: "inherit",
            }}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check className="w-5 h-5" /> Save Changes
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* END-OF-STACK CARD                                                    */
/* ------------------------------------------------------------------ */

function EndOfStackCard({
  storyId,
  locations,
  onGoBack,
}: {
  storyId: string;
  locations: Location[];
  onGoBack: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const allLocked = locations.every((l) => l.locked);
  const allHaveReference = locations.every(
    (l) => l.portraitImageUrl || l.referenceImageUrl
  );
  const lockedCount = locations.filter((l) => l.locked).length;
  const refCount = locations.filter(
    (l) => l.portraitImageUrl || l.referenceImageUrl
  ).length;

  const canProceed = allLocked && allHaveReference;

  async function handleConfirmAndContinue() {
    setConfirming(true);
    try {
      await fetch(`/api/stories/${storyId}/confirm-locations`, {
        method: "POST",
      });
      await fetch(`/api/stories/${storyId}/complete-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "locations" }),
      });
      router.push(`/stories/${storyId}/preview`);
    } catch {
      setConfirming(false);
    }
  }

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white flex flex-col items-center justify-center px-8 py-10 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{
          background: canProceed
            ? "linear-gradient(135deg, #43B89C, #2FA482)"
            : "linear-gradient(135deg, #8b5cf6, #d946ef)",
          boxShadow: canProceed
            ? "0 8px 28px rgba(67,184,156,0.3)"
            : "0 8px 28px rgba(139,92,246,0.3)",
        }}
      >
        {canProceed ? (
          <Eye className="w-9 h-9 text-white" />
        ) : (
          <ArrowLeft className="w-9 h-9 text-white" />
        )}
      </div>

      {canProceed ? (
        <>
          <h2
            className="text-2xl font-extrabold mb-2"
            style={{ color: "#2D2235" }}
          >
            All Set! 🗺️
          </h2>
          <p
            className="text-sm mb-3 leading-relaxed max-w-xs"
            style={{ color: "#7B6E90" }}
          >
            Every location is locked with a reference image. Ready to preview
            your story.
          </p>

          <div className="flex gap-2 mb-8">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(67,184,156,0.1)", color: "#2FA482" }}
            >
              <Lock className="w-3 h-3" /> {lockedCount}/{locations.length}{" "}
              locked
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(67,184,156,0.1)", color: "#2FA482" }}
            >
              <ImageIcon className="w-3 h-3" /> {refCount}/{locations.length}{" "}
              images
            </span>
          </div>

          <button
            onClick={handleConfirmAndContinue}
            disabled={confirming}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 mb-3"
            style={{
              background: "linear-gradient(135deg, #43B89C, #2FA482)",
              boxShadow: "0 6px 24px rgba(67,184,156,0.25)",
              border: "none",
            }}
          >
            {confirming ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Confirming…
              </>
            ) : (
              <>
                <Eye className="w-5 h-5" /> Confirm & Go to Preview
              </>
            )}
          </button>

          <button
            onClick={onGoBack}
            className="text-sm font-semibold py-2 active:scale-95 transition-transform"
            style={{ color: "#A897BD" }}
          >
            ← Go back through stack
          </button>
        </>
      ) : (
        <>
          <h2
            className="text-2xl font-extrabold mb-2"
            style={{ color: "#2D2235" }}
          >
            Almost There!
          </h2>
          <p
            className="text-sm mb-3 leading-relaxed max-w-xs"
            style={{ color: "#7B6E90" }}
          >
            Some locations still need attention before you can continue.
          </p>

          <div className="flex flex-col gap-2 mb-8 w-full max-w-xs">
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
              style={{
                background: allLocked
                  ? "rgba(67,184,156,0.06)"
                  : "rgba(255,179,71,0.08)",
                border: allLocked
                  ? "1.5px solid rgba(67,184,156,0.15)"
                  : "1.5px solid rgba(255,179,71,0.2)",
              }}
            >
              <Lock
                className="w-4 h-4 flex-shrink-0"
                style={{ color: allLocked ? "#2FA482" : "#FFB347" }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: allLocked ? "#2FA482" : "#C08030" }}
              >
                {lockedCount}/{locations.length} locked
              </span>
              {allLocked && (
                <Check
                  className="w-4 h-4 ml-auto"
                  style={{ color: "#2FA482" }}
                />
              )}
            </div>

            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
              style={{
                background: allHaveReference
                  ? "rgba(67,184,156,0.06)"
                  : "rgba(255,179,71,0.08)",
                border: allHaveReference
                  ? "1.5px solid rgba(67,184,156,0.15)"
                  : "1.5px solid rgba(255,179,71,0.2)",
              }}
            >
              <ImageIcon
                className="w-4 h-4 flex-shrink-0"
                style={{ color: allHaveReference ? "#2FA482" : "#FFB347" }}
              />
              <span
                className="text-sm font-semibold"
                style={{ color: allHaveReference ? "#2FA482" : "#C08030" }}
              >
                {refCount}/{locations.length} have images
              </span>
              {allHaveReference && (
                <Check
                  className="w-4 h-4 ml-auto"
                  style={{ color: "#2FA482" }}
                />
              )}
            </div>
          </div>

          <button
            onClick={onGoBack}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-3"
            style={{
              background: "linear-gradient(135deg, #8b5cf6, #d946ef)",
              boxShadow: "0 6px 24px rgba(139,92,246,0.25)",
              border: "none",
            }}
          >
            <ArrowLeft className="w-5 h-5" /> Go Back Through Stack
          </button>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* STACK CONTAINER                                                      */
/* ------------------------------------------------------------------ */

export function MobileLocationStack({
  storyId,
  locations,
  onDelete,
  onLockToggle,
}: {
  storyId: string;
  locations: Location[];
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localLocs, setLocalLocs] = useState(locations);

  useEffect(() => {
    setLocalLocs(locations);
  }, [locations]);

  const isAtEnd = currentIndex >= localLocs.length;
  const safeIndex = Math.min(currentIndex, Math.max(0, localLocs.length - 1));
  const visibleCards = isAtEnd
    ? []
    : localLocs.slice(safeIndex, safeIndex + 3);

  if (localLocs.length === 0) return null;

  return (
    <div
      className="relative w-full mx-auto max-w-md"
      style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
    >
      <AnimatePresence initial={false}>
        {isAtEnd && (
          <motion.div
            key="end-card"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <EndOfStackCard
              storyId={storyId}
              locations={localLocs}
              onGoBack={() => setCurrentIndex(0)}
            />
          </motion.div>
        )}

        {visibleCards.map((loc, idx) => {
          const isTop = idx === 0;

          return (
            <motion.div
              key={loc.id}
              className="absolute inset-0"
              style={{
                zIndex: 10 - idx,
                pointerEvents: isTop ? "auto" : "none",
                isolation: "isolate",
              }}
              initial={{ scale: 1 - idx * 0.03, y: -idx * 8, opacity: 0 }}
              animate={{
                scale: 1 - idx * 0.03,
                y: -idx * 8,
                opacity: isTop ? 1 : 0.75,
              }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              {isTop ? (
                <MobileLocationCard
                  location={loc}
                  storyId={storyId}
                  index={safeIndex + idx}
                  onDelete={onDelete}
                  onLockToggle={(id, locked) => {
                    setLocalLocs((prev) =>
                      prev.map((l) =>
                        l.id === id ? { ...l, locked } : l
                      )
                    );
                    onLockToggle?.(id, locked);
                  }}
                  onSwiped={(id, action) => {
                    if (action === "lock") {
                      setCurrentIndex((prev) => prev + 1);
                    }
                  }}
                />
              ) : (
                <LocationPreview location={loc} index={safeIndex + idx} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PREVIEW CARD                                                         */
/* ------------------------------------------------------------------ */

function LocationPreview({
  location,
  index,
}: {
  location: Location;
  index: number;
}) {
  const accent = LOCATION_ACCENTS[index % LOCATION_ACCENTS.length];
  const emoji = LOCATION_EMOJIS[index % LOCATION_EMOJIS.length];
  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;

  return (
    <div
      className="w-full h-full rounded-3xl overflow-hidden shadow-2xl"
      style={{
        background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={location.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center relative">
          <span className="text-9xl font-black text-white/20 select-none">
            {location.name.charAt(0)}
          </span>
          <motion.div
            animate={{ y: [0, -20, 0] }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute text-8xl opacity-30"
          >
            {emoji}
          </motion.div>
        </div>
      )}
    </div>
  );
}