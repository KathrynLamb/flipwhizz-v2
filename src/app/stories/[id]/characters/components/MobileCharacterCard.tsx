"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
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
  Unlock,
  Loader2,
  X,
  Check,
  Sparkles,
  Upload,
  PenLine,
  ChevronDown,
  Shirt,
  Eye,
  MessageCircle,
  User2,
  ArrowLeft,
  MapPin,
  ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { CharacterOutfit } from "@/app/stories/[id]/characters/CharactersClient";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebaseClient";

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
  role?: string | null;
  outfits?: CharacterOutfit[];
};

type SwipeAction = "lock" | "edit";

const CARD_ACCENTS = [
  { from: "#C77DFF", to: "#E07ABA" },
  { from: "#FFB347", to: "#FF8A65" },
  { from: "#A78BFA", to: "#67E8F9" },
  { from: "#F472B6", to: "#C084FC" },
  { from: "#34D399", to: "#60A5FA" },
  { from: "#FBBF24", to: "#F472B6" },
];

function formatOutfitKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* MOBILE CARD                                                         */
/* ------------------------------------------------------------------ */

export function MobileCharacterCard({
  storyId,
  character,
  index,
  onDelete,
  onLockToggle,
  onSwiped,
}: {
  storyId: string;
  character: Character;
  index: number;
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
  onSwiped?: (id: string, action: SwipeAction) => void;
}) {
  const router = useRouter();
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

  const [imageUrl, setImageUrl] = useState(
    character.portraitImageUrl || character.referenceImageUrl
  );
  const [locked, setLocked] = useState(character.locked);
  const [uploading, setUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  const traits = useMemo(() => {
    return character.personalityTraits
      ? character.personalityTraits
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
  }, [character.personalityTraits]);

  const outfits = character.outfits || [];

  async function handleLock(): Promise<boolean> {
    try {
      const endpoint = locked
        ? "/api/characters/unlock"
        : "/api/characters/lock";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id }),
      });

      if (!res.ok) return false;

      const newLocked = !locked;
      setLocked(newLocked);
      onLockToggle?.(character.id, newLocked);
      return true;
    } catch {
      return false;
    }
  }

  async function uploadToFirebase(file: File, storyId: string) {
    const path = `story-references/${storyId}/${crypto.randomUUID()}-${file.name}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file, {
      contentType: file.type,
    });

    const publicUrl = await getDownloadURL(storageRef);

    return { publicUrl, path };
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

      if (res.ok) {
        router.refresh();
      }
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
      }
    }
  }

  async function handlePhotoUpload(file: File) {
    if (locked) return;

    setUploading(true);
    try {
      const { publicUrl, path } = await uploadToFirebase(file, storyId);

      const res = await fetch("/api/characters/upload-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          imageUrl: publicUrl,
          storagePath: path,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to save reference image");
      }

      if (isMountedRef.current) {
        setImageUrl(publicUrl);
      }

      router.refresh();
    } catch (err) {
      console.error("Photo upload failed:", err);
      if (isMountedRef.current) {
        alert("Photo upload failed. Please try again.");
      }
    } finally {
      if (isMountedRef.current) {
        setUploading(false);
      }
    }
  }

  async function throwCardRight() {
    // Lock the character FIRST, then animate away
    const success = await handleLock();
    if (!success) return;

    await controls.start({
      x: 650,
      rotate: 28,
      opacity: 0,
      transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] },
    });

    onSwiped?.(character.id, "lock");
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

  /* — Truncate appearance for front card — */
  const appearancePreview = character.appearance
    ? character.appearance.length > 100
      ? character.appearance.slice(0, 100) + "…"
      : character.appearance
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
                alt={character.name}
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
                  {character.name.charAt(0)}
                </span>
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

            {/* Upload buttons (top left) */}
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
                      await handlePhotoUpload(file);
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
              <h2 className="text-3xl font-bold text-white drop-shadow-lg">
                {character.name}
              </h2>
              {character.role && (
                <p className="text-sm font-medium text-white/85 italic mt-0.5">
                  {character.role}
                </p>
              )}
              {traits.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {traits.map((t, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-sm text-stone-900"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Info area (bottom portion with appearance + outfits) ── */}
          <div
            className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
            style={{ background: "#FDFBFF" }}
          >
            {/* Appearance */}
            {appearancePreview && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Eye
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "#E07ABA" }}
                  />
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#A897BD" }}
                  >
                    Appearance
                  </span>
                </div>
                <p
                  className="text-[13px] leading-relaxed"
                  style={{ color: "#5A4D6B" }}
                >
                  {appearancePreview}
                </p>
              </div>
            )}

            {/* Outfits */}
            {outfits.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Shirt
                    className="w-3.5 h-3.5 flex-shrink-0"
                    style={{ color: "#A78BFA" }}
                  />
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#A897BD" }}
                  >
                    {outfits.length} Outfit{outfits.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {outfits.map((outfit) => (
                    <div
                      key={outfit.id}
                      className="px-2.5 py-1.5 rounded-xl text-[11px]"
                      style={{
                        background: "rgba(167,139,250,0.08)",
                        border: "1px solid rgba(167,139,250,0.15)",
                        color: "#6B5C80",
                      }}
                    >
                      <span className="font-semibold">
                        {formatOutfitKey(outfit.outfitKey)}
                      </span>
                      {outfit.outfitDescription && (
                        <span className="text-[10px] ml-1 opacity-70">
                          —{" "}
                          {outfit.outfitDescription.length > 40
                            ? outfit.outfitDescription.slice(0, 40) + "…"
                            : outfit.outfitDescription}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No appearance and no outfits — show description snippet */}
            {!appearancePreview && outfits.length === 0 && character.description && (
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: "#5A4D6B" }}
              >
                {character.description.length > 120
                  ? character.description.slice(0, 120) + "…"
                  : character.description}
              </p>
            )}
          </div>

          {/* ── Drag handle + edit button row ── */}
          {!showEdit && (
            <div
              className="flex-shrink-0 px-5 pb-5 pt-2 flex items-center gap-3"
              style={{ background: "#FDFBFF" }}
            >
              {/* Edit button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEdit(true);
                }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                style={{
                  background: "rgba(176,92,230,0.08)",
                  border: "1.5px solid rgba(176,92,230,0.15)",
                  color: "#B05CE6",
                }}
              >
                <PenLine className="w-5 h-5" />
              </button>

              {/* Swipe handle */}
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
              <MobileEditSheet
                character={character}
                storyId={storyId}
                outfits={outfits}
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

function MobileEditSheet({
  character,
  storyId,
  outfits,
  accent,
  onClose,
  onSave,
}: {
  character: Character;
  storyId: string;
  outfits: CharacterOutfit[];
  accent: { from: string; to: string };
  onClose: () => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    description: character.description || "",
    appearance: character.appearance || "",
    personalityTraits: character.personalityTraits || "",
  });
  const [outfitEdits, setOutfitEdits] = useState<Record<string, string>>(
    Object.fromEntries(outfits.map((o) => [o.id, o.outfitDescription]))
  );

  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const imageUrl = character.portraitImageUrl || character.referenceImageUrl;

  const traits = useMemo(() => {
    return character.personalityTraits
      ? character.personalityTraits
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
          .slice(0, 3)
      : [];
  }, [character.personalityTraits]);

  function toggleSection(key: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const isDirty =
    editData.description !== (character.description || "") ||
    editData.appearance !== (character.appearance || "") ||
    editData.personalityTraits !== (character.personalityTraits || "") ||
    outfits.some((o) => outfitEdits[o.id] !== o.outfitDescription);

  async function handleSave() {
    setSaving(true);
    try {
      const charRes = await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editData),
      });

      const outfitPromises = outfits
        .filter((o) => outfitEdits[o.id] !== o.outfitDescription)
        .map((o) =>
          fetch(`/api/stories/${storyId}/outfits/${o.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outfitDescription: outfitEdits[o.id] }),
          })
        );

      await Promise.all(outfitPromises);
      if (charRes.ok) onSave();
    } finally {
      setSaving(false);
    }
  }

  const sections: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    hint: string;
    content: React.ReactNode;
  }> = [
    {
      key: "description",
      label: "Description",
      icon: <MessageCircle className="w-4 h-4" />,
      color: "#9B59D0",
      hint: "Who is this character? Background and personality.",
      content: (
        <textarea
          value={editData.description}
          onChange={(e) =>
            setEditData({ ...editData, description: e.target.value })
          }
          rows={5}
          placeholder="Kind, adventurous, loves exploring the garden with their dog…"
          className="w-full rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed outline-none resize-none transition-all"
          style={{
            border: "2px solid rgba(180,150,210,0.15)",
            background: "white",
            color: "#2D2235",
            fontFamily: "inherit",
          }}
        />
      ),
    },
    {
      key: "appearance",
      label: "Appearance",
      icon: <Eye className="w-4 h-4" />,
      color: "#E07ABA",
      hint: "Physical features the AI should keep consistent across illustrations.",
      content: (
        <textarea
          value={editData.appearance}
          onChange={(e) =>
            setEditData({ ...editData, appearance: e.target.value })
          }
          rows={5}
          placeholder="Brown curly hair, green eyes, always wears a red scarf…"
          className="w-full rounded-2xl px-4 py-3.5 text-[15px] leading-relaxed outline-none resize-none transition-all"
          style={{
            border: "2px solid rgba(180,150,210,0.15)",
            background: "white",
            color: "#2D2235",
            fontFamily: "inherit",
          }}
        />
      ),
    },
    {
      key: "traits",
      label: "Personality Traits",
      icon: <User2 className="w-4 h-4" />,
      color: "#FFB347",
      hint: "Comma-separated traits shown as tags on the card.",
      content: (
        <input
          type="text"
          value={editData.personalityTraits}
          onChange={(e) =>
            setEditData({ ...editData, personalityTraits: e.target.value })
          }
          placeholder="brave, funny, kind, curious"
          className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none transition-all"
          style={{
            border: "2px solid rgba(180,150,210,0.15)",
            background: "white",
            color: "#2D2235",
            fontFamily: "inherit",
          }}
        />
      ),
    },
  ];

  if (outfits.length > 0) {
    sections.push({
      key: "outfits",
      label: `${outfits.length} Outfit${outfits.length !== 1 ? "s" : ""}`,
      icon: <Shirt className="w-4 h-4" />,
      color: "#A78BFA",
      hint: "What each character wears in different scenes.",
      content: (
        <div className="space-y-3">
          {outfits.map((outfit) => (
            <div
              key={outfit.id}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "white",
                border: "1.5px solid rgba(180,150,210,0.12)",
              }}
            >
              <div className="flex items-center gap-2.5 px-4 py-3">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: "#A78BFA" }}
                />
                <span
                  className="text-[13px] font-bold flex-1"
                  style={{ color: "#6B5C80" }}
                >
                  {formatOutfitKey(outfit.outfitKey)}
                </span>
              </div>
              <div className="px-4 pb-3.5">
                <textarea
                  value={outfitEdits[outfit.id] || ""}
                  onChange={(e) =>
                    setOutfitEdits((prev) => ({
                      ...prev,
                      [outfit.id]: e.target.value,
                    }))
                  }
                  rows={3}
                  className="w-full rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed outline-none resize-none transition-all"
                  style={{
                    border: "1.5px solid rgba(180,150,210,0.1)",
                    background: "#FDFBFF",
                    color: "#5A4D6B",
                    fontFamily: "inherit",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      ),
    });
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
        {/* ── Drag handle ── */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(180,150,210,0.25)" }}
          />
        </div>

        {/* ── Close button ── */}
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

        {/* ── Hero ── */}
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
                alt={character.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 space-y-1.5">
                <h3 className="text-2xl font-extrabold text-white drop-shadow-lg">
                  {character.name}
                </h3>
                {character.role && (
                  <p className="text-sm font-medium text-white/80 italic">
                    {character.role}
                  </p>
                )}
                {traits.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {traits.map((t, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 backdrop-blur-sm text-white"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
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
                {character.name.charAt(0)}
              </span>
              <div className="relative px-5 pb-4 space-y-1">
                <h3 className="text-2xl font-extrabold text-white drop-shadow-lg">
                  {character.name}
                </h3>
                {character.role && (
                  <p className="text-sm font-medium text-white/80 italic">
                    {character.role}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Scrollable edit fields ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {sections.map((section) => {
            const isOpen = openSections.has(section.key);
            return (
              <div
                key={section.key}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: "white",
                  border: isOpen
                    ? `1.5px solid ${section.color}25`
                    : "1.5px solid rgba(180,150,210,0.1)",
                }}
              >
                <button
                  onClick={() => toggleSection(section.key)}
                  className="w-full flex items-center gap-3 px-4 py-4"
                  style={{ background: "transparent", border: "none" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: isOpen
                        ? `${section.color}15`
                        : "rgba(180,150,210,0.06)",
                      color: isOpen ? section.color : "#A897BD",
                    }}
                  >
                    {section.icon}
                  </div>
                  <span
                    className="text-[14px] font-bold flex-1 text-left"
                    style={{ color: "#2D2235" }}
                  >
                    {section.label}
                  </span>
                  <ChevronDown
                    className="w-4 h-4"
                    style={{
                      color: "#A897BD",
                      transform: isOpen ? "rotate(180deg)" : "none",
                      transition: "transform 150ms ease",
                    }}
                  />
                </button>

                {isOpen && (
                  <div>
                    <p
                      className="px-4 pb-2.5 text-[12px]"
                      style={{ color: "#A897BD" }}
                    >
                      {section.hint}
                    </p>
                    <div className="px-4 pb-4">{section.content}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Save bar ── */}
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
              background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
              boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
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
  characters,
  onGoBack,
}: {
  storyId: string;
  characters: Character[];
  onGoBack: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const allLocked = characters.every((c) => c.locked);
  const allHaveReference = characters.every(
    (c) => c.portraitImageUrl || c.referenceImageUrl
  );
  const lockedCount = characters.filter((c) => c.locked).length;
  const refCount = characters.filter(
    (c) => c.portraitImageUrl || c.referenceImageUrl
  ).length;

  const canProceed = allLocked && allHaveReference;

  async function handleConfirmAndContinue() {
    setConfirming(true);
    try {
      await fetch(`/api/stories/${storyId}/confirm-characters`, {
        method: "POST",
      });
      await fetch(`/api/stories/${storyId}/complete-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "characters" }),
      });
      router.push(`/stories/${storyId}/locations`);
    } catch {
      setConfirming(false);
    }
  }

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white flex flex-col items-center justify-center px-8 py-10 text-center">
      {/* Icon */}
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{
          background: canProceed
            ? "linear-gradient(135deg, #43B89C, #2FA482)"
            : "linear-gradient(135deg, #C77DFF, #E07ABA)",
          boxShadow: canProceed
            ? "0 8px 28px rgba(67,184,156,0.3)"
            : "0 8px 28px rgba(199,125,255,0.3)",
        }}
      >
        {canProceed ? (
          <MapPin className="w-9 h-9 text-white" />
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
            All Set! 🎉
          </h2>
          <p
            className="text-sm mb-3 leading-relaxed max-w-xs"
            style={{ color: "#7B6E90" }}
          >
            Every character is locked with a reference image. Ready to move on
            to locations.
          </p>

          {/* Status pills */}
          <div className="flex gap-2 mb-8">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(67,184,156,0.1)", color: "#2FA482" }}
            >
              <Lock className="w-3 h-3" /> {lockedCount}/{characters.length}{" "}
              locked
            </span>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(67,184,156,0.1)", color: "#2FA482" }}
            >
              <ImageIcon className="w-3 h-3" /> {refCount}/{characters.length}{" "}
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
                <MapPin className="w-5 h-5" /> Confirm & Go to Locations
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
            Some characters still need attention before you can continue.
          </p>

          {/* Status pills */}
          <div className="flex flex-col gap-2 mb-8 w-full max-w-xs">
            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
              style={{
                background:
                  allLocked
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
                {lockedCount}/{characters.length} locked
              </span>
              {allLocked && (
                <Check className="w-4 h-4 ml-auto" style={{ color: "#2FA482" }} />
              )}
            </div>

            <div
              className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
              style={{
                background:
                  allHaveReference
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
                {refCount}/{characters.length} have images
              </span>
              {allHaveReference && (
                <Check className="w-4 h-4 ml-auto" style={{ color: "#2FA482" }} />
              )}
            </div>
          </div>

          <button
            onClick={onGoBack}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-3"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
              boxShadow: "0 6px 24px rgba(176,92,230,0.25)",
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
  // Track local lock/ref state so end card reflects live changes
  const [localChars, setLocalChars] = useState(characters);

  useEffect(() => {
    setLocalChars(characters);
  }, [characters]);

  const isAtEnd = currentIndex >= localChars.length;
  const safeIndex = Math.min(currentIndex, Math.max(0, localChars.length - 1));
  const visibleCards = isAtEnd ? [] : localChars.slice(safeIndex, safeIndex + 3);

  if (localChars.length === 0) return null;

  return (
    <div
      className="relative w-full mx-auto max-w-md"
      style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
    >
      <AnimatePresence initial={false}>
        {/* Show end-of-stack card */}
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
              characters={localChars}
              onGoBack={() => setCurrentIndex(0)}
            />
          </motion.div>
        )}

        {/* Character cards */}
        {visibleCards.map((char, idx) => {
          const isTop = idx === 0;

          return (
            <motion.div
              key={char.id}
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
                <MobileCharacterCard
                  storyId={storyId}
                  character={char}
                  index={safeIndex + idx}
                  onDelete={onDelete}
                  onLockToggle={(id, locked) => {
                    // Update local state so end card knows
                    setLocalChars((prev) =>
                      prev.map((c) => (c.id === id ? { ...c, locked } : c))
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
                <CardPreview character={char} index={safeIndex + idx} />
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

function CardPreview({
  character,
  index,
}: {
  character: Character;
  index: number;
}) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const imageUrl = character.portraitImageUrl || character.referenceImageUrl;

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
          alt={character.name}
          className="w-full h-full object-cover"
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center relative">
          <span className="text-9xl font-black text-white/20 select-none">
            {character.name.charAt(0)}
          </span>
        </div>
      )}
    </div>
  );
}