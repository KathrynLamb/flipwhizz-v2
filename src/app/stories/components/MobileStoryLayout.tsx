// // // src/app/stories/components/MobileStoryLayout.tsx
// // 'use client';

// // import { motion, AnimatePresence } from 'framer-motion';
// // import { ChevronUp, Check, Sparkles } from 'lucide-react';
// // import { useState } from 'react';
// // import AuthorLetter from './AuthorLetter';

// // type Mode = 'read' | 'collab' | 'confirm';

// // export default function MobileStoryLayout({
// //   page,
// //   authorLetter,
// //   onAccept,
// //   onEdit,
// // }: {
// //   page: React.ReactNode;
// //   authorLetter?: any;
// //   onAccept: () => void;
// //   onEdit: () => void;
// // }) {
// //   const [mode, setMode] = useState<Mode>('read');

// //   return (
// //     <div className="relative min-h-screen bg-white">
// //       {/* READING AREA */}
// //       <div className="px-5 pt-6 pb-32">
// //         {page}
// //       </div>

// //       {/* FLOATING ACTION BAR */}
// //       <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-4 py-3 z-50">
// //         {mode === 'read' && (
// //           <button
// //             onClick={() => setMode('collab')}
// //             className="w-full rounded-full py-3 font-semibold text-stone-700 bg-stone-100 flex items-center justify-center gap-2"
// //           >
// //             <ChevronUp className="w-4 h-4" />
// //             Note from your co-author
// //           </button>
// //         )}

// //         {mode === 'confirm' && (
// //           <button
// //             onClick={onAccept}
// //             className="w-full rounded-full py-3 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
// //           >
// //             <Check className="w-4 h-4 inline mr-2" />
// //             Confirm & continue
// //           </button>
// //         )}
// //       </div>

// //       {/* BOTTOM SHEET */}
// //       <AnimatePresence>
// //         {mode === 'collab' && authorLetter && (
// //           <motion.div
// //             initial={{ y: '100%' }}
// //             animate={{ y: 0 }}
// //             exit={{ y: '100%' }}
// //             transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
// //             className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-[2rem] shadow-2xl max-h-[85vh] overflow-y-auto"
// //           >
// //             <div className="p-6">
// //               <AuthorLetter
// //                 data={authorLetter}
// //                 onContinue={() => setMode('confirm')}
// //                 onRespond={() => {
// //                   setMode('read');
// //                   onEdit();
// //                 }}
// //               />
// //             </div>

// //             <button
// //               onClick={() => setMode('read')}
// //               className="w-full py-4 text-sm text-stone-500"
// //             >
// //               Close
// //             </button>
// //           </motion.div>
// //         )}
// //       </AnimatePresence>
// //     </div>
// //   );
// // }


// "use client";

// import { motion, useMotionValue, animate, AnimatePresence } from "framer-motion";
// import { ChevronLeft, ChevronUp, Check, MessageSquare, X } from "lucide-react";
// import { useState, useEffect, useRef } from "react";
// import { useRouter } from "next/navigation";

// type Page = {
//   pageNumber: number;
//   text: string;
// };

// type AuthorNote = {
//   summary?: string;
//   focusedOn?: string[];
//   optionalIdeas?: string[];
// };

// export default function MobileStoryLayout({
//   story,
//   pages,
//   authorNote,
//   onConfirm,
//   onEdit,
// }: {
//   story: any;
//   pages: Page[];
//   authorNote?: AuthorNote;
//   onConfirm: () => void;
//   onEdit: () => void;
// }) {
//   const router = useRouter();
//   const containerRef = useRef<HTMLDivElement>(null);

//   const [index, setIndex] = useState(0);
//   const [showNote, setShowNote] = useState(false);
//   const [showConfirmBar, setShowConfirmBar] = useState(false);
//   const [viewportWidth, setViewportWidth] = useState<number | null>(null);

//   const x = useMotionValue(0);

//   /* ------------------------------ Measure width ---------------------------- */

