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
    }, 2500); 

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
    setIsConfirming(true); 
    
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
      setIsConfirming(false); 
    }
  };

  // -- 1. MAGICAL LOADING SCREEN (Extraction Phase) --
  if (isConfirming) {
    const CurrentStep = LOADING_STEPS[loadingStepIndex];
    const Icon = CurrentStep.icon;

    return (
      <div className={`fixed inset-0 z-[100] bg-[#FDF8F0] flex flex-col items-center justify-center ${playfair.variable} ${lato.variable} font-sans`}>
        
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
    <div className={`min-h-screen ${playfair.variable} ${lato.variable} font-sans bg-[#FDF8F0] text-[#261C15] pb-40`}>
      
      {/* HEADER (Sticky) */}
      <header className="sticky top-0 z-40 bg-[#FDF8F0]/95 backdrop-blur-md border-b border-[#E6D5B8] shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* LEFT: Back Button (Always Visible) */}
            <Link href="/projects" className="flex items-center text-sm font-bold text-[#8C7A6B] hover:text-[#261C15] transition p-2 -ml-2 rounded-lg hover:bg-black/5">
               <ChevronLeft className="w-5 h-5 mr-1" />
               <span className="hidden xs:inline">Library</span>
            </Link>

            {/* CENTER: Progress Indicators (Hidden on small mobile) */}
            <div className="hidden sm:flex items-center gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
               <span className="flex items-center text-[#261C15] px-3 py-1 rounded-full bg-[#E6D5B8]">
                  <FileText className="w-3 h-3 mr-2" /> 
                  <span className="hidden sm:inline">The Text</span>
                  <span className="sm:hidden">Text</span>
               </span>
               <div className="w-4 sm:w-8 h-[1px] bg-[#E6D5B8]"></div>
               <span className="flex items-center text-[#B0A69D] px-3 py-1">
                  <Sparkles className="w-3 h-3 mr-2" /> 
                  <span className="hidden sm:inline">Magic Art</span>
                  <span className="sm:hidden">Art</span>
               </span>
            </div>

            {/* RIGHT: Logout / Spacer (Empty for now to balance layout) */}
            <div className="w-16"></div> 
        </div>
      </header>

      {/* TITLE SECTION */}
      <div className="pt-8 sm:pt-12 pb-6 sm:pb-10 px-6 text-center max-w-3xl mx-auto">
         <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-4 sm:mb-6 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            First Draft
         </div>

         <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold leading-tight text-[#261C15] mb-4">
           {story.title ?? "Untitled Story"}
         </h1>
         
         <p className="text-[#6B5D52] text-sm sm:text-lg max-w-lg mx-auto">
            Review your tale before we bring it to life with illustrations.
         </p>
      </div>

      {/* PAGES LIST */}
      <div className="mx-auto max-w-2xl px-4 sm:px-6 space-y-6 sm:space-y-8">
        {pages.map((p, index) => (
          <div
            key={p.id}
            className="group relative bg-white text-[#261C15] p-6 sm:p-8 md:p-12 rounded-lg shadow-sm border border-[#EBEBEB] hover:shadow-md transition-shadow duration-300"
          >
            {/* Page Number Badge */}
            <div className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-[#261C15] text-[#FDF8F0] font-serif font-bold text-sm rounded-full shadow-lg z-10 border-2 border-[#FDF8F0]">
              {p.pageNumber}
            </div>

            {/* Decorative Binding Holes */}
            <div className="absolute left-2 sm:left-3 top-0 bottom-0 flex flex-col justify-center gap-8 sm:gap-12 opacity-20 pointer-events-none">
               <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-stone-400 shadow-inner"></div>
               <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-stone-400 shadow-inner"></div>
               <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-stone-400 shadow-inner"></div>
            </div>

            {/* Page Text */}
            <div className="pl-4 sm:pl-6 font-serif text-base sm:text-lg md:text-xl leading-relaxed whitespace-pre-line text-[#4A3B32]">
              {p.text}
            </div>
            
            <div className="absolute bottom-3 right-4 opacity-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] sm:text-xs text-stone-400 italic">Page {index + 1} of {pages.length}</span>
            </div>
          </div>
        ))}
        
        <div className="text-center pt-8 pb-4">
             <div className="text-4xl opacity-20 text-[#261C15]">❦</div>
             <p className="text-xs text-[#8C7A6B] mt-2 font-serif italic">End of draft</p>
        </div>
      </div>

      {/* ACTION DOCK (Fixed Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 sm:px-6 sm:pb-6 pointer-events-none">
         <div className="pointer-events-auto max-w-3xl mx-auto bg-[#261C15] text-white p-3 rounded-2xl shadow-2xl border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            
            {/* Secondary Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-start">
                <a
                  href={`/stories/${storyId}/edit`}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 transition text-stone-300 hover:text-white"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit
                </a>
                <a
                  href={`/stories/${storyId}/pdf`}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/5 hover:bg-white/10 transition text-stone-300 hover:text-white"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </a>
            </div>

            {/* Primary Action */}
            <button
              onClick={confirmStory}
              disabled={isConfirming}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#F4A261] hover:bg-[#E76F51] text-[#0F2236] font-bold shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              <span>Approve & Create Art</span>
              <ArrowRight className="w-4 h-4" />
            </button>
         </div>
      </div>

    </div>
  );
}