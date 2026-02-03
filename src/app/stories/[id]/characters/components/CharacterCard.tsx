"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trash2,
  Lock,
  Unlock,
  Loader2,
  ChevronDown,
  Save,
  FileText,
  User,
  Upload,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { ImageUploadSurface } from "@/app/stories/[id]/characters/components/ImageUploadSurface";

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
};

/* Warm accent palettes per card */
const CARD_ACCENTS = [
  { from: "#f59e0b", to: "#ef4444" },   // amber → red
  { from: "#ec4899", to: "#8b5cf6" },   // pink → violet
  { from: "#8b5cf6", to: "#06b6d4" },   // violet → cyan
  { from: "#06b6d4", to: "#10b981" },   // cyan → emerald
  { from: "#84cc16", to: "#06b6d4" },   // lime → cyan
  { from: "#f59e0b", to: "#ec4899" },   // amber → pink
  { from: "#d946ef", to: "#ec4899" },   // fuchsia → pink
  { from: "#14b8a6", to: "#06b6d4" },   // teal → cyan
];

const MAX_CHARS = 500;

/* ------------------------------------------------------------------ */
/* CARD                                                                */
/* ------------------------------------------------------------------ */

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
  const accent = CARD_ACCENTS[index % CARD_ACCENTS.length];

  /* ── state ── */
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(
    character.portraitImageUrl || character.referenceImageUrl
  );
  const [locked, setLocked] = useState(character.locked);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState<"description" | "appearance" | null>(null);
  const [expandedSection, setExpandedSection] = useState<"description" | "appearance" | null>(null);
  const [description, setDescription] = useState(character.description ?? "");
  const [appearance, setAppearance] = useState(character.appearance ?? "");

  const traits = character.personalityTraits
    ? character.personalityTraits.split(",").map((t) => t.trim()).slice(0, 3)
    : [];

  /* ── image actions ── */
  async function uploadReference(file: File) {
    if (locked) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("characterId", character.id);
      const res = await fetch("/api/characters/upload-reference", { method: "POST", body: fd });
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

  /* ── save ── */
  async function saveField(field: "description" | "appearance") {
    setSaving(field);
    try {
      await fetch("/api/characters/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          [field]: (field === "description" ? description : appearance).trim(),
        }),
      });
      setExpandedSection(null);
    } finally {
      setSaving(null);
    }
  }

  /* ── lock / unlock ── */
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
      setExpandedSection(null);
    }
  }

  /* ── delete ── */
  async function deleteCharacter() {
    if (!confirm(`Delete ${character.name}? This cannot be undone.`)) return;
    setDeleting(true);
    if (onDelete) onDelete(character.id);
    await fetch(`/api/characters/${character.id}`, { method: "DELETE" });
    router.refresh();
  }

  /* ── helpers ── */
  function toggleSection(section: "description" | "appearance") {
    if (locked) return;
    setExpandedSection(expandedSection === section ? null : section);
  }

  /* ── render ── */
  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: locked
          ? 'linear-gradient(145deg, rgba(124,92,252,0.12), rgba(194,94,240,0.06))'
          : 'rgba(255,255,255,0.04)',
        border: '1px solid ' + (locked ? 'rgba(124,92,252,0.3)' : 'rgba(255,255,255,0.08)'),
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* ── locked badge ── */}
      <AnimatePresence>
        {locked && (
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
            style={{ background: 'linear-gradient(135deg, #7c5cfc, #c25ef0)', color: '#fff' }}
          >
            <Lock className="w-3 h-3" />
            Locked
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── image surface ── */}
      <ImageUploadSurface
        imageUrl={imageUrl}
        locked={locked}
        accentFrom={accent.from}
        accentTo={accent.to}
        fallbackLetter={character.name.charAt(0)}
        uploading={uploading}
        onUpload={uploadReference}
        onUseAi={useAiImage}
      />

      {/* ── content ── */}
      <div className="p-4 sm:p-5 space-y-4">

        {/* name + traits */}
        <div>
          <h3 className="text-lg font-bold text-white tracking-tight">{character.name}</h3>
          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {traits.map((t, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.75 rounded-full text-xs font-semibold"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* upload row – only when unlocked */}
        <AnimatePresence>
          {!locked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2">
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
                  disabled={uploading}
                  className="flex-1 h-10 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold transition-all disabled:opacity-40"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </button>

                <button
                  onClick={useAiImage}
                  disabled={uploading}
                  className="flex-1 h-10 rounded-lg flex items-center justify-center gap-2 text-sm font-bold text-white transition-all disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg, #7c5cfc, #c25ef0)' }}
                >
                  <Sparkles className="w-4 h-4" />
                  AI Image
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* expandable sections */}
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
          onSave={() => saveField("description")}
          onCancel={() => { setDescription(character.description ?? ""); setExpandedSection(null); }}
          placeholder="Personality, background, and role in the story…"
        />

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
          onSave={() => saveField("appearance")}
          onCancel={() => { setAppearance(character.appearance ?? ""); setExpandedSection(null); }}
          placeholder="Physical features, clothing, colors…"
        />

        {/* ── actions row ── */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={toggleLock}
            className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white transition-all"
            style={
              locked
                ? { background: 'linear-gradient(135deg, #7c5cfc, #c25ef0)' }
                : { background: 'linear-gradient(135deg, #7c5cfc, #c25ef0)', opacity: 0.85 }
            }
          >
            {locked ? <><Unlock className="w-4 h-4" /> Unlock</> : <><Lock className="w-4 h-4" /> Lock</>}
          </button>

          <button
            onClick={deleteCharacter}
            disabled={deleting}
            className="w-11 h-11 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EXPANDABLE SECTION                                                  */
/* ------------------------------------------------------------------ */

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
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  placeholder: string;
}) {
  const preview = content
    ? content.length > 72
      ? content.slice(0, 72) + "…"
      : content
    : null;

  const isOverLimit = charCount > maxChars;

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{
        border: '1px solid ' + (isExpanded ? 'rgba(124,92,252,0.4)' : 'rgba(255,255,255,0.1)'),
        background: isExpanded ? 'rgba(124,92,252,0.06)' : 'rgba(255,255,255,0.03)',
      }}
    >
      {/* header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 transition-colors"
        style={{ color: 'rgba(255,255,255,0.8)' }}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: isExpanded ? '#a78bfa' : 'rgba(255,255,255,0.4)' }} />
          <span className="text-sm font-semibold" style={{ color: isExpanded ? '#fff' : 'rgba(255,255,255,0.7)' }}>
            {title}
          </span>
        </div>
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4" style={{ color: isExpanded ? '#a78bfa' : 'rgba(255,255,255,0.3)' }} />
        </motion.div>
      </button>

      {/* preview (collapsed) */}
      {!isExpanded && (
        <div className="px-4 pb-3">
          <p className="text-xs line-clamp-2" style={{ color: preview ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.22)' }}>
            {preview ?? (isLocked ? "—" : "Tap to add…")}
          </p>
        </div>
      )}

      {/* expanded editor */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              <textarea
                value={content}
                onChange={(e) => { if (e.target.value.length <= maxChars) onChange(e.target.value); }}
                disabled={isLocked || isSaving}
                placeholder={placeholder}
                autoFocus={!isLocked}
                rows={5}
                className="w-full rounded-lg p-3 text-sm resize-none focus:outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid ' + (isOverLimit ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'),
                  color: '#fff',
                  caretColor: '#a78bfa',
                }}
              />

              {/* char count */}
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-medium"
                  style={{
                    color: isOverLimit
                      ? '#ef4444'
                      : charCount > maxChars * 0.85
                      ? '#f59e0b'
                      : 'rgba(255,255,255,0.3)',
                  }}
                >
                  {charCount} / {maxChars}
                </span>
                {isOverLimit && <span className="text-xs font-bold" style={{ color: '#ef4444' }}>{charCount - maxChars} over</span>}
              </div>

              {/* save / cancel */}
              {!isLocked && (
                <div className="flex gap-2">
                  <button
                    onClick={onSave}
                    disabled={isSaving || isOverLimit || !content.trim()}
                    className="flex-1 h-9 rounded-lg flex items-center justify-center gap-2 text-sm font-bold text-white transition-all disabled:opacity-35"
                    style={{ background: 'linear-gradient(135deg, #7c5cfc, #c25ef0)' }}
                  >
                    {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : <><Save className="w-4 h-4" /> Save</>}
                  </button>

                  <button
                    onClick={onCancel}
                    disabled={isSaving}
                    className="px-5 h-9 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)' }}
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