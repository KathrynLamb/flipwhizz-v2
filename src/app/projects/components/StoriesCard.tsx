"use client";

import Link from "next/link";
import { BookOpen, Sparkles, Palette, Paintbrush, Lock, Clock, Loader2, PackageCheck, Users2 } from "lucide-react";
import { useEffect, useState } from "react";

const PINK = "#D94590";

const STATUS_CONFIG: Record<string, { label: string; icon: any; href: (id: string) => string; color: string }> = {
  planning:         { label: "Planning",           icon: BookOpen,     href: id => `/stories/${id}/chat`,     color: "#F5A862" },
  draft:            { label: "Draft",              icon: BookOpen,     href: id => `/stories/${id}/extract`,  color: "#F5A862" },
  extracting:       { label: "Finding characters", icon: Sparkles,     href: id => `/stories/${id}/extract`,  color: "#E88BAE" },
  world_ready:      { label: "Characters",         icon: Users2,       href: id => `/stories/${id}/extract`,  color: "#A78BDA" },
  style_ready:      { label: "Style",              icon: Palette,      href: id => `/stories/${id}/design`,   color: "#6DBCE0" },
  awaiting_payment: { label: "Unlock art",         icon: Lock,         href: id => `/stories/${id}/checkout`, color: "#F28B7B" },
  generating:       { label: "Illustrating",       icon: Paintbrush,   href: id => `/stories/${id}/studio`,   color: "#9B7DC9" },
  covers_complete:  { label: "Ready",              icon: PackageCheck,  href: id => `/stories/${id}/studio`,   color: "#7DD4A8" },
  publishing:       { label: "Printing",           icon: Loader2,      href: () => "#",                       color: "#7DD4A8" },
  completed:        { label: "Complete",           icon: PackageCheck,  href: id => `/stories/${id}/book`,     color: "#7DD4A8" },
};

export default function StoriesCard({ story }: { story: any }) {
// Determine effective status — paid books with PDF are complete
const effectiveStatus =
  story.paymentStatus === "paid" && story.pdfUrl
    ? "completed"
    : story.status;



const config = STATUS_CONFIG[effectiveStatus] ?? STATUS_CONFIG.draft;
  
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);

  return (
    <li
      className="group relative rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl"
      style={{ background: "white", boxShadow: "0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)" }}
    >
      {/* <Link href={config.href(story.id)} className="block"> */}
      <button onClick={() => console.log(effectiveStatus)}> 
        {/* Cover */}
        <div className="relative w-full overflow-hidden">
          {story.coverImageUrl || story.coverSpread ? (
            <img src={story.coverSpread || story.coverImageUrl} alt={story.title} className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.04]" />
          ) : (
            <div className="aspect-[4/3] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #FDF0F5, #F3EEFA, #EEF6FC)" }}>
              <BookOpen className="w-12 h-12 text-gray-300" />
            </div>
          )}
          {/* Status badge */}
          <div className="absolute top-3 left-3">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold backdrop-blur-md text-white"
              style={{ background: config.color }}
            >
              {config.label}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-3">
          <h3 className="font-bold text-lg leading-snug line-clamp-2" style={{ color: "#2D2235" }}>
            {story.title || "Untitled story"}
          </h3>
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5 font-medium">
            <Clock className="w-3 h-3" />
            {!mounted ? "—" : story.updatedAt ? `Updated ${new Date(story.updatedAt).toLocaleDateString("en-GB")}` : "Just created"}
          </p>
          <div
            className="mt-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-300 group-hover:shadow-md"
            style={{ background: PINK, boxShadow: `0 3px 12px ${PINK}20` }}
          >
            Open story <span className="text-white/60 text-xs ml-0.5">→</span>
          </div>
        </div>
      {/* </Link>*/}
      </button>
    </li>
  );
}