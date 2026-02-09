// src/app/stories/[id]/characters/components/CharacterCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Unlock, Upload, Sparkles, Star } from "lucide-react";

type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance: string | null;
  personalityTraits: string | null;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  locked: boolean;
  role?: string | null;
  age?: string | null;
};

const VIBRANT_GRADIENTS = [
  "from-pink-400 via-purple-400 to-blue-400",
  "from-orange-400 via-pink-400 to-purple-400",
  "from-yellow-400 via-orange-400 to-pink-400",
  "from-green-400 via-teal-400 to-blue-400",
  "from-purple-400 via-pink-400 to-red-400",
  "from-blue-400 via-purple-400 to-pink-400",
];

export default function CharacterCard({
  character,
  storyId, // ✅ Pass this as prop from parent
  index = 0,
  onUpdate,
}: {
  character: Character;
  storyId: string; // ✅ Required prop
  index?: number;
  onUpdate?: () => void;
}) {
  const router = useRouter();
  const [locked, setLocked] = useState(character.locked);
  const [uploading, setUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({
    description: character.description || "",
    appearance: character.appearance || "",
    personalityTraits: character.personalityTraits || "",
  });

  const gradient = VIBRANT_GRADIENTS[index % VIBRANT_GRADIENTS.length];
  const imageUrl = character.portraitImageUrl || character.referenceImageUrl;
  const traits = character.personalityTraits
    ? character.personalityTraits.split(",").map(t => t.trim()).filter(Boolean).slice(0, 3)
    : [];

  async function toggleLock() {
    const endpoint = locked ? "/api/characters/unlock" : "/api/characters/lock";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: character.id }),
    });
    
    if (res.ok) {
      setLocked(!locked);
      onUpdate?.();
    }
  }

  async function uploadReference(file: File) {
    if (locked) return;
    setUploading(true);
    
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("characterId", character.id);
      const res = await fetch("/api/characters/upload-reference", { 
        method: "POST", 
        body: fd 
      });
      
      if (res.ok) {
        onUpdate?.();
        router.refresh();
      }
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
      
      if (res.ok) {
        onUpdate?.();
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  async function saveEdit() {
    const res = await fetch(`/api/characters/${character.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editData),
    });
    
    if (res.ok) {
      setShowEdit(false);
      onUpdate?.();
      router.refresh();
    }
  }

  return (
    <>
      <div className="group relative bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
        
        {/* Lock Badge */}
        {locked && (
          <div className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-400 text-white text-xs font-bold shadow-lg">
            <Star className="w-3 h-3 fill-current" />
            Locked
          </div>
        )}

        {/* Image Section */}
        <div className="relative aspect-[3/4] overflow-hidden">
          {imageUrl ? (
            <img 
              src={imageUrl} 
              alt={character.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-9xl font-black text-white/20">
                {character.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Upload Buttons */}
          {!locked && !uploading && (
            <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-900 text-xs font-semibold hover:bg-white transition-colors shadow-lg"
              >
                <Upload className="w-3 h-3" />
                Photo
              </button>
              
              <button
                onClick={useAiImage}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500 text-white text-xs font-semibold hover:bg-purple-600 transition-colors shadow-lg"
              >
                <Sparkles className="w-3 h-3" />
                AI
              </button>
            </div>
          )}

          {/* Uploading Overlay */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h3 className="text-2xl font-black text-white drop-shadow-lg mb-2">
              {character.name}
            </h3>
            {character.role && (
              <p className="text-sm text-white/90 font-medium">
                {character.role}
              </p>
            )}
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-4">
          
          {/* Traits */}
          {traits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {traits.map((trait, i) => (
                <span
                  key={i}
                  className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold"
                >
                  {trait}
                </span>
              ))}
            </div>
          )}

          {/* Description Preview */}
          {character.description && (
            <p className="text-sm text-gray-600 line-clamp-3">
              {character.description}
            </p>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowEdit(true)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold text-sm transition-colors"
            >
              Edit Details
            </button>
            
            <button
              onClick={toggleLock}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                locked
                  ? "bg-gradient-to-r from-green-400 to-emerald-400 text-white hover:shadow-lg"
                  : "bg-gradient-to-r from-pink-500 to-purple-500 text-white hover:shadow-lg"
              }`}
            >
              {locked ? (
                <>
                  <Unlock className="w-4 h-4" />
                  Unlock
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Lock In
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl">
              <h2 className="text-2xl font-black text-gray-900">
                Edit {character.name}
              </h2>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-6">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none px-4 py-3 text-gray-900"
                  placeholder="Personality, background, role in the story..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Appearance
                </label>
                <textarea
                  value={editData.appearance}
                  onChange={(e) => setEditData({ ...editData, appearance: e.target.value })}
                  rows={4}
                  className="w-full rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none px-4 py-3 text-gray-900"
                  placeholder="Physical features, clothing, colors, distinguishing features..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Personality Traits
                  <span className="text-gray-500 font-normal ml-2">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={editData.personalityTraits}
                  onChange={(e) => setEditData({ ...editData, personalityTraits: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none px-4 py-3 text-gray-900"
                  placeholder="brave, funny, kind, curious"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-8 py-6 rounded-b-3xl flex gap-3">
              <button
                onClick={() => setShowEdit(false)}
                className="flex-1 px-6 py-3 rounded-xl bg-white border-2 border-gray-200 text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold hover:shadow-lg transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}