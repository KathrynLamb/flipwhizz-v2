// src/app/stories/[id]/characters/components/CharacterCard.tsx
'use client';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebaseClient";
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Unlock,
  Upload,
  Sparkles,
  Check,
  ChevronDown,
  Loader2,
  Shirt,
  Camera,
  Save,
  X,
  Eye,
  MessageSquare,
  User,
  AlertTriangle,
} from 'lucide-react';
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
  visualDetails?: any;
};

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

const GRADIENTS = [
  { from: '#C77DFF', to: '#E07ABA' },
  { from: '#FFB347', to: '#FF8A65' },
  { from: '#A78BFA', to: '#67E8F9' },
  { from: '#F472B6', to: '#C084FC' },
  { from: '#34D399', to: '#60A5FA' },
  { from: '#FBBF24', to: '#F472B6' },
];

function formatOutfitKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/* MAIN CARD                                                           */
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
  const [validating, setValidating] = useState(false);       // NEW
  const [uploadError, setUploadError] = useState<string | null>(null); // NEW
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showOutfitChoice, setShowOutfitChoice] = useState(false);

  const [currentImageUrl, setCurrentImageUrl] = useState(
    character.portraitImageUrl || character.referenceImageUrl
  );

  // Editable state
  const [editName, setEditName] = useState(character.name);
  const [editDescription, setEditDescription] = useState(character.description || '');
  const [editAppearance, setEditAppearance] = useState(character.appearance || '');
  const [editTraits, setEditTraits] = useState(character.personalityTraits || '');
  const [outfitEdits, setOutfitEdits] = useState<Record<string, string>>(
    Object.fromEntries((character.outfits || []).map((o) => [o.id, o.outfitDescription]))
  );

  const traits = character.personalityTraits
    ? character.personalityTraits.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4)
    : [];

  const outfits = character.outfits || [];

  const photoAnalysis = (character.visualDetails as any)?.photoAnalysis as {
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
    setUploadError(null);
    setUploading(true);

    try {
      // ── HEIC conversion ──
      let uploadFile = file;
      if (
        file.name.toLowerCase().endsWith('.heic') ||
        file.name.toLowerCase().endsWith('.heif') ||
        file.type === 'image/heic' ||
        file.type === 'image/heif'
      ) {
        const heic2any = (await import('heic2any')).default;
        const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
        uploadFile = new File(
          [blob as Blob],
          file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg'),
          { type: 'image/jpeg' }
        );
      }

      // ── Upload to Firebase ──
      const path = `story-references/${storyId}/${crypto.randomUUID()}-${uploadFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, uploadFile, { contentType: uploadFile.type });
      const publicUrl = await getDownloadURL(storageRef);

      // ── Validate via Claude vision ──
      setUploading(false);
      setValidating(true);

      const validationRes = await fetch('/api/characters/validate-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrl, characterName: character.name }),
      });

      const validation = validationRes.ok ? await validationRes.json() : { valid: true };

      if (!validation.valid) {
        setUploadError(
          validation.message ||
            (validation.issue === 'group_photo'
              ? `Looks like a group photo — upload one with just ${character.name}`
              : 'Photo not suitable — try a clear solo photo')
        );
        // Orphaned Firebase upload — will be cleaned up by storage lifecycle rules
        return;
      }

      // ── Accepted — save to DB ──
      const res = await fetch('/api/characters/upload-reference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, imageUrl: publicUrl, storagePath: path }),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentImageUrl(data.url);
        onUpdate?.();
        router.refresh();
      }
    } catch (err) {
      console.error('Photo upload failed:', err);
      setUploadError('Photo upload failed — please try again');
    } finally {
      setUploading(false);
      setValidating(false);
    }
  }

  useEffect(() => {
    setEditName(character.name);
    setEditDescription(character.description || '');
    setEditAppearance(character.appearance || '');
    setEditTraits(character.personalityTraits || '');
    setCurrentImageUrl(character.portraitImageUrl || character.referenceImageUrl);
    setOutfitEdits(Object.fromEntries((character.outfits || []).map((o) => [o.id, o.outfitDescription])));
  }, [character]);

  async function useAiImage(outfitMode?: 'story' | 'reference') {
    if (locked) return;
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

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/characters/${character.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          appearance: editAppearance,
          personalityTraits: editTraits,
        }),
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

      setEditing(false);
      onUpdate?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditName(character.name);
    setEditDescription(character.description || '');
    setEditAppearance(character.appearance || '');
    setEditTraits(character.personalityTraits || '');
    setOutfitEdits(Object.fromEntries(outfits.map((o) => [o.id, o.outfitDescription])));
    setEditing(false);
  }

  const isBusy = uploading || validating;

  /* ── Render ── */

  return (
    <div
      className="relative overflow-hidden transition-all duration-300"
      style={{
        background: 'white',
        borderRadius: 20,
        border: locked ? '2px solid rgba(67,184,156,0.25)' : '1px solid rgba(180,150,210,0.1)',
        boxShadow: '0 2px 8px rgba(100,60,140,0.04), 0 8px 28px rgba(100,60,140,0.06)',
      }}
    >
      {/* ── Image area ── */}
      <div className="relative aspect-[4/3] overflow-hidden group">
        {currentImageUrl ? (
          <img src={currentImageUrl} alt={character.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
            <span className="text-7xl font-extrabold text-white/20 select-none">
              {character.name.charAt(0)}
            </span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Lock badge */}
        {locked && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
            style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', color: '#2FA482' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#43B89C' }} />
            Locked
          </div>
        )}

        {/* Upload controls */}
        {!locked && !isBusy && (
          <div className="absolute top-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => {
              setUploadError(null);
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/jpeg,image/png,image/webp,image/heic';
              input.onchange = (e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) uploadReference(f);
              };
              input.click();
            }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)', color: '#2D2235' }}>
              <Upload className="w-3 h-3" /> Photo
            </button>
            <button onClick={() => useAiImage()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #B05CE6, #D45DA0)', boxShadow: '0 2px 8px rgba(176,92,230,0.3)' }}>
              <Sparkles className="w-3 h-3" /> AI
            </button>
          </div>
        )}

        {/* Uploading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
            <span className="text-xs font-semibold text-white">Uploading…</span>
          </div>
        )}

        {/* Validating overlay — NEW */}
        {validating && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
            <Loader2 className="w-7 h-7 text-white animate-spin" />
            <span className="text-xs font-semibold text-white">Checking photo…</span>
          </div>
        )}

        {/* Outfit choice overlay */}
        <AnimatePresence>
          {showOutfitChoice && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center p-4"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={(e) => { if (e.target === e.currentTarget) setShowOutfitChoice(false); }}>
              <div className="w-full max-w-[260px] p-4 space-y-2.5 bg-white rounded-2xl shadow-2xl"
                style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
                <p className="text-xs font-bold text-center" style={{ color: '#2D2235' }}>What should they wear?</p>
                <button onClick={() => useAiImage('story')}
                  className="w-full py-2 rounded-xl text-[11px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #B05CE6, #D45DA0)' }}>
                  <Shirt className="w-3 h-3 inline mr-1" style={{ verticalAlign: '-1px' }} /> Story outfit
                </button>
                <button onClick={() => useAiImage('reference')}
                  className="w-full py-2 rounded-xl text-[11px] font-semibold"
                  style={{ border: '1px solid rgba(180,150,210,0.2)', color: '#6B5C80', background: 'white' }}>
                  <Upload className="w-3 h-3 inline mr-1" style={{ verticalAlign: '-1px' }} /> Keep photo outfit
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3.5 pt-8">
          <h3 className="text-lg font-extrabold text-white drop-shadow-lg leading-tight">
            {character.name}
          </h3>
          {character.role && (
            <p className="text-[11px] text-white/75 mt-0.5"
              style={{ fontFamily: "'Lora', serif", fontStyle: 'italic' }}>
              {character.role}
            </p>
          )}
        </div>
      </div>

      {/* ── Upload error banner — NEW ── */}
      <AnimatePresence>
        {uploadError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mt-3 flex items-start gap-2 px-3 py-2.5 rounded-xl text-[11px] font-semibold"
              style={{ background: 'rgba(217,119,6,0.07)', color: '#B45309', border: '1px solid rgba(217,119,6,0.18)' }}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span className="flex-1 leading-relaxed">{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Collapsed body — always visible ── */}
      <div className="px-4 pt-3.5 pb-1">
        {/* Traits */}
        {traits.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2.5">
            {traits.map((trait, i) => (
              <span key={i} className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
                style={{ background: 'rgba(199,125,255,0.08)', color: '#9B59D0' }}>
                {trait}
              </span>
            ))}
          </div>
        )}

        {/* Appearance preview */}
        {character.appearance && (
          <p className="text-[12px] leading-relaxed line-clamp-5 mb-2" style={{ color: '#5A4D6B' }}>
            {character.appearance}
          </p>
        )}

        {/* Quick stats row */}
        <div className="flex items-center gap-3 text-[10px] mb-2" style={{ color: '#A897BD' }}>
          {character.description && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Description
            </span>
          )}
          {outfits.length > 0 && (
            <span className="flex items-center gap-1">
              <Shirt className="w-3 h-3" /> {outfits.length} outfit{outfits.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Expand toggle ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors hover:bg-[rgba(180,150,210,0.04)]"
        style={{ color: '#A897BD', borderTop: '1px solid rgba(180,150,210,0.08)' }}
      >
        {expanded ? 'Less detail' : 'See all details'}
        <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* ── Expanded details ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3" style={{ borderTop: '1px solid rgba(180,150,210,0.06)' }}>

              {/* Photo suggestions */}
              {photoAnalysis && photoAnalysis.status !== 'handled' && (
                <PhotoSuggestions
                  characterId={character.id} storyId={storyId} analysis={photoAnalysis}
                  currentAppearance={character.appearance} currentDescription={character.description}
                  onAccepted={() => { onUpdate?.(); router.refresh(); }}
                />
              )}

              {/* Description */}
              {(character.description || editing) && (
                <DetailSection label="Description" icon={<MessageSquare className="w-3 h-3" />}>
                  {editing ? (
                    <textarea value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={3} className="w-full text-[12px] leading-relaxed p-2.5 rounded-lg border outline-none resize-y transition-colors focus:border-[#C77DFF] focus:ring-2 focus:ring-[rgba(199,125,255,0.1)]"
                      style={{ borderColor: 'rgba(180,150,210,0.15)', background: '#FDFBFF', color: '#2D2235' }}
                      placeholder="Who is this character?" />
                  ) : (
                    <p className="text-[12px] leading-relaxed" style={{ color: '#5A4D6B' }}>
                      {character.description}
                    </p>
                  )}
                </DetailSection>
              )}

              {/* Appearance (full) */}
              {(character.appearance || editing) && (
                <DetailSection label="Appearance" icon={<Eye className="w-3 h-3" />}>
                  {editing ? (
                    <textarea value={editAppearance}
                      onChange={(e) => setEditAppearance(e.target.value)}
                      rows={3} className="w-full text-[12px] leading-relaxed p-2.5 rounded-lg border outline-none resize-y transition-colors focus:border-[#C77DFF] focus:ring-2 focus:ring-[rgba(199,125,255,0.1)]"
                      style={{ borderColor: 'rgba(180,150,210,0.15)', background: '#FDFBFF', color: '#2D2235' }}
                      placeholder="Physical features, hair, eyes, build..." />
                  ) : (
                    <p className="text-[12px] leading-relaxed" style={{ color: '#5A4D6B' }}>
                      {character.appearance}
                    </p>
                  )}
                </DetailSection>
              )}

              {/* Outfits */}
              {outfits.length > 0 && (
                <DetailSection label={`${outfits.length} outfit${outfits.length !== 1 ? 's' : ''}`} icon={<Shirt className="w-3 h-3" />}>
                  <div className="space-y-2">
                    {outfits.map((outfit) => (
                      <div key={outfit.id} className="rounded-lg p-2.5"
                        style={{ background: 'rgba(200,180,220,0.05)', border: '1px solid rgba(180,150,210,0.06)' }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#C77DFF' }} />
                          <span className="text-[11px] font-bold" style={{ color: '#6B5C80' }}>
                            {formatOutfitKey(outfit.outfitKey)}
                          </span>
                          {outfit.triggerConditions && (
                            <span className="text-[9px] ml-auto px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(199,125,255,0.06)', color: '#9B59D0' }}>
                              {outfit.triggerConditions}
                            </span>
                          )}
                        </div>
                        {editing ? (
                          <textarea value={outfitEdits[outfit.id] || ''}
                            onChange={(e) => setOutfitEdits((prev) => ({ ...prev, [outfit.id]: e.target.value }))}
                            rows={2} className="w-full text-[11px] leading-relaxed p-2 rounded-md border outline-none resize-y transition-colors focus:border-[#C77DFF]"
                            style={{ borderColor: 'rgba(180,150,210,0.1)', background: 'white', color: '#2D2235' }} />
                        ) : (
                          <p className="text-[11px] leading-relaxed" style={{ color: '#8B7BA0' }}>
                            {outfit.outfitDescription}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </DetailSection>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action bar ── */}
      <div className="px-4 pb-4 flex gap-2">
        {editing ? (
          <>
            <button onClick={cancelEdit}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
              style={{ border: '1.5px solid rgba(180,150,210,0.15)', background: 'white', color: '#6B5C80' }}>
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #B05CE6, #D45DA0)', boxShadow: '0 3px 12px rgba(176,92,230,0.2)' }}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        ) : (
          <>
            {!locked && (
              <button onClick={() => { setExpanded(true); setEditing(true); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-semibold transition-all"
                style={{ border: '1.5px solid rgba(180,150,210,0.15)', background: 'white', color: '#6B5C80' }}>
                <Save className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            <button onClick={toggleLock}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[12px] font-bold transition-all"
              style={{
                background: locked ? '#E8F5F0' : 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                color: locked ? '#2FA482' : 'white',
                boxShadow: locked ? 'none' : '0 3px 12px rgba(176,92,230,0.2)',
                border: locked ? '1.5px solid rgba(67,184,156,0.2)' : 'none',
              }}>
              {locked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock In</>}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DETAIL SECTION — reusable labeled container                         */
/* ------------------------------------------------------------------ */

function DetailSection({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-2.5">
      <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-bold uppercase"
        style={{ color: '#A897BD', letterSpacing: '0.08em' }}>
        <span className="text-[#B8A5D0]">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}