//   useEffect(() => {
//     const measure = () => {
//       const el = containerRef.current;
//       const w = el?.getBoundingClientRect().width ?? window.innerWidth;
//       setViewportWidth(w);
//       animate(x, -index * w, { duration: 0 });
//     };

//     measure();

//     const ro =
//       typeof ResizeObserver !== "undefined"
//         ? new ResizeObserver(measure)
//         : null;

//     if (ro && containerRef.current) ro.observe(containerRef.current);

//     window.addEventListener("resize", measure);
//     window.addEventListener("orientationchange", measure);

//     return () => {
//       window.removeEventListener("resize", measure);
//       window.removeEventListener("orientationchange", measure);
//       ro?.disconnect();
//     };
//   }, [index, x]);

//   /* ------------------------------ Navigation -------------------------------- */

//   function clamp(i: number) {
//     return Math.max(0, Math.min(i, pages.length - 1));
//   }

//   function snapTo(i: number) {
//     if (viewportWidth == null) return;

//     const next = clamp(i);
//     setIndex(next);

//     animate(x, -next * viewportWidth, {
//       type: "spring",
//       stiffness: 280,
//       damping: 34,
//     });
//   }

//   function onDragEnd(_: any, info: any) {
//     if (viewportWidth == null) return;

//     const offset = info.offset.x;
//     const velocity = info.velocity.x;

//     if (offset < -viewportWidth * 0.15 || velocity < -500) {
//       snapTo(index + 1);
//     } else if (offset > viewportWidth * 0.15 || velocity > 500) {
//       snapTo(index - 1);
//     } else {
//       snapTo(index);
//     }
//   }

//   /* -------------------------------- Actions -------------------------------- */

//   function handleViewedNote() {
//     setShowNote(false);
//     setShowConfirmBar(true);
//   }

//   if (viewportWidth == null) {
//     return (
//       <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
//         <div className="animate-pulse text-purple-600">Loading...</div>
//       </div>
//     );
//   }

//   return (
//     <div
//       ref={containerRef}
//       className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 overflow-hidden"
//       style={{
//         paddingTop: "env(safe-area-inset-top)",
//         paddingBottom: "env(safe-area-inset-bottom)",
//       }}
//     >
//       {/* ============================== HEADER ============================== */}
//       <div className="absolute top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
//         <div className="px-4 py-3 flex items-center justify-between">
//           <button
//             onClick={() => router.push("/dashboard")}
//             className="p-2 -ml-2 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors"
//           >
//             <ChevronLeft className="w-5 h-5 text-gray-700" />
//           </button>

//           <div className="flex-1 text-center">
//             <h1 className="text-sm font-bold text-gray-900 truncate px-4">
//               {story.title}
//             </h1>
//             <p className="text-xs text-gray-500">
//               Page {index + 1} of {pages.length}
//             </p>
//           </div>

//           <div className="w-9" /> {/* Spacer for centering */}
//         </div>
//       </div>

//       {/* ============================ SWIPE TRACK ============================ */}
//       <motion.div
//         className="flex h-full pt-16 pb-20"
//         style={{ x }}
//         drag={showNote ? false : "x"}
//         dragConstraints={{
//           left: -((pages.length - 1) * viewportWidth),
//           right: 0,
//         }}
//         dragElastic={0.08}
//         onDragEnd={onDragEnd}
//       >
//         {pages.map((page, i) => (
//           <div
//             key={i}
//             className="flex-none shrink-0 h-full flex items-center justify-center px-8"
//             style={{ width: viewportWidth }}
//           >
//             {/* Page Card */}
//             <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full max-h-[70vh] overflow-y-auto border border-gray-100">
//               <div className="flex items-start justify-between mb-4">
//                 <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
//                   Page {page.pageNumber}
//                 </span>
//                 <div className="flex gap-1">
//                   <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
//                   <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
//                   <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
//                 </div>
//               </div>

//               <p className="text-lg leading-relaxed text-gray-800 font-serif">
//                 {page.text}
//               </p>
//             </div>
//           </div>
//         ))}
//       </motion.div>

