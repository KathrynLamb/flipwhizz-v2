"use client";

// MobileLocationCard.tsx — v2
// Clear two-path UX: upload photo (AI illustrates it) vs generate from description

import React, { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  motion, useMotionValue, useTransform, useAnimationControls,
  AnimatePresence, type PanInfo,
} from "framer-motion";
import {
  Lock, Unlock, Loader2, X, Check, Sparkles, Camera,
  AlertTriangle, RotateCcw, PenLine, MapPin, ChevronDown, ArrowRight,
} from "lucide-react";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebaseClient";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

export type Location = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  portraitImageUrl: string | null;
  locked: boolean;
  portraitSource?: string | null;
};

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                           */
/* ------------------------------------------------------------------ */

const CARD_GRADIENTS = [
  { from: "#f59e0b", to: "#ef4444" },
  { from: "#ec4899", to: "#8b5cf6" },
  { from: "#8b5cf6", to: "#06b6d4" },
  { from: "#06b6d4", to: "#10b981" },
  { from: "#84cc16", to: "#06b6d4" },
  { from: "#f59e0b", to: "#ec4899" },
];
const LOCATION_EMOJIS = ["🏰", "🌳", "🏔️", "🏖️", "🌆", "🎪", "🏡", "🌋"];
const FONT = "'Bricolage Grotesque', system-ui, sans-serif";
const SWIPE_HINT_KEY = "fw_location_swipe_hint_v1";

type Phase = "idle" | "generating" | "locking" | "done";

/* ------------------------------------------------------------------ */
/* MAIN CARD                                                           */
/* ------------------------------------------------------------------ */

