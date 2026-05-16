// src/app/stories/[id]/locations/components/LocationCard.tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2, MapPin, Lock, Unlock, Loader2,
  Sparkles, X, Check, PenLine, Camera, ArrowRight,
} from "lucide-react";

type Location = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  portraitImageUrl: string | null;
  locked: boolean;
};

const GRADIENTS = [
  { from: "#f59e0b", to: "#ef4444" },
  { from: "#ec4899", to: "#8b5cf6" },
  { from: "#8b5cf6", to: "#06b6d4" },
  { from: "#06b6d4", to: "#10b981" },
  { from: "#84cc16", to: "#06b6d4" },
  { from: "#f59e0b", to: "#ec4899" },
];

/* ------------------------------------------------------------------ */
/* IMAGE STATE                                                         */
/* empty     → no image at all → show both options with explanations  */
/* reference → has photo, no portrait → show "Illustrate from photo"  */
/* portrait  → has final illustration → show it                       */
/* ------------------------------------------------------------------ */

export default function LocationCard({
  location,
  storyId,
  index = 0,
  onUpdate,
  onDelete,
  onLockToggle,
}: {
  location: Location;
  storyId: string;
  index?: number;
  onUpdate?: () => void;
  onDelete?: (id: string) => void;
  onLockToggle?: (id: string, locked: boolean) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const grad = GRADIENTS[index % GRADIENTS.length];

  const [locked, setLocked] = useState(location.locked);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editDesc, setEditDesc] = useState(location.description || "");
  const [currentLoc, setCurrentLoc] = useState(location);

  const imageState: "empty" | "reference" | "portrait" =
    currentLoc.portraitImageUrl ? "portrait"
    : currentLoc.referenceImageUrl ? "reference"
    : "empty";

  const displayImage = currentLoc.portraitImageUrl || currentLoc.referenceImageUrl;
  const busy = uploading || generating;

  /* ── Upload reference photo ── */
  async function uploadReference(file: File) {
    if (locked) return;
    setUploading(true);
    try {
      let uploadFile = file;
      if (/\.heic$/i.test(file.name) || file.type === "image/heic") {
        const heic2any = (await import("heic2any")).default;
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
        uploadFile = new File([blob as Blob], file.name.replace(/\.heic$/i, ".jpg"), { type: "image/jpeg" });
      }

      const { ref: storageRefFn, uploadBytes, getDownloadURL } = await import("firebase/storage");
      const { storage } = await import("@/lib/firebaseClient");
      const path = `story-references/${storyId}/locations/${crypto.randomUUID()}-${uploadFile.name}`;
      const sRef = storageRefFn(storage, path);
      await uploadBytes(sRef, uploadFile, { contentType: uploadFile.type });
      const publicUrl = await getDownloadURL(sRef);

      const res = await fetch("/api/locations/upload-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id, imageUrl: publicUrl, storagePath: path }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentLoc((prev) => ({ ...prev, referenceImageUrl: data.url ?? publicUrl }));
        onUpdate?.();
        router.refresh();
      }
    } catch (err) {
      console.error("Location upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  /* ── Generate AI illustration ── */
  async function generateIllustration(mode: "reference" | "description") {
    if (locked) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/locations/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id, mode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) setCurrentLoc((prev) => ({ ...prev, portraitImageUrl: data.url }));
        onUpdate?.();
        router.refresh();
      }
    } finally {
      setGenerating(false);
    }
  }

  /* ── Lock / unlock ── */
  async function toggleLock() {
    const res = await fetch("/api/locations/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: location.id }),
    });
    if (res.ok) {
      const data = await res.json();
      setLocked(data.locked);
      onLockToggle?.(location.id, data.locked);
      onUpdate?.();
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${location.name}? This cannot be undone.`)) return;
    setDeleting(true);
    onDelete?.(location.id);
    await fetch(`/api/locations/${location.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function saveEdit() {
    const res = await fetch("/api/locations/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: location.id, description: editDesc.trim() }),
    });
    if (res.ok) {
      setCurrentLoc((prev) => ({ ...prev, description: editDesc.trim() }));
      setShowEdit(false);
      onUpdate?.();
    }
  }

  /* ---------------------------------------------------------------- */
  /* RENDER                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => e.target.files && uploadReference(e.target.files[0])} />

      <div className="group relative overflow-hidden transition-all duration-300"
        style={{
          background: "white",
          borderRadius: 22,
          border: locked ? "2px solid rgba(67,184,156,0.25)" : "1px solid rgba(180,150,210,0.1)",
          boxShadow: "0 2px 8px rgba(100,60,140,0.04), 0 12px 40px rgba(100,60,140,0.06)",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}>

        {/* Locked badge */}
        {locked && (
          <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)", color: "#2FA482", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: "#43B89C" }} />
            Locked
          </div>
        )}

        {/* ── IMAGE AREA ── */}
        <div className="relative overflow-hidden" style={{ minHeight: 200 }}>

          {/* ── STATE: EMPTY — no image at all ── */}
          {imageState === "empty" && !busy && (
            <div className="p-5" style={{ background: `linear-gradient(135deg, ${grad.from}18, ${grad.to}10)` }}>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4" style={{ color: grad.from }} />
                <h3 className="text-lg font-extrabold" style={{ color: "#2D2235" }}>{currentLoc.name}</h3>
              </div>

              <p className="text-[12px] font-semibold mb-4" style={{ color: "#7B6E90" }}>
                How do you want to add the scene image?
              </p>

              {/* Option 1 — Upload photo */}
              <button onClick={() => fileRef.current?.click()}
                className="w-full flex items-start gap-3 p-3.5 rounded-2xl mb-2.5 text-left active:scale-[0.98] transition-all group/btn"
                style={{ background: "white", border: "1.5px solid rgba(180,150,210,0.2)", boxShadow: "0 2px 8px rgba(100,60,140,0.04)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "rgba(139,92,246,0.08)" }}>
                  <Camera className="w-4.5 h-4.5" style={{ color: "#8B5CF6", width: 18, height: 18 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: "#2D2235" }}>Upload a photo</p>
                  <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: "#8B7BA0" }}>
                    Add a real photo of the place — AI turns it into illustrated book art to match your style
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 flex-shrink-0 mt-2 opacity-30 group-hover/btn:opacity-70 transition-opacity" style={{ color: "#8B5CF6" }} />
              </button>

              {/* Option 2 — AI from description */}
              <button onClick={() => generateIllustration("description")}
                className="w-full flex items-start gap-3 p-3.5 rounded-2xl text-left active:scale-[0.98] transition-all group/btn"
                style={{ background: "white", border: "1.5px solid rgba(180,150,210,0.2)", boxShadow: "0 2px 8px rgba(100,60,140,0.04)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(217,70,239,0.12))" }}>
                  <Sparkles className="w-4.5 h-4.5" style={{ color: "#8B5CF6", width: 18, height: 18 }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: "#2D2235" }}>Generate from description</p>
                  <p className="text-[11px] leading-relaxed mt-0.5" style={{ color: "#8B7BA0" }}>
                    No photo needed — AI imagines the scene from the story description and your book's style
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 flex-shrink-0 mt-2 opacity-30 group-hover/btn:opacity-70 transition-opacity" style={{ color: "#8B5CF6" }} />
              </button>
            </div>
          )}

          {/* ── STATE: REFERENCE — has photo, needs illustration ── */}
          {imageState === "reference" && !busy && (
            <div className="relative">
              <img src={currentLoc.referenceImageUrl!} alt={currentLoc.name}
                className="w-full object-cover" style={{ maxHeight: 180 }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

              {/* Change photo link */}
              {!locked && (
                <button onClick={() => fileRef.current?.click()}
                  className="absolute top-3 right-3 text-[10px] font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,0.85)" }}>
                  Change photo
                </button>
              )}

              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <MapPin className="w-4 h-4 text-white/70" />
                  <h3 className="text-lg font-extrabold text-white drop-shadow-lg">{currentLoc.name}</h3>
                </div>
                {!locked && (
                  <button onClick={() => generateIllustration("reference")}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white active:scale-[0.97] transition-transform"
                    style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)", boxShadow: "0 3px 12px rgba(239,68,68,0.35)" }}>
                    <Sparkles className="w-4 h-4" />
                    Illustrate this photo in book style
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── STATE: PORTRAIT — has illustration ── */}
          {imageState === "portrait" && !busy && (
            <div className="relative">
              <img src={currentLoc.portraitImageUrl!} alt={currentLoc.name}
                className="w-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                style={{ maxHeight: 220 }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-white/80" />
                  <h3 className="text-xl font-extrabold text-white drop-shadow-lg">{currentLoc.name}</h3>
                </div>
                {!locked && (
                  <button onClick={() => fileRef.current?.click()}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                    style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,0.8)" }}>
                    Change
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── BUSY OVERLAY ── */}
          {busy && (
            <div className="flex flex-col items-center justify-center py-12 px-5"
              style={{ background: `linear-gradient(135deg, ${grad.from}18, ${grad.to}10)` }}>
              <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: "#8B5CF6" }} />
              <p className="text-[13px] font-semibold" style={{ color: "#6B5C80" }}>
                {uploading ? "Uploading photo…" : "Creating illustration…"}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "#A897BD" }}>
                {generating && "This takes about 30 seconds"}
              </p>
            </div>
          )}
        </div>

        {/* ── BODY ── */}
        {imageState !== "empty" && (
          <div className="px-5 py-3.5">
            {currentLoc.description ? (
              <p className="text-[13px] leading-relaxed line-clamp-2" style={{ color: "#5A4D6B" }}>
                {currentLoc.description}
              </p>
            ) : (
              <p className="text-[13px] italic" style={{ color: "#B8AAC8" }}>No description yet</p>
            )}

            {/* Regenerate options when has portrait and unlocked */}
            {imageState === "portrait" && !locked && !busy && (
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                <button onClick={() => generateIllustration("description")}
                  className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                  style={{ background: "rgba(139,92,246,0.07)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.15)" }}>
                  <Sparkles className="w-3 h-3" /> Regenerate from description
                </button>
                {currentLoc.referenceImageUrl && (
                  <button onClick={() => generateIllustration("reference")}
                    className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full active:scale-95 transition-transform"
                    style={{ background: "rgba(139,92,246,0.07)", color: "#8B5CF6", border: "1px solid rgba(139,92,246,0.15)" }}>
                    <Camera className="w-3 h-3" /> Regenerate from photo
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── ACTIONS ── */}
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={() => setShowEdit(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{ border: "1.5px solid rgba(180,150,210,0.18)", background: "white", color: "#6B5C80", cursor: "pointer" }}>
            <PenLine className="w-3.5 h-3.5" /> Edit
          </button>
          <button onClick={toggleLock}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
            style={{
              border: "none", cursor: "pointer",
              background: locked ? "#E8F5F0" : "linear-gradient(135deg, #8B5CF6, #D946EF)",
              color: locked ? "#2FA482" : "white",
              boxShadow: locked ? "none" : "0 3px 12px rgba(139,92,246,0.2)",
              ...(locked ? { border: "1.5px solid rgba(67,184,156,0.2)" } : {}),
            }}>
            {locked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock In</>}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="w-10 flex items-center justify-center rounded-xl transition-all"
            style={{ background: "rgba(239,68,68,0.06)", border: "1.5px solid rgba(239,68,68,0.12)", color: "#DC2626", cursor: "pointer", opacity: deleting ? 0.4 : 1 }}>
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── EDIT MODAL ── */}
      <AnimatePresence>
        {showEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(45,34,53,0.5)", backdropFilter: "blur(4px)" }}
            onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-h-[90vh] overflow-y-auto"
              style={{ maxWidth: 560, background: "white", borderRadius: 24, boxShadow: "0 30px 80px rgba(45,34,53,0.25)", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>

              <div className="sticky top-0 z-10 px-8 py-6 flex items-center justify-between"
                style={{ background: "white", borderBottom: "1px solid rgba(180,150,210,0.1)", borderRadius: "24px 24px 0 0" }}>
                <h3 className="text-xl font-extrabold" style={{ color: "#2D2235" }}>Edit {currentLoc.name}</h3>
                <button onClick={() => setShowEdit(false)}
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center"
                  style={{ background: "rgba(180,150,210,0.08)", border: "none", color: "#8B7BA0", cursor: "pointer" }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-8 py-6">
                <label className="flex items-center gap-2 mb-3 text-[13px] font-bold" style={{ color: "#2D2235" }}>
                  <span style={{ fontSize: 16 }}>📍</span> Description
                </label>
                <textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={6} maxLength={500}
                  placeholder="Describe this location's atmosphere, key features, and significance..."
                  style={{ width: "100%", borderRadius: 12, border: "2px solid rgba(180,150,210,0.15)", background: "#FDFBFF", color: "#2D2235", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontSize: 14, lineHeight: 1.6, padding: "12px 16px", outline: "none", resize: "vertical" }} />
                <p className="mt-2 text-xs text-right" style={{ color: editDesc.length > 450 ? "#E07ABA" : "#A897BD" }}>
                  {editDesc.length} / 500
                </p>
              </div>

              <div className="sticky bottom-0 px-8 py-6 flex gap-3"
                style={{ background: "rgba(253,251,255,0.95)", backdropFilter: "blur(8px)", borderTop: "1px solid rgba(180,150,210,0.1)", borderRadius: "0 0 24px 24px" }}>
                <button onClick={() => setShowEdit(false)}
                  className="flex-1 py-3.5 rounded-[14px] text-sm font-semibold"
                  style={{ border: "2px solid rgba(180,150,210,0.15)", background: "white", color: "#6B5C80", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={saveEdit}
                  className="flex-1 py-3.5 rounded-[14px] text-sm font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #8B5CF6, #D946EF)", boxShadow: "0 4px 16px rgba(139,92,246,0.2)", border: "none", cursor: "pointer" }}>
                  <Check className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}