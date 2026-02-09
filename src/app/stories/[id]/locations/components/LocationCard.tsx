// src/app/stories/[id]/locations/components/LocationCard.tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  MapPin,
  Lock,
  Unlock,
  Loader2,
  Upload,
  Sparkles,
  Star,
  X,
} from "lucide-react";

type Location = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  portraitImageUrl: string | null;
  locked: boolean;
};

const VIBRANT_GRADIENTS = [
  "from-pink-400 via-purple-400 to-blue-400",
  "from-orange-400 via-pink-400 to-purple-400",
  "from-yellow-400 via-orange-400 to-pink-400",
  "from-green-400 via-teal-400 to-blue-400",
  "from-purple-400 via-pink-400 to-red-400",
  "from-blue-400 via-purple-400 to-pink-400",
];

export default function LocationCard({
  location,
  storyId,
  index = 0,
  onUpdate,
  onDelete,
}: {
  location: Location;
  storyId: string;
  index?: number;
  onUpdate?: () => void;
  onDelete?: (id: string) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  
  const [locked, setLocked] = useState(location.locked);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editData, setEditData] = useState({
    description: location.description || "",
  });

  const gradient = VIBRANT_GRADIENTS[index % VIBRANT_GRADIENTS.length];
  const imageUrl = location.portraitImageUrl || location.referenceImageUrl;

  async function toggleLock() {
    const endpoint = locked ? "/api/locations/unlock" : "/api/locations/lock";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationId: location.id }),
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
      fd.append("locationId", location.id);
      const res = await fetch("/api/locations/upload-reference", { 
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
      const res = await fetch("/api/locations/use-ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId: location.id }),
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
    const res = await fetch("/api/locations/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locationId: location.id,
        description: editData.description.trim(),
      }),
    });
    
    if (res.ok) {
      setShowEdit(false);
      onUpdate?.();
      router.refresh();
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${location.name}? This cannot be undone.`)) return;
    
    setDeleting(true);
    onDelete?.(location.id);
    
    await fetch(`/api/locations/${location.id}`, {
      method: "DELETE",
    });
    
    router.refresh();
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files && uploadReference(e.target.files[0])}
      />

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
              alt={location.name} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
              <span className="text-9xl font-black text-white/20">
                {location.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Upload Buttons */}
          {!locked && !uploading && (
            <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => fileRef.current?.click()}
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
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5 text-white/90" />
              <h3 className="text-2xl font-black text-white drop-shadow-lg">
                {location.name}
              </h3>
            </div>
          </div>
        </div>

        {/* Content Section */}
        <div className="p-6 space-y-4">
          
          {/* Description Preview */}
          {location.description && (
            <p className="text-sm text-gray-600 line-clamp-3">
              {location.description}
            </p>
          )}

          {!location.description && (
            <p className="text-sm text-gray-400 italic">
              No description yet
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

            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-10 h-10 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
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
            <div className="sticky top-0 bg-white border-b border-gray-200 px-8 py-6 rounded-t-3xl flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900">
                Edit {location.name}
              </h2>
              <button
                onClick={() => setShowEdit(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 space-y-6">
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData({ description: e.target.value })}
                  rows={8}
                  maxLength={500}
                  className="w-full rounded-xl border-2 border-gray-200 focus:border-purple-400 focus:outline-none px-4 py-3 text-gray-900 resize-none"
                  placeholder="Describe this location's atmosphere, key features, and significance to the story..."
                />
                <div className="mt-2 text-right">
                  <span className={`text-xs font-medium ${
                    editData.description.length > 450 
                      ? 'text-orange-600' 
                      : 'text-gray-500'
                  }`}>
                    {editData.description.length} / 500 characters
                  </span>
                </div>
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