"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Users, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  ChevronRight, 
  ArrowLeft,
  ImagePlus,
  Loader2,
  Camera
} from "lucide-react";
import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";
import { SampleImageLocationCard } from "@/components/SampleImageLocationCard";

type Entity = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  referenceImageUrl?: string | null;
};

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  // --- UI STEPS: 'extracting' | 'characters' | 'locations' ---
  const [step, setStep] = useState<'extracting' | 'characters' | 'locations'>('extracting');
  const [loading, setLoading] = useState(true);
  const [localCharacters, setLocalCharacters] = useState<Entity[]>([]);
  const [localLocations, setLocalLocations] = useState<Entity[]>([]);

  /* ---------------- LOAD DATA ---------------- */
  async function loadWorld() {
    if (!storyId) return;
    try {
      const res = await fetch(`/api/stories/${storyId}/world`);
      const data = await res.json();
      if (!res.ok) return;

      setLocalCharacters(data?.characters ?? []);
      setLocalLocations(data?.locations ?? []);

      // If story is already extracting, keep showing loader
      if (data.story?.status === 'needs_style') {
          setStep('characters');
      }
    } finally {
      setLoading(false);
    }
  }

  // Initial Extraction Trigger
  useEffect(() => {
    async function init() {
        if (!storyId) return;
        const res = await fetch(`/api/stories/${storyId}/extract-world`, { method: "POST" });
        if (res.ok) {
            await loadWorld();
        }
    }
    init();
  }, [storyId]);

  /* ---------------- UPDATE LOGIC ---------------- */
  function updateEntity(id: string, updates: Partial<Entity>, type: 'char' | 'loc') {
    if (type === 'char') {
      setLocalCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } else {
      setLocalLocations(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }
  }

  /* ---------------- RENDER ---------------- */

  if (loading || step === 'extracting') return (
    <div className="min-h-screen bg-[#FFFBCA] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-[#4635B1] rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl animate-bounce">
        <Sparkles className="text-[#AEEA94] w-12 h-12" />
      </div>
      <h2 className="text-4xl font-serif font-black text-[#4635B1] mb-4">Reading your manuscript...</h2>
      <p className="text-[#6B5D52] max-w-sm font-medium">FlipWhizz is identifying the heroes and magical places in your story.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#261C15] pb-32">
      
      {/* --- PREMIUM HEADER --- */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-stone-200/40 px-8 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${step === 'characters' ? 'bg-[#4635B1] text-white' : 'bg-[#AEEA94] text-[#4635B1]'}`}>
              {step === 'characters' ? <Users /> : <CheckCircle2 />}
            </div>
            <div className="h-px w-8 bg-stone-200 hidden sm:block" />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${step === 'locations' ? 'bg-[#4635B1] text-white' : 'bg-stone-100 text-stone-400'}`}>
              <MapPin />
            </div>
          </div>
          
          <button 
            onClick={() => step === 'characters' ? setStep('locations') : router.push(`/stories/${storyId}/design`)}
            className="flex items-center gap-2 px-8 py-3 bg-[#4635B1] text-white rounded-full font-bold shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
          >
            {step === 'characters' ? "Next: Scouting Locations" : "Finish & Design Style"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-16">
        <AnimatePresence mode="wait">
          {step === 'characters' ? (
            <motion.section 
              key="chars"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <header>
                <h1 className="text-5xl font-serif font-black text-[#4635B1] mb-4">Meet the Cast</h1>
                <p className="text-xl text-stone-500 italic">We found {localCharacters.length} characters. Give them a face and a personality.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {localCharacters.map(char => (
                  <SampleImageCharacterCard 
                    key={char.id}
                    character={{...char, referenceImageUrl: char.referenceImageUrl ?? null, description: char.description ?? null}}
                    onUpdated={(u) => updateEntity(char.id, u, 'char')}
                  />
                ))}
              </div>
            </motion.section>
          ) : (
            <motion.section 
              key="locs"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
              <header>
                <button onClick={() => setStep('characters')} className="flex items-center gap-2 text-sm font-bold text-[#B771E5] mb-4 uppercase tracking-widest">
                  <ArrowLeft className="w-4 h-4" /> Back to Cast
                </button>
                <h1 className="text-5xl font-serif font-black text-[#4635B1] mb-4">Scouting Locations</h1>
                <p className="text-xl text-stone-500 italic">These settings bring your story to life. Describe the vibe.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {localLocations.map(loc => (
                  <SampleImageLocationCard 
                    key={loc.id}
                    location={{...loc, referenceImageUrl: loc.referenceImageUrl ?? null, description: loc.description ?? null}}
                    onUpdated={(u) => updateEntity(loc.id, u, 'loc')}
                  />
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* --- FLOATING HELPER --- */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white px-6 py-3 rounded-full border border-stone-200 shadow-2xl flex items-center gap-4">
        <div className="flex -space-x-2">
          {localCharacters.slice(0, 3).map((c, i) => (
            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-[#B771E5] flex items-center justify-center text-[10px] text-white font-bold uppercase">
              {c.name[0]}
            </div>
          ))}
        </div>
        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">
            {step === 'characters' ? "Reviewing Characters" : "Reviewing Locations"}
        </p>
      </div>
    </div>
  );
}