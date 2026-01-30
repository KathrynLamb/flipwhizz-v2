"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Lock,
  Unlock,
  Loader2,
  ChevronDown,
  ChevronUp,
  Save,
  User,
  FileText,
  AlertCircle,
  Upload,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ImageUploadSurface } from "@/app/stories/[id]/characters/components/ImageUploadSurface";

type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  personalityTraits: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  locked: boolean;
};

const GRADIENTS = [
  "from-amber-400 via-orange-500 to-rose-500",
  "from-pink-400 via-rose-500 to-purple-500",
  "from-purple-400 via-violet-500 to-indigo-500",
  "from-cyan-400 via-blue-500 to-indigo-500",
  "from-lime-400 via-green-500 to-emerald-500",
  "from-yellow-400 via-amber-500 to-orange-500",
  "from-fuchsia-400 via-pink-500 to-rose-500",
  "from-teal-400 via-cyan-500 to-blue-500",
];

const MAX_CHARS = 500;

export function CharacterCard({
  storyId,
  character,
  index,
  onDelete,
}: {
  storyId: string;
  character: Character;
  index: number;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
  const gradient = GRADIENTS[index % GRADIENTS.length];

  // State
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(
    character.portraitImageUrl || character.referenceImageUrl
  );

  const [locked, setLocked] = useState(character.locked);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState<"description" | "appearance" | null>(null);

  // Expandable sections
  const [expandedSection, setExpandedSection] = useState<
    "description" | "appearance" | null
  >(null);

  // Editing state
  const [description, setDescription] = useState(character.description ?? "");
  const [appearance, setAppearance] = useState(character.appearance ?? "");

  const traits = character.personalityTraits
    ? character.personalityTraits.split(",").map((t) => t.trim()).slice(0, 3)
    : [];

  /* ======================================================
     IMAGE ACTIONS
  ====================================================== */

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

      const data = await res.json();
      if (!res.ok) throw new Error();

      setImageUrl(data.url);
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

      const data = await res.json();
      if (!res.ok) throw new Error();

      setImageUrl(data.url);
    } finally {
      setUploading(false);
    }
  }

  /* ======================================================
     SAVE ACTIONS
  ====================================================== */

  async function saveDescription() {
    setSaving("description");
    try {
      await fetch("/api/characters/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          description: description.trim(),
        }),
      });
      setExpandedSection(null);
    } finally {
      setSaving(null);
    }
  }

  async function saveAppearance() {
    setSaving("appearance");
    try {
      await fetch("/api/characters/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          appearance: appearance.trim(),
        }),
      });
      setExpandedSection(null);
    } finally {
      setSaving(null);
    }
  }

  /* ======================================================
     LOCK/UNLOCK
  ====================================================== */

  async function toggleLock() {
    if (locked) {
      await fetch("/api/characters/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id }),
      });
      setLocked(false);
    } else {
      await fetch("/api/characters/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id }),
      });
      setLocked(true);
      setExpandedSection(null); // Close any open sections
    }
  }

  /* ======================================================
     DELETE
  ====================================================== */

  async function deleteCharacter() {
    if (!confirm(`Delete ${character.name}? This cannot be undone.`)) return;

    setDeleting(true);
    if (onDelete) onDelete(character.id);

    await fetch(`/api/characters/${character.id}`, {
      method: "DELETE",
    });

    router.refresh();
  }

  /* ======================================================
     TOGGLE SECTION
  ====================================================== */

  function toggleSection(section: "description" | "appearance") {
    if (locked) return; // Can't edit when locked
    setExpandedSection(expandedSection === section ? null : section);
  }

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <motion.div
      layout
      whileHover={{ y: locked ? 0 : -4 }}
      className={`
        relative bg-white rounded-2xl overflow-hidden
        border-2 shadow-md hover:shadow-xl transition-all
        ${locked ? "border-purple-200 bg-purple-50/20" : "border-gray-200"}
      `}
    >
      {/* Locked Badge */}
      {locked && (
        <div className="absolute top-3 right-3 z-10 bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
          <Lock className="w-3 h-3" />
          Locked
        </div>
      )}

      {/* IMAGE SURFACE */}
      <ImageUploadSurface
        imageUrl={imageUrl}
        locked={locked}
        gradient={gradient}
        fallbackLetter={character.name.charAt(0)}
        uploading={uploading}
        onUpload={uploadReference}
        onUseAi={useAiImage}
      />

      {/* CONTENT */}
      <div className="p-5 space-y-4">
        {/* Name & Traits */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            {character.name}
          </h3>

          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {traits.map((t, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 text-xs font-semibold"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Image Upload Buttons (visible, mobile-friendly) */}
        {!locked && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) uploadReference(file);
                };
                input.click();
              }}
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
        <ExpandableSection
          title="Description"
          icon={FileText}
          content={description}
          isExpanded={expandedSection === "description"}
          isLocked={locked}
          isSaving={saving === "description"}
          charCount={description.length}
          maxChars={MAX_CHARS}
          onToggle={() => toggleSection("description")}
          onChange={setDescription}
          onSave={saveDescription}
          onCancel={() => {
            setDescription(character.description ?? "");
            setExpandedSection(null);
          }}
          placeholder="Describe this character's personality, background, and role in the story..."
        />

        {/* Appearance Section */}
        <ExpandableSection
          title="Appearance"
          icon={User}
          content={appearance}
          isExpanded={expandedSection === "appearance"}
          isLocked={locked}
          isSaving={saving === "appearance"}
          charCount={appearance.length}
          maxChars={MAX_CHARS}
          onToggle={() => toggleSection("appearance")}
          onChange={setAppearance}
          onSave={saveAppearance}
          onCancel={() => {
            setAppearance(character.appearance ?? "");
            setExpandedSection(null);
          }}
          placeholder="Describe physical features, clothing, colors, and distinctive characteristics..."
        />

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={toggleLock}
            className={`
              flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
              ${
                locked
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600"
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
            onClick={deleteCharacter}
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
        {locked && expandedSection && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-purple-700">
              This character is locked. Unlock to make changes.
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/* ======================================================
   EXPANDABLE SECTION COMPONENT
====================================================== */

function ExpandableSection({
  title,
  icon: Icon,
  content,
  isExpanded,
  isLocked,
  isSaving,
  charCount,
  maxChars,
  onToggle,
  onChange,
  onSave,
  onCancel,
  placeholder,
}: {
  title: string;
  icon: any;
  content: string;
  isExpanded: boolean;
  isLocked: boolean;
  isSaving: boolean;
  charCount: number;
  maxChars: number;
  onToggle: () => void;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder: string;
}) {
  const preview = content
    ? content.length > 80
      ? content.slice(0, 80) + "..."
      : content
    : null;

  const isOverLimit = charCount > maxChars;

  return (
    <div
      className={`
        border-2 rounded-xl overflow-hidden transition-all
        ${isExpanded ? "border-purple-300 bg-purple-50/30" : "border-gray-200"}
      `}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className={`
          w-full px-4 py-3 flex items-center justify-between
          transition-colors
          ${isExpanded ? "bg-purple-100/50" : "bg-gray-50 hover:bg-gray-100"}
        `}
      >
        <div className="flex items-center gap-2">
          <Icon
            className={`w-4 h-4 ${
              isExpanded ? "text-purple-600" : "text-gray-600"
            }`}
          />
          <span
            className={`font-bold text-sm ${
              isExpanded ? "text-purple-900" : "text-gray-900"
            }`}
          >
            {title}
          </span>
        </div>

        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-purple-600" />
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
            {isLocked ? "No content" : "Tap to add..."}
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
                value={content}
                onChange={(e) => {
                  if (e.target.value.length <= maxChars) {
                    onChange(e.target.value);
                  }
                }}
                disabled={isLocked || isSaving}
                placeholder={placeholder}
                className={`
                  w-full rounded-xl p-3 text-sm resize-none
                  border-2 transition-colors
                  ${
                    isOverLimit
                      ? "border-red-300 bg-red-50 focus:border-red-400"
                      : "border-gray-200 focus:border-purple-400"
                  }
                  ${isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
                  focus:outline-none
                `}
                rows={6}
                autoFocus={!isLocked}
              />

              {/* Character Count */}
              <div className="flex items-center justify-between text-xs">
                <span
                  className={`font-medium ${
                    isOverLimit
                      ? "text-red-600"
                      : charCount > maxChars * 0.9
                      ? "text-amber-600"
                      : "text-gray-500"
                  }`}
                >
                  {charCount} / {maxChars} characters
                </span>

                {isOverLimit && (
                  <span className="text-red-600 font-bold">
                    {charCount - maxChars} over limit
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              {!isLocked && (
                <div className="flex gap-2">
                  <button
                    onClick={onSave}
                    disabled={isSaving || isOverLimit || !content.trim()}
                    className={`
                      flex-1 h-10 rounded-lg font-bold text-sm flex items-center justify-center gap-2
                      transition-all
                      ${
                        isSaving || isOverLimit || !content.trim()
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                      }
                    `}
                  >
                    {isSaving ? (
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
                    onClick={onCancel}
                    disabled={isSaving}
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
  );
}