//       {/* =========================== BOTTOM ACTION BAR ======================== */}
//       <div className="absolute bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3">
//         {!showNote && !showConfirmBar && authorNote && (
//           <button
//             onClick={() => setShowNote(true)}
//             className="w-full rounded-2xl py-4 font-semibold text-gray-700 bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
//           >
//             <MessageSquare className="w-4 h-4" />
//             View Note from Co-Author
//           </button>
//         )}

//         {showConfirmBar && (
//           <button
//             onClick={onConfirm}
//             className="w-full rounded-2xl py-4 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
//           >
//             <Check className="w-5 h-5" />
//             Confirm Story & Continue
//           </button>
//         )}
//       </div>

//       {/* ============================ PAGE INDICATORS ========================= */}
//       {!showNote && (
//         <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-1.5 px-4">
//           {pages.map((_, i) => (
//             <button
//               key={i}
//               onClick={() => snapTo(i)}
//               className={`h-1.5 rounded-full transition-all ${
//                 i === index
//                   ? "w-8 bg-gradient-to-r from-purple-500 to-pink-500"
//                   : "w-1.5 bg-gray-300"
//               }`}
//             />
//           ))}
//         </div>
//       )}

//       {/* ========================== AUTHOR NOTE SHEET ========================= */}
//       <AnimatePresence>
//         {showNote && authorNote && (
//           <>
//             {/* Backdrop */}
//             <motion.div
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               exit={{ opacity: 0 }}
//               className="absolute inset-0 bg-black/40 z-50"
//               onClick={() => setShowNote(false)}
//             />

//             {/* Bottom Sheet */}
//             <motion.div
//               initial={{ y: "100%" }}
//               animate={{ y: 0 }}
//               exit={{ y: "100%" }}
//               transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
//               className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
//             >
//               {/* Handle */}
//               <div className="flex justify-center pt-3 pb-2">
//                 <div className="w-10 h-1 bg-gray-300 rounded-full" />
//               </div>

//               {/* Header */}
//               <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
//                 <div className="flex items-center gap-2">
//                   <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">
//                     ✨
//                   </div>
//                   <h3 className="font-bold text-gray-900">Your Co-Author's Note</h3>
//                 </div>
//                 <button
//                   onClick={() => setShowNote(false)}
//                   className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
//                 >
//                   <X className="w-5 h-5 text-gray-500" />
//                 </button>
//               </div>

//               {/* Content */}
//               <div className="px-6 py-6 space-y-6">
//                 {/* Summary */}
//                 {authorNote.summary && (
//                   <div>
//                     <p className="text-base text-gray-700 leading-relaxed">
//                       {authorNote.summary}
//                     </p>
//                   </div>
//                 )}

//                 {/* What I Focused On */}
//                 {authorNote.focusedOn && authorNote.focusedOn.length > 0 && (
//                   <div>
//                     <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
//                       <span className="text-purple-500">✓</span>
//                       What I focused on:
//                     </h4>
//                     <ul className="space-y-2">
//                       {authorNote.focusedOn.map((item, i) => (
//                         <li
//                           key={i}
//                           className="text-sm text-gray-700 pl-4 border-l-2 border-purple-200"
//                         >
//                           {item}
//                         </li>
//                       ))}
//                     </ul>
//                   </div>
//                 )}

//                 {/* Optional Ideas */}
//                 {authorNote.optionalIdeas &&
//                   authorNote.optionalIdeas.length > 0 && (
//                     <div>
//                       <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
//                         <span className="text-pink-500">💡</span>
//                         Optional ideas to explore:
//                       </h4>
//                       <ul className="space-y-2">
//                         {authorNote.optionalIdeas.map((item, i) => (
//                           <li
//                             key={i}
//                             className="text-sm text-gray-700 pl-4 border-l-2 border-pink-200"
//                           >
//                             {item}
//                           </li>
//                         ))}
//                       </ul>
//                     </div>
//                   )}
//               </div>

//               {/* Actions */}
//               <div className="px-6 pb-6 pt-2 space-y-3">
//                 <button
//                   onClick={handleViewedNote}
//                   className="w-full rounded-2xl py-4 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
//                 >
//                   Looks Great! Continue
//                 </button>

