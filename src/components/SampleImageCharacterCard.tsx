"use client";

import { useState } from "react";
import { Loader, Upload } from "lucide-react";

type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  referenceImageUrl?: string | null;
};

export function SampleImageCharacterCard({
  character,
  onUpdated,
}: {
  character: Character;
  onUpdated?: (c: Character) => void;
}) {
  const [desc, setDesc] = useState(character.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    character.referenceImageUrl ?? null
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  /* ----------------------------
     Save description (on blur)
  ----------------------------- */
  async function saveDescription() {
    if (desc === character.description) return;

    setSaving(true);
    try {
      await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });

      onUpdated?.({ ...character, description: desc });
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------------
     Upload reference image
  ----------------------------- */
  async function uploadReference(file: File) {
    setUploading(true);

    try {
      const session = await (await fetch("/api/auth/session")).json();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Not logged in");

      const fd = new FormData();
      fd.append("file", file);
      fd.append("userId", userId);

      const res = await fetch("/api/uploads/reference", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // 🔥 OPTIMISTIC UI UPDATE
      setImageUrl(data.url);
      onUpdated?.({ ...character, referenceImageUrl: data.url });

      // Persist to DB
      await fetch(`/api/characters/${character.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceImageUrl: data.url }),
      });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="bg-white/95 rounded-2xl shadow border border-white/10 overflow-hidden">
      {/* IMAGE */}
      <div className="relative aspect-square bg-black/10">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={character.name}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
        ) : (
          <label className="flex flex-col items-center justify-center h-full text-white/50 cursor-pointer hover:text-white transition">
            {uploading ? (
              <Loader className="animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
            <span className="text-xs mt-2">Upload photo</span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={(e) =>
                e.target.files && uploadReference(e.target.files[0])
              }
            />
          </label>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-4 bg-black/60">
        <h3 className="font-bold text-sm mb-2 text-white">
          {character.name}
        </h3>

        <textarea
          className="
            w-full
            bg-black/40
            border border-white/10
            rounded-xl
            p-3
            text-sm
            text-white
            placeholder:text-white/40
            focus:outline-none
            focus:ring-2
            focus:ring-purple-500/50
            resize-none
          "
          rows={4}
          placeholder="Describe this character..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={saveDescription}
        />

        {saving && (
          <p className="text-[10px] text-white/40 mt-1">Saving…</p>
        )}
      </div>

      {/* ACCENT */}
      <div className="h-1 bg-gradient-to-r from-violet-500 via-pink-500 to-orange-500" />
    </div>
  );
}
