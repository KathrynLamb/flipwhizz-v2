"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  MapPin,
  Lock,
  Unlock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  FileText,
  Upload,
  Sparkles,
  AlertCircle,
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
  "from-yellow-400 via-amber-500 to-orange-500",
  "from-pink-400 via-rose-500 to-red-500",
  "from-purple-400 via-violet-500 to-indigo-500",
  "from-cyan-400 via-blue-500 to-indigo-500",
  "from-lime-400 via-green-500 to-emerald-500",
  "from-orange-400 via-red-500 to-pink-500",
  "from-teal-400 via-cyan-500 to-blue-500",
  "from-fuchsia-400 via-pink-500 to-purple-500",
];

const LOCATION_EMOJIS = ["🏰", "🌳", "🏔️", "🏖️", "🌆", "🎪", "🏡", "🌋"];

const MAX_CHARS = 500;

export function LocationCard({
  location,
  index,
  onDelete,
}: {
  location: Location;
  index: number;
  onDelete?: (id: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const emoji = LOCATION_EMOJIS[index % LOCATION_EMOJIS.length];

  // State
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(
    location.portraitImageUrl || location.referenceImageUrl || null
  );

  const [locked, setLocked] = useState(location.locked);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Expandable section
  const [isExpanded, setIsExpanded] = useState(false);
  const [description, setDescription] = useState(location.description ?? "");

  const displayImage = localPreview || imageUrl;

  /* ======================================================
     IMAGE UPLOAD
  ====================================================== */

  function isHeic(file: File) {
    return (
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif")
    );
  }

  async function handleUpload(file: File) {
    if (locked) return;

    if (!isHeic(file)) {
      setLocalPreview(URL.createObjectURL(file));
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("locationId", location.id);

      const res = await fetch("/api/locations/upload-reference", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      setImageUrl(data.url);
      setLocalPreview(null);
    } catch {
      alert("Failed to upload image");
      setLocalPreview(null);
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

      const data = await res.json();
      if (!res.ok) throw new Error();

      setImageUrl(data.url);
    } catch {
      alert("AI image generation failed");
    } finally {
      setUploading(false);
    }
  }

  /* ======================================================
     SAVE DESCRIPTION
  ====================================================== */

  async function saveDescription() {
    setSaving(true);
    try {
      await fetch("/api/locations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          description: description.trim(),
        }),
      });
      setIsExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  /* ======================================================
     LOCK/UNLOCK
  ====================================================== */

  async function toggleLock() {
    if (locked) {
      await fetch("/api/locations/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id }),
      });
      setLocked(false);
    } else {
      await fetch("/api/locations/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id }),
      });
      setLocked(true);
      setIsExpanded(false);
    }
  }

  /* ======================================================
     DELETE
  ====================================================== */

  async function deleteLocation() {
    if (!confirm(`Delete ${location.name}? This cannot be undone.`)) return;

    setDeleting(true);
    if (onDelete) onDelete(location.id);

    await fetch(`/api/locations/${location.id}`, {
      method: "DELETE",
    });
  }

  /* ======================================================
     TOGGLE SECTION
  ====================================================== */

  function toggleSection() {
    if (locked) return;
    setIsExpanded(!isExpanded);
  }

  /* ======================================================
     RENDER
  ====================================================== */

  const preview = description
    ? description.length > 80
      ? description.slice(0, 80) + "..."
      : description
    : null;

  const isOverLimit = description.length > MAX_CHARS;

  return (
    <motion.div
      layout
      whileHover={{ y: locked ? 0 : -4 }}
      className={`
        relative bg-white rounded-2xl overflow-hidden
        border-2 shadow-md hover:shadow-xl transition-all
        ${locked ? "border-amber-200 bg-amber-50/20" : "border-gray-200"}
      `}
    >
      {/* Locked Badge */}
      {locked && (
        <div className="absolute top-3 right-3 z-10 bg-amber-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
          <Lock className="w-3 h-3" />
          Locked
        </div>
      )}

      {/* IMAGE SECTION */}
      <div className="relative">
        <div
          className={`
            relative aspect-square
            bg-gradient-to-br ${gradient}
            overflow-hidden
            flex items-center justify-center
          `}
        >
          {displayImage ? (
            <img
              src={displayImage}
              alt={location.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              {/* Fallback Letter */}
              <div className="text-7xl font-black text-white/30">
                {location.name.charAt(0)}
              </div>

              {/* Hover Emoji */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/5 opacity-0 group-hover:opacity-100 transition">
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-6xl"
                >
                  {emoji}
                </motion.div>
              </div>
            </>
          )}

          {/* Upload Overlay (only when unlocked) */}
          {!locked && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) =>
                  e.target.files && handleUpload(e.target.files[0])
                }
              />

              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-full bg-white text-gray-900 text-sm font-bold hover:scale-105 transition disabled:opacity-50"
                >
                  <Upload className="w-4 h-4 inline mr-1" />
                  Upload
                </button>

                <button
                  onClick={useAiImage}
                  disabled={uploading}
                  className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-bold hover:scale-105 transition disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  AI
                </button>
              </div>
            </>
          )}

          {/* Uploading State */}
          {uploading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-sm font-bold">Processing...</p>
            </div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-5 space-y-4">
        {/* Name */}
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gray-600" />
          <h3 className="text-xl font-bold text-gray-900">{location.name}</h3>
        </div>

        {/* Image Upload Buttons (visible, mobile-friendly) */}
        {!locked && (
          <div className="flex gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex-1 h-10 rounded-lg border-2 border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Image
            </button>

            <button
              onClick={useAiImage}
              disabled={uploading}
              className="flex-1 h-10 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-sm hover:from-purple-700 hover:to-pink-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              AI Image
            </button>
          </div>
        )}

        {/* Description Section */}
        <div
          className={`
            border-2 rounded-xl overflow-hidden transition-all
            ${isExpanded ? "border-orange-300 bg-orange-50/30" : "border-gray-200"}
          `}
        >
          {/* Header */}
          <button
            onClick={toggleSection}
            className={`
              w-full px-4 py-3 flex items-center justify-between
              transition-colors
              ${isExpanded ? "bg-orange-100/50" : "bg-gray-50 hover:bg-gray-100"}
            `}
          >
            <div className="flex items-center gap-2">
              <FileText
                className={`w-4 h-4 ${
                  isExpanded ? "text-orange-600" : "text-gray-600"
                }`}
              />
              <span
                className={`font-bold text-sm ${
                  isExpanded ? "text-orange-900" : "text-gray-900"
                }`}
              >
                Description
              </span>
            </div>

            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-orange-600" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {/* Preview (when collapsed) */}
          {!isExpanded && preview && (
            <div className="px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-600 line-clamp-2">{preview}</p>
            </div>
          )}

          {!isExpanded && !preview && (
            <div className="px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-400 italic">
                {locked ? "No content" : "Tap to add..."}
              </p>
            </div>
          )}

          {/* Expanded Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 space-y-3 bg-white">
                  {/* Textarea */}
                  <textarea
                    value={description}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_CHARS) {
                        setDescription(e.target.value);
                      }
                    }}
                    disabled={locked || saving}
                    placeholder="Describe this location's atmosphere, key features, and significance to the story..."
                    className={`
                      w-full rounded-xl p-3 text-sm resize-none
                      border-2 transition-colors
                      ${
                        isOverLimit
                          ? "border-red-300 bg-red-50 focus:border-red-400"
                          : "border-gray-200 focus:border-orange-400"
                      }
                      ${locked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
                      focus:outline-none
                    `}
                    rows={6}
                    autoFocus={!locked}
                  />

                  {/* Character Count */}
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-medium ${
                        isOverLimit
                          ? "text-red-600"
                          : description.length > MAX_CHARS * 0.9
                          ? "text-amber-600"
                          : "text-gray-500"
                      }`}
                    >
                      {description.length} / {MAX_CHARS} characters
                    </span>

                    {isOverLimit && (
                      <span className="text-red-600 font-bold">
                        {description.length - MAX_CHARS} over limit
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {!locked && (
                    <div className="flex gap-2">
                      <button
                        onClick={saveDescription}
                        disabled={
                          saving || isOverLimit || !description.trim()
                        }
                        className={`
                          flex-1 h-10 rounded-lg font-bold text-sm flex items-center justify-center gap-2
                          transition-all
                          ${
                            saving || isOverLimit || !description.trim()
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-orange-600 to-amber-600 text-white hover:from-orange-700 hover:to-amber-700"
                          }
                        `}
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setDescription(location.description ?? "");
                          setIsExpanded(false);
                        }}
                        disabled={saving}
                        className="px-6 h-10 rounded-lg border-2 border-gray-300 text-gray-700 font-bold text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={toggleLock}
            className={`
              flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
              ${
                locked
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600"
              }
            `}
          >
            {locked ? (
              <>
                <Unlock className="w-4 h-4" />
                Unlock
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Lock
              </>
            )}
          </button>

          <button
            onClick={deleteLocation}
            disabled={deleting}
            className="w-12 h-12 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center"
          >
            {deleting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Trash2 className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Locked Message */}
        {locked && isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-50 border-2 border-amber-200 rounded-xl p-3 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              This location is locked. Unlock to make changes.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}