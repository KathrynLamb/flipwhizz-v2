// 'use client'
// import Link from "next/link";
// import { useRouter } from "next/navigation";

// type StoryProps = {
//   story: {
//     id: string;
//     projectId: string;
//     title: string;
//     storyConfirmed: boolean; // <--- The field you need
//     status: string;          // "planning", "extracting", "generated", etc.
//     updatedAt: Date | null;
//   };
// };

// function StoriesCard({story}: StoryProps) {
//     const router = useRouter()
//     console.log("Story => ", s)
//             return (
//                 <div >
//                 <li key={s.storyId} className="group">
//                   <Link
//                     // 👉 point this to wherever your story editor lives
//                     href={`/chat?story=${s.storyId}`}
//                     className="block h-full rounded-3xl border-4 border-[#E6D5B8] bg-[#F3EAD3] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.08)] transition hover:-translate-y-1 hover:shadow-[0_30px_80px_rgba(0,0,0,0.12)]"
//                   >
//                     <div className="flex items-start justify-between gap-4">
//                       <div className="min-w-0">
//                         <h2 className="font-serif text-2xl font-bold text-[#261C15] truncate">
//                           {s.title}
//                         </h2>
//                         <p className="mt-1 text-xs text-[#6B5D52] truncate">
//                           In <span className="font-semibold">{s.projectName}</span>
//                         </p>
//                       </div>

//                       <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white shadow ring-1 ring-black/5 transition group-hover:scale-105">
//                         →
//                       </span>
//                     </div>

//                     <div className="mt-4 flex flex-wrap gap-2">
//                       <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#261C15] ring-1 ring-black/5">
//                         📖 {s.pageCount} pages
//                       </span>
//                       <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#261C15] ring-1 ring-black/5">
//                         🧭 {s.status ?? "planning"}
//                       </span>
//                       <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#261C15] ring-1 ring-black/5">
//                         💳 {s.paymentStatus ?? "pending"}
//                       </span>
//                     </div>

//                     <p className="mt-4 text-sm text-[#6B5D52] leading-relaxed line-clamp-3">
//                       {s.description ?? "Open to continue crafting your story…"}
//                     </p>

//                     <p className="mt-4 text-xs text-[#6B5D52]/80">
//                       Updated{" "}
//                       {(s.updatedAt ?? s.createdAt)
//                         ? new Date((s.updatedAt ?? s.createdAt)!).toLocaleDateString()
//                         : "—"}
//                     </p>

//                     <div className="mt-6 h-1 w-full rounded-full bg-gradient-to-r from-[#F4A261] via-[#E6D5B8] to-transparent" />
//                   </Link>
                  
//                 </li>

//                 <button onClick={() => router.push(`/stories/${s.storyId}`)}>read project</button>
//                 </div>
//   );
// }

// export default StoriesCard
import Link from "next/link";
import { Sparkles, BookOpen, Clock, Paintbrush } from "lucide-react";

// Matches your Drizzle Schema
type StoryProps = {
  story: {
    id: string;
    projectId: string;
    title: string;
    storyConfirmed: boolean; // <--- The field you need
    status: string;          // "planning", "extracting", "generated", etc.
    updatedAt: Date | null;
  };
};

export default function StoryCard({ story }: StoryProps) {
  console.log(story)
  // LOGIC: Determine where the "Continue" button goes based on status
  let actionLink = `/stories/${story.id}`;
  let buttonText = "Continue";
  let StatusIcon = BookOpen;
  let statusLabel = "Drafting";

  if (!story.storyConfirmed) {
    // Stage 1: Writing the text
    actionLink = `/stories/${story.id}`; // Go to the Draft View we just built
    buttonText = "Review Draft";
    StatusIcon = BookOpen;
    statusLabel = "Writing Phase";
  } else if (story.status === 'extracting') {
    // Stage 2: AI is thinking
    actionLink = `/stories/${story.id}/extract`;
    buttonText = "View Magic";
    StatusIcon = Sparkles;
    statusLabel = "Magic in Progress";
  } else {
    // Stage 3: Art generation / Done
    actionLink = `/stories/${story.id}/studio`;
    buttonText = "Open Studio";
    StatusIcon = Paintbrush;
    statusLabel = "Art Studio";
  }

  return (
    <div className="group relative bg-white rounded-r-2xl rounded-l-md shadow-sm border border-stone-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-[320px] w-full max-w-sm">
      
      {/* --- SPINE (Visual decorative left edge) --- */}
      <div className="absolute left-0 top-0 bottom-0 w-3 bg-[#261C15] rounded-l-md z-20 flex flex-col items-center justify-center gap-1">
        <div className="w-[1px] h-full bg-white/10"></div>
      </div>
      <div className="absolute left-3 top-0 bottom-0 w-1 bg-stone-300 z-10 shadow-inner"></div>

      {/* --- COVER AREA --- */}
      <div className="relative h-48 bg-[#F3EAD3] rounded-tr-2xl overflow-hidden ml-4">
         {/* Placeholder for dynamic cover art */}
         <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <Sparkles className="w-20 h-20 text-[#261C15]" />
         </div>
         
         {/* Status Badge */}
         <div className="absolute top-3 right-3">
            <span className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm border
              ${story.storyConfirmed 
                ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                : "bg-amber-100 text-amber-800 border-amber-200"}
            `}>
              <StatusIcon className="w-3 h-3" />
              {statusLabel}
            </span>
         </div>
      </div>

      {/* --- INFO AREA --- */}
      <div className="flex-grow flex flex-col p-5 ml-4">
        <h3 className="font-serif text-xl font-bold text-[#261C15] line-clamp-2 leading-tight">
          {story.title || "Untitled Adventure"}
        </h3>
        
        <p className="text-xs text-[#8C7A6B] mt-2 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Updated {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString() : 'Just now'}
        </p>

        <div className="mt-auto pt-4">
          <Link 
            href={actionLink}
            className={`
              flex items-center justify-center w-full py-2.5 rounded-lg text-sm font-bold transition-colors
              ${story.storyConfirmed 
                ? "bg-[#261C15] text-white hover:bg-black" 
                : "bg-[#F4A261] text-[#261C15] hover:bg-[#E76F51]"}
            `}
          >
            {buttonText}
          </Link>
        </div>
      </div>
    </div>
  );
}