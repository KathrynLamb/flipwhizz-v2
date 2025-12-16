"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  ChevronRight, 
  ArrowLeft, 
  Wand2, 
  Plus,
  Search,
  UserPlus
} from "lucide-react";
import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";
import { SampleImageLocationCard } from "@/components/SampleImageLocationCard";

// --- TYPES ---
type Entity = {
  id: string;
  name: string;
  description: string | null;
  appearance?: string | null;
  referenceImageUrl?: string | null;
};

type PageData = {
  id: string;
  pageNumber: number;
}

type PresenceData = {
  pageId: string;
  characterId: string;
}

// --- ANIMATION VARIANTS ---
const fadeIn = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function ExtractWorldPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  // --- STATE ---
  const [step, setStep] = useState<'loading' | 'characters' | 'locations'>('loading');
  
  // Data
  const [allCharacters, setAllCharacters] = useState<Entity[]>([]);
  const [localLocations, setLocalLocations] = useState<Entity[]>([]);
  
  // Visibility Logic
  const [visibleCharacterIds, setVisibleCharacterIds] = useState<Set<string>>(new Set());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // --- POLLING LOGIC ---
  useEffect(() => {
    if (!storyId) return;
    
    // Initial kickoff
    fetch(`/api/stories/${storyId}/extract-world`, { method: "POST" });

    const interval = setInterval(async () => {
      const res = await fetch(`/api/stories/${storyId}/world`);
      if (res.ok) {
        const data = await res.json();
        
        // Check if data is ready
        if (data.story?.status === 'needs_style' || (data.characters?.length > 0)) {
           setAllCharacters(data.characters || []);
           setLocalLocations(data.locations || []);
           
           // --- INTELLIGENT FILTERING ---
           // 1. Find IDs of Page 1 & 2
           const firstTwoPageIds = new Set(
             (data.pages as PageData[])
               .filter(p => p.pageNumber <= 2)
               .map(p => p.id)
           );

           // 2. Find Characters present on those pages
           const presentCharIds = new Set<string>();
           (data.presence as PresenceData[]).forEach(row => {
              if (firstTwoPageIds.has(row.pageId)) {
                presentCharIds.add(row.characterId);
              }
           });

           // 3. If no one detected on pg 1-2 (rare), show everyone. Otherwise show filtered.
           if (presentCharIds.size > 0) {
             setVisibleCharacterIds(presentCharIds);
           } else {
             // Fallback: Show first 3 characters if detection failed to place them
             setVisibleCharacterIds(new Set(data.characters.slice(0, 3).map((c: Entity) => c.id)));
           }

           setStep('characters');
           clearInterval(interval);
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [storyId]);

  /* ---------------- HANDLERS ---------------- */
  function updateEntity(id: string, updates: Partial<Entity>, type: 'char' | 'loc') {
    if (type === 'char') {
      setAllCharacters(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    } else {
      setLocalLocations(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
    }
  }

  function addCharacterToView(id: string) {
    const newSet = new Set(visibleCharacterIds);
    newSet.add(id);
    setVisibleCharacterIds(newSet);
    setIsDropdownOpen(false);
  }

  // Derived lists
  const visibleCharacters = allCharacters.filter(c => visibleCharacterIds.has(c.id));
  const hiddenCharacters = allCharacters.filter(c => !visibleCharacterIds.has(c.id));

  /* ---------------- RENDER: LOADING ---------------- */
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Same loading UI as before... */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/40 via-[#0F172A] to-[#0F172A]" />
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
          className="relative z-10 w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center mb-8 border border-indigo-400/30 backdrop-blur-xl shadow-[0_0_50px_rgba(99,102,241,0.3)]"
        >
          <Sparkles className="w-12 h-12 text-indigo-300" />
        </motion.div>
        <div className="z-10 text-center max-w-md px-6">
          <h2 className="text-3xl font-serif text-white mb-3 tracking-wide">Summoning your story...</h2>
          <p className="text-indigo-200/60 font-light text-lg">Identifying the heroes and magical places.</p>
        </div>
      </div>
    );
  }

  /* ---------------- RENDER: MAIN ---------------- */
  return (
    <div className="min-h-screen bg-stone-50 text-stone-800 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* NAVBAR */}
      <header className="fixed top-0 w-full z-40 bg-white/80 backdrop-blur-xl border-b border-stone-200/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Wand2 className="w-4 h-4" />
            </div>
            <span className="font-serif font-bold text-lg text-stone-900">FlipWhizz Studio</span>
          </div>
          
          <div className="flex items-center gap-8 text-sm font-medium text-stone-400">
             <div className={`flex items-center gap-2 transition-colors ${step === 'characters' ? 'text-indigo-600' : ''}`}>
                <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">1</span>
                Cast
             </div>
             <div className="w-8 h-px bg-stone-200" />
             <div className={`flex items-center gap-2 transition-colors ${step === 'locations' ? 'text-indigo-600' : ''}`}>
                <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs">2</span>
                Locations
             </div>
          </div>

          <button 
             onClick={() => step === 'characters' ? setStep('locations') : router.push(`/stories/${storyId}/design`)}
             className="bg-stone-900 hover:bg-black text-white px-6 py-2.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-stone-900/20"
          >
            {step === 'characters' ? "Next: Locations" : "Finish & Design"}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="pt-32 pb-40 px-6 max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          
          {/* --- STEP 1: CHARACTERS --- */}
          {step === 'characters' && (
            <motion.div 
              key="characters"
              initial="hidden" animate="visible" exit={{ opacity: 0, x: -20 }}
              variants={fadeIn}
              className="space-y-12"
            >
              <div className="text-center max-w-2xl mx-auto">
                <span className="text-indigo-500 font-bold uppercase tracking-widest text-xs mb-3 block">Step 1 of 2</span>
                <h1 className="text-5xl font-serif text-stone-900 mb-6">Casting Call</h1>
                <p className="text-xl text-stone-500 font-light leading-relaxed">
                  These characters appear in the <strong>first few pages</strong>. Upload photos to preserve their likeness, or let AI dream them up.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visibleCharacters.map((char) => (
                  <SampleImageCharacterCard
                    key={char.id}
                    character={{...char, referenceImageUrl: char.referenceImageUrl ?? null, description: char.description ?? null}}
                    onUpdated={(u) => updateEntity(char.id, u, 'char')}
                  />
                ))}

                {/* --- ADD CHARACTER BUTTON / DROPDOWN --- */}
                <div className="relative min-h-[400px]">
                  <button 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full h-full border-2 border-dashed border-stone-200 rounded-2xl flex flex-col items-center justify-center p-8 text-stone-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all group"
                  >
                     <div className="w-12 h-12 rounded-full bg-stone-100 group-hover:bg-indigo-100 flex items-center justify-center mb-4 transition-colors">
                        <Plus className={`w-6 h-6 transition-transform ${isDropdownOpen ? 'rotate-45' : ''}`} />
                     </div>
                     <span className="font-medium">Add Supporting Cast</span>
                     <span className="text-xs mt-2 opacity-60">Anyone else needed for this scene?</span>
                  </button>

                  {/* POPUP DROPDOWN */}
                  <AnimatePresence>
                    {isDropdownOpen && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        className="absolute top-0 left-0 w-full h-full bg-white rounded-2xl shadow-2xl border border-stone-200 z-10 overflow-hidden flex flex-col"
                      >
                        <div className="p-4 border-b border-stone-100 bg-stone-50 flex items-center gap-2">
                           <Search className="w-4 h-4 text-stone-400" />
                           <span className="text-sm font-bold text-stone-600 uppercase tracking-wider">Available Characters</span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                          {hiddenCharacters.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-stone-400 text-sm p-4 text-center">
                               <p>No other characters found.</p>
                            </div>
                          ) : (
                            hiddenCharacters.map(char => (
                              <button
                                key={char.id}
                                onClick={() => addCharacterToView(char.id)}
                                className="w-full flex items-center justify-between p-3 hover:bg-indigo-50 rounded-xl transition-colors text-left group"
                              >
                                <div>
                                  <div className="font-bold text-stone-800">{char.name}</div>
                                  <div className="text-xs text-stone-400 truncate max-w-[180px]">{char.description}</div>
                                </div>
                                <div className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                   <Plus className="w-4 h-4" />
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                        
                        <div className="p-3 bg-stone-50 text-center border-t border-stone-100">
                           <button onClick={() => setIsDropdownOpen(false)} className="text-xs font-bold text-stone-500 hover:text-stone-800">Cancel</button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>
            </motion.div>
          )}

          {/* --- STEP 2: LOCATIONS --- */}
          {step === 'locations' && (
            <motion.div 
              key="locations"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
              className="space-y-12"
            >
               {/* Same Location UI as before ... */}
               <div className="flex items-center mb-8">
                  <button onClick={() => setStep('characters')} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors">
                     <ArrowLeft className="w-4 h-4" /> Back to Cast
                  </button>
               </div>
               
               <div className="text-center max-w-2xl mx-auto">
                <span className="text-indigo-500 font-bold uppercase tracking-widest text-xs mb-3 block">Step 2 of 2</span>
                <h1 className="text-5xl font-serif text-stone-900 mb-6">Location Scouting</h1>
                <p className="text-xl text-stone-500 font-light leading-relaxed">
                   Set the scene for your story.
                </p>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {localLocations.map((loc) => (
                  <SampleImageLocationCard
                    key={loc.id}
                    location={{...loc, description: loc.description ?? null, referenceImageUrl: loc.referenceImageUrl ?? null}}
                    onUpdated={(u) => updateEntity(loc.id, u, 'loc')}
                  />
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}