export function MobileLocationCard({
  storyId,
  location,
  index,
  onSwiped,
  onUpdate,
}: {
  storyId: string;
  location: Location;
  index: number;
  onSwiped?: (id: string) => void;
  onUpdate?: () => void;
}) {
  const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const emoji = LOCATION_EMOJIS[index % LOCATION_EMOJIS.length];

  const [loc, setLoc] = useState(location);
  const [locked, setLocked] = useState(location.locked);
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [lockError, setLockError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mounted, setMounted] = useState(false);

  const controls = useAnimationControls();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-12, 0, 12]);
  const editOpacity = useTransform(x, [-120, -30, 0], [1, 0.3, 0]);
  const lockOpacity = useTransform(x, [0, 30, 120], [0, 0.3, 1]);

  const isMounted = useRef(true);
  useEffect(() => { setMounted(true); return () => { isMounted.current = false; }; }, []);
  useEffect(() => { setLoc(location); setLocked(location.locked); }, [location]);

  // One-time swipe hint
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

  const imageState: "empty" | "reference" | "portrait" = useMemo(() => {
    if (loc.portraitImageUrl) return "portrait";
    if (loc.referenceImageUrl) return "reference";
    return "empty";
  }, [loc.portraitImageUrl, loc.referenceImageUrl]);

  const hasReference = !!loc.referenceImageUrl;
  const isBackgroundTask = isUploading || isValidating || phase === "generating";
  const isLocking = phase === "locking";
  const hasStalePortrait = imageState === "portrait" && hasReference && loc.portraitSource === "description_only";

  function badgeLabel(): string {
    if (isUploading) return "Uploading photo… swipe to continue";
    if (isValidating) return "Checking photo… swipe to continue";
    if (phase === "generating") return "Creating illustration… swipe to continue";
    return "";
  }

  /* ── Upload ── */
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
          await fetch("/api/locations/unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ locationId: loc.id }),
          });
          if (isMounted.current) setLocked(false);
        }
  
        let uploadFile = file;
        if (/\.heic$/i.test(file.name) || file.type === "image/heic") {
          const heic2any = (await import("heic2any")).default;
          const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
          uploadFile = new File([blob as Blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
        }
  
        const path = `story-references/${storyId}/locations/${crypto.randomUUID()}-${uploadFile.name}`;
        const sRef = storageRef(storage, path);
        await uploadBytes(sRef, uploadFile, { contentType: uploadFile.type });
        const publicUrl = await getDownloadURL(sRef);
  
        if (isMounted.current) { setIsUploading(false); setIsValidating(true); }
  
        const validationRes = await fetch("/api/locations/validate-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: publicUrl, locationName: loc.name }),
        }).catch(() => null);
        const validation = validationRes?.ok ? await validationRes.json() : { valid: true };
  
        if (!validation.valid) {
          if (isMounted.current) setUploadError(validation.message || "Photo not suitable — try a clear location photo");
          return;
        }
  
        const res = await fetch("/api/locations/upload-reference", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId: loc.id, imageUrl: publicUrl, storagePath: path }),
        });
  
        if (res.ok && isMounted.current) {
          const data = await res.json();
          setLoc((prev) => ({ ...prev, referenceImageUrl: data.url }));
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
        generatePortrait("reference", false, unlockFirst);
      }
    };
  
    input.addEventListener("cancel", () => document.body.removeChild(input));
    input.click();
  }

  /* ── Generate ── */
  async function generatePortrait(mode?: "reference" | "description", shouldLockAfter = false, force = false) {
    if (locked && !force) return;
    setPhase("generating");
    try {
      const res = await fetch("/api/locations/use-ai-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.id, mode: mode ?? (hasReference ? "reference" : "description") }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (isMounted.current && data.url) {
        setLoc((prev) => ({ ...prev, portraitImageUrl: data.url, portraitSource: data.usedReference ? "reference_photo" : "description_only" }));
      }
      onUpdate?.();
      if (shouldLockAfter && isMounted.current) { await doLock(); }
      else if (isMounted.current) { setPhase("idle"); }
    } catch { if (isMounted.current) { setLockError("Illustration failed"); setPhase("idle"); } }
  }

  /* ── Lock ── */
  async function startLock() {
    if (locked || phase !== "idle") return;
    setLockError(null);
    if (loc.portraitImageUrl) { await doLock(); return; }
    await generatePortrait(hasReference ? "reference" : "description", true);
  }

  async function doLock() {
    setPhase("locking");
    try {
      const res = await fetch("/api/locations/lock", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: loc.id }),
      });
      if (!res.ok) throw new Error();
      if (isMounted.current) { setLocked(true); setPhase("done"); }
      await controls.start({ x: 650, rotate: 20, opacity: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] } });
      onSwiped?.(loc.id);
    } catch { if (isMounted.current) { setLockError("Failed to lock — tap retry"); setPhase("idle"); } }
  }

  /* ── Drag ── */
  async function handleDragEnd(_: any, info: PanInfo) {
    setIsDragging(false);
    const T = 70, V = 400;
    const right = info.offset.x > T || info.velocity.x > V;
    const left = info.offset.x < -T || info.velocity.x < -V;

    if (right) {
      if (isUploading || isValidating || phase === "generating") {
        await controls.start({ x: 650, rotate: 20, opacity: 0, transition: { duration: 0.3 } });
        onSwiped?.(loc.id); return;
      }
      if (loc.portraitImageUrl) {
        await controls.start({ x: 650, rotate: 20, opacity: 0, transition: { duration: 0.3 } });
        fetch("/api/locations/lock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: loc.id }) })
          .then(() => { if (isMounted.current) setLocked(true); });
        onSwiped?.(loc.id); return;
      }
      await controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      startLock(); return;
    }
    if (left) {
      await controls.start({ x: -60, rotate: -4, transition: { duration: 0.12 } });
      await controls.start({ x: 0, rotate: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
      setDrawerOpen(true); return;
    }
    await controls.start({ x: 0, rotate: 0, opacity: 1, transition: { type: "spring", stiffness: 400, damping: 30 } });
  }

  const dragDisabled = phase === "locking" || drawerOpen;
  const displayImage = loc.portraitImageUrl || loc.referenceImageUrl;

  return (
    <>
      <motion.div
        animate={controls} drag={dragDisabled ? false : "x"}
        dragConstraints={{ left: 0, right: 0 }} dragDirectionLock dragElastic={0.12} dragMomentum={false}
        onDragStart={() => setIsDragging(true)} onDragEnd={handleDragEnd}
        style={{ x, rotate, fontFamily: FONT, touchAction: "none" }}
        className="w-full h-full select-none">

        <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white flex flex-col">

          {/* IMAGE ZONE */}
          <div className="relative flex-shrink-0 overflow-hidden" style={{ height: "55%" }}>

            {/* Background */}
            {displayImage ? (
              <img src={displayImage} alt={loc.name} className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="w-full h-full flex items-center justify-center relative"
                style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
                <span className="font-black text-white/10 select-none" style={{ fontSize: "clamp(5rem, 22vw, 8rem)" }}>{loc.name.charAt(0)}</span>
                <motion.div animate={{ y: [0, -16, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute text-7xl opacity-20 pointer-events-none">{emoji}</motion.div>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent pointer-events-none" />

            {/* Swipe overlays */}
            <motion.div style={{ opacity: editOpacity }} className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute top-8 left-5 px-4 py-2 rounded-2xl"
                style={{ background: "rgba(139,92,246,0.92)", border: "3px solid white", transform: "rotate(-18deg)", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
                <span className="text-white font-extrabold text-xl tracking-wide">EDIT</span>
              </div>
            </motion.div>
            <motion.div style={{ opacity: lockOpacity }} className="absolute inset-0 z-20 pointer-events-none">
              <div className="absolute top-8 right-5 px-4 py-2 rounded-2xl"
                style={{ background: "rgba(16,185,129,0.92)", border: "3px solid white", transform: "rotate(18deg)", boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}>
                <span className="text-white font-extrabold text-xl tracking-wide">LOCK ✓</span>
              </div>
            </motion.div>

            {/* ── STATE A: no image — explain both paths clearly ── */}
            {imageState === "empty" && !isDragging && !isBackgroundTask && (
              <div className="absolute inset-0 flex flex-col justify-end p-4 z-10">
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,0.22)" }}>

                  {/* Option 1: Upload photo */}
                  <button onClick={(e) => { e.stopPropagation(); triggerUpload(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/10 transition-colors"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(255,255,255,0.9)" }}>
                      <Camera className="w-4 h-4" style={{ color: "#8B5CF6" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-white leading-tight">Upload a photo</p>
                      <p className="text-[10px] text-white/65 leading-snug mt-0.5">AI illustrates it in your book's style</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
                  </button>

                  {/* Option 2: Generate from description */}
                  <button onClick={(e) => { e.stopPropagation(); generatePortrait("description"); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-white/10 transition-colors">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.85), rgba(217,70,239,0.85))" }}>
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-white leading-tight">Generate from description</p>
                      <p className="text-[10px] text-white/65 leading-snug mt-0.5">No photo needed — AI imagines the scene</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
                  </button>
                </div>
              </div>
            )}

            {/* ── STATE B: has reference, needs illustration ── */}
            {imageState === "reference" && !isDragging && !isBackgroundTask && !locked && (
              <button onClick={(e) => { e.stopPropagation(); triggerUpload(locked); }}
                className="absolute top-12 right-3 z-20 text-[10px] font-semibold px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,0.8)" }}>
                Change photo
              </button>
            )}

            {/* ── STATE C: has portrait ── */}
            {imageState === "portrait" && !isDragging && !isBackgroundTask && !locked && (
              <>
                <button onClick={(e) => { e.stopPropagation(); triggerUpload(locked); }}
                  className="absolute top-12 right-3 z-20 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,0.75)" }}>
                  Change
                </button>
                {hasStalePortrait && (
                  <div className="absolute bottom-14 left-4 right-4 z-30">
                    <button onClick={(e) => { e.stopPropagation(); setDrawerOpen(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-semibold active:scale-[0.97] transition-transform"
                      style={{ background: "rgba(217,119,6,0.85)", backdropFilter: "blur(8px)", color: "white" }}>
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Illustration doesn't use your photo — tap Edit to regenerate
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Processing badge */}
            {isBackgroundTask && badgeLabel() && (
              <div className="absolute bottom-14 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-full"
                style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}>
                <Loader2 className="w-3.5 h-3.5 text-white animate-spin flex-shrink-0" />
                <span className="text-[11px] font-semibold text-white">{badgeLabel()}</span>
              </div>
            )}

            {/* Status badge */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{
                background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
                color: locked ? "#2FA482" : imageState === "portrait" ? "#2FA482" : imageState === "reference" ? "#8B5CF6" : "#D97706",
              }}>
              {locked && <Lock className="w-2.5 h-2.5" />}
              {locked ? "Locked" : imageState === "portrait" ? "Ready" : imageState === "reference" ? "Needs illustration" : "Needs image"}
            </div>
          </div>

          {/* BODY */}
          <div className="flex-1 flex flex-col min-h-0" style={{ background: "#FDFBFF" }}>
            {/* Name row — moved out of the image zone so it never collides
                with the upload/generate choice panel on long location names.
                Previously both were bottom-anchored inside the same 55%
                image zone, overlapping when combined content exceeded that
                height. */}
            <div className="flex-shrink-0 flex items-center gap-2 px-4 pt-3.5 pb-1">
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: "#B8A5D0" }} />
              <h2 className="text-lg font-extrabold leading-tight" style={{ color: "#2D2235" }}>
                {loc.name}
              </h2>
            </div>

            <div className="flex-1 px-4 pt-1 pb-1 flex flex-col justify-center min-h-0 overflow-hidden">

              <AnimatePresence>
                {uploadError && (
                  <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
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
                  <button onClick={() => { setLockError(null); startLock(); }} className="ml-auto flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Retry
                  </button>
                </div>
              )}

              {loc.description && (
                <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: "#5A4D6B" }}>{loc.description}</p>
              )}

              <button onClick={() => setDrawerOpen(true)}
                className="mt-1.5 self-start flex items-center gap-1 text-[10px] font-semibold"
                style={{ color: "#B8A5D0", background: "none", border: "none", cursor: "pointer" }}>
                <ChevronDown className="w-3 h-3" /> See full details
              </button>
            </div>

            {/* Action bar */}
            <div className="flex-shrink-0 px-4 pb-5 pt-2">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <span className="text-[10px] font-medium" style={{ color: "rgba(180,150,210,0.5)" }}>← swipe to edit</span>
                <div className="flex gap-1.5">{[0,1,2].map(i => <div key={i} className="w-1 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />)}</div>
                <span className="text-[10px] font-medium" style={{ color: "rgba(180,150,210,0.5)" }}>lock in →</span>
              </div>

              <div className="flex gap-2.5">
                <button onClick={() => setDrawerOpen(true)}
                  className="flex items-center justify-center gap-1.5 rounded-2xl text-[12px] font-semibold active:scale-95 transition-transform"
                  style={{ width: "36%", padding: "12px 0", background: "rgba(139,92,246,0.07)", border: "1.5px solid rgba(139,92,246,0.12)", color: "#8B5CF6" }}>
                  <PenLine className="w-4 h-4" /> Edit
                </button>

                <button onClick={locked ? undefined : startLock}
                  disabled={isLocking || phase === "generating"}
                  className="flex items-center justify-center gap-2 rounded-2xl text-[13px] font-bold text-white active:scale-[0.97] transition-transform disabled:opacity-60"
                  style={{
                    flex: 1, padding: "12px 0",
                    background: locked ? "#E8F5F0" : "linear-gradient(135deg, #8B5CF6, #D946EF)",
                    color: locked ? "#2FA482" : "white",
                    border: locked ? "1.5px solid rgba(67,184,156,0.2)" : "none",
                    boxShadow: locked ? "none" : "0 4px 16px rgba(139,92,246,0.25)",
                  }}>
                  {isLocking ? <Loader2 className="w-4 h-4 animate-spin" />
                    : locked ? <><Check className="w-4 h-4" /> Locked</>
                    : phase === "generating" ? <><Loader2 className="w-4 h-4 animate-spin" /> Working…</>
                    : <><Lock className="w-4 h-4" /> Lock In</>}
                </button>

                {locked && (
                  <button onClick={() => {
                    fetch("/api/locations/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locationId: loc.id }) })
                      .then(() => { if (isMounted.current) setLocked(false); });
                  }}
                    className="flex items-center justify-center rounded-2xl text-[11px] font-semibold active:scale-95 transition-transform"
                    style={{ width: "36%", padding: "12px 0", background: "white", border: "1.5px solid rgba(67,184,156,0.2)", color: "#6B9E8A" }}>
                    <Unlock className="w-3.5 h-3.5 mr-1" /> Unlock
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* DRAWER */}
      {mounted && createPortal(
        <LocationDrawer
          open={drawerOpen} loc={loc} imageState={imageState} hasReference={hasReference}
          isGenerating={phase === "generating"}
          onClose={() => setDrawerOpen(false)}
          onSaved={(updates) => { setLoc((prev) => ({ ...prev, ...updates })); onUpdate?.(); }}
          onGeneratePortrait={(mode) => { setDrawerOpen(false); generatePortrait(mode); }}
        />,
        document.body
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* DRAWER                                                              */
/* ------------------------------------------------------------------ */

function LocationDrawer({ open, loc, imageState, hasReference, isGenerating, onClose, onSaved, onGeneratePortrait }: {
  open: boolean; loc: Location; imageState: "empty" | "reference" | "portrait";
  hasReference: boolean; isGenerating: boolean; onClose: () => void;
  onSaved: (updates: Partial<Location>) => void;
  onGeneratePortrait: (mode?: "reference" | "description") => void;
}) {
  const [name, setName] = useState(loc.name);
  const [description, setDescription] = useState(loc.description || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setName(loc.name); setDescription(loc.description || ""); }, [loc]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/locations/${loc.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      onSaved({ name, description }); onClose();
    } finally { setSaving(false); }
  }

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

            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />
            </div>

            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0 border-b" style={{ borderColor: "rgba(180,150,210,0.1)" }}>
              <div>
                <h3 className="text-base font-extrabold" style={{ color: "#2D2235" }}>{loc.name}</h3>
                <p className="text-[11px]" style={{ color: "#A897BD" }}>Edit details · illustration options</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "rgba(180,150,210,0.1)", color: "#8B7BA0" }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* Illustration section */}
              {!loc.locked && (
                <div>
                  <p className="text-[10px] font-bold uppercase mb-2.5" style={{ color: "#A897BD", letterSpacing: "0.08em" }}>
                    ✨ Illustration
                  </p>

                  {loc.portraitImageUrl && (
                    <div className="flex items-center gap-3 mb-3 p-2.5 rounded-2xl"
                      style={{ background: "rgba(180,150,210,0.05)", border: "1px solid rgba(180,150,210,0.1)" }}>
                      <img src={loc.portraitImageUrl} alt={loc.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                        style={{ border: "1.5px solid rgba(180,150,210,0.15)" }} />
                      <div>
                        <p className="text-[12px] font-semibold" style={{ color: "#2D2235" }}>Current illustration</p>
                        <p className="text-[10px]" style={{ color: "#A897BD" }}>Regenerate below to change</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <button onClick={() => onGeneratePortrait("description")} disabled={isGenerating}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-white active:scale-[0.97] transition-transform disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #8B5CF6, #D946EF)", boxShadow: "0 3px 14px rgba(139,92,246,0.2)" }}>
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Sparkles className="w-4 h-4 flex-shrink-0" />}
                      <div className="text-left">
                        <span className="text-[13px] font-bold block">
                          {imageState === "empty" ? "Generate from description" : loc.portraitImageUrl ? "Regenerate from description" : "Create from description"}
                        </span>
                        <span className="text-[10px] opacity-75">AI imagines the scene from story text</span>
                      </div>
                    </button>

                    {hasReference && (
                      <button onClick={() => onGeneratePortrait("reference")} disabled={isGenerating}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:scale-[0.97] transition-transform disabled:opacity-50"
                        style={{ background: "white", border: "1.5px solid rgba(180,150,210,0.2)", color: "#6B5C80" }}>
                        <Camera className="w-4 h-4 flex-shrink-0" />
                        <div className="text-left">
                          <span className="text-[13px] font-semibold block">
                            {loc.portraitImageUrl ? "Regenerate from reference photo" : "Illustrate from reference photo"}
                          </span>
                          <span className="text-[10px] opacity-60">Styled book art based on your uploaded photo</span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ height: 1, background: "rgba(180,150,210,0.1)" }} />

              <div>
                <label className="text-[11px] font-bold block mb-1.5" style={{ color: "#6B5C80" }}>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none"
                  style={{ border: "1.5px solid rgba(180,150,210,0.18)", background: "#FDFBFF", color: "#2D2235", fontFamily: FONT }} />
              </div>

              <div>
                <label className="text-[11px] font-bold block mb-0.5" style={{ color: "#6B5C80" }}>Description</label>
                <p className="text-[10px] mb-1.5" style={{ color: "#B8A5D0" }}>Setting, atmosphere, key features</p>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                  className="w-full px-3.5 py-2.5 rounded-xl text-[13px] outline-none resize-none"
                  style={{ border: "1.5px solid rgba(180,150,210,0.18)", background: "#FDFBFF", color: "#2D2235", fontFamily: FONT }}
                  placeholder="A cosy living room with warm lighting…" />
              </div>

              <div style={{ height: "env(safe-area-inset-bottom, 8px)" }} />
            </div>

            <div className="flex-shrink-0 px-5 py-4 border-t"
              style={{ borderColor: "rgba(180,150,210,0.1)", background: "rgba(253,251,255,0.95)", backdropFilter: "blur(12px)" }}>
              <div className="flex gap-2.5">
                <button onClick={onClose} className="flex-1 py-3 rounded-2xl text-[13px] font-semibold"
                  style={{ border: "1.5px solid rgba(180,150,210,0.15)", background: "white", color: "#6B5C80" }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-[2] py-3 rounded-2xl text-[13px] font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #D946EF)", boxShadow: "0 4px 16px rgba(139,92,246,0.2)" }}>
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