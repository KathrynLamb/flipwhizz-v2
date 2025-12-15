"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Playfair_Display, Lato } from "next/font/google";
import { 
  BookOpen, 
  Sparkles, 
  Edit3, 
  ArrowRight, 
  FileText, 
  ChevronLeft, 
  Download,
  Feather,
  Map,
  User,
  Palette
} from "lucide-react";

// 1. Font Setup
const playfair = Playfair_Display({ 
  subsets: ["latin"], 
  variable: "--font-serif",
  weight: ["400", "600", "700"]
});

const lato = Lato({ 
  subsets: ["latin"], 
  variable: "--font-sans",
  weight: ["400", "700"]
});

type StoryPage = {
  id: string;
  pageNumber: number;
  text: string;
};

// 2. Magical Loading Messages
const LOADING_STEPS = [
  { text: "Reading your story...", icon: BookOpen },
  { text: "Identifying the heroes...", icon: User },
  { text: "Scouting locations...", icon: Map },
  { text: "Preparing the sketchpad...", icon: Feather },
  { text: "Mixing the magic paints...", icon: Palette },
  { text: "Almost ready...", icon: Sparkles },
];

export default function StoryViewPage() {
  const params = useParams();
  const router = useRouter();

  const storyId = useMemo(() => {
    const raw = params?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  const [story, setStory] = useState<any>(null);
  const [pages, setPages] = useState<StoryPage[]>([]);
  
  // State for initial load
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for "Confirming" (The AI Extraction Phase)
  const [isConfirming, setIsConfirming] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);

  // Cycle through magical messages while confirming
  useEffect(() => {
    if (!isConfirming) return;

    const interval = setInterval(() => {
      setLoadingStepIndex((prev) => (prev + 1) % LOADING_STEPS.length);
    }, 2500); // Change message every 2.5 seconds

    return () => clearInterval(interval);
  }, [isConfirming]);

  useEffect(() => {
    async function load() {
      if (!storyId) {
        setLoading(false);
        setError("Missing story id.");
        return;
      }

      try {
        const res = await fetch(`/api/stories/${storyId}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error ?? "Failed to load story.");
          setLoading(false);
          return;
        }

        setStory(data.story);
        setPages(data.pages || []);
      } catch (e) {
        setError("Network error loading story.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [storyId]);

  const confirmStory = async () => {
    setIsConfirming(true); // Start the magical loading screen
    
    try {
      await fetch(`/api/stories/${storyId}/extract-world`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overwriteLinks: true }),
      });

      router.push(`/stories/${storyId}/extract`);
    } catch (err) {
      console.error(err);
      alert("Failed to confirm story.");
      setIsConfirming(false); // Stop loading if it fails
    }
  };

  // -- 1. MAGICAL LOADING SCREEN (Extraction Phase) --
  if (isConfirming) {
    const CurrentStep = LOADING_STEPS[loadingStepIndex];
    const Icon = CurrentStep.icon;

    return (
      <div className={`fixed inset-0 z-50 bg-[#FDF8F0] flex flex-col items-center justify-center ${playfair.variable} ${lato.variable} font-sans`}>
        
        {/* Animated Icon Circle */}
        <div className="relative mb-10">
          <div className="absolute inset-0 bg-amber-200 rounded-full blur-2xl opacity-40 animate-pulse"></div>
          <div className="relative w-24 h-24 bg-white rounded-full shadow-xl border-4 border-[#E6D5B8] flex items-center justify-center">
             <Icon className="w-10 h-10 text-[#F4A261] animate-bounce-slow" />
          </div>
        </div>

        {/* Dynamic Text */}
        <h2 className="font-serif text-3xl font-bold text-[#261C15] mb-4 animate-fade-in text-center px-4">
          {CurrentStep.text}
        </h2>
        
        <p className="text-[#8C7A6B] text-sm mb-8 animate-pulse">
          Please wait while we weave the magic...
        </p>

        {/* Progress Bar */}
        <div className="w-64 h-2 bg-[#E6D5B8] rounded-full overflow-hidden">
           <div className="h-full bg-[#F4A261] animate-progress-indeterminate"></div>
        </div>

      </div>
    );
  }

  // -- 2. INITIAL LOADING STATE --
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDF8F0] flex flex-col items-center justify-center space-y-4">
        <div className="animate-bounce text-4xl">📖</div>
        <p className="font-serif text-[#261C15] text-xl animate-pulse">Unfolding your story...</p>
      </div>
    );
  }

  // -- 3. ERROR STATE --
  if (error || !story) {
    return (
      <div className="min-h-screen bg-[#FDF8F0] flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-xl border-2 border-red-100 max-w-md text-center">
          <div className="text-red-500 mb-4 text-4xl">🥀</div>
          <h2 className="text-xl font-bold text-[#261C15] mb-2">Oh no!</h2>
          <p className="text-[#6B5D52] mb-6">{error || "Story not found."}</p>
          <Link href="/projects" className="px-6 py-2 bg-[#261C15] text-white rounded-full text-sm font-medium hover:bg-black transition">
            Back to Library
          </Link>
        </div>
      </div>
    );
  }

  // -- 4. MAIN MANUSCRIPT VIEW --
  return (
    <div className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-[#261C15] pb-32`}>
      
      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-[#FDF8F0]/90 backdrop-blur-md border-b border-[#E6D5B8]">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
            <Link href="/projects" className="flex items-center text-sm text-[#8C7A6B] hover:text-[#261C15] transition">
               <ChevronLeft className="w-4 h-4 mr-1" />
               Library
            </Link>

            <div className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
               <span className="flex items-center text-[#261C15] px-3 py-1 rounded-full bg-[#E6D5B8]">
                  <FileText className="w-3 h-3 mr-2" /> 1. The Text
               </span>
               <div className="w-8 h-[1px] bg-[#E6D5B8]"></div>
               <span className="flex items-center text-[#B0A69D] px-3 py-1">
                  <Sparkles className="w-3 h-3 mr-2" /> 2. Magic Art
               </span>
            </div>

            <div className="w-16"></div>
        </div>
      </header>

      {/* TITLE */}
      <div className="pt-12 pb-10 px-6 text-center max-w-3xl mx-auto">
         <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-6 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            First Draft
         </div>

         <h1 className="font-serif text-4xl md:text-5xl font-bold leading-tight text-[#261C15] mb-4">
           {story.title ?? "Untitled Story"}
         </h1>
         
         <p className="text-[#6B5D52] text-lg">
            Review your tale before we bring it to life with illustrations.
         </p>
      </div>

      {/* PAGES */}
      <div className="mx-auto max-w-2xl px-6 space-y-8">
        {pages.map((p, index) => (
          <div
            key={p.id}
            className="group relative bg-white text-[#261C15] p-8 md:p-12 rounded-sm shadow-sm border border-[#EBEBEB] hover:shadow-md transition-shadow duration-300"
          >
            <div className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-[#261C15] text-[#FDF8F0] font-serif font-bold text-sm rounded-full shadow-lg z-10">
              {p.pageNumber}
            </div>

            <div className="absolute left-3 top-0 bottom-0 flex flex-col justify-center gap-12 opacity-20">
               <div className="w-3 h-3 rounded-full bg-stone-300 shadow-inner"></div>
               <div className="w-3 h-3 rounded-full bg-stone-300 shadow-inner"></div>
               <div className="w-3 h-3 rounded-full bg-stone-300 shadow-inner"></div>
            </div>

            <div className="pl-6 font-serif text-lg md:text-xl leading-[1.8] whitespace-pre-line text-[#4A3B32]">
              {p.text}
            </div>
            
            <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs text-stone-400 italic">Page {index + 1} of {pages.length}</span>
            </div>
          </div>
        ))}
        
        <div className="text-center pt-8 pb-4">
             <div className="text-4xl opacity-20">❦</div>
             <p className="text-sm text-[#8C7A6B] mt-2 font-serif italic">End of draft</p>
        </div>
      </div>

      {/* ACTION DOCK */}
      <div className="fixed bottom-0 left-0 right-0 z-40 px-6 pb-6 pointer-events-none">
         <div className="pointer-events-auto max-w-3xl mx-auto bg-[#261C15]/95 backdrop-blur-xl text-white p-3 rounded-2xl shadow-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            
            <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
                <a
                  href={`/stories/${storyId}/edit`}
                  className="flex items-center gap-2 px-4 py-3 md:py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition text-stone-300 hover:text-white"
                >
                  <Edit3 className="w-4 h-4" />
                  Make Edits
                </a>
                <a
                  href={`/stories/${storyId}/pdf`}
                  className="flex items-center gap-2 px-4 py-3 md:py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition text-stone-300 hover:text-white"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </a>
            </div>

            <button
              onClick={confirmStory}
              disabled={isConfirming}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#F4A261] hover:bg-[#E76F51] text-[#0F2236] font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              Approve & Create Art
              <ArrowRight className="w-4 h-4" />
            </button>
         </div>
      </div>

    </div>
  );
}