'use client';

import { useRef, useState } from "react";
import { Upload, Sparkles, Pencil, Check } from "lucide-react";

type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  personalityTraits: string | null;
  portraitImageUrl: string | null;
};

const GRADIENTS = [
  "from-yellow-400 to-orange-500",
  "from-pink-400 to-rose-500",
  "from-purple-400 to-indigo-500",
  "from-cyan-400 to-blue-500",
  "from-lime-400 to-green-500",
];

const TRAIT_COLORS = [
  "bg-pink-500",
  "bg-purple-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
];

export function CharacterCard({
  storyId,
  character,
  index,
  locked,
}: {
  storyId: string;
  character: Character;
  index: number;
  locked: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const gradient = GRADIENTS[index % GRADIENTS.length];

  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(character.portraitImageUrl);

  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(character.description ?? "");

  const traits = character.personalityTraits
    ? character.personalityTraits.split(",").map(t => t.trim())
    : [];

  /* ---------------- IMAGE UPLOAD ---------------- */

  async function handleUpload(file: File) {
    setLocalPreview(URL.createObjectURL(file));
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
      if (!res.ok) throw new Error(data.error);

      setImageUrl(data.url);
      setLocalPreview(null);
    } catch {
      alert("Failed to upload image");
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }

  /* ---------------- AI IMAGE ---------------- */

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
    } catch {
      alert("AI image failed");
    } finally {
      setUploading(false);
    }
  }

  /* ---------------- DESCRIPTION SAVE ---------------- */

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

  const displayImage = localPreview || imageUrl;

  return (
    <div className="group bg-white border-4 border-black rounded-3xl p-5 hover:shadow-2xl transition-shadow">
      
      {/* IMAGE */}
      <div
        className={`relative aspect-square rounded-2xl bg-gradient-to-br ${gradient} mb-4 overflow-hidden flex items-center justify-center`}
      >
        {displayImage ? (
          <img src={displayImage} className="w-full h-full object-cover" />
        ) : (
          <div className="text-7xl font-black text-white/30">
            {character.name[0]}
          </div>
        )}

        {!locked && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files && handleUpload(e.target.files[0])}
            />

            {/* Upload on hover */}
            <button
              onClick={() => fileRef.current?.click()}
              className="
                absolute inset-0 bg-black/40 opacity-0
          group-hover:opacity-100 transition
                flex items-center justify-center
                text-white font-bold
              "
            >
              <Upload className="w-6 h-6 mr-2" />
              Upload reference
            </button>
          </>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold">
            Working…
          </div>
        )}
      </div>

      {/* NAME */}
      <h3 className="text-2xl font-black mb-2">{character.name}</h3>

      {/* TRAITS */}
      {traits.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {traits.map((t, i) => (
            <span
              key={i}
              className={`${TRAIT_COLORS[i % TRAIT_COLORS.length]} text-white px-3 py-1 rounded-full text-xs font-bold`}
            >
              {t}
            </span>
          ))}
        </div>
      )}

      {/* DESCRIPTION (INLINE EDIT) */}
      {editingDesc ? (
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onBlur={saveDescription}
          className="w-full text-sm border border-black rounded-lg p-2 mb-2"
          rows={3}
          autoFocus
        />
      ) : (
        <p className="text-sm text-gray-600 mb-2">
          {desc || "No description yet"}
        </p>
      )}

      {/* ACTION ROW */}
      <div className="flex justify-between items-center mt-2">
        {!locked && (
          <button
            onClick={() => setEditingDesc(true)}
            className="text-sm font-bold flex items-center gap-1 hover:underline"
          >
            <Pencil className="w-4 h-4" />
            Edit description
          </button>
        )}

        {!locked && (
          <button
            onClick={useAiImage}
            className="text-xs font-bold px-3 py-1 rounded-full bg-black text-white hover:scale-105 transition"
          >
            AI decides ✨
          </button>
        )}
      </div>
    </div>
  );
}
