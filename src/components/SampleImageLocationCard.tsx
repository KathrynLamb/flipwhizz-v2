"use client";

import { useState } from "react";
import { Loader, Upload } from "lucide-react";

type Location = {
  id: string;
  name: string;
  description?: string | null;
  referenceImageUrl?: string | null;
};

export function SampleImageLocationCard({
  location,
  onUpdated,
}: {
  location: Location;
  onUpdated?: (l: Location) => void;
}) {
  const [desc, setDesc] = useState(location.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    location.referenceImageUrl ?? null
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  /* ----------------------------
     Save description
  ----------------------------- */
  async function saveDescription() {
    if (desc === location.description) return;

    setSaving(true);
    try {
      await fetch(`/api/locations/${location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });

      onUpdated?.({ ...location, description: desc });
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

      // 🔥 Optimistic UI
      setImageUrl(data.url);
      onUpdated?.({ ...location, referenceImageUrl: data.url });

      // Persist
      await fetch(`/api/locations/${location.id}`, {
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
            alt={location.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <label className="flex flex-col items-center justify-center h-full text-white/50 cursor-pointer hover:text-white transition">
            {uploading ? (
              <Loader className="animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
            <span className="text-xs mt-2">Upload location image</span>
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
          {location.name}
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
          placeholder="Describe this location..."
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={saveDescription}
        />

        {saving && (
          <p className="text-[10px] text-white/40 mt-1">Saving…</p>
        )}
      </div>

      <div className="h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
    </div>
  );
}
