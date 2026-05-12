// src/app/stories/[id]/characters/components/MobileCharacterCard.tsx
"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
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
  MessageSquare,
  User,
  PawPrint,
  Camera,
  AlertTriangle,
  Save,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebaseClient";
import type { CharacterOutfit } from "@/app/stories/[id]/characters/CharactersClient";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

export type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  personalityTraits: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  fullBodyImageUrl: string | null;
  locked: boolean;
  role?: string | null;
  species?: string | null;
  breed?: string | null;
  outfits?: CharacterOutfit[];
  visualDetails?: any;
};

type VisionConflict = {
  field: string;
  label: string;
  extracted: string;
  photo: string;
  question: string;
};

type LockPhase =
  | "idle"
  | "analyzing"    // vision comparing photo vs description
  | "conflicts"    // conflicts found, waiting for user resolution
  | "generating"   // portrait being generated
  | "locking"      // calling lock endpoint
  | "done";        // card about to fly away

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                           */
/* ------------------------------------------------------------------ */

const CARD_GRADIENTS = [
  { from: "#C77DFF", to: "#E07ABA" },
  { from: "#FFB347", to: "#FF8A65" },
  { from: "#A78BFA", to: "#67E8F9" },
  { from: "#F472B6", to: "#C084FC" },
  { from: "#34D399", to: "#60A5FA" },
  { from: "#FBBF24", to: "#F472B6" },
];

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

