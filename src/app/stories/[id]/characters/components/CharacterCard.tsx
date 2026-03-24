'use client';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebaseClient";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  Upload,
  Sparkles,
  X,
  Check,
  PenLine,
  ChevronRight,
  Loader2,
  Shirt,
} from 'lucide-react';
// import type { CharacterOutfit } from './CharactersClient';
import PhotoSuggestions from './PhotoSuggestions';
import { CharacterOutfit } from '@/app/stories/[id]/characters/CharactersClient';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

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
  outfits?: CharacterOutfit[];
};

/* ------------------------------------------------------------------ */
/* GRADIENT PALETTE                                                    */
/* ------------------------------------------------------------------ */

const GRADIENTS = [
  { from: '#C77DFF', to: '#E07ABA' },
  { from: '#FFB347', to: '#FF8A65' },
  { from: '#A78BFA', to: '#67E8F9' },
  { from: '#F472B6', to: '#C084FC' },
  { from: '#34D399', to: '#60A5FA' },
  { from: '#FBBF24', to: '#F472B6' },
];

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function formatOutfitKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* CARD                                                                */
/* ------------------------------------------------------------------ */

export default function CharacterCard({
  character,
  storyId,
  index = 0,
  onUpdate,
}: {
  character: Character;
  storyId: string;
  index?: number;
  onUpdate?: () => void;
}) {
  const router = useRouter();
  const grad = GRADIENTS[index % GRADIENTS.length];

  const [locked, setLocked] = useState(character.locked);
  const [uploading, setUploading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showOutfits, setShowOutfits] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(
    character.portraitImageUrl || character.referenceImageUrl
  );

  const traits = character.personalityTraits
    ? character.personalityTraits.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 3)
    : [];

  const outfits = character.outfits || [];

  // Photo analysis suggestions (from background Inngest job)
  const visualDetails = (character as any).visualDetails as Record<string, any> | null;
  const photoAnalysis = visualDetails?.photoAnalysis as {
    status: 'pending' | 'ready' | 'handled';
    suggestions?: any;
    imageUrl?: string;
  } | null;

  /* ── Actions ── */

  async function toggleLock() {
    const endpoint = locked ? '/api/characters/unlock' : '/api/characters/lock';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      // Step 1: Upload to Firebase
      const path = `story-references/${storyId}/${crypto.randomUUID()}-${file.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const publicUrl = await getDownloadURL(storageRef);
  
      // Step 2: Save URL to character
      const res = await fetch('/api/characters/upload-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId: character.id,
          imageUrl: publicUrl,
          storagePath: path,
        }),
      });
  
      if (res.ok) {
        const data = await res.json();
        setCurrentImageUrl(data.url);
        onUpdate?.();
        router.refresh();
      }
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploading(false);
    }
  }

  const [showOutfitChoice, setShowOutfitChoice] = useState(false);

  async function useAiImage(outfitMode?: 'story' | 'reference') {
    if (locked) return;

    // If there's a reference image and no mode chosen yet, ask
    if (currentImageUrl && !outfitMode) {
      setShowOutfitChoice(true);
      return;
    }

    setShowOutfitChoice(false);
    setUploading(true);
    try {
      const res = await fetch('/api/characters/use-ai-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, outfitMode }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) setCurrentImageUrl(data.url);
        onUpdate?.();
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div
        className="group relative overflow-hidden transition-all duration-300"
        style={{
          background: 'white',
          borderRadius: 22,
          border: locked ? '2px solid rgba(67,184,156,0.25)' : '1px solid rgba(180,150,210,0.1)',
          boxShadow: '0 2px 8px rgba(100,60,140,0.04), 0 12px 40px rgba(100,60,140,0.06)',
        }}
      >
        {/* Lock badge */}
        {locked && (
          <div
            className="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
            style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(8px)',
              color: '#2FA482',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
          >
            <div className="w-[7px] h-[7px] rounded-full" style={{ background: '#43B89C' }} />
            Locked
          </div>
        )}

        {/* Portrait */}
        <div className="relative aspect-[4/3] overflow-hidden">
          {currentImageUrl ? (
            <img
              src={currentImageUrl}
              alt={character.name}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
            >
              <span className="text-8xl font-extrabold text-white/25 select-none">
                {character.name.charAt(0)}
              </span>
            </div>
          )}

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Upload buttons */}
          {!locked && !uploading && (
            <div className="absolute top-3.5 left-3.5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) uploadReference(file);
                  };
                  input.click();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(8px)',
                  color: '#2D2235',
                  border: 'none',
                }}
              >
                <Upload className="w-3 h-3" /> Photo
              </button>
              <button
                onClick={() => useAiImage()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                  color: 'white',
                  border: 'none',
                  boxShadow: '0 2px 8px rgba(176,92,230,0.3)',
                }}
              >
                <Sparkles className="w-3 h-3" /> AI
              </button>
            </div>
          )}

          {/* Upload spinner */}
          {uploading && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}

          {/* Outfit choice popover */}
          <AnimatePresence>
            {showOutfitChoice && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-30 flex items-center justify-center p-4"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                onClick={(e) => { if (e.target === e.currentTarget) setShowOutfitChoice(false); }}
              >
                <div
                  className="w-full max-w-[280px] p-5 space-y-3"
                  style={{
                    background: 'white',
                    borderRadius: 20,
                    boxShadow: '0 20px 60px rgba(45,34,53,0.3)',
                    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
                  }}
                >
                  <h4 className="text-sm font-bold text-center" style={{ color: '#2D2235' }}>
                    What should they wear?
                  </h4>
                  <p className="text-[11px] text-center leading-relaxed" style={{ color: '#8B7BA0' }}>
                    You uploaded a reference photo. Should the AI portrait use the story's outfit or keep what's in the photo?
                  </p>
                  <button
                    onClick={() => useAiImage('story')}
                    className="w-full py-2.5 rounded-xl text-[12px] font-bold text-white"
                    style={{
                      background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                      border: 'none',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <Shirt className="w-3.5 h-3.5 inline mr-1.5" style={{ verticalAlign: '-2px' }} />
                    Use story outfit
                  </button>
                  <button
                    onClick={() => useAiImage('reference')}
                    className="w-full py-2.5 rounded-xl text-[12px] font-semibold"
                    style={{
                      background: 'white',
                      border: '1.5px solid rgba(180,150,210,0.2)',
                      color: '#6B5C80',
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <Upload className="w-3.5 h-3.5 inline mr-1.5" style={{ verticalAlign: '-2px' }} />
                    Keep photo's outfit
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-5">
            <h3 className="text-xl font-extrabold text-white drop-shadow-lg">
              {character.name}
            </h3>
            {character.role && (
              <p
                className="text-xs font-medium mt-0.5"
                style={{ color: 'rgba(255,255,255,0.85)', fontFamily: "'Lora', serif", fontStyle: 'italic' }}
              >
                {character.role}
              </p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3.5">
          {/* Traits */}
          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {traits.map((trait, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ background: 'rgba(199,125,255,0.08)', color: '#9B59D0' }}
                >
                  {trait}
                </span>
              ))}
            </div>
          )}

          {/* Appearance preview */}
          {character.appearance && (
            <div
              className="p-3 rounded-xl"
              style={{
                background: '#FDFBFF',
                border: '1px solid rgba(180,150,210,0.08)',
              }}
            >
              <div
                className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold uppercase"
                style={{ color: '#A897BD', letterSpacing: '0.1em' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                Appearance
              </div>
              <p
                className="text-[12.5px] leading-relaxed line-clamp-2"
                style={{ color: '#5A4D6B' }}
              >
                {character.appearance}
              </p>
            </div>
          )}

          {/* Photo analysis suggestions */}
          {photoAnalysis && photoAnalysis.status !== 'handled' && (
            <PhotoSuggestions
              characterId={character.id}
              storyId={storyId}
              analysis={photoAnalysis}
              currentAppearance={character.appearance}
              currentDescription={character.description}
              onAccepted={() => {
                onUpdate?.();
                router.refresh();
              }}
            />
          )}

          {/* Outfits pill */}
          {outfits.length > 0 && (
            <button
              onClick={() => setShowOutfits(!showOutfits)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
              style={{
                background: showOutfits ? 'rgba(199,125,255,0.12)' : 'rgba(199,125,255,0.06)',
                color: '#9B59D0',
                border: 'none',
                fontFamily: 'inherit',
              }}
            >
              <Shirt className="w-3 h-3" />
              {outfits.length} outfit{outfits.length !== 1 ? 's' : ''} detected
              <ChevronRight
                className="w-3 h-3 transition-transform"
                style={{ transform: showOutfits ? 'rotate(90deg)' : 'none' }}
              />
            </button>
          )}

          {/* Outfits expanded */}
          <AnimatePresence>
            {showOutfits && outfits.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="flex flex-col gap-1.5 pt-1">
                  {outfits.map((outfit) => (
                    <div
                      key={outfit.id}
                      className="flex items-start gap-2 px-3 py-2 rounded-lg"
                      style={{ background: 'rgba(200,180,220,0.06)' }}
                    >
                      <span
                        className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: '#C77DFF' }}
                      />
                      <div>
                        <div
                          className="text-[11px] font-bold"
                          style={{ color: '#6B5C80' }}
                        >
                          {formatOutfitKey(outfit.outfitKey)}
                        </div>
                        <div
                          className="text-[11px] leading-snug line-clamp-2"
                          style={{ color: '#8B7BA0' }}
                        >
                          {outfit.outfitDescription}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              border: '1.5px solid rgba(180,150,210,0.18)',
              background: 'white',
              color: '#6B5C80',
              fontFamily: 'inherit',
            }}
          >
            <PenLine className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={toggleLock}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
            style={{
              border: 'none',
              background: locked
                ? '#E8F5F0'
                : `linear-gradient(135deg, #B05CE6, #D45DA0)`,
              color: locked ? '#2FA482' : 'white',
              fontFamily: 'inherit',
              boxShadow: locked ? 'none' : '0 3px 12px rgba(176,92,230,0.2)',
              ...(locked ? { border: '1.5px solid rgba(67,184,156,0.2)' } : {}),
            }}
          >
            {locked ? (
              <><Unlock className="w-3.5 h-3.5" /> Unlock</>
            ) : (
              <><Lock className="w-3.5 h-3.5" /> Lock In</>
            )}
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {showEdit && (
        <EditModal
          character={character}
          storyId={storyId}
          outfits={outfits}
          onClose={() => setShowEdit(false)}
          onSave={() => {
            setShowEdit(false);
            onUpdate?.();
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* EDIT MODAL                                                          */
/* ------------------------------------------------------------------ */

function EditModal({
  character,
  storyId,
  outfits,
  onClose,
  onSave,
}: {
  character: Character;
  storyId: string;
  outfits: CharacterOutfit[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [editData, setEditData] = useState({
    description: character.description || '',
    appearance: character.appearance || '',
    personalityTraits: character.personalityTraits || '',
  });
  const [outfitEdits, setOutfitEdits] = useState<Record<string, string>>(
    Object.fromEntries(outfits.map((o) => [o.id, o.outfitDescription]))
  );
  const [showOutfitSection, setShowOutfitSection] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const charRes = await fetch(`/api/characters/${character.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });

      const outfitPromises = outfits
        .filter((o) => outfitEdits[o.id] !== o.outfitDescription)
        .map((o) =>
          fetch(`/api/stories/${storyId}/outfits/${o.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ outfitDescription: outfitEdits[o.id] }),
          })
        );

      await Promise.all(outfitPromises);

      if (charRes.ok) {
        onSave();
      }
    } finally {
      setSaving(false);
    }
  }

  const fieldStyles: React.CSSProperties = {
    width: '100%',
    borderRadius: 12,
    border: '2px solid rgba(180,150,210,0.15)',
    background: '#FDFBFF',
    color: '#2D2235',
    fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
    fontSize: 14,
    lineHeight: 1.6,
    padding: '12px 16px',
    outline: 'none',
    resize: 'vertical' as const,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(45,34,53,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-h-[90vh] overflow-y-auto"
        style={{
          maxWidth: 640,
          background: 'white',
          borderRadius: 24,
          boxShadow: '0 30px 80px rgba(45,34,53,0.25)',
          fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-8 py-6 flex items-center justify-between"
          style={{
            background: 'white',
            borderBottom: '1px solid rgba(180,150,210,0.1)',
            borderRadius: '24px 24px 0 0',
          }}
        >
          <h3 className="text-xl font-extrabold" style={{ color: '#2D2235' }}>
            Edit {character.name}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[10px] flex items-center justify-center transition-colors"
            style={{ background: 'rgba(180,150,210,0.08)', border: 'none', color: '#8B7BA0', cursor: 'pointer' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="px-8 py-6 space-y-6">
          {/* Description */}
          <div>
            <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, fontWeight: 700, color: '#2D2235' }}>
              <span style={{ fontSize: 16 }}>💭</span> Description
            </label>
            <textarea
              value={editData.description}
              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
              rows={4}
              placeholder="Personality, background, role in the story..."
              style={fieldStyles}
              onFocus={(e) => {
                e.target.style.borderColor = '#C77DFF';
                e.target.style.boxShadow = '0 0 0 4px rgba(199,125,255,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(180,150,210,0.15)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Appearance */}
          <div>
            <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, fontWeight: 700, color: '#2D2235' }}>
              <span style={{ fontSize: 16 }}>👁️</span> Appearance
            </label>
            <textarea
              value={editData.appearance}
              onChange={(e) => setEditData({ ...editData, appearance: e.target.value })}
              rows={4}
              placeholder="Physical features, clothing, colours, distinguishing features..."
              style={fieldStyles}
              onFocus={(e) => {
                e.target.style.borderColor = '#C77DFF';
                e.target.style.boxShadow = '0 0 0 4px rgba(199,125,255,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(180,150,210,0.15)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <p className="mt-2 text-xs leading-relaxed" style={{ color: '#A897BD' }}>
              Be specific! Hair colour, eye colour, clothing, distinguishing features — these directly guide the AI illustrator.
            </p>
          </div>

          {/* Personality Traits */}
          <div>
            <label className="flex items-center gap-2 mb-3" style={{ fontSize: 13, fontWeight: 700, color: '#2D2235' }}>
              <span style={{ fontSize: 16 }}>✨</span> Personality Traits
              <span style={{ fontSize: 12, fontWeight: 400, color: '#A897BD', marginLeft: 4 }}>(comma separated)</span>
            </label>
            <input
              type="text"
              value={editData.personalityTraits}
              onChange={(e) => setEditData({ ...editData, personalityTraits: e.target.value })}
              placeholder="brave, funny, kind, curious"
              style={{ ...fieldStyles, resize: 'none' as const }}
              onFocus={(e) => {
                e.target.style.borderColor = '#C77DFF';
                e.target.style.boxShadow = '0 0 0 4px rgba(199,125,255,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(180,150,210,0.15)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Outfits */}
          {outfits.length > 0 && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid rgba(180,150,210,0.1)', background: '#FDFBFF' }}
            >
              <button
                onClick={() => setShowOutfitSection(!showOutfitSection)}
                className="flex items-center gap-3 w-full text-left px-5 py-4"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <Shirt className="w-4 h-4" style={{ color: '#9B59D0' }} />
                <span className="text-sm font-bold flex-1" style={{ color: '#2D2235' }}>
                  {outfits.length} Outfit Variation{outfits.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs" style={{ color: '#A897BD' }}>
                  {showOutfitSection ? 'Hide' : 'Show & Edit'}
                </span>
                <ChevronRight
                  className="w-4 h-4 transition-transform"
                  style={{ color: '#A897BD', transform: showOutfitSection ? 'rotate(90deg)' : 'none' }}
                />
              </button>

              <AnimatePresence>
                {showOutfitSection && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div
                      className="px-5 pb-5 space-y-3"
                      style={{ borderTop: '1px solid rgba(180,150,210,0.08)' }}
                    >
                      <p className="text-xs pt-3" style={{ color: '#A897BD' }}>
                        These describe what each character wears in different scenes. Edit to fine-tune the illustrations.
                      </p>
                      {outfits.map((outfit) => (
                        <div
                          key={outfit.id}
                          className="rounded-xl p-4"
                          style={{ background: 'white', border: '1px solid rgba(180,150,210,0.1)' }}
                        >
                          <div className="flex items-center gap-2 mb-2.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#C77DFF' }} />
                            <span className="text-[13px] font-bold" style={{ color: '#2D2235' }}>
                              {formatOutfitKey(outfit.outfitKey)}
                            </span>
                            {outfit.triggerConditions && (
                              <span
                                className="text-[10px] ml-auto px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(199,125,255,0.08)', color: '#9B59D0' }}
                              >
                                {outfit.triggerConditions}
                              </span>
                            )}
                          </div>
                          <textarea
                            value={outfitEdits[outfit.id] || ''}
                            onChange={(e) =>
                              setOutfitEdits((prev) => ({ ...prev, [outfit.id]: e.target.value }))
                            }
                            rows={2}
                            style={{
                              ...fieldStyles,
                              fontSize: 13,
                              padding: '10px 14px',
                              border: '1.5px solid rgba(180,150,210,0.12)',
                            }}
                            onFocus={(e) => {
                              e.target.style.borderColor = '#C77DFF';
                              e.target.style.boxShadow = '0 0 0 3px rgba(199,125,255,0.08)';
                            }}
                            onBlur={(e) => {
                              e.target.style.borderColor = 'rgba(180,150,210,0.12)';
                              e.target.style.boxShadow = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="sticky bottom-0 px-8 py-6 flex gap-3"
          style={{
            background: 'rgba(253,251,255,0.95)',
            backdropFilter: 'blur(8px)',
            borderTop: '1px solid rgba(180,150,210,0.1)',
            borderRadius: '0 0 24px 24px',
          }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-[14px] text-sm font-semibold transition-all"
            style={{
              border: '2px solid rgba(180,150,210,0.15)',
              background: 'white',
              color: '#6B5C80',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3.5 rounded-[14px] text-sm font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
              boxShadow: '0 4px 16px rgba(176,92,230,0.2)',
              border: 'none',
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            ) : (
              <><Check className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}