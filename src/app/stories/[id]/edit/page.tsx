"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Wand2, 
  Stars,
  Loader2,
  BookOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type StoryPage = {
  id: string;
  pageNumber: number;
  text: string;
};

export default function MobileStoryEditor() {
  const params = useParams();
  const router = useRouter();
  const storyId = useMemo(() => {
    const raw = (params as any)?.id;
    return typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : null;
  }, [params]);

  const [pages, setPages] = useState<StoryPage[]>([]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("idle");
  const [rewriteInstruction, setRewriteInstruction] = useState("");

  useEffect(() => {
    async function load() {
      if (!storyId) return;
      const res = await fetch(`/api/stories/${storyId}`);
      const data = await res.json();
      setPages(data.pages ?? []);
      setLoading(false);
    }
    load();
  }, [storyId]);

  const updatePageText = (text: string) => {
    setPages(prev => prev.map((p, i) => i === currentPageIdx ? { ...p, text } : p));
  };

  if (loading) return <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center"><Loader2 className="animate-spin text-[#4635B1]" /></div>;

  return (
    <div className="fixed inset-0 bg-[#FAF9F6] flex flex-col font-sans overflow-hidden">
      
      {/* --- MINIMAL HEADER --- */}
      <nav className="flex-none px-6 py-4 flex items-center justify-between border-b border-stone-200/40 bg-white/50 backdrop-blur-md">
        <button onClick={() => router.push(`/stories/${storyId}`)} className="text-[#4635B1]"><ChevronLeft /></button>
        <div className="text-center">
          <span className="block text-[10px] font-black uppercase tracking-widest text-stone-400">Manuscript</span>
          <span className="text-sm font-serif italic">Page {currentPageIdx + 1} of {pages.length}</span>
        </div>
        <button className="text-[#4635B1] font-bold text-sm">Save</button>
      </nav>

      {/* --- SWIPABLE CARD AREA --- */}
      <main className="flex-1 relative flex items-center justify-center p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPageIdx}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onDragEnd={(_, info) => {
              if (info.offset.x < -100 && currentPageIdx < pages.length - 1) setCurrentPageIdx(i => i + 1);
              if (info.offset.x > 100 && currentPageIdx > 0) setCurrentPageIdx(i => i - 1);
            }}
            className="w-full max-w-sm aspect-[3/4] bg-white rounded-[2.5rem] shadow-2xl shadow-stone-200/50 p-8 flex flex-col border border-stone-100"
          >
            <div className="flex-1">
              <textarea
                value={pages[currentPageIdx]?.text || ""}
                onChange={(e) => updatePageText(e.target.value)}
                className="w-full h-full bg-transparent text-2xl font-serif leading-relaxed text-[#1A1A1A] focus:outline-none resize-none"
                placeholder="The story continues..."
              />
            </div>
            <div className="pt-4 border-t border-stone-50 flex justify-between items-center">
              <span className="text-[10px] font-bold text-[#AEEA94] uppercase tracking-widest">Scribed</span>
              <BookOpen className="w-4 h-4 text-stone-200" />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --- MOBILE ACTIONS --- */}
      <footer className="flex-none p-6 space-y-4 bg-white border-t border-stone-200/40">
        <div className="flex gap-2">
           <input 
            value={rewriteInstruction}
            onChange={(e) => setRewriteInstruction(e.target.value)}
            placeholder="Rewrite this page..." 
            className="flex-1 bg-[#FAF9F6] rounded-full px-5 py-3 text-sm focus:outline-none italic"
          />
          <button className="bg-[#4635B1] text-white p-3 rounded-full"><Wand2 className="w-5 h-5" /></button>
        </div>
        
        <button 
          // onClick={() => router.push(`/stories/${storyId}/extract`)}
          onClick={() => router.push(`/stories/${storyId}/hub`)}
          className="w-full py-4 bg-[#4635B1] text-white rounded-full font-bold shadow-xl shadow-[#4635B1]/20 flex items-center justify-center gap-2"
        >
          <Stars className="w-5 h-5 text-[#AEEA94]" />
          Confirm Story & Continue
        </button>
      </footer>
    </div>
  );
}