//                 <button
//                   onClick={() => {
//                     setShowNote(false);
//                     onEdit();
//                   }}
//                   className="w-full rounded-2xl py-4 font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
//                 >
//                   I'd Like to Make Changes
//                 </button>
//               </div>
//             </motion.div>
//           </>
//         )}
//       </AnimatePresence>
//     </div>
//   );
// }


"use client";

import { motion, useMotionValue, animate, AnimatePresence } from "framer-motion";
import { ChevronLeft, Check, MessageSquare, X, Send, Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Page = {
  pageNumber: number;
  text: string;
};

type AuthorNote = {
  summary?: string;
  focusedOn?: string[];
  optionalIdeas?: string[];
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function MobileStoryLayout({
  story,
  pages,
  authorNote,
  onConfirm,
}: {
  story: any;
  pages: Page[];
  authorNote?: AuthorNote;
  onConfirm: () => void;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [index, setIndex] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showConfirmBar, setShowConfirmBar] = useState(false);
  const [viewportWidth, setViewportWidth] = useState<number | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);

  const x = useMotionValue(0);

  /* ------------------------------ Measure width ---------------------------- */

  useEffect(() => {
    const measure = () => {
      const el = containerRef.current;
      const w = el?.getBoundingClientRect().width ?? window.innerWidth;
      setViewportWidth(w);
      animate(x, -index * w, { duration: 0 });
    };

    measure();

    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(measure)
        : null;

    if (ro && containerRef.current) ro.observe(containerRef.current);

    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      ro?.disconnect();
    };
  }, [index, x]);

  /* -------------------------- Initialize chat with author note ------------- */

  useEffect(() => {
    if (authorNote?.summary) {
      const initialMessage = formatAuthorNoteAsMessage(authorNote);
      setMessages([{ role: "assistant", content: initialMessage }]);
      setConversationHistory([{ role: "assistant", content: initialMessage }]);
    }
  }, [authorNote]);

  /* -------------------------- Auto-scroll messages ------------------------- */

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ------------------------------ Navigation -------------------------------- */

  function clamp(i: number) {
    return Math.max(0, Math.min(i, pages.length - 1));
  }

  function snapTo(i: number) {
    if (viewportWidth == null) return;

    const next = clamp(i);
    setIndex(next);

    animate(x, -next * viewportWidth, {
      type: "spring",
      stiffness: 280,
      damping: 34,
    });
  }

  function onDragEnd(_: any, info: any) {
    if (viewportWidth == null) return;

    const offset = info.offset.x;
    const velocity = info.velocity.x;

    if (offset < -viewportWidth * 0.15 || velocity < -500) {
      snapTo(index + 1);
    } else if (offset > viewportWidth * 0.15 || velocity > 500) {
      snapTo(index - 1);
    } else {
      snapTo(index);
    }
  }

  /* ----------------------------- Chat functionality ------------------------ */

  async function handleSendMessage() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/stories/${story.id}/rewrite-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory,
          currentSpread: {
            index: Math.floor(index / 2),
            pages: [pages[index], pages[index + 1]].filter(Boolean),
          },
          storyContext: {
            title: story.title,
            allPages: pages,
          },
        }),
      });

      const data = await response.json();

      if (data.reply) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.reply,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setConversationHistory(data.conversationHistory || []);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

// Update the applyEdits function in your MobileStoryLayout.tsx component

