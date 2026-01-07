'use client';

import { useRef, useState } from 'react';
import { Upload, Pencil, Lock, Unlock } from 'lucide-react';

type Location = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  portraitImageUrl: string | null;
  locked: boolean;
};

const GRADIENTS = [
  'from-yellow-400 to-orange-500',
  'from-pink-400 to-rose-500',
  'from-purple-400 to-indigo-500',
  'from-cyan-400 to-blue-500',
  'from-lime-400 to-green-500',
];

export function LocationCard({
  storyId,
  location,
  index,
}: {
  storyId: string;
  location: Location;
  index: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const gradient = GRADIENTS[index % GRADIENTS.length];

  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(
    location.portraitImageUrl || location.referenceImageUrl || null
  );

  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(location.description ?? '');
  const [locked, setLocked] = useState(location.locked);

  const displayImage = localPreview || imageUrl;

  /* ---------------------------------------------------
     IMAGE UPLOAD
  --------------------------------------------------- */

  function isHeic(file: File) {
    return (
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif')
    );
  }

  async function handleUpload(file: File) {
    if (locked) return;

    if (!isHeic(file)) {
      setLocalPreview(URL.createObjectURL(file));
    } else {
      setLocalPreview(null);
    }

    setUploading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('locationId', location.id);

      const res = await fetch('/api/locations/upload-reference', {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setImageUrl(data.url);
      setLocalPreview(null);
    } catch {
      alert('Failed to upload image');
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }

  /* ---------------------------------------------------
     AI IMAGE
  --------------------------------------------------- */

  async function useAiImage() {
    if (locked) return;

    setUploading(true);
    try {
      const res = await fetch('/api/locations/use-ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: location.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error();

      setImageUrl(data.url);
    } catch {
      alert('AI image failed');
    } finally {
      setUploading(false);
    }
  }

  /* ---------------------------------------------------
     DESCRIPTION
  --------------------------------------------------- */

  async function saveDescription() {
    setEditingDesc(false);

    await fetch('/api/locations/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId: location.id,
        description: desc,
      }),
    });
  }

  /* ---------------------------------------------------
     LOCK / UNLOCK
  --------------------------------------------------- */

  async function lockLocation() {
    const ok = confirm(
      'Lock this location?\n\nIts description and image will be frozen.'
    );
    if (!ok) return;

    await fetch('/api/locations/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: location.id }),
    });

    setLocked(true);
    setEditingDesc(false);
  }

  async function unlockLocation() {
    const ok = confirm(
      'Unlock this location?\n\nYou will be able to edit it again.'
    );
    if (!ok) return;

    await fetch('/api/locations/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: location.id }),
    });

    setLocked(false);
  }

  return (
    <div className="group relative bg-white border-[3px] border-black rounded-[28px] p-5 transition-all hover:shadow-2xl">

      {/* IMAGE TILE */}
      <div
        className={`relative aspect-square rounded-2xl bg-gradient-to-br ${gradient} mb-4 overflow-hidden flex items-center justify-center`}
      >
        {displayImage ? (
          <img src={displayImage} alt={location.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-7xl font-black text-white/30">
            {location.name.charAt(0)}
          </div>
        )}

        {!locked && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
            />

            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white font-black"
            >
              <Upload className="w-7 h-7 mb-1" />
              Upload reference
            </button>

            <button
              onClick={useAiImage}
              className="absolute top-3 right-3 rounded-full px-3 py-1 text-xs font-black bg-white text-black border-2 border-black hover:scale-105 transition"
            >
              AI ✨
            </button>
          </>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white font-black">
            Working…
          </div>
        )}
      </div>

      {/* TITLE */}
      <h3 className="text-2xl font-black mb-2 text-black">
        {location.name}
      </h3>

      {/* DESCRIPTION */}
      {editingDesc && !locked ? (
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={saveDescription}
          className="w-full rounded-xl p-3 mb-3 text-sm font-medium border-[3px] border-black"
          rows={3}
          autoFocus
        />
      ) : (
        <p className="text-sm text-slate-700 mb-3 leading-relaxed">
          {desc || <span className="italic text-slate-400">No description yet</span>}
        </p>
      )}

      {/* ACTION BAR */}
      <div className="flex items-center justify-between gap-3 mt-2">

        {!locked && (
          <button
            onClick={() => setEditingDesc(true)}
            className="flex items-center gap-1 text-sm font-black hover:underline"
          >
            <Pencil className="w-4 h-4" />
            Edit description
          </button>
        )}

        {locked ? (
          <button
            onClick={unlockLocation}
            className="px-5 py-2 rounded-full font-black text-sm bg-yellow-400 text-black hover:scale-105 transition"
          >
            <Unlock className="w-4 h-4 inline mr-1" />
            Unlock
          </button>
        ) : (
          <button
            onClick={lockLocation}
            className="px-5 py-2 rounded-full font-black text-sm bg-black text-white hover:scale-105 transition"
          >
            <Lock className="w-4 h-4 inline mr-1" />
            Lock
          </button>
        )}
      </div>
    </div>
  );
}
