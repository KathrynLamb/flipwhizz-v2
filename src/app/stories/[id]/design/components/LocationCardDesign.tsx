'use client'

import { useState, useRef } from 'react'
import { MapPin, Upload, Save, X, Loader2 } from 'lucide-react'

// Ensure we typed the prop correctly
type LocationProps = {
  location: {
    id: string;
    name: string;
    description?: string | null;
    aiSummary?: string | null; // Locations often use aiSummary as description
    referenceImageUrl?: string | null;
  };
  onUpdate?: (updatedLoc: any) => void; 
}

export default function LocationCardDesign({ location, onUpdate }: LocationProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Locations might use 'description' or 'aiSummary' depending on how extraction went
  const [descInput, setDescInput] = useState(location.aiSummary ?? location.description ?? "");
  const [imagePreview, setImagePreview] = useState(location.referenceImageUrl);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Handle File Selection & Upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optimistic preview
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      // Optional: formData.append("userId", "..."); if you have it context

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.url) {
        setImagePreview(data.url);
      }
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload image");
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Save Changes to DB
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // ✅ Points to your locations route
      const res = await fetch(`/api/locations/${location.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: descInput,
          referenceImageUrl: imagePreview,
        }),
      });

      if (!res.ok) throw new Error("Failed to save");

      setIsEditing(false);
      
      if (onUpdate) {
        onUpdate({ 
            ...location, 
            description: descInput, 
            aiSummary: descInput, // Update both to be safe in UI
            referenceImageUrl: imagePreview 
        });
      }

    } catch (err) {
      console.error(err);
      alert("Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex gap-4 transition-all hover:bg-white/[0.07] group">
      
      {/* --- IMAGE AREA --- */}
      <div className="relative shrink-0">
        <div 
          className="w-16 h-16 bg-black/40 rounded-lg overflow-hidden flex items-center justify-center border border-white/5 cursor-pointer relative"
          onClick={() => isEditing && fileInputRef.current?.click()}
        >
           {imagePreview ? (
             /* eslint-disable-next-line @next/next/no-img-element */
             <img src={imagePreview} alt={location.name} className="w-full h-full object-cover" />
           ) : (
             <MapPin className="w-6 h-6 text-white/20" />
           )}
           
           {/* Edit Overlay */}
           {isEditing && (
             <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
               <Upload className="w-4 h-4 text-white" />
             </div>
           )}
        </div>
        
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
            disabled={!isEditing}
        />
      </div>

      {/* --- TEXT AREA --- */}
      <div className="min-w-0 flex-1 flex flex-col justify-between">
        <div className="flex justify-between items-start">
            <h3 className="font-bold text-white text-sm">{location.name}</h3>
            
            {/* Action Buttons */}
            {isEditing ? (
              <div className="flex items-center gap-2">
                 <button 
                    onClick={() => setIsEditing(false)}
                    className="p-1 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition"
                 >
                    <X className="w-3 h-3" />
                 </button>
                 <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="p-1 rounded-full bg-amber-500 hover:bg-amber-400 text-black transition disabled:opacity-50"
                 >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                 </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="text-xs text-amber-500 hover:text-amber-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
              >
                  Edit
              </button>
            )}
        </div>

        {/* Description Field */}
        <div className="mt-1">
          {isEditing ? (
            <div className="relative">
              <textarea
                placeholder="Describe appearance..."
                value={descInput}
                onChange={(e) => setDescInput(e.target.value)}
                rows={2}
                className="
                  w-full resize-none rounded-lg bg-[#0F1115] text-slate-200
                  border border-white/10 px-3 py-2 text-xs leading-relaxed
                  focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20
                  custom-scrollbar
                "
              />
            </div>
          ) : (
            <p className="text-xs text-white/50 line-clamp-2 leading-relaxed">
              {descInput || <span className="italic opacity-50">No description yet...</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}