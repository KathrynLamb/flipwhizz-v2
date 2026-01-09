'use client';

import { useRef, useState } from 'react';
import {
  Trash2,
  MapPin,
  Pencil,
  Upload,
  Sparkles,
  Lock,
  Unlock,
} from 'lucide-react';

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

const HOVER_EMOJIS = ['🏰', '🌳', '🏔️', '🏖️', '🌆', '🎪', '🏡', '🌋'];

export function LocationCard({
  location,
  index,
}: {
  location: Location;
  index: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const gradient = GRADIENTS[index % GRADIENTS.length];
  const hoverEmoji = HOVER_EMOJIS[index % HOVER_EMOJIS.length];

  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(
    location.portraitImageUrl || location.referenceImageUrl || null
  );

  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(location.description ?? '');
  const [locked, setLocked] = useState(location.locked);
  const [deleting, setDeleting] = useState(false);

  const displayImage = localPreview || imageUrl;

  /* ---------------------------------------------
     IMAGE UPLOAD
  --------------------------------------------- */

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
      if (!res.ok) throw new Error();

      setImageUrl(data.url);
      setLocalPreview(null);
    } catch {
      alert('Failed to upload image');
      setLocalPreview(null);
    } finally {
      setUploading(false);
    }
  }

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

  async function lockLocation() {
    if (!confirm('Lock this location? Its appearance will be frozen.')) return;

    await fetch('/api/locations/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: location.id }),
    });

    setLocked(true);
    setEditingDesc(false);
  }

  async function unlockLocation() {
    if (!confirm('Unlock this location for editing?')) return;

    await fetch('/api/locations/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: location.id }),
    });

    setLocked(false);
  }

  async function deleteLocation() {
    if (!confirm(`Delete ${location.name}? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      await fetch(`/api/locations/${location.id}`, {
        method: 'DELETE',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="
        group relative
        bg-white
        border-[3px] border-black
        rounded-3xl
        p-5
        hover:shadow-2xl
        transition
      "
    >
      {/* IMAGE */}
      <div
        className={`
          relative aspect-square
          rounded-2xl
          bg-gradient-to-br ${gradient}
          overflow-hidden
          mb-4
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
            <div className="text-7xl font-black text-white/30">
              {location.name.charAt(0)}
            </div>

            {/* Emoji hover */}
            <div className="
              absolute inset-0
              flex items-center justify-center
              bg-black/10
              opacity-0 group-hover:opacity-100
              transition
            ">
              <div className="text-5xl animate-bounce">
                {hoverEmoji}
              </div>
            </div>
          </>
        )}

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

            <div className="
              absolute inset-0
              bg-black/40
              opacity-0 group-hover:opacity-100
              transition
              flex items-center justify-center gap-2
            ">
              <button
                onClick={() => fileRef.current?.click()}
                className="px-4 py-2 rounded-full bg-white text-black text-xs font-black"
              >
                <Upload className="w-3 h-3 inline mr-1" />
                Upload
              </button>

              <button
                onClick={useAiImage}
                className="px-4 py-2 rounded-full bg-black text-white text-xs font-black"
              >
                <Sparkles className="w-3 h-3 inline mr-1" />
                AI
              </button>
            </div>
          </>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center text-white font-black">
            Working…
          </div>
        )}
      </div>

      {/* NAME */}
      <div className="flex items-center gap-2 mb-2">
        <MapPin className="w-5 h-5 text-gray-600" />
        <h3 className="text-xl font-black">
          {location.name}
        </h3>
      </div>

      {/* DESCRIPTION */}
      {editingDesc && !locked ? (
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          onBlur={saveDescription}
          className="w-full rounded-xl p-2 text-sm border-2 border-black mb-3"
          rows={3}
          autoFocus
        />
      ) : (
        <p className="text-sm text-slate-700 mb-3 line-clamp-2">
          {desc || (
            <span className="italic text-slate-400">
              No description yet
            </span>
          )}
        </p>
      )}

      {/* ACTION ROW */}
      <div className="flex items-center justify-between">
        {!locked && (
          <button
            onClick={() => setEditingDesc(true)}
            className="text-xs font-black underline flex items-center gap-1"
          >
            <Pencil className="w-3 h-3" />
            Edit
          </button>
        )}

        <div className="flex gap-2">
          {locked ? (
            <button
              onClick={unlockLocation}
              className="px-3 py-1 rounded-full bg-yellow-400 text-black text-xs font-black"
            >
              <Unlock className="w-3 h-3 inline mr-1" />
              Unlock
            </button>
          ) : (
            <button
              onClick={lockLocation}
              className="px-3 py-1 rounded-full bg-black text-white text-xs font-black"
            >
              <Lock className="w-3 h-3 inline mr-1" />
              Lock
            </button>
          )}

          <button
            onClick={deleteLocation}
            disabled={deleting}
            className="
              w-8 h-8
              rounded-full
              border-2 border-black
              flex items-center justify-center
              hover:bg-red-500 hover:text-white
            "
            title="Delete location"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
