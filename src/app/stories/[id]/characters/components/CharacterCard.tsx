'use client';

import { useRef, useState } from "react";
import { motion } from 'framer-motion';
import { 
  Trash2, 
  Upload, 
  Sparkles, 
  Pencil, 
  Lock, 
  Unlock,
  X,
  Check,
  Loader2
} from "lucide-react";
import { useRouter } from "next/navigation";

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
  const fileRef = useRef<HTMLInputElement>(null);
  
  const gradient = GRADIENTS[index % GRADIENTS.length];

  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(
    character.portraitImageUrl || character.referenceImageUrl || null
  );

  const [editingDesc, setEditingDesc] = useState(false);
  const [desc, setDesc] = useState(character.description ?? '');
  const [locked, setLocked] = useState(character.locked);
  const [deleting, setDeleting] = useState(false);

  const traits = character.personalityTraits
    ? character.personalityTraits.split(",").map(t => t.trim()).slice(0, 3)
    : [];

  const displayImage = localPreview || imageUrl;

  /* ---------------- IMAGE UPLOAD ---------------- */

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
      fd.append('characterId', character.id);

      const res = await fetch('/api/characters/upload-reference', {
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
      const res = await fetch('/api/characters/use-ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id }),
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
    await fetch('/api/characters/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterId: character.id,
        description: desc,
      }),
    });
  }

  async function lockCharacter() {

    await fetch('/api/characters/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: character.id }),
    });

    setLocked(true);
    setEditingDesc(false);
  }

  async function unlockCharacter() {
    await fetch('/api/characters/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterId: character.id }),
    });

    setLocked(false);
  }

  async function deleteCharacter() {
    const confirmed = window.confirm(
      `Delete ${character.name}? This action cannot be undone.`
    );
    
    if (!confirmed) return;
    
    if (onDelete) {
      onDelete(character.id);
    }
    
    setDeleting(true);
    
    try {
      const res = await fetch(`/api/characters/${character.id}`, {
        method: 'DELETE',
      });
      
      if (!res.ok) {
        alert('Failed to delete character');
        if (!onDelete) {
          router.refresh();
        }
      } else if (!onDelete) {
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete character');
      if (!onDelete) {
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <motion.div
      layout
      whileHover={{ y: -4 }}
      className={`
        group relative
        bg-white
        rounded-2xl
        overflow-hidden
        shadow-sm hover:shadow-2xl
        border-2 transition-all duration-300
        ${locked 
          ? 'border-violet-200 bg-violet-50/30' 
          : 'border-slate-200 hover:border-slate-300'
        }
      `}
    >
      {/* LOCKED BADGE */}
      {locked && (
        <div className="absolute top-3 right-3 z-20">
          <div className="
            px-2.5 py-1 rounded-full
            bg-violet-500 text-white
            text-xs font-bold
            flex items-center gap-1
            shadow-lg
          ">
            <Lock className="w-3 h-3" />
            Locked
          </div>
        </div>
      )}

      {/* IMAGE */}
      <div 
        className="relative aspect-[3/4] overflow-hidden"
      >
        {displayImage ? (
          <img
            src={displayImage}
            alt={character.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`
            w-full h-full
            bg-gradient-to-br ${gradient}
            flex items-center justify-center
          `}>
            <div className="text-8xl font-black text-white/20">
              {character.name.charAt(0)}
            </div>
          </div>
        )}

        {/* UPLOAD OVERLAY - Only show on hover and when not locked */}
        {!locked && !uploading && (
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
              bg-black/40 backdrop-blur-[2px]
              opacity-0 group-hover:opacity-100
              transition-all duration-200
              flex items-center justify-center gap-2 p-4
            ">
              <button
                onClick={() => fileRef.current?.click()}
                className="
                  p-3 rounded-xl
                  bg-white/95 text-slate-900
                  hover:bg-white hover:scale-110
                  active:scale-95
                  transition-all
                  shadow-lg
                "
                title="Upload Photo"
              >
                <Upload className="w-5 h-5" />
              </button>

              <button
                onClick={useAiImage}
                className="
                  p-3 rounded-xl
                  bg-violet-500/95 text-white
                  hover:bg-violet-500 hover:scale-110
                  active:scale-95
                  transition-all
                  shadow-lg
                "
                title="Generate AI Portrait"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            </div>
          </>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <Loader2 className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm font-semibold">Processing...</p>
          </div>
        )}
      </div>

      {/* CONTENT */}
      <div className="p-5">
        
        {/* NAME */}
        <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-1">
          {character.name}
        </h3>

        {/* TRAITS */}
        {traits.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {traits.map((t, i) => (
              <span
                key={i}
                className="
                  px-2.5 py-1
                  rounded-full
                  bg-slate-100 text-slate-700
                  text-xs font-semibold
                "
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* DESCRIPTION */}
        {editingDesc && !locked ? (
          <div className="mb-3">
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="
                w-full rounded-xl p-3
                text-sm text-slate-700
                border-2 border-slate-200
                focus:border-violet-400 focus:outline-none
                resize-none
              "
              rows={3}
              autoFocus
              placeholder="Describe this character..."
            />
            <div className="flex gap-2 mt-2">
              <button
                onClick={saveDescription}
                className="
                  flex-1 px-3 py-2 rounded-lg
                  bg-slate-900 text-white text-xs font-semibold
                  hover:bg-slate-800 transition-colors
                  flex items-center justify-center gap-1
                "
              >
                <Check className="w-3 h-3" />
                Save
              </button>
              <button
                onClick={() => {
                  setDesc(character.description ?? '');
                  setEditingDesc(false);
                }}
                className="
                  px-3 py-2 rounded-lg
                  bg-slate-100 text-slate-600 text-xs font-semibold
                  hover:bg-slate-200 transition-colors
                "
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-600 mb-4 line-clamp-2 min-h-[40px]">
            {desc || (
              <span className="italic text-slate-400">
                No description yet
              </span>
            )}
          </p>
        )}

        {/* ACTIONS */}
        <div className="flex items-center gap-2">
          {locked ? (
            <>
              <button
                onClick={unlockCharacter}
                className="
                  flex-1 px-4 py-2.5 rounded-xl
                  bg-amber-50 border-2 border-amber-200
                  text-amber-700 font-semibold text-sm
                  hover:bg-amber-100 transition-colors
                  flex items-center justify-center gap-2
                "
              >
                <Unlock className="w-4 h-4" />
                Unlock
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditingDesc(true)}
                className="
                  flex-1 px-4 py-2.5 rounded-xl
                  bg-slate-100 text-slate-700
                  font-semibold text-sm
                  hover:bg-slate-200 transition-colors
                  flex items-center justify-center gap-2
                "
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>

              <button
                onClick={lockCharacter}
                className="
                  flex-1 px-4 py-2.5 rounded-xl
                  bg-gradient-to-r from-violet-500 to-purple-600
                  text-white font-semibold text-sm
                  hover:shadow-lg hover:scale-105
                  active:scale-95
                  transition-all
                  flex items-center justify-center gap-2
                "
              >
                <Lock className="w-4 h-4" />
                Lock
              </button>
            </>
          )}

          <button
            onClick={deleteCharacter}
            disabled={deleting}
            className="
              w-10 h-10
              rounded-xl
              bg-red-50 border-2 border-red-200
              text-red-600
              hover:bg-red-100
              transition-colors
              flex items-center justify-center
              disabled:opacity-50
            "
            title="Delete character"
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