"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Trash2,
  Pencil,
  Lock,
  Unlock,
  X,
  Check,
  Loader2,
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

  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState(
    character.portraitImageUrl || character.referenceImageUrl
  );
  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(character.description ?? "");
  const [locked, setLocked] = useState(character.locked);
  const [deleting, setDeleting] = useState(false);

  const traits = character.personalityTraits
    ? character.personalityTraits.split(",").map(t => t.trim()).slice(0, 3)
    : [];

  /* -------- IMAGE ACTIONS -------- */

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

  /* -------- META ACTIONS -------- */

  async function saveDescription() {
    setEditingDesc(false);
    await fetch("/api/characters/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: character.id,
        description: desc,
      }),
    });
  }

  async function lockCharacter() {
    await fetch("/api/characters/lock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: character.id }),
    });
    setLocked(true);
    setEditingDesc(false);
  }

  async function unlockCharacter() {
    await fetch("/api/characters/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: character.id }),
    });
    setLocked(false);
  }

  async function deleteCharacter() {
    if (!confirm(`Delete ${character.name}? This cannot be undone.`)) return;

    setDeleting(true);
    if (onDelete) onDelete(character.id);

    await fetch(`/api/characters/${character.id}`, {
      method: "DELETE",
    });

    router.refresh();
  }

  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      className={`
        group relative bg-white rounded-2xl overflow-hidden
        border-2 shadow-sm hover:shadow-xl transition-all
        ${locked ? "border-violet-200 bg-violet-50/30" : "border-slate-200"}
      `}
    >
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
      <div className="p-5">
        <h3 className="text-xl font-bold text-slate-900 mb-2">
          {character.name}
        </h3>

        {traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {traits.map((t, i) => (
              <span
                key={i}
                className="px-2.5 py-1 rounded-full bg-slate-100 text-xs font-semibold"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {editingDesc && !locked ? (
          <>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full rounded-xl p-3 border-2 text-sm resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={saveDescription}
                className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-xs font-semibold"
              >
                <Check className="w-3 h-3 inline mr-1" />
                Save
              </button>
              <button
                onClick={() => setEditingDesc(false)}
                className="px-3 py-2 bg-slate-100 rounded-lg"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600 mb-4 min-h-[40px]">
            {desc || <span className="italic text-slate-400">No description yet</span>}
          </p>
        )}

        <div className="flex gap-2">
          {locked ? (
            <button
              onClick={unlockCharacter}
              className="flex-1 bg-amber-50 border-2 border-amber-200 text-amber-700 rounded-xl py-2 text-sm font-semibold"
            >
              <Unlock className="w-4 h-4 inline mr-1" />
              Unlock
            </button>
          ) : (
            <>
              <button
                onClick={() => setEditingDesc(true)}
                className="flex-1 bg-slate-100 rounded-xl py-2 text-sm font-semibold"
              >
                <Pencil className="w-4 h-4 inline mr-1" />
                Edit
              </button>
              <button
                onClick={lockCharacter}
                className="flex-1 bg-violet-600 text-white rounded-xl py-2 text-sm font-semibold"
              >
                <Lock className="w-4 h-4 inline mr-1" />
                Lock
              </button>
            </>
          )}

          <button
            onClick={deleteCharacter}
            disabled={deleting}
            className="w-10 h-10 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 flex items-center justify-center"
          >
            {deleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
