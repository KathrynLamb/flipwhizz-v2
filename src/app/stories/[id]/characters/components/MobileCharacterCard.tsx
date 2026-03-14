"use client";

import React, { useMemo, useState } from "react";
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { CharacterOutfit } from "@/app/stories/[id]/characters/CharactersClient";

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

  async function uploadReference(file: File) {
    if (locked) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("characterId", character.id);
      const res = await fetch("/api/characters/upload-reference", {
        method: "POST",
        body: fd,
      });
      if (res.ok) {
        const data = await res.json();
        setImageUrl(data.url);
        router.refresh();
      }
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

  async function throwCardRight() {
    await controls.start({
      x: 650,
      rotate: 28,
      opacity: 0,
      transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] },
    });

    await handleLock();
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
        <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white isolate">
          {/* Image */}
          <div className="absolute inset-0 z-0">
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>

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
            <div className="absolute top-4 left-4 right-4 z-10 flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (ev) => {
                    const file = (ev.target as HTMLInputElement).files?.[0];
                    if (file) uploadReference(file);
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
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-sm font-semibold text-white">
                  Processing…
                </span>
              </div>
            </div>
          )}

          {/* Info overlay */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pt-5 pb-28 space-y-3">
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">
              {character.name}
            </h2>

            {character.role && (
              <p className="text-sm font-medium text-white/85 italic">
                {character.role}
              </p>
            )}

            {traits.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
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

            {outfits.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/15 backdrop-blur-sm text-white/90">
                <Shirt className="w-3 h-3" />
                {outfits.length} outfit{outfits.length !== 1 ? "s" : ""}
              </div>
            )}

            {character.description && (
              <p className="text-sm text-white/90 line-clamp-2 drop-shadow-md">
                {character.description}
              </p>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEdit(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold active:scale-95 transition-transform bg-white/12 backdrop-blur-md text-white border border-white/20"
            >
              <PenLine className="w-3.5 h-3.5" /> Edit Details
            </button>
          </div>

          {/* Action buttons */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
            {/* Left: Edit */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowEdit(true);
              }}
              className="w-14 h-14 rounded-full bg-white shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
              style={{ color: "#B05CE6" }}
            >
              <PenLine className="w-6 h-6" strokeWidth={2.5} />
            </button>

            {/* Center: Lock / Unlock */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                throwCardRight();
              }}
              className="w-16 h-16 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
              style={{
                background: locked
                  ? "linear-gradient(135deg, #43B89C, #2FA482)"
                  : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              }}
            >
              {locked ? (
                <Unlock className="w-7 h-7" strokeWidth={2.5} />
              ) : (
                <Lock className="w-7 h-7" strokeWidth={2.5} />
              )}
            </button>

            {/* Right: Checkmark when locked */}
            {locked && (
              <button className="w-14 h-14 rounded-full bg-emerald-500 shadow-xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform">
                <Check className="w-7 h-7" strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Drag handle */}
          {!showEdit && !uploading && (
            <div className="absolute bottom-0 left-0 right-0 z-30 px-5 pb-4">
              <div
                className="w-full rounded-2xl bg-white/12 border border-white/20 backdrop-blur-md flex items-center justify-center gap-2 py-3 text-white/90"
                style={{ touchAction: "none" }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                  dragControls.start(e);
                }}
              >
                <div className="w-10 h-1.5 rounded-full bg-white/40" />
                <span className="text-xs font-semibold">Swipe to edit / lock</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Edit sheet */}
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
      </AnimatePresence>
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

  const [openSections, setOpenSections] = useState<Set<string>>(
    // new Set(["description"])
  );

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
                <span className="text-[13px] font-bold flex-1" style={{ color: "#6B5C80" }}>
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
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />
        </div>

        {/* ── Close button (floating over hero) ── */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 z-10 w-9 h-9 rounded-xl flex items-center justify-center"
          style={{
            background: imageUrl ? "rgba(0,0,0,0.35)" : "rgba(180,150,210,0.08)",
            backdropFilter: "blur(8px)",
            border: "none",
            color: imageUrl ? "white" : "#8B7BA0",
          }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── Hero: Character image + name ── */}
        <div className="relative flex-shrink-0 overflow-hidden" style={{ borderRadius: "20px 20px 0 0" }}>
          {imageUrl ? (
            <div className="relative w-full" style={{ aspectRatio: "4 / 3", maxHeight: 260 }}>
              <img
                src={imageUrl}
                alt={character.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

              {/* Name + role overlay */}
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
            /* No image — gradient fallback with initial */
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
                      background: isOpen ? `${section.color}15` : "rgba(180,150,210,0.06)",
                      color: isOpen ? section.color : "#A897BD",
                    }}
                  >
                    {section.icon}
                  </div>
                  <span className="text-[14px] font-bold flex-1 text-left" style={{ color: "#2D2235" }}>
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
                    <p className="px-4 pb-2.5 text-[12px]" style={{ color: "#A897BD" }}>
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

  const safeIndex = Math.min(currentIndex, Math.max(0, characters.length - 1));
  const visibleCards = characters.slice(safeIndex, safeIndex + 3);

  if (characters.length === 0) return null;

  return (
    <div
      className="relative w-full mx-auto max-w-md"
      style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
    >
      <AnimatePresence initial={false}>
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
              animate={{ scale: 1 - idx * 0.03, y: -idx * 8, opacity: isTop ? 1 : 0.75 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}
            >
              {isTop ? (
                <MobileCharacterCard
                  storyId={storyId}
                  character={char}
                  index={safeIndex + idx}
                  onDelete={onDelete}
                  onLockToggle={onLockToggle}
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

      {safeIndex >= characters.length - 1 && characters.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div className="text-center space-y-3">
            <div className="text-5xl">🎉</div>
            <p className="text-lg font-bold text-stone-700">
              All characters reviewed!
            </p>
          </div>
        </motion.div>
      )}
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