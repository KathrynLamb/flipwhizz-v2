"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Lock,
  Unlock,
  Loader2,
  X,
  Check,
  Sparkles,
  Upload,
  PenLine,
  ChevronRight,
  Shirt,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { CharacterOutfit } from "./CharactersClient";

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
}: {
  storyId: string;
  character: Character;
  index: number;
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
}) {
  const router = useRouter();
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

  const [imageUrl, setImageUrl] = useState(
    character.portraitImageUrl || character.referenceImageUrl
  );
  const [locked, setLocked] = useState(character.locked);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-15, 0, 15]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const traits = character.personalityTraits
    ? character.personalityTraits.split(",").map((t) => t.trim()).slice(0, 3)
    : [];

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

  function handleDragEnd(event: any, info: PanInfo) {
    if (Math.abs(info.offset.x) > 150) {
      handleLock();
    }
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, opacity }}
      className="w-full h-full cursor-grab active:cursor-grabbing"
    >
      <div
        className="relative w-full h-full overflow-hidden isolate"
        style={{
          borderRadius: 24,
          background: "white",
          boxShadow: "0 8px 32px rgba(100,60,140,0.12), 0 2px 8px rgba(100,60,140,0.06)",
        }}
      >
        {/* Image */}
        <div className="absolute inset-0 z-0">
          {imageUrl ? (
            <img src={imageUrl} alt={character.name} className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              }}
            >
              <span className="text-9xl font-extrabold text-white/20 select-none">
                {character.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        </div>

        {/* Locked badge */}
        {locked && (
          <div
            className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(8px)",
              color: "#2FA482",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: "#43B89C" }} />
            Locked
          </div>
        )}

        {/* Upload buttons */}
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold active:scale-95 transition-transform"
              style={{
                background: "rgba(255,255,255,0.9)",
                backdropFilter: "blur(8px)",
                color: "#2D2235",
                border: "none",
              }}
            >
              <Upload className="w-3 h-3" /> Photo
            </button>
            <button
              onClick={useAiImage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold active:scale-95 transition-transform"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                color: "white",
                border: "none",
                boxShadow: "0 2px 8px rgba(176,92,230,0.3)",
              }}
            >
              <Sparkles className="w-3 h-3" /> AI
            </button>
          </div>
        )}

        {/* Uploading */}
        {uploading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <span className="text-sm font-semibold text-white">Processing…</span>
            </div>
          </div>
        )}

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-5 pt-5 pb-28 space-y-3">
          <h2 className="text-3xl font-extrabold text-white drop-shadow-lg">
            {character.name}
          </h2>

          {character.role && (
            <p
              className="text-sm font-medium"
              style={{
                color: "rgba(255,255,255,0.85)",
                fontFamily: "'Lora', serif",
                fontStyle: "italic",
              }}
            >
              {character.role}
            </p>
          )}

          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {traits.map((t, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    background: "rgba(255,255,255,0.9)",
                    backdropFilter: "blur(8px)",
                    color: "#2D2235",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Outfit count */}
          {outfits.length > 0 && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(8px)",
                color: "rgba(255,255,255,0.9)",
              }}
            >
              <Shirt className="w-3 h-3" />
              {outfits.length} outfit{outfits.length !== 1 ? "s" : ""} detected
            </div>
          )}

          {character.description && (
            <p className="text-sm text-white/90 line-clamp-2 drop-shadow-md">
              {character.description}
            </p>
          )}

          <button
            onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold active:scale-95 transition-transform"
            style={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(12px)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            <PenLine className="w-3.5 h-3.5" /> Edit Details
          </button>
        </div>

        {/* Action buttons */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-red-400 hover:scale-110 active:scale-95 transition-transform disabled:opacity-40"
            style={{ background: "white", border: "none" }}
          >
            {deleting ? <Loader2 className="w-6 h-6 animate-spin" /> : <X className="w-7 h-7" strokeWidth={2.5} />}
          </button>

          <button
            onClick={handleLock}
            className="w-16 h-16 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
            style={{
              background: locked
                ? "linear-gradient(135deg, #43B89C, #2FA482)"
                : `linear-gradient(135deg, ${accent.from}, ${accent.to})`,
              border: "none",
            }}
          >
            {locked ? <Unlock className="w-7 h-7" strokeWidth={2.5} /> : <Lock className="w-7 h-7" strokeWidth={2.5} />}
          </button>

          {locked && (
            <button
              className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-transform"
              style={{
                background: "linear-gradient(135deg, #43B89C, #2FA482)",
                border: "none",
              }}
            >
              <Check className="w-7 h-7" strokeWidth={2.5} />
            </button>
          )}
        </div>

        {/* Swipe indicators */}
        <motion.div
          style={{ opacity: useTransform(x, [-200, -50, 0], [1, 0.5, 0]) }}
          className="absolute top-1/3 left-8 z-10 px-6 py-3 rounded-2xl text-white font-extrabold text-xl rotate-[-20deg]"
          style2={{
            background: "rgba(239,68,68,0.9)",
            border: "3px solid white",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}
        >
          SKIP
        </motion.div>

        <motion.div
          style={{ opacity: useTransform(x, [0, 50, 200], [0, 0.5, 1]) }}
          className="absolute top-1/3 right-8 z-10 px-6 py-3 rounded-2xl text-white font-extrabold text-xl rotate-[20deg]"
          style2={{
            background: "rgba(67,184,156,0.9)",
            border: "3px solid white",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}
        >
          LOCK
        </motion.div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <MobileEditModal
          character={character}
          storyId={storyId}
          outfits={outfits}
          onClose={() => setShowEdit(false)}
          onSave={() => {
            setShowEdit(false);
            router.refresh();
          }}
        />
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* MOBILE EDIT MODAL                                                   */
/* ------------------------------------------------------------------ */

function MobileEditModal({
  character,
  storyId,
  outfits,
  onClose,
  onSave,
}: {
  character: Character;
  storyId: string;
  outfits: CharacterOutfit[];
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
  const [showOutfits, setShowOutfits] = useState(false);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(45,34,53,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-h-[90vh] overflow-y-auto"
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />
        </div>

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(180,150,210,0.1)" }}>
          <h3 className="text-lg font-extrabold" style={{ color: "#2D2235" }}>
            Edit {character.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full"
            style={{ background: "rgba(180,150,210,0.08)", border: "none", color: "#8B7BA0" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5">
          <MobileField label="Description" emoji="💭">
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={3}
              placeholder="Personality, background..."
              className="w-full rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed outline-none resize-none"
              style={{
                border: "1.5px solid rgba(180,150,210,0.18)",
                background: "#FDFBFF",
                color: "#2D2235",
                fontFamily: "inherit",
              }}
            />
          </MobileField>

          <MobileField label="Appearance" emoji="👁️">
            <textarea
              value={editData.appearance}
              onChange={(e) => setEditData({ ...editData, appearance: e.target.value })}
              rows={3}
              placeholder="Physical features, clothing..."
              className="w-full rounded-xl px-3.5 py-2.5 text-[14px] leading-relaxed outline-none resize-none"
              style={{
                border: "1.5px solid rgba(180,150,210,0.18)",
                background: "#FDFBFF",
                color: "#2D2235",
                fontFamily: "inherit",
              }}
            />
          </MobileField>

          <MobileField label="Traits" emoji="✨">
            <input
              type="text"
              value={editData.personalityTraits}
              onChange={(e) => setEditData({ ...editData, personalityTraits: e.target.value })}
              placeholder="brave, funny, kind"
              className="w-full rounded-xl px-3.5 py-2.5 text-[14px] outline-none"
              style={{
                border: "1.5px solid rgba(180,150,210,0.18)",
                background: "#FDFBFF",
                color: "#2D2235",
                fontFamily: "inherit",
              }}
            />
          </MobileField>

          {/* Outfits */}
          {outfits.length > 0 && (
            <div>
              <button
                onClick={() => setShowOutfits(!showOutfits)}
                className="flex items-center gap-2 w-full text-left py-2"
                style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
              >
                <Shirt className="w-4 h-4" style={{ color: "#9B59D0" }} />
                <span className="text-[11px] font-bold uppercase flex-1" style={{ color: "#6B5C80", letterSpacing: "0.1em" }}>
                  {outfits.length} Outfit{outfits.length !== 1 ? "s" : ""}
                </span>
                <ChevronRight
                  className="w-4 h-4 transition-transform"
                  style={{ color: "#A897BD", transform: showOutfits ? "rotate(90deg)" : "none" }}
                />
              </button>

              {showOutfits && (
                <div className="space-y-3 pt-2">
                  {outfits.map((outfit) => (
                    <div key={outfit.id} className="rounded-xl p-3.5" style={{ background: "#FDFBFF", border: "1px solid rgba(180,150,210,0.1)" }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#C77DFF" }} />
                        <span className="text-[12px] font-bold" style={{ color: "#6B5C80" }}>
                          {formatOutfitKey(outfit.outfitKey)}
                        </span>
                      </div>
                      <textarea
                        value={outfitEdits[outfit.id] || ""}
                        onChange={(e) => setOutfitEdits((prev) => ({ ...prev, [outfit.id]: e.target.value }))}
                        rows={2}
                        className="w-full rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none resize-none"
                        style={{ border: "1px solid rgba(180,150,210,0.12)", background: "white", color: "#5A4D6B", fontFamily: "inherit" }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="px-6 pb-8 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
              boxShadow: "0 4px 16px rgba(176,92,230,0.25)",
              border: "none",
              fontFamily: "inherit",
            }}
          >
            {saving ? <><Loader2 className="w-5 h-5 animate-spin" /> Saving…</> : <><Check className="w-5 h-5" /> Save Changes</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MobileField({ label, emoji, children }: { label: string; emoji: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-2 mb-2" style={{ fontSize: 11, fontWeight: 700, color: "#6B5C80", textTransform: "uppercase" as const, letterSpacing: "0.1em" }}>
        <span style={{ fontSize: 14 }}>{emoji}</span>
        {label}
      </label>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* STACK CONTAINER                                                     */
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
    setCurrentIndex((prev) => Math.min(prev, characters.length - 2));
  };

  const handleLockToggle = (id: string, locked: boolean) => {
    onLockToggle?.(id, locked);
    if (locked) {
      setTimeout(() => {
        setCurrentIndex((prev) => Math.min(prev + 1, characters.length - 1));
      }, 300);
    }
  };

  return (
    <div
      className="relative w-full mx-auto max-w-md"
      style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}
    >
      {visibleCards.map((char, idx) => {
        const isTop = idx === 0;

        return (
          <div
            key={`${char.id}-${currentIndex}-${idx}`}
            className="absolute inset-0"
            style={{
              zIndex: 10 - idx,
              pointerEvents: isTop ? "auto" : "none",
              isolation: "isolate",
            }}
          >
            <div
              style={{
                transform: `scale(${1 - idx * 0.03}) translateY(${-idx * 8}px)`,
                opacity: isTop ? 1 : 0.7,
                transition: "transform 0.3s ease, opacity 0.3s ease",
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
/* CARD PREVIEW                                                        */
/* ------------------------------------------------------------------ */

function CardPreview({ character, index }: { character: Character; index: number }) {
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];
  const imageUrl = character.portraitImageUrl || character.referenceImageUrl;

  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{
        borderRadius: 24,
        boxShadow: "0 8px 32px rgba(100,60,140,0.08)",
      }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={character.name} className="w-full h-full object-cover" />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${accent.from}, ${accent.to})` }}
        >
          <span className="text-9xl font-extrabold text-white/20 select-none">
            {character.name.charAt(0)}
          </span>
        </div>
      )}
    </div>
  );
}