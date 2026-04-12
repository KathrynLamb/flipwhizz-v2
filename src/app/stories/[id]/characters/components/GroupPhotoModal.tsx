'use client';

/**
 * GroupPhotoModal.tsx
 *
 * Drop-in modal for the CharactersClient page.
 * Flow:
 *   1. User uploads one group photo
 *   2. Face detection runs (face-api.js) → bounding boxes overlaid
 *   3. For each character: user taps the right face → confirmed
 *   4. Per assignment: crop face from canvas → upload to Firebase →
 *      POST /api/characters/upload-reference → POST /api/characters/use-ai-image
 *   5. onComplete() called → parent does router.refresh()
 *
 * Usage in CharactersClient:
 *   <GroupPhotoModal
 *     storyId={storyId}
 *     characters={charactersLocal}
 *     onComplete={() => router.refresh()}
 *     onClose={() => setShowGroupPhoto(false)}
 *   />
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, ChevronRight, Loader2, Check, Users, AlertCircle } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebaseClient';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type Character = {
  id: string;
  name: string;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
};

type DetectedFace = {
  id: string;
  /** All values 0–1, relative to natural image dimensions */
  x: number;
  y: number;
  w: number;
  h: number;
};

type Assignment = {
  characterId: string;
  faceId: string;
};

type CharacterStatus = 'pending' | 'uploading' | 'generating' | 'done' | 'error';

/* ------------------------------------------------------------------ */
/* FACE-API LOADER                                                     */
/* ------------------------------------------------------------------ */

let faceApiLoaded = false;
let faceApiLoading = false;
const faceApiCallbacks: Array<() => void> = [];

async function loadFaceApi(): Promise<void> {
  if (faceApiLoaded) return;
  if (faceApiLoading) {
    return new Promise((res) => faceApiCallbacks.push(res));
  }
  faceApiLoading = true;

  // Dynamically import face-api.js — add to package.json: "face-api.js": "^0.22.2"
  const faceapi = await import('face-api.js');
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/weights'),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri('/weights'),
  ]);

  faceApiLoaded = true;
  faceApiLoading = false;
  faceApiCallbacks.forEach((cb) => cb());
  faceApiCallbacks.length = 0;
}

async function detectFaces(imgEl: HTMLImageElement): Promise<DetectedFace[]> {
  const faceapi = await import('face-api.js');
  const detections = await faceapi.detectAllFaces(
    imgEl,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
  );

  const scaleX = 1 / imgEl.naturalWidth;
  const scaleY = 1 / imgEl.naturalHeight;

  return detections.map((d, i) => ({
    id: `face-${i}`,
    x: d.box.x * scaleX,
    y: d.box.y * scaleY,
    w: d.box.width * scaleX,
    h: d.box.height * scaleY,
  }));
}

/* ------------------------------------------------------------------ */
/* CANVAS CROP UTILITY                                                 */
/* ------------------------------------------------------------------ */

async function cropFaceToBlob(
  imgEl: HTMLImageElement,
  face: DetectedFace
): Promise<Blob> {
  const NW = imgEl.naturalWidth;
  const NH = imgEl.naturalHeight;

  // Add generous padding so Gemini has context (shoulders, neck)
  const PAD_X = face.w * NW * 0.7;        // wide enough for shoulders
  const PAD_TOP = face.h * NH * 1.1;      // tall above for hats / hair
  const PAD_BOTTOM = face.h * NH * 1.2;   // below for neck, chest, clothing

  const sx = Math.max(0, face.x * NW - PAD_X);
  const sy = Math.max(0, face.y * NH - PAD_TOP);
  const sw = Math.min(NW - sx, face.w * NW + PAD_X * 2);
  const sh = Math.min(NH - sy, face.h * NH + PAD_TOP + PAD_BOTTOM);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, sw, sh);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/jpeg', 0.92);
  });
}

