"use client";

// MobileCharacterCard.tsx — Full rebuild v2
//
// CHANGES FROM v1:
// • Card stays swipeable during reference upload AND AI portrait generation
//   — tasks finish in background, parent refreshes via onUpdate()
// • Outfit choice moved into DetailDrawer Portrait section (not image-zone overlay)
// • generatePortrait() exposes outfitMode param for drawer to use
// • Processing badge unified for all background tasks with "swipe to continue" hint
// • OUTFIT CHOICE MODAL in image zone stays COMMENTED OUT — drawer is canonical

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useMotionValue,
  useTransform,
  useAnimationControls,
  AnimatePresence,
  type PanInfo,
} from "framer-motion";
import {
  Lock, Unlock, Loader2, X, Check, Sparkles, Camera,
  AlertTriangle, RotateCcw, PenLine, PawPrint, MessageSquare,
  Shirt, ChevronDown,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
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

type LockPhase = "idle" | "analyzing" | "conflicts" | "generating" | "locking" | "done";

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
const SWIPE_HINT_KEY = "fw_swipe_hint_v1";

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function fmt(key: string) {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function bestImage(c: Character): string | null {
  return c.portraitImageUrl || c.fullBodyImageUrl || c.referenceImageUrl || null;
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
  const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

  const [char, setChar] = useState(character);
  const [locked, setLocked] = useState(character.locked);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lockPhase, setLockPhase] = useState<LockPhase>("idle");
  const [conflicts, setConflicts] = useState<VisionConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, "extracted" | "photo">>({});
  const [lockError, setLockError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  // OUTFIT CHOICE inline image-zone modal — COMMENTED OUT
  // Outfit selection lives in DetailDrawer → Portrait section
  // const [showOutfitChoice, setShowOutfitChoice] = useState(false);

  const controls = useAnimationControls();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-12, 0, 12]);
  const editOpacity = useTransform(x, [-120, -30, 0], [1, 0.3, 0]);
  const lockOpacity = useTransform(x, [0, 30, 120], [0, 0.3, 1]);

  const isMounted = useRef(true);
  useEffect(() => {
    setMounted(true);
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    setChar(character);
    setLocked(character.locked);
  }, [character]);

  /* ── One-time swipe hint (first card only) ── */
  useEffect(() => {
    if (index !== 0 || typeof window === "undefined") return;
    if (localStorage.getItem(SWIPE_HINT_KEY)) return;

    const timer = setTimeout(async () => {
      if (!isMounted.current) return;
      await controls.start({ x: 28, rotate: 3, transition: { duration: 0.35, ease: "easeOut" } });
      await controls.start({ x: 0, rotate: 0, transition: { duration: 0.25, ease: "easeIn" } });
      await new Promise((r) => setTimeout(r, 120));
      await controls.start({ x: -28, rotate: -3, transition: { duration: 0.35, ease: "easeOut" } });
      await controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 400, damping: 28 } });
      localStorage.setItem(SWIPE_HINT_KEY, "1");
    }, 900);

    return () => clearTimeout(timer);
  }, [index, controls]);

  /* ── Derived ── */
  const traits = useMemo(
    () => char.personalityTraits
      ? char.personalityTraits.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 4)
      : [],
    [char.personalityTraits]
  );

  const isAnimal = char.species && char.species !== "human";
  const previewText = char.appearance || char.description || null;

  const imageState: "empty" | "reference" | "portrait" = useMemo(() => {
    if (char.portraitImageUrl) return "portrait";
    if (char.referenceImageUrl || char.fullBodyImageUrl) return "reference";
    return "empty";
  }, [char.portraitImageUrl, char.referenceImageUrl, char.fullBodyImageUrl]);

  // Any task running in background — shows badge but does NOT block swipe
  const isBackgroundTask = isUploading || isValidating || lockPhase === "analyzing" || lockPhase === "generating";
  const isLocking = lockPhase === "locking";
  const showConflictUI = lockPhase === "conflicts";

  function badgeLabel(): string {
    if (isUploading) return "Uploading photo… swipe to continue";
    if (isValidating) return "Checking photo… swipe to continue";
    if (lockPhase === "analyzing") return "Analysing photo…";
    if (lockPhase === "generating") return "Creating portrait… swipe to continue";
    return "";
  }

  /* ---------------------------------------------------------------- */
  /* UPLOAD                                                           */
  /* ---------------------------------------------------------------- */

  function triggerUpload(unlockFirst = false) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.style.cssText = "position:fixed;top:-100px;left:-100px;opacity:0;";
    document.body.appendChild(input);
  
    input.onchange = async (e) => {
      document.body.removeChild(input);
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
  
      setUploadError(null);
      setIsUploading(true);
  
      let uploadSucceeded = false;
  
      try {
        if (unlockFirst) {
          await fetch("/api/characters/unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ characterId: char.id }),
          });
          if (isMounted.current) setLocked(false);
        }
  
        let uploadFile = file;
        if (/\.heic$/i.test(file.name) || /\.heif$/i.test(file.name) || file.type === "image/heic") {
          const heic2any = (await import("heic2any")).default;
          const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
          uploadFile = new File([blob as Blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
        }
  
        const path = `story-references/${storyId}/${crypto.randomUUID()}-${uploadFile.name}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, uploadFile, { contentType: uploadFile.type });
        const publicUrl = await getDownloadURL(sRef);
  
        if (isMounted.current) { setIsUploading(false); setIsValidating(true); }
  
        const validationRes = await fetch("/api/characters/validate-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: publicUrl, characterName: char.name }),
        });
        const validation = validationRes.ok ? await validationRes.json() : { valid: true };
  
        if (!validation.valid) {
          if (isMounted.current) setUploadError(
            validation.issue === "group_photo"
              ? `Looks like a group photo — try one with just ${char.name}`
              : validation.message || "Photo not suitable — try a clear solo photo"
          );
          return;
        }
  
        const res = await fetch("/api/characters/upload-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: char.id, imageUrl: publicUrl, storagePath: path }),
        });
  
        if (res.ok && isMounted.current) {
          const data = await res.json();
          setChar((prev) => ({ ...prev, referenceImageUrl: data.url }));
          uploadSucceeded = true;
        }
  
        onUpdate?.();
      } catch {
        if (isMounted.current) setUploadError("Upload failed — please try again");
      } finally {
        if (isMounted.current) { setIsUploading(false); setIsValidating(false); }
      }
  
      // Outside try/finally — runs after finally completes, only if upload worked
      if (uploadSucceeded && isMounted.current) {
        generatePortrait("story", false, unlockFirst); // force=true if we just unlocked
      }
    };
  
    input.addEventListener("cancel", () => document.body.removeChild(input));
    input.click();
  }

  /* ---------------------------------------------------------------- */
  /* PORTRAIT GENERATION                                              */
  /* outfitMode exposed for DetailDrawer Portrait section to use      */
  /* ---------------------------------------------------------------- */

  async function generatePortrait(outfitMode?: "story" | "reference", shouldLockAfter = false, force = false) {
    if (locked && !force) return;
    // Default to 'story' when reference exists, undefined (description-only) when not
    const resolvedMode: "story" | undefined = outfitMode ?? (char.referenceImageUrl ? "story" : undefined);
    setLockPhase("generating");

    try {
      const res = await fetch("/api/characters/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: char.id, outfitMode: resolvedMode }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();

      if (isMounted.current && data.url) setChar((prev) => ({ ...prev, portraitImageUrl: data.url }));
      onUpdate?.();

      if (shouldLockAfter && isMounted.current) {
        await doLock();
      } else if (isMounted.current) {
        setLockPhase("idle");
      }
    } catch {
      if (isMounted.current) { setLockError("Portrait generation failed"); setLockPhase("idle"); }
    }
  }

  /* ---------------------------------------------------------------- */
  /* SMART LOCK                                                       */
  /* ---------------------------------------------------------------- */

  async function startSmartLock() {
    if (locked || lockPhase !== "idle") return;
    setLockError(null);

    if (char.portraitImageUrl) { await doLock(); return; }

    if (char.referenceImageUrl) {
      setLockPhase("analyzing");
      try {
        const res = await fetch(`/api/characters/${char.id}/analyze-reference`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId }),
        });
        if (!res.ok) { await generatePortrait("story", true); return; }

        const data = await res.json();
        const found: VisionConflict[] = data.conflicts || [];

        if (found.length === 0) {
          await generatePortrait("story", true);
        } else {
          setConflicts(found);
          setResolutions({});
          setLockPhase("conflicts");
        }
      } catch {
        await generatePortrait("story", true);
      }
      return;
    }

    await generatePortrait(undefined, true);
  }

  async function resolveConflictsAndContinue() {
    const updates: Record<string, string> = {};
    for (const conflict of conflicts) {
      if (resolutions[conflict.field] === "photo") updates[conflict.field] = conflict.photo;
    }
    if (Object.keys(updates).length > 0) {
      try {
        await fetch(`/api/characters/${char.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (isMounted.current) setChar((prev) => ({ ...prev, ...updates }));
      } catch {}
    }
    await generatePortrait("story", true);
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
      if (isMounted.current) { setLocked(true); setLockPhase("done"); }
      await controls.start({ x: 650, rotate: 20, opacity: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } });
      onSwiped?.(char.id);
    } catch {
      if (isMounted.current) { setLockError("Failed to lock — tap retry"); setLockPhase("idle"); }
    }
  }

  function cancelSmartLock() {
    setLockPhase("idle"); setConflicts([]); setResolutions({}); setLockError(null);
  }

  /* ---------------------------------------------------------------- */
  /* SWIPE / DRAG                                                     */
  /* Only blocked by: conflicts, locking, drawer open                 */
  /* Uploading, validating, analyzing, generating → still swipeable   */
  /* ---------------------------------------------------------------- */

  async function handleDragEnd(_: any, info: PanInfo) {
    setIsDragging(false);
    const THRESHOLD = 70;
    const VELOCITY = 400;

    const swipedRight = info.offset.x > THRESHOLD || info.velocity.x > VELOCITY;
    const swipedLeft = info.offset.x < -THRESHOLD || info.velocity.x < -VELOCITY;

    if (swipedRight) {
      // Background tasks: let user swipe away, task finishes in background
      if (isUploading || isValidating || lockPhase === "generating" || lockPhase === "analyzing") {
        await controls.start({ x: 650, rotate: 20, opacity: 0, transition: { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] } });
        onSwiped?.(char.id);
        return;
      }
      // Has portrait: lock and fly
      if (char.portraitImageUrl) {
        await controls.start({ x: 650, rotate: 20, opacity: 0, transition: { duration: 0.3 } });
        fetch("/api/characters/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: char.id }),
        }).then(() => { if (isMounted.current) setLocked(true); });
        onSwiped?.(char.id);
        return;
      }
      // No portrait: bounce and start smart lock
      await controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      startSmartLock();
      return;
    }

    if (swipedLeft) {
      await controls.start({ x: -60, rotate: -4, transition: { duration: 0.12 } });
      await controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      setDrawerOpen(true);
      return;
    }

    await controls.start({ x: 0, rotate: 0, opacity: 1, transition: { type: "spring", stiffness: 400, damping: 30 } });
  }

  const dragDisabled = lockPhase === "conflicts" || lockPhase === "locking" || drawerOpen;

  /* ---------------------------------------------------------------- */
  /* RENDER                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <motion.div
        animate={controls}
        drag={dragDisabled ? false : "x"}
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

          {/* IMAGE ZONE */}
          <div className="relative flex-shrink-0" style={{ height: "55%" }}>
            <ImageZone
              char={char} grad={grad} imageState={imageState}
              isDragging={isDragging} isBackgroundTask={isBackgroundTask}
              badgeLabel={badgeLabel()} locked={locked}
              onUpload={() => triggerUpload(false)}
              onChangePhoto={() => triggerUpload(locked)}
              onGeneratePortrait={() => generatePortrait()}
              hasReference={!!(char.referenceImageUrl || char.fullBodyImageUrl)}
              onOpenDrawer={() => setDrawerOpen(true)}
            />

            {/* Swipe overlays */}
            <motion.div style={{ opacity: editOpacity }} className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute top-8 left-5 px-4 py-2 rounded-2xl"
                style={{ background: "rgba(176,92,230,0.92)", border: "3px solid white", transform: "rotate(-18deg)", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
                <span className="text-white font-extrabold text-xl tracking-wide">EDIT</span>
              </div>
            </motion.div>
            <motion.div style={{ opacity: lockOpacity }} className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute top-8 right-5 px-4 py-2 rounded-2xl"
                style={{ background: "rgba(16,185,129,0.92)", border: "3px solid white", transform: "rotate(18deg)", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
                <span className="text-white font-extrabold text-xl tracking-wide">LOCK ✓</span>
              </div>
            </motion.div>

            {/* Name overlay */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pb-3 pt-8"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)" }}>
              <h2 className="text-2xl font-extrabold text-white leading-tight drop-shadow-lg">{char.name}</h2>
              {char.role && (
                <p className="text-[11px] text-white/75 mt-0.5 italic" style={{ fontFamily: "'Lora', serif" }}>{char.role}</p>
              )}
            </div>

            {/* Status badge */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{
                background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
                color: locked ? "#2FA482" : imageState === "portrait" ? "#2FA482" : imageState === "reference" ? "#B05CE6" : "#D97706",
              }}>
              {locked && <Lock className="w-2.5 h-2.5" />}
              {locked ? "Locked" : imageState === "portrait" ? "Ready" : imageState === "reference" ? "Add portrait" : "Add photo"}
            </div>

            {isAnimal && (
              <div className="absolute top-3 left-3 z-30 flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", color: "#6B5C80" }}>
                <span style={{ fontSize: 10 }}>🐾</span> {char.breed || char.species}
              </div>
            )}
          </div>

          {/* BODY */}
          {showConflictUI ? (
            <ConflictUI
              conflicts={conflicts} resolutions={resolutions} setResolutions={setResolutions}
              onConfirm={resolveConflictsAndContinue} onCancel={cancelSmartLock}
            />
          ) : (
            <div className="flex-1 flex flex-col min-h-0" style={{ background: "#FDFBFF" }}>
              <div className="flex-1 px-4 pt-3 pb-1 flex flex-col justify-center min-h-0 overflow-hidden">

                <AnimatePresence>
                  {uploadError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="flex items-start gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold mb-2"
                      style={{ background: "rgba(217,119,6,0.07)", color: "#B45309", border: "1px solid rgba(217,119,6,0.18)" }}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span className="flex-1">{uploadError}</span>
                      <button onClick={() => setUploadError(null)}><X className="w-3.5 h-3.5 opacity-50" /></button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {lockError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold mb-2"
                    style={{ background: "rgba(233,30,99,0.06)", color: "#E91E63", border: "1px solid rgba(233,30,99,0.15)" }}>
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {lockError}
                    <button onClick={() => { setLockError(null); startSmartLock(); }} className="ml-auto flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                )}

                {/* Traits — only when populated */}
                {traits.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {traits.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                        style={{ background: "rgba(199,125,255,0.08)", color: "#9B59D0" }}>{t}</span>
                    ))}
                  </div>
                )}

                {previewText && (
                  <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: "#5A4D6B" }}>{previewText}</p>
                )}

                <button onClick={() => setDrawerOpen(true)}
                  className="mt-1.5 self-start flex items-center gap-1 text-[10px] font-semibold"
                  style={{ color: "#B8A5D0", background: "none", border: "none", cursor: "pointer" }}>
                  <ChevronDown className="w-3 h-3" /> See full details
                </button>
              </div>

              {/* ACTION BAR */}
              <div className="flex-shrink-0 px-4 pb-5 pt-2">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-[10px] font-medium" style={{ color: "rgba(180,150,210,0.5)" }}>← swipe to edit</span>
                  <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />)}</div>
                  <span className="text-[10px] font-medium" style={{ color: "rgba(180,150,210,0.5)" }}>lock in →</span>
                </div>

                <div className="flex gap-2.5">
                  <button onClick={() => setDrawerOpen(true)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl text-[12px] font-semibold active:scale-95 transition-transform"
                    style={{ width: "36%", padding: "12px 0", background: "rgba(176,92,230,0.07)", border: "1.5px solid rgba(176,92,230,0.12)", color: "#B05CE6" }}>
                    <PenLine className="w-4 h-4" /> Edit
                  </button>

                  <button onClick={locked ? undefined : startSmartLock}
                    disabled={isLocking || lockPhase === "generating" || lockPhase === "analyzing"}
                    className="flex items-center justify-center gap-2 rounded-2xl text-[13px] font-bold text-white active:scale-[0.97] transition-transform disabled:opacity-60"
                    style={{
                      flex: 1, padding: "12px 0",
                      background: locked ? "#E8F5F0" : "linear-gradient(135deg, #B05CE6, #D45DA0)",
                      color: locked ? "#2FA482" : "white",
                      border: locked ? "1.5px solid rgba(67,184,156,0.2)" : "none",
                      boxShadow: locked ? "none" : "0 4px 16px rgba(176,92,230,0.25)",
                    }}>
                    {isLocking ? <Loader2 className="w-4 h-4 animate-spin" />
                      : locked ? <><Check className="w-4 h-4" /> Locked</>
                      : (lockPhase === "generating" || lockPhase === "analyzing") ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</>
                      : <><Lock className="w-4 h-4" /> Lock In</>}
                  </button>

                  {locked && (
                    <button onClick={() => {
                      fetch("/api/characters/unlock", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ characterId: char.id }),
                      }).then(() => { if (isMounted.current) setLocked(false); });
                    }}
                      className="flex items-center justify-center rounded-2xl text-[11px] font-semibold active:scale-95 transition-transform"
                      style={{ width: "36%", padding: "12px 0", background: "white", border: "1.5px solid rgba(67,184,156,0.2)", color: "#6B9E8A" }}>
                      <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* DRAWER PORTAL */}
      {mounted && createPortal(
        <DetailDrawer
          open={drawerOpen}
          char={char}
          storyId={storyId}
          imageState={imageState}
          isGenerating={lockPhase === "generating"}
          onClose={() => setDrawerOpen(false)}
          onSaved={(updates) => { setChar((prev) => ({ ...prev, ...updates })); onUpdate?.(); }}
          onGeneratePortrait={(mode) => { setDrawerOpen(false); generatePortrait(mode); }}
        />,
        document.body
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* IMAGE ZONE                                                          */
/* ------------------------------------------------------------------ */

function ImageZone({
  char, grad, imageState, isDragging, isBackgroundTask, badgeLabel,
  locked, onUpload, onChangePhoto, onGeneratePortrait, hasReference, onOpenDrawer,
}: {
  char: Character; grad: { from: string; to: string };
  imageState: "empty" | "reference" | "portrait";
  isDragging: boolean; isBackgroundTask: boolean; badgeLabel: string;
  locked: boolean; onUpload: () => void; onChangePhoto: () => void; onGeneratePortrait: () => void;
  hasReference: boolean;
onOpenDrawer: () => void;
}) {
  const displayImage = bestImage(char);
  const isAnimal = char.species && char.species !== "human";

  return (
    <div className="absolute inset-0 overflow-hidden">
      {displayImage ? (
        <img src={displayImage} alt={char.name} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
          {isAnimal
            ? <span style={{ fontSize: "5rem", opacity: 0.1 }}>🐾</span>
            : <span className="font-black text-white/10 select-none" style={{ fontSize: "clamp(5rem, 22vw, 8rem)" }}>{char.name.charAt(0)}</span>
          }
        </div>
      )}

      {/* State A — no image */}
      {imageState === "empty" && !isDragging && !isBackgroundTask && (
        <div className="absolute inset-0 flex items-center justify-center p-5">
          <div className="w-full rounded-2xl p-4 text-center"
            style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.25)" }}>
            <p className="text-white font-bold text-sm mb-0.5">{char.name} needs a face</p>
            <p className="text-white/70 text-[11px] mb-3">A photo makes illustrations more personal</p>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); onUpload(); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.92)", color: "#2D2235" }}>
                <Camera className="w-3.5 h-3.5" /> Add photo
              </button>
              <button onClick={(e) => { e.stopPropagation(); onGeneratePortrait(); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-white active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, rgba(176,92,230,0.9), rgba(212,93,160,0.9))", border: "1px solid rgba(255,255,255,0.2)" }}>
                <Sparkles className="w-3.5 h-3.5" /> AI imagine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* State B — has reference, needs portrait */}
{imageState === "reference" && !isDragging && !isBackgroundTask && !locked && (
  <button onClick={(e) => { e.stopPropagation(); onChangePhoto(); }}
    className="absolute top-12 right-3 z-20 text-[10px] font-semibold px-2.5 py-1 rounded-full active:scale-95 transition-transform"
    style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,0.8)" }}>
    Change photo
  </button>
)}

  {/* State C — has portrait */}
{imageState === "portrait" && !isDragging && !isBackgroundTask && !locked && (
  <>
    <button onClick={(e) => { e.stopPropagation(); onChangePhoto(); }}
      className="absolute top-12 right-3 z-20 text-[10px] font-semibold px-2.5 py-1 rounded-full active:scale-95 transition-transform"
      style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,0.75)" }}>
      Change
    </button>

    {/* Stale portrait warning — portrait was generated without the reference photo */}
    {(char as any).portraitSource === "description_only" && hasReference && (
      <div className="absolute bottom-14 left-4 right-4 z-30">
        <button
          onClick={(e) => { e.stopPropagation(); onOpenDrawer(); }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-semibold active:scale-[0.97] transition-transform"
          style={{
            background: "rgba(217,119,6,0.85)",
            backdropFilter: "blur(8px)",
            color: "white",
          }}
        >
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Portrait doesn't use your photo — tap Edit to regenerate
        </button>
      </div>
    )}
  </>
)}

      {/* Processing badge — non-blocking */}
      {isBackgroundTask && badgeLabel && (
        <div className="absolute bottom-14 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-full"
          style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}>
          <Loader2 className="w-3.5 h-3.5 text-white animate-spin flex-shrink-0" />
          <span className="text-[11px] font-semibold text-white">{badgeLabel}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CONFLICT UI                                                        */
/* ------------------------------------------------------------------ */

function ConflictUI({
  conflicts, resolutions, setResolutions, onConfirm, onCancel,
}: {
  conflicts: VisionConflict[];
  resolutions: Record<string, "extracted" | "photo">;
  setResolutions: React.Dispatch<React.SetStateAction<Record<string, "extracted" | "photo">>>;
  onConfirm: () => void; onCancel: () => void;
}) {
  const allResolved = conflicts.length > 0 && conflicts.every((c) => resolutions[c.field]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 py-4 space-y-3" style={{ background: "#FDFBFF" }}>
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <p className="text-sm font-bold" style={{ color: "#2D2235" }}>Photo doesn't match story</p>
      </div>
      <p className="text-[12px]" style={{ color: "#7B6E90" }}>Which is correct?</p>

      {conflicts.map((c) => (
        <div key={c.field} className="rounded-2xl p-3 space-y-2" style={{ background: "white", border: "1.5px solid rgba(180,150,210,0.12)" }}>
          <p className="text-[11px] font-bold" style={{ color: "#6B5C80" }}>{c.question}</p>
          {(["extracted", "photo"] as const).map((choice) => (
            <button key={choice} onClick={() => setResolutions((p) => ({ ...p, [c.field]: choice }))}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[12px] transition-all"
              style={{
                background: resolutions[c.field] === choice
                  ? choice === "extracted" ? "rgba(176,92,230,0.08)" : "rgba(67,184,156,0.08)"
                  : "rgba(249,245,255,0.5)",
                border: resolutions[c.field] === choice
                  ? choice === "extracted" ? "1.5px solid rgba(176,92,230,0.25)" : "1.5px solid rgba(67,184,156,0.25)"
                  : "1.5px solid rgba(180,150,210,0.1)",
                color: "#2D2235",
              }}>
              {choice === "extracted"
                ? <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-purple-400" />
                : <Camera className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />}
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold block" style={{ color: "#A897BD" }}>
                  {choice === "extracted" ? "Story says:" : "Photo shows:"}
                </span>
                <span className="font-semibold">{choice === "extracted" ? c.extracted : c.photo}</span>
              </div>
              {resolutions[c.field] === choice && <Check className="w-4 h-4 flex-shrink-0 text-emerald-500" />}
            </button>
          ))}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-[12px] font-semibold"
          style={{ border: "1.5px solid rgba(180,150,210,0.15)", color: "#6B5C80", background: "white" }}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={!allResolved}
          className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 3px 12px rgba(176,92,230,0.2)" }}>
          Generate Portrait
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DETAIL DRAWER                                                      */
/* Portrait section at top — outfit mode selection lives here         */
/* ------------------------------------------------------------------ */

function DetailDrawer({
  open, char, storyId, imageState, isGenerating, onClose, onSaved, onGeneratePortrait,
}: {
  open: boolean; char: Character; storyId: string;
  imageState: "empty" | "reference" | "portrait";
  isGenerating: boolean; onClose: () => void;
  onSaved: (updates: Partial<Character>) => void;
  onGeneratePortrait: (mode?: "story" | "reference") => void;
}) {
  const [name, setName] = useState(char.name);
  const [description, setDescription] = useState(char.description || "");
  const [appearance, setAppearance] = useState(char.appearance || "");
  const [traits, setTraits] = useState(char.personalityTraits || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(char.name);
    setDescription(char.description || "");
    setAppearance(char.appearance || "");
    setTraits(char.personalityTraits || "");
  }, [char]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/characters/${char.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, appearance, personalityTraits: traits }),
      });
      onSaved({ name, description, appearance, personalityTraits: traits });
      onClose();
    } finally { setSaving(false); }
  }

  const outfits = char.outfits || [];
  const isAnimal = char.species && char.species !== "human";
  const animalProfile = (char.visualDetails as any)?.animalProfile;
  const hasReference = !!(char.referenceImageUrl || char.fullBodyImageUrl);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="bd" className="fixed inset-0 z-[99]" style={{ background: "rgba(0,0,0,0.5)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />

          <motion.div key="sh" className="fixed bottom-0 left-0 right-0 z-[100] rounded-t-3xl overflow-hidden flex flex-col"
            style={{ background: "white", maxHeight: "88vh", fontFamily: FONT, boxShadow: "0 -8px 40px rgba(100,60,140,0.15)" }}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0 border-b" style={{ borderColor: "rgba(180,150,210,0.1)" }}>
              <div>
                <h3 className="text-base font-extrabold" style={{ color: "#2D2235" }}>{char.name}</h3>
                <p className="text-[11px]" style={{ color: "#A897BD" }}>Edit details · portrait options</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(180,150,210,0.1)", color: "#8B7BA0" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* ── PORTRAIT SECTION ── */}
              {!char.locked && (
                <div>
                  <p className="text-[10px] font-bold uppercase mb-2.5" style={{ color: "#A897BD", letterSpacing: "0.08em" }}>
                    ✨ Portrait
                  </p>

                  {/* Current portrait thumbnail */}
                  {char.portraitImageUrl && (
                    <div className="flex items-center gap-3 mb-3 p-2.5 rounded-2xl"
                      style={{ background: "rgba(180,150,210,0.05)", border: "1px solid rgba(180,150,210,0.1)" }}>
                      <img src={char.portraitImageUrl} alt={char.name}
                        className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                        style={{ border: "1.5px solid rgba(180,150,210,0.15)" }} />
                      <div>
                        <p className="text-[12px] font-semibold" style={{ color: "#2D2235" }}>Current portrait</p>
                        <p className="text-[10px]" style={{ color: "#A897BD" }}>Regenerate below to change</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {/* Story outfit button — always available */}
                    <button onClick={() => onGeneratePortrait("story")} disabled={isGenerating}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white active:scale-[0.97] transition-transform disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 3px 14px rgba(176,92,230,0.2)" }}>
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Sparkles className="w-4 h-4 flex-shrink-0" />}
                      <div className="text-left">
                        <span className="text-[13px] font-bold block">
                          {imageState === "empty" ? "Generate from description"
                            : char.portraitImageUrl ? "Regenerate · story outfit"
                            : "Create portrait · story outfit"}
                        </span>
                        <span className="text-[10px] opacity-75">AI designs the outfit from the story</span>
                      </div>
                    </button>

                    {/* Reference photo outfit — only if has reference image */}
                    {hasReference && (
                      <button onClick={() => onGeneratePortrait("reference")} disabled={isGenerating}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-[0.97] transition-transform disabled:opacity-50"
                        style={{ background: "white", border: "1.5px solid rgba(180,150,210,0.2)", color: "#6B5C80" }}>
                        <Camera className="w-4 h-4 flex-shrink-0" />
                        <div className="text-left">
                          <span className="text-[13px] font-semibold block">
                            {char.portraitImageUrl ? "Regenerate · keep photo outfit" : "Create portrait · keep photo outfit"}
                          </span>
                          <span className="text-[10px] opacity-60">Uses the outfit from the uploaded photo</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: "rgba(180,150,210,0.1)" }} />

              {/* Name */}
              <Field label="Name">
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ border: "1.5px solid rgba(180,150,210,0.18)", background: "#FDFBFF", color: "#2D2235", fontFamily: FONT }} />
              </Field>

              {/* Description */}
              <Field label="Description" hint="Who are they, what drives them?">
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none resize-none"
                  style={{ border: "1.5px solid rgba(180,150,210,0.18)", background: "#FDFBFF", color: "#2D2235", fontFamily: FONT }}
                  placeholder="A curious toddler who loves exploring..." />
              </Field>

              {/* Appearance */}
              <Field label="Appearance" hint="Hair, eyes, build, features">
                <textarea value={appearance} onChange={(e) => setAppearance(e.target.value)} rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none resize-none"
                  style={{ border: "1.5px solid rgba(180,150,210,0.18)", background: "#FDFBFF", color: "#2D2235", fontFamily: FONT }}
                  placeholder="Brown curly hair, bright green eyes..." />
              </Field>

              {/* Personality traits */}
              <Field label="Personality traits" hint="Comma-separated">
                <input value={traits} onChange={(e) => setTraits(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ border: "1.5px solid rgba(180,150,210,0.18)", background: "#FDFBFF", color: "#2D2235", fontFamily: FONT }}
                  placeholder="curious, brave, funny" />
              </Field>

              {/* Animal profile */}
              {isAnimal && animalProfile && (
                <div>
                  <p className="text-[10px] font-bold uppercase mb-2" style={{ color: "#A897BD", letterSpacing: "0.08em" }}>Animal details</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(animalProfile).filter(([, v]) => v).map(([k, v]) => (
                      <div key={k} className="rounded-lg px-2.5 py-2" style={{ background: "rgba(200,180,220,0.05)", border: "1px solid rgba(180,150,210,0.06)" }}>
                        <span className="text-[9px] font-bold uppercase block" style={{ color: "#A897BD" }}>{fmt(k)}</span>
                        <span className="text-[11px] font-semibold" style={{ color: "#5A4D6B" }}>{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Outfits read-only */}
              {outfits.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase mb-2" style={{ color: "#A897BD", letterSpacing: "0.08em" }}>
                    <Shirt className="w-3 h-3 inline mr-1" style={{ verticalAlign: "-1px" }} />
                    {outfits.length} story outfit{outfits.length !== 1 ? "s" : ""}
                  </p>
                  <div className="space-y-1.5">
                    {outfits.map((o) => (
                      <div key={o.id} className="rounded-xl p-2.5" style={{ background: "rgba(200,180,220,0.05)", border: "1px solid rgba(180,150,210,0.06)" }}>
                        <span className="text-[10px] font-bold" style={{ color: "#6B5C80" }}>{fmt(o.outfitKey)}</span>
                        <p className="text-[11px] mt-0.5" style={{ color: "#8B7BA0" }}>{o.outfitDescription}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ height: "env(safe-area-inset-bottom, 8px)" }} />
            </div>

            {/* Save bar */}
            <div className="flex-shrink-0 px-5 py-4 border-t"
              style={{ borderColor: "rgba(180,150,210,0.1)", background: "rgba(253,251,255,0.95)", backdropFilter: "blur(12px)" }}>
              <div className="flex gap-2.5">
                <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-[13px] font-semibold"
                  style={{ border: "1.5px solid rgba(180,150,210,0.15)", background: "white", color: "#6B5C80" }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-[2] py-3 rounded-2xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 16px rgba(176,92,230,0.2)" }}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* FIELD                                                              */
/* ------------------------------------------------------------------ */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-1.5">
        <label className="text-[11px] font-bold" style={{ color: "#6B5C80" }}>{label}</label>
        {hint && <span className="text-[10px]" style={{ color: "#B8A5D0" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}