async function applyEdits() {
  setIsLoading(true);

  try {
    const instruction = conversationHistory
      .filter((msg) => msg.role === "user")
      .map((msg) => msg.content)
      .join("\n\n");

    console.log("🔄 Applying edits with instruction:", instruction);

    const response = await fetch(`/api/stories/${story.id}/global-rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instruction: instruction || "Apply the discussed changes to the story.",
      }),
    });

    console.log("📡 Response status:", response.status, response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Network error" }));
      console.error("❌ Server error:", errorData);
      alert(`Failed to apply edits: ${errorData.error || "Server error"}`);
      setIsLoading(false);
      return;
    }

    const data = await response.json();
    console.log("✅ Response data:", data);

    if (data.ok) {
      // Show success message before reload
      const successMsg = document.createElement('div');
      successMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#10b981;color:white;padding:20px 40px;border-radius:12px;font-weight:bold;z-index:9999;box-shadow:0 10px 40px rgba(0,0,0,0.3);';
      successMsg.textContent = '✓ Changes applied! Reloading...';
      document.body.appendChild(successMsg);
      
      // Wait a moment before reload so user sees success
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else {
      console.error("❌ Unexpected response:", data);
      alert(`Failed to apply edits: ${data.error || "Unknown error"}`);
      setIsLoading(false);
    }
  } catch (error) {
    console.error("❌ Edit error:", error);
    alert(`Failed to apply edits: ${error instanceof Error ? error.message : "Network error"}`);
    setIsLoading(false);
  }
}

  /* -------------------------------- Actions -------------------------------- */

  function handleViewedNote() {
    setShowNote(false);
    setShowConfirmBar(true);
  }

  function handleStartEditing() {
    setShowNote(false);
    setShowChat(true);
  }

  if (viewportWidth == null) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="animate-pulse text-purple-600">Loading...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 overflow-hidden"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* ============================== HEADER ============================== */}
      <div className="absolute top-0 inset-x-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="p-2 -ml-2 hover:bg-gray-100 active:bg-gray-200 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          <div className="flex-1 text-center">
            <h1 className="text-sm font-bold text-gray-900 truncate px-4">
              {story.title}
            </h1>
            <p className="text-xs text-gray-500">
              Page {index + 1} of {pages.length}
            </p>
          </div>

          <div className="w-9" />
        </div>
      </div>

      {/* ============================ SWIPE TRACK ============================ */}
      {!showChat && (
        <motion.div
          className="flex h-full pt-16 pb-20"
          style={{ x }}
          drag={showNote ? false : "x"}
          dragConstraints={{
            left: -((pages.length - 1) * viewportWidth),
            right: 0,
          }}
          dragElastic={0.08}
          onDragEnd={onDragEnd}
        >
          {pages.map((page, i) => (
            <div
              key={i}
              className="flex-none shrink-0 h-full flex items-center justify-center px-8"
              style={{ width: viewportWidth }}
            >
              <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full max-h-[70vh] overflow-y-auto border border-gray-100">
                <div className="flex items-start justify-between mb-4">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Page {page.pageNumber}
                  </span>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-pink-400" />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  </div>
                </div>

                <p className="text-lg leading-relaxed text-gray-800 font-serif">
                  {page.text}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* =========================== BOTTOM ACTION BAR ======================== */}
      {!showChat && (
        <div className="absolute bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 px-4 py-3">
          {!showNote && !showConfirmBar && authorNote && (
            <button
              onClick={() => setShowNote(true)}
              className="w-full rounded-2xl py-4 font-semibold text-gray-700 bg-gradient-to-r from-purple-100 to-pink-100 hover:from-purple-200 hover:to-pink-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4" />
              View Note from Co-Author
            </button>
          )}

          {showConfirmBar && (
            <button
              onClick={onConfirm}
              className="w-full rounded-2xl py-4 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Confirm Story & Continue
            </button>
          )}
        </div>
      )}

      {/* ============================ PAGE INDICATORS ========================= */}
      {!showNote && !showChat && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center gap-1.5 px-4">
          {pages.map((_, i) => (
            <button
              key={i}
              onClick={() => snapTo(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index
                  ? "w-8 bg-gradient-to-r from-purple-500 to-pink-500"
                  : "w-1.5 bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}

      {/* ========================== AUTHOR NOTE SHEET ========================= */}
      <AnimatePresence>
        {showNote && authorNote && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 z-50"
              onClick={() => setShowNote(false)}
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm">
                    ✨
                  </div>
                  <h3 className="font-bold text-gray-900">Your Co-Author's Note</h3>
                </div>
                <button
                  onClick={() => setShowNote(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="px-6 py-6 space-y-6">
                {authorNote.summary && (
                  <div>
                    <p className="text-base text-gray-700 leading-relaxed">
                      {authorNote.summary}
                    </p>
                  </div>
                )}

                {authorNote.focusedOn && authorNote.focusedOn.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <span className="text-purple-500">✓</span>
                      What I focused on:
                    </h4>
                    <ul className="space-y-2">
                      {authorNote.focusedOn.map((item, i) => (
                        <li
                          key={i}
                          className="text-sm text-gray-700 pl-4 border-l-2 border-purple-200"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {authorNote.optionalIdeas &&
                  authorNote.optionalIdeas.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="text-pink-500">💡</span>
                        Optional ideas to explore:
                      </h4>
                      <ul className="space-y-2">
                        {authorNote.optionalIdeas.map((item, i) => (
                          <li
                            key={i}
                            className="text-sm text-gray-700 pl-4 border-l-2 border-pink-200"
                          >
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>

              <div className="px-6 pb-6 pt-2 space-y-3">
                <button
                  onClick={handleViewedNote}
                  className="w-full rounded-2xl py-4 font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg hover:shadow-xl active:scale-[0.98] transition-all"
                >
                  Looks Great! Continue
                </button>

                <button
                  onClick={handleStartEditing}
                  className="w-full rounded-2xl py-4 font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all"
                >
                  I'd Like to Make Changes
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ============================ CHAT INTERFACE ========================== */}
      <AnimatePresence>
        {showChat && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-50 bg-white flex flex-col"
          >
            {/* Chat Header */}
            <div className="flex-none px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 flex items-center gap-3">
              <button
                onClick={() => setShowChat(false)}
                className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1">
                <h2 className="font-bold text-white">Edit Your Story</h2>
                <p className="text-xs text-white/80">Chat with your co-author</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`
                      max-w-[85%] rounded-3xl px-5 py-3.5 text-sm shadow-md
                      ${
                        msg.role === "user"
                          ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white"
                          : "bg-gray-100 text-gray-800"
                      }
                    `}
                  >
                    <FormattedMessage
                      content={msg.content}
                      isUser={msg.role === "user"}
                    />
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-3xl px-5 py-3.5 shadow-md">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-none bg-white border-t border-gray-200 px-4 py-3 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder="What would you like to change?"
                  className="flex-1 rounded-full border-2 border-gray-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white p-3 active:scale-95 transition disabled:opacity-40 shadow-lg"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {messages.length > 1 && (
                <button
                  onClick={applyEdits}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-lg active:scale-98 transition disabled:opacity-40"
                >
                  {isLoading ? "Applying..." : "Apply Changes to Story"}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ======================================================
   HELPERS
====================================================== */

function formatAuthorNoteAsMessage(note: AuthorNote): string {
  let message = note.summary || "";

  if (note.focusedOn && note.focusedOn.length > 0) {
    message += "\n\n**What I focused on:**";
    note.focusedOn.forEach((item) => {
      message += `\n• ${item}`;
    });
  }

  if (note.optionalIdeas && note.optionalIdeas.length > 0) {
    message += "\n\n**Optional ideas to explore:**";
    note.optionalIdeas.forEach((item) => {
      message += `\n• ${item}`;
    });
  }

  return message;
}

function FormattedMessage({
  content,
  isUser,
}: {
  content: string;
  isUser: boolean;
}) {
  return (
    <div className="space-y-1">
      {content.split("\n").map((line, idx) => {
        if (line.includes("**")) {
          const parts = line.split("**");
          return (
            <div key={idx}>
              {parts.map((part, i) =>
                i % 2 === 1 ? (
                  <strong key={i} className="font-bold">
                    {part}
                  </strong>
                ) : (
                  <span key={i}>{part}</span>
                )
              )}
            </div>
          );
        }
        if (line.trim().startsWith("•")) {
          return (
            <div key={idx} className="flex gap-2 ml-2">
              <span>•</span>
              <span>{line.trim().substring(1).trim()}</span>
            </div>
          );
        }
        if (line.trim()) {
          return <div key={idx}>{line}</div>;
        }
        return <div key={idx} className="h-2" />;
      })}
    </div>
  );
}