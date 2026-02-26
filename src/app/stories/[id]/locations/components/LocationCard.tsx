// src/app/stories/[id]/locations/components/LocationCard.tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  MapPin,
  Lock,
  Unlock,
  Loader2,
  Upload,
  Sparkles,
  X,
  Check,
  PenLine,
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
  { from: "#C77DFF", to: "#E07ABA" },
  { from: "#FFB347", to: "#FF8A65" },
  { from: "#A78BFA", to: "#67E8F9" },
  { from: "#F472B6", to: "#C084FC" },
  { from: "#34D399", to: "#60A5FA" },
  { from: "#FBBF24", to: "#F472B6" },
];

export default function LocationCard({
  location,
  storyId,
  index = 0,
  onUpdate,
  onDelete,
}: {
  location: Location;
  storyId: string;
  index?: number;
  onUpdate?: () => void;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const grad = GRADIENTS[index % GRADIENTS.length];

  const [locked, setLocked] = useState(location.locked);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({
    description: location.description || "",
  });

  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;

  /* ── Actions ── */

  async function toggleLock() {
    const res = await fetch("/api/locations/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: location.id }),
    });

    if (res.ok) {
      const data = await res.json();
      setLocked(data.locked);
      onUpdate?.();
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
      if (res.ok) {
        onUpdate?.();
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
      const res = await fetch("/api/locations/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id }),
      });
      if (res.ok) {
        onUpdate?.();
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  async function saveEdit() {
    const res = await fetch("/api/locations/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: location.id,
        description: editData.description.trim(),
      }),
    });
    if (res.ok) {
      setShowEdit(false);
      onUpdate?.();
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${location.name}? This cannot be undone.`)) return;
    setDeleting(true);
    onDelete?.(location.id);
    await fetch(`/api/locations/${location.id}`, { method: "DELETE" });
    router.refresh();
  }

  /* ── Render ── */

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && uploadReference(e.target.files[0])}
      />

      <div
        className="group relative overflow-hidden transition-all duration-300"
        style={{
          background: "white",
          borderRadius: 22,
          border: locked
            ? "2px solid rgba(67,184,156,0.25)"
            : "1px solid rgba(180,150,210,0.1)",
          boxShadow:
            "0 2px 8px rgba(100,60,140,0.04), 0 12px 40px rgba(100,60,140,0.06)",
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        {/* Locked badge */}
        {locked && (
          <div
            className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
            style={{
              background: "rgba(255,255,255,0.92)",
              backdropFilter: "blur(8px)",
              color: "#2FA482",
              boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            }}
          >
            <div
              className="w-[7px] h-[7px] rounded-full"
              style={{ background: "#43B89C" }}
            />
            Locked
          </div>
        )}

        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={location.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
              }}
            >
              <span className="text-8xl font-extrabold text-white/25 select-none">
                {location.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Upload buttons */}
          {!locked && !uploading && (
            <div className="absolute top-3.5 left-3.5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
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

          {/* Upload spinner */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* Name overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-white/80" />
              <h3 className="text-xl font-extrabold text-white drop-shadow-lg">
                {location.name}
              </h3>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5">
          {location.description ? (
            <p
              className="text-[13px] leading-relaxed line-clamp-3"
              style={{ color: "#5A4D6B" }}
            >
              {location.description}
            </p>
          ) : (
            <p
              className="text-[13px] italic"
              style={{ color: "#B8AAC8" }}
            >
              No description yet
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              border: "1.5px solid rgba(180,150,210,0.18)",
              background: "white",
              color: "#6B5C80",
              fontFamily: "inherit",
              cursor: "pointer",
            }}
          >
            <PenLine className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={toggleLock}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
            style={{
              border: "none",
              background: locked
                ? "#E8F5F0"
                : "linear-gradient(135deg, #B05CE6, #D45DA0)",
              color: locked ? "#2FA482" : "white",
              fontFamily: "inherit",
              cursor: "pointer",
              boxShadow: locked
                ? "none"
                : "0 3px 12px rgba(176,92,230,0.2)",
              ...(locked
                ? { border: "1.5px solid rgba(67,184,156,0.2)" }
                : {}),
            }}
          >
            {locked ? (
              <>
                <Unlock className="w-3.5 h-3.5" /> Unlock
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" /> Lock In
              </>
            )}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-10 flex items-center justify-center rounded-xl transition-all"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1.5px solid rgba(239,68,68,0.12)",
              color: "#DC2626",
              cursor: "pointer",
              opacity: deleting ? 0.4 : 1,
            }}
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {showEdit && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: "rgba(45,34,53,0.5)",
              backdropFilter: "blur(4px)",
            }}
            onClick={(e) =>
              e.target === e.currentTarget && setShowEdit(false)
            }
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-h-[90vh] overflow-y-auto"
              style={{
                maxWidth: 560,
                background: "white",
                borderRadius: 24,
                boxShadow: "0 30px 80px rgba(45,34,53,0.25)",
                fontFamily:
                  "'Bricolage Grotesque', system-ui, sans-serif",
              }}
            >
              {/* Header */}
              <div
                className="sticky top-0 z-10 px-8 py-6 flex items-center justify-between"
                style={{
                  background: "white",
                  borderBottom: "1px solid rgba(180,150,210,0.1)",
                  borderRadius: "24px 24px 0 0",
                }}
              >
                <h3
                  className="text-xl font-extrabold"
                  style={{ color: "#2D2235" }}
                >
                  Edit {location.name}
                </h3>
                <button
                  onClick={() => setShowEdit(false)}
                  className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors"
                  style={{
                    background: "rgba(180,150,210,0.08)",
                    border: "none",
                    color: "#8B7BA0",
                    cursor: "pointer",
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <div className="px-8 py-6">
                <label
                  className="flex items-center gap-2 mb-3"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#2D2235",
                  }}
                >
                  <span style={{ fontSize: 16 }}>📍</span> Description
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) =>
                    setEditData({ description: e.target.value })
                  }
                  rows={6}
                  maxLength={500}
                  placeholder="Describe this location's atmosphere, key features, and significance to the story..."
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    border: "2px solid rgba(180,150,210,0.15)",
                    background: "#FDFBFF",
                    color: "#2D2235",
                    fontFamily:
                      "'Bricolage Grotesque', system-ui, sans-serif",
                    fontSize: 14,
                    lineHeight: 1.6,
                    padding: "12px 16px",
                    outline: "none",
                    resize: "vertical" as const,
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = "#C77DFF";
                    e.target.style.boxShadow =
                      "0 0 0 4px rgba(199,125,255,0.1)";
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor =
                      "rgba(180,150,210,0.15)";
                    e.target.style.boxShadow = "none";
                  }}
                />
                <p
                  className="mt-2 text-xs text-right"
                  style={{
                    color:
                      editData.description.length > 450
                        ? "#E07ABA"
                        : "#A897BD",
                  }}
                >
                  {editData.description.length} / 500
                </p>
              </div>

              {/* Footer */}
              <div
                className="sticky bottom-0 px-8 py-6 flex gap-3"
                style={{
                  background: "rgba(253,251,255,0.95)",
                  backdropFilter: "blur(8px)",
                  borderTop: "1px solid rgba(180,150,210,0.1)",
                  borderRadius: "0 0 24px 24px",
                }}
              >
                <button
                  onClick={() => setShowEdit(false)}
                  className="flex-1 py-3.5 rounded-[14px] text-sm font-semibold transition-all"
                  style={{
                    border: "2px solid rgba(180,150,210,0.15)",
                    background: "white",
                    color: "#6B5C80",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  className="flex-1 py-3.5 rounded-[14px] text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
                  style={{
                    background:
                      "linear-gradient(135deg, #B05CE6, #D45DA0)",
                    boxShadow:
                      "0 4px 16px rgba(176,92,230,0.2)",
                    border: "none",
                    fontFamily: "inherit",
                    cursor: "pointer",
                  }}
                >
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