function fmt(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bestImage(c: Character) {
  return c.portraitImageUrl || c.fullBodyImageUrl || c.referenceImageUrl || null;
}

function getStatus(c: Character): { label: string; color: string; bg: string } {
  if (c.locked) return { label: "Locked", color: "#2FA482", bg: "rgba(67,184,156,0.1)" };
  if (c.portraitImageUrl) return { label: "Ready", color: "#2FA482", bg: "rgba(67,184,156,0.1)" };
  if (c.referenceImageUrl) return { label: "Generate portrait", color: "#B05CE6", bg: "rgba(176,92,230,0.1)" };
  return { label: "Add photo", color: "#D97706", bg: "rgba(217,119,6,0.1)" };
}

/* ------------------------------------------------------------------ */
/* MAIN CARD                                                           */
/* ------------------------------------------------------------------ */

export function MobileCharacterCard({
  storyId,
  character,
  index,
  onSwiped,
  onUpdate,
}: {
  storyId: string;
  character: Character;
  index: number;
  onSwiped?: (id: string) => void;
  onUpdate?: () => void;
}) {
  const router = useRouter();
  const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

  /* ── State ── */
  const [char, setChar] = useState(character);
  const [imageUrl, setImageUrl] = useState(bestImage(character));
  const [locked, setLocked] = useState(character.locked);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showOutfitChoice, setShowOutfitChoice] = useState(false);
  const [pendingLockAfterGenerate, setPendingLockAfterGenerate] = useState(false);

  // Smart lock flow
  const [lockPhase, setLockPhase] = useState<LockPhase>("idle");
  const [conflicts, setConflicts] = useState<VisionConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, "extracted" | "photo">>({});
  const [lockError, setLockError] = useState<string | null>(null);

  // Edit fields
  const [editName, setEditName] = useState(char.name);
  const [editDescription, setEditDescription] = useState(char.description || "");
  const [editAppearance, setEditAppearance] = useState(char.appearance || "");
  const [editTraits, setEditTraits] = useState(char.personalityTraits || "");

  const controls = useAnimationControls();
  const dragControls = useDragControls();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-12, 0, 12]);
  const editOpacity = useTransform(x, [-120, -30, 0], [1, 0.3, 0]);
  const lockOpacity = useTransform(x, [0, 30, 120], [0, 0.3, 1]);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const traits = useMemo(() =>
    char.personalityTraits?.split(",").map(t => t.trim()).filter(Boolean).slice(0, 4) || [],
    [char.personalityTraits]
  );

  const outfits = char.outfits || [];
  const isAnimal = char.species && char.species !== "human";
  const animalProfile = (char.visualDetails as any)?.animalProfile;
  const status = getStatus({ ...char, locked, portraitImageUrl: char.portraitImageUrl, referenceImageUrl: char.referenceImageUrl });

  /* ── Upload ── */

  async function handleUpload() {
    if (locked) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/heic";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setUploadError(null);
      setUploading(true);

      try {
        // ── HEIC conversion ──
        let uploadFile = file;
        if (/\.heic$/i.test(file.name) || /\.heif$/i.test(file.name) || file.type === "image/heic") {
          const heic2any = (await import("heic2any")).default;
          const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
          uploadFile = new File([blob as Blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
        }

        // ── Upload to Firebase ──
        const path = `story-references/${storyId}/${crypto.randomUUID()}-${uploadFile.name}`;
        const storageRef = ref(storage, path);
        await uploadBytes(storageRef, uploadFile, { contentType: uploadFile.type });
        const publicUrl = await getDownloadURL(storageRef);

        // ── Validate via Claude vision ──
        setUploading(false);
        setValidating(true);

        const validationRes = await fetch("/api/characters/validate-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: publicUrl, characterName: char.name }),
        });

        const validation = validationRes.ok ? await validationRes.json() : { valid: true };

        if (!validation.valid) {
          if (isMounted.current) {
            setUploadError(
              validation.message ||
                (validation.issue === "group_photo"
                  ? `Looks like a group photo — upload one with just ${char.name}`
                  : "Photo not suitable — try a clear solo photo")
            );
          }
          return;
        }

        // ── Accepted — save to DB ──
        const res = await fetch("/api/characters/upload-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: char.id, imageUrl: publicUrl, storagePath: path }),
        });

        if (res.ok) {
          if (isMounted.current) {
            setImageUrl(publicUrl);
            setChar(prev => ({ ...prev, referenceImageUrl: publicUrl }));
          }
          onUpdate?.();
        }
      } catch (err) {
        console.error("Upload failed:", err);
        if (isMounted.current) {
          setUploadError("Photo upload failed — please try again");
        }
      } finally {
        if (isMounted.current) {
          setUploading(false);
          setValidating(false);
        }
      }
    };
    input.click();
  }

  /* ── Generate portrait (standalone button) ── */
  async function generatePortrait(
    outfitMode?: "story" | "reference",
    shouldLockAfter = false
  ) {
    if (locked) return;

    const hasReferenceLikeImage = !!char.referenceImageUrl;

    // Only show the outfit choice when the user explicitly taps "AI Portrait"
    // (outfitMode is undefined AND shouldLockAfter is false).
    // The smart lock flow passes shouldLockAfter=true — auto-select and proceed.
    if (hasReferenceLikeImage && !char.portraitImageUrl && !outfitMode && !shouldLockAfter) {
      setPendingLockAfterGenerate(shouldLockAfter);
      setShowOutfitChoice(true);
      return;
    }

    setShowOutfitChoice(false);
    setUploading(true);

    try {
      const res = await fetch("/api/characters/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: char.id,
          outfitMode,
        }),
      });

      if (!res.ok) throw new Error();

      const data = await res.json();

      if (isMounted.current && data.url) {
        setImageUrl(data.url);
        setChar((prev) => ({ ...prev, portraitImageUrl: data.url }));
      }

      onUpdate?.();

      if (shouldLockAfter) {
        await doLock();
      }
    } catch {
      if (isMounted.current) {
        setLockError("Portrait generation failed");
        setLockPhase("idle");
      }
    } finally {
      if (isMounted.current) {
        setUploading(false);
        setPendingLockAfterGenerate(false);
      }
    }
  }

  /* ── Smart lock flow ── */

  async function startSmartLock() {
    if (locked || lockPhase !== "idle") return;
    setLockError(null);

    const hasPortrait = !!char.portraitImageUrl;
    const hasReference = !!char.referenceImageUrl;

    // Case C: already has portrait — just lock
    if (hasPortrait) {
      setLockPhase("locking");
      await doLock();
      return;
    }

    // Case B: has reference photo but no portrait — analyze then generate
    if (hasReference) {
      setLockPhase("analyzing");
      try {
        const res = await fetch(`/api/characters/${char.id}/analyze-reference`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId }),
        });

        if (!res.ok) {
          console.warn("Vision analysis unavailable, generating portrait directly");
          setLockPhase("generating");
          await doGenerateAndLock();
          return;
        }

        const data = await res.json();
        const foundConflicts: VisionConflict[] = data.conflicts || [];

        if (foundConflicts.length === 0) {
          setLockPhase("generating");
          await doGenerateAndLock();
        } else {
          setConflicts(foundConflicts);
          setResolutions({});
          setLockPhase("conflicts");
        }
      } catch {
        setLockPhase("generating");
        await doGenerateAndLock();
      }
      return;
    }

    // Case A: no photo at all — generate from description
    setLockPhase("generating");
    await doGenerateAndLock();
  }

  async function resolveConflictsAndContinue() {
    const updates: Record<string, string> = {};
    for (const conflict of conflicts) {
      const choice = resolutions[conflict.field];
      if (choice === "photo") {
        updates[conflict.field] = conflict.photo;
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        await fetch(`/api/characters/${char.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        setChar(prev => ({ ...prev, ...updates }));
        if (updates.appearance) setEditAppearance(updates.appearance);
        if (updates.description) setEditDescription(updates.description);
      } catch {
        // Non-fatal — continue anyway
      }
    }

    setLockPhase("generating");
    await doGenerateAndLock();
  }

  async function doGenerateAndLock() {
    // ✅ Auto-select "story" outfit mode when a reference image exists so the
    // smart lock flow never stalls waiting for the outfit choice modal.
    // The explicit "AI Portrait" button still shows the choice.
    const mode = char.referenceImageUrl ? "story" : undefined;
    await generatePortrait(mode, true);
  }

  async function doLock() {
    setLockPhase("locking");
    try {
      const res = await fetch("/api/characters/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: char.id }),
      });
      if (!res.ok) throw new Error();

      if (isMounted.current) {
        setLocked(true);
        setLockPhase("done");
      }

      await controls.start({
        x: 650, rotate: 20, opacity: 0,
        transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
      });
      onSwiped?.(char.id);
    } catch {
      if (isMounted.current) {
        setLockError("Failed to lock");
        setLockPhase("idle");
      }
    }
  }

  function cancelSmartLock() {
    setLockPhase("idle");
    setConflicts([]);
    setResolutions({});
    setLockError(null);
  }

  /* ── Swipe handling ── */
  async function handleDragEnd(_: any, info: PanInfo) {
    setIsDragging(false);
    const THRESHOLD = 70;
    const VELOCITY = 400;

    const swipedRight = info.offset.x > THRESHOLD || info.velocity.x > VELOCITY;
    const swipedLeft = info.offset.x < -THRESHOLD || info.velocity.x < -VELOCITY;

    if (swipedRight) {
      // If already generating, allow swiping to next card — generation continues in background
      if (lockPhase === "generating") {
        await controls.start({
          x: 650, rotate: 20, opacity: 0,
          transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
        });
        onSwiped?.(char.id);
        return;
      }

      const hasPortrait = !!char.portraitImageUrl;

      if (hasPortrait) {
        await controls.start({
          x: 650, rotate: 20, opacity: 0,
          transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] },
        });
        fetch("/api/characters/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: char.id }),
        }).then(() => { setLocked(true); });
        onSwiped?.(char.id);
      } else {
        await controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
        startSmartLock();
      }
      return;
    }

    if (swipedLeft) {
      await controls.start({ x: -60, rotate: -4, transition: { duration: 0.12 } });
      await controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      setExpanded(true);
      setEditing(true);
      return;
    }

    await controls.start({ x: 0, rotate: 0, opacity: 1, transition: { type: "spring", stiffness: 400, damping: 30 } });
  }

  /* ── Save edits ── */

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/characters/${char.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDescription, appearance: editAppearance, personalityTraits: editTraits }),
      });
      setChar(prev => ({ ...prev, name: editName, description: editDescription, appearance: editAppearance, personalityTraits: editTraits }));
      setEditing(false);
      onUpdate?.();
    } finally { setSaving(false); }
  }

  function cancelEdit() {
    setEditName(char.name);
    setEditDescription(char.description || "");
    setEditAppearance(char.appearance || "");
    setEditTraits(char.personalityTraits || "");
    setEditing(false);
  }

  /* ── Derived UI flags ── */

  // ✅ isProcessing no longer blocks dragging — only conflicts and locking do
  const isProcessing = lockPhase === "analyzing" || lockPhase === "generating" || lockPhase === "locking";
  const showConflictUI = lockPhase === "conflicts";
  const allConflictsResolved = conflicts.length > 0 && conflicts.every(c => resolutions[c.field]);

  /* ── Render ── */

  return (
    <motion.div
      animate={controls}
      // ✅ Allow dragging during "generating" — user can swipe to next card while portrait is created
      drag={lockPhase !== "conflicts" && lockPhase !== "locking" && !editing ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragDirectionLock
      dragElastic={0.12}
      dragMomentum={false}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={handleDragEnd}
      style={{ x, rotate, fontFamily: FONT, touchAction: "none" }}
      className="w-full h-full select-none"
    >
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white flex flex-col">

        {/* ━━━ IMAGE AREA ━━━ */}
        <div className="relative w-full overflow-hidden"
              style={{ maxHeight: "45%", minHeight: "200px" }}>
          {imageUrl ? (
            <img src={imageUrl} alt={char.name} className="w-full h-full object-cover" draggable={false} />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
              {isAnimal ? (
                <PawPrint className="w-20 h-20 text-white/20" />
              ) : (
                <span className="text-8xl font-black text-white/15 select-none">{char.name.charAt(0)}</span>
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Swipe overlays */}
          <motion.div style={{ opacity: editOpacity }} className="absolute inset-0 z-20 pointer-events-none">
            <div className="absolute top-8 left-5 px-4 py-2 rounded-2xl rotate-[-18deg]" style={{ background: "rgba(176,92,230,0.92)", border: "3px solid white", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
              <span className="text-white font-extrabold text-xl tracking-wide">EDIT</span>
            </div>
          </motion.div>
          <motion.div style={{ opacity: lockOpacity }} className="absolute inset-0 z-20 pointer-events-none">
            <div className="absolute top-8 right-5 px-4 py-2 rounded-2xl rotate-[18deg]" style={{ background: "rgba(16,185,129,0.92)", border: "3px solid white", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
              <span className="text-white font-extrabold text-xl tracking-wide">LOCK ✓</span>
            </div>
          </motion.div>

          {/* Status badge */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", color: status.color }}>
            {locked && <Lock className="w-2.5 h-2.5" />}
            {status.label}
          </div>

          {/* Species badge */}
          {isAnimal && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", color: "#6B5C80" }}>
              <PawPrint className="w-2.5 h-2.5" />
              {char.breed ? `${char.breed}` : char.species}
            </div>
          )}

          {/* Upload / AI Portrait buttons — hidden during processing */}
          {!uploading && !validating && !isProcessing && !showConflictUI && !isDragging && (
            <>
              <div className="absolute bottom-14 left-3 flex gap-1.5 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadError(null);
                    if (locked) {
                      fetch("/api/characters/unlock", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ characterId: char.id }),
                      }).then(() => {
                        setLocked(false);
                        handleUpload();
                      });
                    } else {
                      handleUpload();
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold active:scale-95 transition-transform"
                  style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", color: "#2D2235" }}
                >
                  <Camera className="w-3 h-3" /> {imageUrl ? "Change" : "Photo"}
                </button>

                {!locked && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      generatePortrait();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold text-white active:scale-95 transition-transform"
                    style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 2px 8px rgba(176,92,230,0.3)" }}
                  >
                    <Sparkles className="w-3 h-3" /> AI Portrait
                  </button>
                )}
              </div>

              <AnimatePresence>
                {showOutfitChoice && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-30 flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget) setShowOutfitChoice(false);
                    }}
                  >
                    <div className="w-full max-w-[260px] p-4 space-y-2.5 bg-white rounded-2xl shadow-2xl" style={{ fontFamily: FONT }}>
                      <p className="text-xs font-bold text-center" style={{ color: "#2D2235" }}>
                        What should they wear?
                      </p>
                      <button
                        onClick={() => generatePortrait("story", pendingLockAfterGenerate)}
                        className="w-full py-2 rounded-xl text-[11px] font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)" }}
                      >
                        <Shirt className="w-3 h-3 inline mr-1" style={{ verticalAlign: "-1px" }} />
                        Story outfit
                      </button>
                      <button
                        onClick={() => generatePortrait("reference", pendingLockAfterGenerate)}
                        className="w-full py-2 rounded-xl text-[11px] font-semibold"
                        style={{ border: "1px solid rgba(180,150,210,0.2)", color: "#6B5C80", background: "white" }}
                      >
                        <Camera className="w-3 h-3 inline mr-1" style={{ verticalAlign: "-1px" }} />
                        Keep photo outfit
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}

          {/* Uploading overlay */}
          {uploading && !isProcessing && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl bg-black/30 backdrop-blur-sm">
                <Loader2 className="w-7 h-7 text-white animate-spin" />
                <span className="text-sm font-semibold text-white">Uploading…</span>
              </div>
            </div>
          )}

          {/* Validating overlay */}
          {validating && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2 px-4 py-3 rounded-2xl bg-black/30 backdrop-blur-sm">
                <Loader2 className="w-7 h-7 text-white animate-spin" />
                <span className="text-sm font-semibold text-white">Checking photo…</span>
              </div>
            </div>
          )}

          {/* ✅ Processing state — small badge so user can still see card and swipe to next */}
          {isProcessing && (
            <div
              className="absolute bottom-14 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              >
                {lockPhase === "analyzing" && <Eye className="w-3 h-3 text-white" />}
                {lockPhase === "generating" && <Sparkles className="w-3 h-3 text-white" />}
                {lockPhase === "locking" && <Lock className="w-3 h-3 text-white" />}
              </motion.div>
              <span className="text-[10px] font-bold text-white">
                {lockPhase === "analyzing" && "Checking photo…"}
                {lockPhase === "generating" && "Creating portrait…"}
                {lockPhase === "locking" && "Locking…"}
              </span>
            </div>
          )}

          {/* Name + role at bottom of image */}
          <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-3">
            <h2 className="text-2xl font-extrabold text-white drop-shadow-lg leading-tight">{char.name}</h2>
            {char.role && <p className="text-[11px] text-white/80 mt-0.5 italic">{char.role}</p>}
          </div>
        </div>

        {/* ━━━ BODY ━━━ */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: "#FDFBFF" }}>

          {/* Conflict resolution UI */}
          <AnimatePresence>
            {showConflictUI && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4" style={{ color: "#D97706" }} />
                  <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Photo doesn't match story</p>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: "#7B6E90" }}>
                  We noticed some differences. Which is correct?
                </p>

                {conflicts.map((c) => (
                  <div key={c.field} className="rounded-2xl p-3.5 space-y-2.5" style={{ background: "white", border: "1.5px solid rgba(180,150,210,0.12)" }}>
                    <p className="text-[11px] font-bold" style={{ color: "#6B5C80" }}>{c.question}</p>
                    <button onClick={() => setResolutions(p => ({ ...p, [c.field]: "extracted" }))}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-[12px]"
                      style={{
                        background: resolutions[c.field] === "extracted" ? "rgba(176,92,230,0.08)" : "rgba(249,245,255,0.5)",
                        border: resolutions[c.field] === "extracted" ? "1.5px solid rgba(176,92,230,0.25)" : "1.5px solid rgba(180,150,210,0.1)",
                        color: "#2D2235",
                      }}>
                      <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#B05CE6" }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold block" style={{ color: "#A897BD" }}>Story says:</span>
                        <span className="font-semibold">{c.extracted}</span>
                      </div>
                      {resolutions[c.field] === "extracted" && <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#B05CE6" }} />}
                    </button>
                    <button onClick={() => setResolutions(p => ({ ...p, [c.field]: "photo" }))}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-[12px]"
                      style={{
                        background: resolutions[c.field] === "photo" ? "rgba(67,184,156,0.08)" : "rgba(249,245,255,0.5)",
                        border: resolutions[c.field] === "photo" ? "1.5px solid rgba(67,184,156,0.25)" : "1.5px solid rgba(180,150,210,0.1)",
                        color: "#2D2235",
                      }}>
                      <Camera className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#43B89C" }} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold block" style={{ color: "#A897BD" }}>Photo shows:</span>
                        <span className="font-semibold">{c.photo}</span>
                      </div>
                      {resolutions[c.field] === "photo" && <Check className="w-4 h-4 flex-shrink-0" style={{ color: "#43B89C" }} />}
                    </button>
                  </div>
                ))}

                <div className="flex gap-2 pt-1">
                  <button onClick={cancelSmartLock}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold"
                    style={{ border: "1.5px solid rgba(180,150,210,0.15)", color: "#6B5C80", background: "white" }}>Cancel</button>
                  <button onClick={resolveConflictsAndContinue} disabled={!allConflictsResolved}
                    className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-40 transition-opacity"
                    style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 3px 12px rgba(176,92,230,0.2)" }}>
                    Generate Portrait
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Normal body content */}
          {!showConflictUI && (
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">

              {/* Upload error */}
              <AnimatePresence>
                {uploadError && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-[11px] font-semibold"
                    style={{ background: "rgba(217,119,6,0.07)", color: "#B45309", border: "1px solid rgba(217,119,6,0.18)" }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="flex-1 leading-relaxed">{uploadError}</span>
                    <button
                      onClick={() => setUploadError(null)}
                      className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Lock error */}
              {lockError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold" style={{ background: "rgba(233,30,99,0.06)", color: "#E91E63", border: "1px solid rgba(233,30,99,0.15)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {lockError}
                  <button onClick={() => { setLockError(null); startSmartLock(); }} className="ml-auto flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}

              {/* Traits */}
              {traits.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {traits.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold" style={{ background: "rgba(199,125,255,0.08)", color: "#9B59D0" }}>{t}</span>
                  ))}
                </div>
              )}

              {/* Animal details */}
              {isAnimal && animalProfile && !expanded && (
                <p className="text-[11px] leading-relaxed" style={{ color: "#5A4D6B" }}>
                  {[animalProfile.coatColour, animalProfile.coatPattern, animalProfile.size, animalProfile.bodyShape].filter(Boolean).join(" · ")}
                </p>
              )}

              {/* Appearance preview */}
              {!isAnimal && char.appearance && !editing && (
                <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: "#5A4D6B" }}>{char.appearance}</p>
              )}

              {/* Expanded: full details */}
              <AnimatePresence>
                {expanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-3">
                    {(char.description || editing) && (
                      <Section label="Description" icon={<MessageSquare className="w-3 h-3" />}>
                        {editing ? (
                          <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3}
                            className="w-full text-[12px] leading-relaxed p-2.5 rounded-lg border outline-none resize-y"
                            style={{ borderColor: "rgba(180,150,210,0.15)", background: "white", color: "#2D2235" }}
                            placeholder="Who is this character?" />
                        ) : (
                          <p className="text-[12px] leading-relaxed" style={{ color: "#5A4D6B" }}>{char.description}</p>
                        )}
                      </Section>
                    )}

                    {(char.appearance || editing) && (
                      <Section label="Appearance" icon={<Eye className="w-3 h-3" />}>
                        {editing ? (
                          <textarea value={editAppearance} onChange={(e) => setEditAppearance(e.target.value)} rows={3}
                            className="w-full text-[12px] leading-relaxed p-2.5 rounded-lg border outline-none resize-y"
                            style={{ borderColor: "rgba(180,150,210,0.15)", background: "white", color: "#2D2235" }}
                            placeholder="Physical features…" />
                        ) : (
                          <p className="text-[12px] leading-relaxed" style={{ color: "#5A4D6B" }}>{char.appearance}</p>
                        )}
                      </Section>
                    )}

                    {isAnimal && animalProfile && (
                      <Section label={`${char.species} details`} icon={<PawPrint className="w-3 h-3" />}>
                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                          {animalProfile.breed && <Detail label="Breed" value={animalProfile.breed} />}
                          {animalProfile.coatColour && <Detail label="Coat" value={animalProfile.coatColour} />}
                          {animalProfile.coatPattern && <Detail label="Pattern" value={animalProfile.coatPattern} />}
                          {animalProfile.size && <Detail label="Size" value={animalProfile.size} />}
                          {animalProfile.earType && <Detail label="Ears" value={animalProfile.earType} />}
                          {animalProfile.eyeColour && <Detail label="Eyes" value={animalProfile.eyeColour} />}
                        </div>
                      </Section>
                    )}

                    {outfits.length > 0 && (
                      <Section label={`${outfits.length} outfit${outfits.length !== 1 ? "s" : ""}`} icon={<Shirt className="w-3 h-3" />}>
                        <div className="space-y-1.5">
                          {outfits.map(o => (
                            <div key={o.id} className="rounded-lg p-2" style={{ background: "rgba(200,180,220,0.05)", border: "1px solid rgba(180,150,210,0.06)" }}>
                              <span className="text-[10px] font-bold" style={{ color: "#6B5C80" }}>{fmt(o.outfitKey)}</span>
                              <p className="text-[10px] mt-0.5" style={{ color: "#8B7BA0" }}>{o.outfitDescription}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {editing && (
                      <Section label="Personality" icon={<Sparkles className="w-3 h-3" />}>
                        <input type="text" value={editTraits} onChange={(e) => setEditTraits(e.target.value)}
                          className="w-full text-[12px] p-2.5 rounded-lg border outline-none"
                          style={{ borderColor: "rgba(180,150,210,0.15)", background: "white", color: "#2D2235" }}
                          placeholder="brave, funny, kind" />
                      </Section>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ━━━ BOTTOM BAR ━━━ */}
          {!showConflictUI && !isProcessing && (
            <div className="flex-shrink-0 px-4 pb-4 pt-1 space-y-2">
              {!editing && (
                <button onClick={() => setExpanded(!expanded)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold"
                  style={{ color: "#A897BD" }}>
                  {expanded ? "Less detail" : "See all details"}
                  <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
              )}

              {editing ? (
                <div className="flex gap-2">
                  <button onClick={cancelEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold"
                    style={{ border: "1.5px solid rgba(180,150,210,0.15)", background: "white", color: "#6B5C80" }}>
                    <X className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 3px 12px rgba(176,92,230,0.2)" }}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setExpanded(true); setEditing(true); }}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                    style={{ background: "rgba(176,92,230,0.08)", border: "1.5px solid rgba(176,92,230,0.12)", color: "#B05CE6" }}>
                    <PenLine className="w-4.5 h-4.5" />
                  </button>
                  <div className="flex-1 rounded-2xl flex items-center justify-center gap-2 py-3 cursor-grab active:cursor-grabbing"
                    style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)", touchAction: "none" }}
                    onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); dragControls.start(e); }}>
                    <div className="w-8 h-1.5 rounded-full" style={{ background: "rgba(180,150,210,0.2)" }} />
                    <span className="text-[11px] font-semibold" style={{ color: "#A897BD" }}>
                      {locked ? "✓ locked" : lockPhase === "generating" ? "← swipe to next →" : "← edit · lock →"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bottom bar hint during generating — still show so user knows they can swipe */}
          {isProcessing && lockPhase === "generating" && (
            <div className="flex-shrink-0 px-4 pb-4 pt-1">
              <div className="flex-1 rounded-2xl flex items-center justify-center gap-2 py-3"
                style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)" }}>
                <div className="w-8 h-1.5 rounded-full" style={{ background: "rgba(180,150,210,0.2)" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#A897BD" }}>
                  Swipe right to move on, portrait saves when ready
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* SUB-COMPONENTS                                                      */
/* ------------------------------------------------------------------ */

function Section({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="pt-1">
      <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase" style={{ color: "#A897BD", letterSpacing: "0.08em" }}>
        <span style={{ color: "#B8A5D0" }}>{icon}</span>{label}
      </div>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(200,180,220,0.05)", border: "1px solid rgba(180,150,210,0.06)" }}>
      <span className="text-[9px] font-bold uppercase block" style={{ color: "#A897BD" }}>{label}</span>
      <span className="text-[11px] font-semibold" style={{ color: "#5A4D6B" }}>{value}</span>
    </div>
  );
}