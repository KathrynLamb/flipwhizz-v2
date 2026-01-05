'use client';

import { useRef, useState } from "react";
import { Upload, Sparkles, Pencil, Check } from "lucide-react";

type Location = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  portraitImageUrl: string | null;
};

const GRADIENTS = [
  "from-yellow-400 to-orange-500",
  "from-pink-400 to-rose-500",
  "from-purple-400 to-indigo-500",
  "from-cyan-400 to-blue-500",
  "from-lime-400 to-green-500",
];

export function LocationCard({
  storyId,
  location,
  index,
  locked,
}: {
  storyId: string;
  location: Location;
  index: number;
  locked: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const gradient = GRADIENTS[index % GRADIENTS.length];

  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(
    location.portraitImageUrl || location.referenceImageUrl || null
  );

  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(location.description ?? "");

  const displayImage = localPreview || imageUrl;

  /* ---------------- IMAGE UPLOAD ---------------- */

  async function handleUpload(file: File) {
    if (locked) return;

    setLocalPreview(URL.createObjectURL(file));
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
      const res = await fetch("/api/locations/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id }),
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

    await fetch("/api/locations/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: location.id,
        description: desc,
      }),
    });
  }

  return (
    <div className="group bg-white border-4 border-black rounded-3xl p-5 hover:shadow-2xl transition-shadow">
      
      {/* IMAGE TILE */}
      <div
        className={`relative aspect-square rounded-2xl bg-gradient-to-br ${gradient} mb-4 overflow-hidden flex items-center justify-center`}
      >
        {displayImage ? (
          <img
            src={displayImage}
            alt={location.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-7xl font-black text-white/30">
            {location.name.charAt(0)}
          </div>
        )}

        {/* Upload hover */}
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

        {/* AI decides button (replaces star) */}
        {!locked && (
          <button
            onClick={useAiImage}
            className="
              absolute top-3 right-3
              bg-white border-2 border-black
              rounded-full px-3 py-1
              text-xs font-black
              hover:scale-105 transition
            "
          >
            AI ✨
          </button>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-bold">
            Working…
          </div>
        )}
      </div>

      {/* NAME */}
      <h3 className="text-2xl font-black mb-2">{location.name}</h3>

      {/* DESCRIPTION */}
      {editingDesc ? (
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={saveDescription}
          className="w-full text-sm border-2 border-black rounded-xl p-2 mb-2"
          rows={3}
          autoFocus
        />
      ) : (
        <p className="text-sm text-gray-600 mb-2">
          {desc || "No description yet"}
        </p>
      )}

      {/* ACTION ROW */}
      {!locked && (
        <div className="flex justify-between items-center mt-2">
          <button
            onClick={() => setEditingDesc(true)}
            className="text-sm font-black flex items-center gap-1 hover:underline"
          >
            <Pencil className="w-4 h-4" />
            Edit description
          </button>
        </div>
      )}
    </div>
  );
}
