
"use client";


import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StyleEditor } from "@/components/StyleEditor";
import { CharacterCard } from "@/components/CharacterCard";
import { LocationCard } from "@/components/LocationCard";
import { StyleConfirmation } from "@/components/StyleConfirmation";


// ... (Keep your Type Definitions: Character, Location, Style exactly as before) ...
type Character = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  age?: string | null;
  referenceImageUrl?: string | null;
  _localPreview?: string | null;
};

type Location = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  referenceImageUrl?: string | null;
  _localPreview?: string | null;
};

type Style = {
  summary?: string;
  lighting?: string;
  palette?: string;
  render?: string;
  userNotes?: string;
  referenceImageUrl?: string | null;
  sampleIllustrationUrl?: string | null; // Make sure this is in type
};

// ... (Keep normalizeImage function as is) ...
async function normalizeImage(file: File): Promise<File> {
  const lower = file.name.toLowerCase();
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    lower.endsWith(".heic") ||
    lower.endsWith(".heif");

  if (!isHeic) return file;

  try {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    const newName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return new File([blob as BlobPart], newName, { type: "image/jpeg" });
  } catch (err) {
    console.warn("HEIC convert failed, uploading original", err);
    return file;
  }
}

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();

  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [savingStyle, setSavingStyle] = useState(false);

  // --- NEW STATE: To manually toggle back to edit mode even if URL exists ---
  const [isEditing, setIsEditing] = useState(false);

  const [story, setStory] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [style, setStyle] = useState<Style>({});
  const [error, setError] = useState<string | null>(null);

  /* ---------------- LOAD DATA ---------------- */

  async function loadWorld() {
    if (!storyId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/world`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to load world");
        return;
      }
      console.log("STOry", data)
      setStory(data?.story);
      setCharacters(data?.characters ?? []);
      setLocations(data?.locations ?? []);
      setStyle(data?.style ?? {});
    
    } catch (err) {
      console.log(err);
      setError("Network error loading world.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorld();
  }, [storyId]);

  useEffect(() => {
    async function load() {
      if (!storyId) return;
      try {
        const res = await fetch(`/api/stories/${storyId}`);
        const data = await res.json();
        if (res.ok) {
          setStory(data.story);
          const loadedPages = data.pages || [];
          loadedPages.sort((a: any, b: any) => a.pageNumber - b.pageNumber);
          setPages(loadedPages);
        }
      } catch (e) {
        console.error(e);
      }
    }
    load();
  }, [storyId]);

  async function startExtraction() {
    if (!storyId || extracting) return;
    setExtracting(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/extract-world`, { method: "POST" });
      if (res.ok) await loadWorld();
    } catch (err) {
      setError("Network error running extraction.");
    } finally {
      setExtracting(false);
    }
  }

  /* ---------------- HELPER FUNCTIONS ---------------- */
  // ... (Keep updateCharacterLocal, updateLocationLocal, saveCharacter, saveLocation, uploadReference) ...
  
  function updateCharacterLocal(id: string, patch: Partial<Character>) {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function updateLocationLocal(id: string, patch: Partial<Location>) {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  async function saveCharacter(c: Character) {
    const payload = { ...c };
    await fetch(`/api/characters/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
  }

  async function saveLocation(l: Location) {
      await fetch(`/api/locations/${l.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: l.name,
            description: l.description,
            appearance: l.appearance,
            referenceImageUrl: l.referenceImageUrl
        }),
      });
  }

  async function uploadReference(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const session = await fetch("/api/auth/session").then((r) => r.json());
    fd.append("userId", session?.user?.id);
    const res = await fetch("/api/uploads/reference", { method: "POST", body: fd });
    const data = await res.json();
    return data.url as string;
  }

  // --- SAVE STYLE (No changes needed, used by StyleEditor) ---
  async function saveStyle() {
    if (!storyId || savingStyle) return;
    setSavingStyle(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/style`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style }),
      });
      if (!res.ok) throw new Error("Failed to save style");
      
      // IMPORTANT: After saving successfully, ensure we exit edit mode if a URL exists
      if (style.sampleIllustrationUrl) {
        setIsEditing(false);
      }
    } finally {
      setSavingStyle(false);
    }
  }

  // Sample pages context for AI
  const sampleStoryContext = pages.slice(0, 2).map(p => p.text);

  // --- LOGIC: Determine which view to show ---
  // If we have a sample URL AND the user hasn't explicitly clicked "Edit", show Confirmation.
  const showConfirmation = !!style?.sampleIllustrationUrl && !isEditing;


  /* ---------------- RENDER ---------------- */

  if (!storyId) return <div>Missing story id.</div>;
  if (loading) return <div className="min-h-screen bg-[#0b0b10] text-white flex items-center justify-center">Loading world...</div>;

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white">
      <div className="max-w-5xl mx-auto p-6">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className="text-[10px] uppercase text-white/50">Story world review</div>
            <h1 className="text-2xl font-semibold">{story?.title}</h1>
          </div>
          
          {/* Only show Extract button if we are in edit mode or haven't started yet */}
          {!showConfirmation && (
            <button
                onClick={startExtraction}
                disabled={extracting}
                className="bg-white/10 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/20 transition"
            >
                {extracting ? "Extracting..." : "Re-Run Extraction"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-200">
            {error}
          </div>
        )}

        {/* --- MAIN CONTENT SWITCHER --- */}
        
        {showConfirmation ? (
          
          /* VIEW 1: CONFIRMATION / NEXT STEPS */
          <StyleConfirmation 
            imageUrl={style.sampleIllustrationUrl!} 
            storyId={storyId as string}
            onRefine={() => setIsEditing(true)}
          />

        ) : (

          /* VIEW 2: EDITORS (Style, Characters, Locations) */
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* STYLE EDITOR */}
            <StyleEditor
              style={style}
              setStyle={setStyle}
              onSave={saveStyle}
              pages={sampleStoryContext}
              characters={characters}
              locations={locations}
              // We don't need setSampleIllustrationUrl passed separately anymore
              // because setStyle handles the object update
              setSampleIllustrationUrl={() => {}} 
            />

            {/* CHARACTERS DECK */}
            <div className="mt-14">
              <div className="flex items-end gap-3 mb-6 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                  Character Deck
                </h2>
                <span className="text-sm text-white/40 pb-1">
                  {characters.length} cards collected
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {characters.map((c) => (
                  <CharacterCard
                    key={c.id}
                    character={c}
                    onUpdate={updateCharacterLocal}
                    onSave={saveCharacter}
                    onUpload={uploadReference}
                    onNormalize={normalizeImage}
                  />
                ))}
                {characters.length === 0 && (
                  <div className="col-span-full py-10 text-center text-white/30 border border-dashed border-white/10 rounded-xl">
                    No characters found. Run extraction to find them.
                  </div>
                )}
              </div>
            </div>

            {/* LOCATIONS DECK */}
            <div className="mt-16 pb-20">
              <div className="flex items-end gap-3 mb-6 border-b border-white/10 pb-4">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
                  World Locations
                </h2>
                <span className="text-sm text-white/40 pb-1">
                  {locations.length} settings found
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                {locations.map((l) => (
                  <LocationCard
                    key={l.id}
                    location={l}
                    onUpdate={updateLocationLocal}
                    onSave={saveLocation}
                    onUpload={uploadReference}
                    onNormalize={normalizeImage}
                  />
                ))}
                {locations.length === 0 && (
                  <div className="col-span-full py-10 text-center text-white/30 border border-dashed border-white/10 rounded-xl">
                    No locations found.
                  </div>
                )}
              </div>
            </div>
            
          </div>
        )}

      </div>
    </div>
  );
}