/* ------------------------------------------------------------------ */
/* FIREBASE UPLOAD + PORTRAIT GENERATION                              */
/* ------------------------------------------------------------------ */

async function uploadCropAndGenerate(
  characterId: string,
  storyId: string,
  blob: Blob
): Promise<void> {
  // 1. Upload cropped face to Firebase
  const path = `story-references/${storyId}/${crypto.randomUUID()}-group-crop.jpg`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const publicUrl = await getDownloadURL(storageRef);

  // 2. Save as referenceImageUrl
  const uploadRes = await fetch('/api/characters/upload-reference', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, imageUrl: publicUrl, storagePath: path }),
  });
  if (!uploadRes.ok) throw new Error('Failed to save reference image');

  // 3. Generate AI portrait from reference
  const genRes = await fetch('/api/characters/use-ai-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId }),
  });
  if (!genRes.ok) throw new Error('Failed to generate portrait');
}

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function getClosestFace(
  tapX: number,
  tapY: number,
  faces: DetectedFace[],
  displayW: number,
  displayH: number
): DetectedFace | null {
  let closest: DetectedFace | null = null;
  let minDist = Infinity;

  for (const face of faces) {
    const cx = (face.x + face.w / 2) * displayW;
    const cy = (face.y + face.h / 2) * displayH;
    const dist = Math.hypot(tapX - cx, tapY - cy);
    if (dist < minDist) {
      minDist = dist;
      closest = face;
    }
  }

  if (!closest) return null;
  const avgRadius = ((closest.w + closest.h) / 4) * Math.max(displayW, displayH);
  return minDist < avgRadius * 1.8 ? closest : null;
}

/* ------------------------------------------------------------------ */
/* SUB-COMPONENTS                                                      */
/* ------------------------------------------------------------------ */

function FaceBox({
  face,
  displayW,
  displayH,
  state,
}: {
  face: DetectedFace;
  displayW: number;
  displayH: number;
  state: 'idle' | 'selected' | 'assigned';
}) {
  const PAD = 8;
  const left = face.x * displayW - PAD;
  const top = face.y * displayH - PAD;
  const width = face.w * displayW + PAD * 2;
  const height = face.h * displayH + PAD * 2;

  const styles = {
    idle: { border: '2px solid rgba(255,255,255,0.5)', background: 'transparent', shadow: 'none' },
    selected: { border: '2.5px solid #D94590', background: 'rgba(217,69,144,0.08)', shadow: '0 0 0 4px rgba(217,69,144,0.2)' },
    assigned: { border: '2.5px solid #43B89C', background: 'rgba(67,184,156,0.08)', shadow: 'none' },
  }[state];

  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        borderRadius: 10,
        border: styles.border,
        background: styles.background,
        boxShadow: styles.shadow,
        pointerEvents: 'none',
        transition: 'all 0.18s ease',
      }}
    />
  );
}

function NameBadge({
  name,
  face,
  displayW,
  displayH,
}: {
  name: string;
  face: DetectedFace;
  displayW: number;
  displayH: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: (face.x + face.w / 2) * displayW,
        top: (face.y + face.h) * displayH + 14,
        transform: 'translateX(-50%)',
        background: '#43B89C',
        color: '#fff',
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "'Bricolage Grotesque', sans-serif",
        padding: '3px 10px',
        borderRadius: 999,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(67,184,156,0.35)',
      }}
    >
      {name}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function GroupPhotoModal({
  storyId,
  characters,
  onComplete,
  onClose,
}: {
  storyId: string;
  characters: Character[];
  onComplete: () => void;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<'upload' | 'detect' | 'assign' | 'generate'>('upload');
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);

  // Assignment state
  const [activeCharIdx, setActiveCharIdx] = useState(0);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedFaceId, setSelectedFaceId] = useState<string | null>(null);

  // Generation state
  const [statuses, setStatuses] = useState<Record<string, CharacterStatus>>({});
  const [generationDone, setGenerationDone] = useState(false);

  const activeChar = characters[activeCharIdx] ?? null;
  const assignedFaceIds = new Set(assignments.map((a) => a.faceId));
  const assignedCharIds = new Set(assignments.map((a) => a.characterId));
  const allAssigned = characters.every((c) => assignedCharIds.has(c.id));

  // Measure image display size
  useEffect(() => {
    if (!imgRef.current) return;
    const measure = () => {
      if (imgRef.current) {
        setDisplaySize({ w: imgRef.current.offsetWidth, h: imgRef.current.offsetHeight });
      }
    };
    const ro = new ResizeObserver(measure);
    ro.observe(imgRef.current);
    measure();
    return () => ro.disconnect();
  }, [photoSrc]);

  // Load face-api models on mount
  useEffect(() => {
    loadFaceApi().catch(console.error);
  }, []);

  /* ── Photo selection ── */

  async function handlePhotoSelected(file: File) {
    // HEIC conversion if needed
    let useFile = file;
    if (
      file.name.toLowerCase().endsWith('.heic') ||
      file.name.toLowerCase().endsWith('.heif') ||
      file.type === 'image/heic' ||
      file.type === 'image/heif'
    ) {
      const heic2any = (await import('heic2any')).default;
      const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 });
      useFile = new File(
        [blob as Blob],
        file.name.replace(/\.(heic|heif)$/i, '.jpg'),
        { type: 'image/jpeg' }
      );
    }

    setPhotoFile(useFile);
    const url = URL.createObjectURL(useFile);
    setPhotoSrc(url);
    setPhase('detect');
  }

  /* ── Face detection ── */

  async function runDetection() {
    if (!imgRef.current) return;
    setDetecting(true);
    setDetectError(null);
    try {
      await loadFaceApi();
      const detected = await detectFaces(imgRef.current);
      if (detected.length === 0) {
        setDetectError("No faces detected. Try a clearer photo or one with faces more visible.");
        setPhase('upload');
        return;
      }
      setFaces(detected);
      setPhase('assign');
    } catch (err) {
      console.error(err);
      setDetectError("Face detection failed. Please try again.");
      setPhase('upload');
    } finally {
      setDetecting(false);
    }
  }

  // Auto-run detection when image loads
  const handleImageLoad = useCallback(() => {
    if (phase === 'detect') runDetection();
  }, [phase]);

  /* ── Tap handling ── */

  function handleTap(e: React.MouseEvent | React.TouchEvent) {
    if (phase !== 'assign' || !imgRef.current || !activeChar) return;

    const rect = imgRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const tapX = clientX - rect.left;
    const tapY = clientY - rect.top;

    const face = getClosestFace(tapX, tapY, faces, displaySize.w, displaySize.h);
    if (!face) return;

    // Don't allow selecting a face already assigned to another character
    const existingAssignment = assignments.find((a) => a.faceId === face.id);
    if (existingAssignment && existingAssignment.characterId !== activeChar.id) return;

    setSelectedFaceId(face.id === selectedFaceId ? null : face.id);
  }

  /* ── Confirm assignment ── */

  function confirmAssignment() {
    if (!selectedFaceId || !activeChar) return;

    const newAssignments = [
      ...assignments.filter((a) => a.characterId !== activeChar.id),
      { characterId: activeChar.id, faceId: selectedFaceId },
    ];
    setAssignments(newAssignments);
    setSelectedFaceId(null);

    // Advance to next unassigned character
    const newAssignedCharIds = new Set(newAssignments.map((a) => a.characterId));
    const nextIdx = characters.findIndex((c, i) => i > activeCharIdx && !newAssignedCharIds.has(c.id));
    if (nextIdx !== -1) {
      setActiveCharIdx(nextIdx);
    }
  }

  /* ── Generate portraits ── */

  async function generateAll() {
    if (!imgRef.current) return;
    setPhase('generate');

    const initialStatuses: Record<string, CharacterStatus> = {};
    assignments.forEach((a) => { initialStatuses[a.characterId] = 'pending'; });
    setStatuses(initialStatuses);

    for (const assignment of assignments) {
      const face = faces.find((f) => f.id === assignment.faceId);
      if (!face || !imgRef.current) continue;

      setStatuses((prev) => ({ ...prev, [assignment.characterId]: 'uploading' }));

      try {
        const blob = await cropFaceToBlob(imgRef.current, face);

        setStatuses((prev) => ({ ...prev, [assignment.characterId]: 'generating' }));

        await uploadCropAndGenerate(assignment.characterId, storyId, blob);

        setStatuses((prev) => ({ ...prev, [assignment.characterId]: 'done' }));
      } catch (err) {
        console.error(`Failed for character ${assignment.characterId}:`, err);
        setStatuses((prev) => ({ ...prev, [assignment.characterId]: 'error' }));
      }
    }

    setGenerationDone(true);
  }

  /* ── Face state helper ── */

  function getFaceState(face: DetectedFace): 'idle' | 'selected' | 'assigned' {
    if (assignedFaceIds.has(face.id)) return 'assigned';
    if (selectedFaceId === face.id) return 'selected';
    return 'idle';
  }

  function getAssignedName(face: DetectedFace): string | null {
    const assignment = assignments.find((a) => a.faceId === face.id);
    if (!assignment) return null;
    return characters.find((c) => c.id === assignment.characterId)?.name ?? null;
  }

  /* ── Status icon ── */

  function StatusIcon({ status }: { status: CharacterStatus }) {
    if (status === 'uploading' || status === 'generating') {
      return <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#D94590' }} />;
    }
    if (status === 'done') return <Check className="w-4 h-4" style={{ color: '#43B89C' }} />;
    if (status === 'error') return <AlertCircle className="w-4 h-4" style={{ color: '#E05555' }} />;
    return <div className="w-4 h-4 rounded-full" style={{ background: 'rgba(180,150,210,0.2)' }} />;
  }

  /* ================================================================ */
  /* RENDER                                                            */
  /* ================================================================ */

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(20,10,30,0.6)', backdropFilter: 'blur(6px)' }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="w-full sm:max-w-xl relative overflow-hidden"
          style={{
            background: '#FEFCFA',
            borderRadius: '22px 22px 0 0',
            maxHeight: '92vh',
            overflowY: 'auto',
          }}
        >
          {/* ── Header ── */}
          <div
            className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
            style={{
              background: '#FEFCFA',
              borderBottom: '1px solid rgba(180,150,210,0.1)',
              fontFamily: "'Bricolage Grotesque', sans-serif",
            }}
          >
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: '#D94590' }}>
                Group Photo
              </p>
              <h2 className="text-lg font-extrabold leading-tight" style={{ color: '#2D2235' }}>
                {phase === 'upload' && 'Upload a group photo'}
                {phase === 'detect' && 'Detecting faces…'}
                {phase === 'assign' && (allAssigned ? 'All matched!' : `Who is ${activeChar?.name}?`)}
                {phase === 'generate' && (generationDone ? 'Portraits ready!' : 'Generating portraits…')}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: 'rgba(180,150,210,0.1)', color: '#7B6E90' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 pb-8 pt-4" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>

            {/* ──────────────────────────────────────────────────── */}
            {/* PHASE: UPLOAD                                        */}
            {/* ──────────────────────────────────────────────────── */}
            {phase === 'upload' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-sm mb-5 leading-relaxed" style={{ color: '#7B6E90' }}>
                  Upload one photo with your whole cast. You'll tap each face to match them to a character — we'll generate individual AI portraits from there.
                </p>

                {detectError && (
                  <div
                    className="flex items-start gap-2.5 p-3.5 rounded-xl mb-4 text-sm"
                    style={{ background: 'rgba(224,85,85,0.08)', color: '#C03030', border: '1px solid rgba(224,85,85,0.15)' }}
                  >
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {detectError}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handlePhotoSelected(f);
                  }}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-3 py-12 rounded-[18px] transition-all active:scale-[0.98]"
                  style={{
                    border: '2px dashed rgba(180,150,210,0.3)',
                    background: 'rgba(199,125,255,0.03)',
                    color: '#9B59D0',
                  }}
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(199,125,255,0.1)' }}
                  >
                    <Users className="w-7 h-7" style={{ color: '#C77DFF' }} />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-sm" style={{ color: '#2D2235' }}>Choose group photo</p>
                    <p className="text-xs mt-0.5" style={{ color: '#A897BD' }}>JPEG, PNG, HEIC — one photo with everyone in it</p>
                  </div>
                </button>

                {/* Character list preview */}
                <div className="mt-5">
                  <p className="text-[11px] font-bold uppercase tracking-wider mb-2.5" style={{ color: '#A897BD' }}>
                    Characters to match
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {characters.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold"
                        style={{ background: 'rgba(199,125,255,0.08)', color: '#6B5C80' }}
                      >
                        {c.portraitImageUrl ? (
                          <img src={c.portraitImageUrl} alt={c.name} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                            style={{ background: 'rgba(180,150,210,0.2)', color: '#9B59D0' }}>
                            {c.name.charAt(0)}
                          </div>
                        )}
                        {c.name}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ──────────────────────────────────────────────────── */}
            {/* PHASE: DETECT (photo loaded, detection running)     */}
            {/* ──────────────────────────────────────────────────── */}
            {(phase === 'detect' || phase === 'assign') && photoSrc && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>

                {/* Character pills */}
                {phase === 'assign' && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {characters.map((c, i) => {
                      const isAssigned = assignedCharIds.has(c.id);
                      const isActive = !allAssigned && activeCharIdx === i;
                      return (
                        <button
                          key={c.id}
                          onClick={() => {
                            if (!isAssigned) setActiveCharIdx(i);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                          style={{
                            border: isActive
                              ? '2px solid #D94590'
                              : isAssigned
                              ? '2px solid rgba(67,184,156,0.4)'
                              : '2px solid rgba(180,150,210,0.2)',
                            background: isActive ? '#fff0f8' : isAssigned ? '#f0faf4' : 'white',
                            color: isActive ? '#D94590' : isAssigned ? '#2FA482' : '#6B5C80',
                            boxShadow: isActive ? '0 0 0 3px rgba(217,69,144,0.12)' : 'none',
                            cursor: isAssigned ? 'default' : 'pointer',
                          }}
                        >
                          {isAssigned ? <Check className="w-3 h-3" /> : isActive ? <span>👆</span> : <span className="w-3 h-3 rounded-full inline-block" style={{ background: 'rgba(180,150,210,0.3)' }} />}
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Photo with overlays */}
                <div
                  className="relative overflow-hidden rounded-[16px]"
                  style={{
                    cursor: phase === 'assign' && !allAssigned ? 'crosshair' : 'default',
                    boxShadow: '0 4px 24px rgba(45,34,53,0.12)',
                  }}
                  onClick={handleTap}
                  onTouchStart={handleTap}
                >
                  <img
                    ref={imgRef}
                    src={photoSrc}
                    alt="Group photo"
                    className="w-full block"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                    onLoad={handleImageLoad}
                  />

                  {/* Detecting overlay */}
                  {detecting && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(45,34,53,0.5)', backdropFilter: 'blur(3px)' }}>
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
                        <p className="text-white text-sm font-semibold">Detecting faces…</p>
                      </div>
                    </div>
                  )}

                  {/* Face overlays */}
                  {displaySize.w > 0 && faces.map((face) => (
                    <FaceBox
                      key={face.id}
                      face={face}
                      displayW={displaySize.w}
                      displayH={displaySize.h}
                      state={getFaceState(face)}
                    />
                  ))}

                  {/* Name badges for assigned faces */}
                  {displaySize.w > 0 && faces.map((face) => {
                    const name = getAssignedName(face);
                    if (!name) return null;
                    return (
                      <NameBadge
                        key={`badge-${face.id}`}
                        name={name}
                        face={face}
                        displayW={displaySize.w}
                        displayH={displaySize.h}
                      />
                    );
                  })}
                </div>

                {/* Instruction — only when no face selected and no generate button showing */}
                {phase === 'assign' && !selectedFaceId && assignments.length === 0 && (
                  <p className="text-center text-sm mt-3" style={{ color: '#A897BD' }}>
                    Tap <strong style={{ color: '#2D2235' }}>{activeChar?.name}'s</strong> face in the photo
                  </p>
                )}

                {/* Confirm this face */}
                {phase === 'assign' && selectedFaceId && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={confirmAssignment}
                    className="w-full mt-4 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #D94590, #B05CE6)',
                      boxShadow: '0 4px 16px rgba(217,69,144,0.3)',
                      border: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    That's {activeChar?.name}! ✓
                  </motion.button>
                )}

                {/* Done / generate — visible once at least one character is matched */}
                {phase === 'assign' && assignments.length > 0 && !selectedFaceId && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 space-y-2"
                  >
                    {allAssigned ? (
                      <p className="text-center text-sm font-semibold" style={{ color: '#3a9e6a' }}>
                        ✓ All {characters.length} characters matched
                      </p>
                    ) : (
                      <p className="text-center text-xs" style={{ color: '#A897BD' }}>
                        {assignments.length} of {characters.length} matched —{' '}
                        <span style={{ color: '#2D2235' }}>not everyone in this photo? That's fine.</span>
                      </p>
                    )}
                    <button
                      onClick={generateAll}
                      className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      style={{
                        background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                        boxShadow: '0 4px 20px rgba(176,92,230,0.3)',
                        border: 'none',
                        fontFamily: 'inherit',
                      }}
                    >
                      Generate {assignments.length} portrait{assignments.length !== 1 ? 's' : ''}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ──────────────────────────────────────────────────── */}
            {/* PHASE: GENERATE                                      */}
            {/* ──────────────────────────────────────────────────── */}
            {phase === 'generate' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <p className="text-sm mb-2" style={{ color: '#7B6E90' }}>
                  {generationDone
                    ? 'All portraits generated. Your characters are ready!'
                    : 'Cropping faces, uploading references, and generating AI portraits…'}
                </p>

                {assignments.map((assignment) => {
                  const char = characters.find((c) => c.id === assignment.characterId);
                  const status = statuses[assignment.characterId] ?? 'pending';
                  const label = {
                    pending: 'Waiting…',
                    uploading: 'Uploading…',
                    generating: 'Generating portrait…',
                    done: 'Done',
                    error: 'Failed — will retry on refresh',
                  }[status];

                  return (
                    <div
                      key={assignment.characterId}
                      className="flex items-center gap-3 p-3.5 rounded-xl"
                      style={{
                        background: status === 'done' ? 'rgba(67,184,156,0.06)' : status === 'error' ? 'rgba(224,85,85,0.06)' : 'rgba(180,150,210,0.06)',
                        border: status === 'done' ? '1px solid rgba(67,184,156,0.15)' : '1px solid rgba(180,150,210,0.1)',
                      }}
                    >
                      <StatusIcon status={status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold" style={{ color: '#2D2235' }}>{char?.name}</p>
                        <p className="text-[11px]" style={{ color: '#A897BD' }}>{label}</p>
                      </div>
                    </div>
                  );
                })}

                {generationDone && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => { onComplete(); onClose(); }}
                    className="w-full mt-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #43B89C, #2FA482)',
                      boxShadow: '0 4px 16px rgba(67,184,156,0.3)',
                      border: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    View portraits →
                  </motion.button>
                )}
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}