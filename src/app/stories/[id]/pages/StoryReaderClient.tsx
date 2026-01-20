// 'use client';

// import { useState, useEffect, useRef } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
// import { Check, Send, Loader2, MessageSquare } from 'lucide-react';
// import { useRouter } from 'next/navigation';
// import MobileStoryLayout from '@/app/stories/components/MobileStoryLayout';

// /* ======================================================
//    TYPES
// ====================================================== */

// type StoryPage = {
//   pageNumber: number;
//   text: string;
// };

// export type AuthorLetterApiResponse = {
//   opening: string;
//   intention: string[];
//   optionalTweaks: string[];
//   invitation: string;
// };

// type Message = {
//   role: 'user' | 'assistant';
//   content: string;
//   timestamp: Date;
// };

// /* ======================================================
//    COMPONENT
// ====================================================== */

// export default function StoryReaderClient({
//   title,
//   pages,
//   id,
// }: {
//   title: string;
//   pages: StoryPage[];
//   id: string;
// }) {
//   const router = useRouter();
//   const spreads = chunkIntoSpreads(pages);
//   const messagesEndRef = useRef<HTMLDivElement>(null);

//   const [index, setIndex] = useState(0);
//   const [mounted, setMounted] = useState(false);
//   const [authorLetter, setAuthorLetter] = useState<AuthorLetterApiResponse | null>(null);
  
//   // Chat state
//   const [messages, setMessages] = useState<Message[]>([]);
//   const [input, setInput] = useState('');
//   const [isLoading, setIsLoading] = useState(false);
//   const [conversationHistory, setConversationHistory] = useState<any[]>([]);

//   const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   // Load author letter and initialize chat
//   useEffect(() => {
//     fetch(`/api/stories/${id}/author-letter`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ title, pages }),
//     })
//       .then(res => res.json())
//       .then((res) => {
//         if (
//           res &&
//           typeof res.opening === "string" &&
//           Array.isArray(res.intention) &&
//           Array.isArray(res.optionalTweaks) &&
//           typeof res.invitation === "string"
//         ) {
//           setAuthorLetter(res);
          
//           // Format author letter as first chat message
//           const letterMessage = formatAuthorLetterAsMessage(res);
          
//           const initialMessage: Message = {
//             role: 'assistant',
//             content: letterMessage,
//             timestamp: new Date(),
//           };
          
//           setMessages([initialMessage]);
          
//           // Initialize conversation history for API
//           setConversationHistory([
//             { role: 'assistant', content: letterMessage }
//           ]);
//         }
//       })
//       .catch(console.error);
//   }, [title, pages, id]);

//   useEffect(() => {
//     messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
//   }, [messages]);

//   const handleSendMessage = async () => {
//     if (!input.trim() || isLoading) return;

//     const userMessage: Message = {
//       role: 'user',
//       content: input.trim(),
//       timestamp: new Date(),
//     };

//     setMessages(prev => [...prev, userMessage]);
//     setInput('');
//     setIsLoading(true);

//     try {
//       const response = await fetch(`/api/stories/${id}/rewrite-chat`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           message: userMessage.content,
//           conversationHistory,
//           currentSpread: {
//             index,
//             pages: spreads[index],
//           },
//           storyContext: {
//             title,
//             allPages: pages,
//           },
//         }),
//       });

//       const data = await response.json();

//       if (data.reply) {
//         const assistantMessage: Message = {
//           role: 'assistant',
//           content: data.reply,
//           timestamp: new Date(),
//         };

//         setMessages(prev => [...prev, assistantMessage]);
//         setConversationHistory(data.conversationHistory || []);
//       }
//     } catch (error) {
//       console.error('Chat error:', error);
//       const errorMessage: Message = {
//         role: 'assistant',
//         content: 'Sorry, I encountered an error. Please try again.',
//         timestamp: new Date(),
//       };
//       setMessages(prev => [...prev, errorMessage]);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const applyEditsToStory = async () => {
//     setIsLoading(true);
    
//     try {
//       // Build instruction from conversation history
//       const instruction = conversationHistory
//         .filter(msg => msg.role === 'user')
//         .map(msg => msg.content)
//         .join('\n\n');

//       const response = await fetch(`/api/stories/${id}/global-rewrite`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           instruction: instruction || 'Apply the discussed changes to the story.',
//         }),
//       });

//       const data = await response.json();

//       if (data.ok) {
//         // Successfully rewrote the story
//         window.location.reload(); // Reload to show updated pages
//       } else {
//         console.error('Rewrite failed:', data.error);
//         alert(`Failed to apply edits: ${data.error || 'Unknown error'}`);
//       }
//     } catch (error) {
//       console.error('Edit error:', error);
//       alert('Failed to apply edits. Please try again.');
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const handleConfirmStory = async () => {
//     // 🔍 Derive story intent (non-blocking, best-effort)
//     try {
//       fetch(`/api/stories/${id}/derive-intent`, {
//         method: "POST",
//       }).catch(() => {});
//     } catch {
//       // Intentionally ignored
//     }
  
//     // 🚀 Continue immediately
//     router.push(`/stories/${id}/extract`);
//   };
  

//   if (!mounted) return null;

//   return isMobile ? (
//     <MobileStoryLayout
//       page={<PageCard page={pages[index]} />}
//       authorLetter={authorLetter && {
//         opening: authorLetter.opening,
//         intention: authorLetter.intention ?? [],
//         optionalTweaks: authorLetter.optionalTweaks ?? [],
//         invitation: authorLetter.invitation,
//       }}
//       onAccept={() => router.push(`/stories/${id}/extract`)}
//       onEdit={() => {}} // Mobile keeps separate flow for now
//     />
//   ) : (
//     <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
//       <div className="max-w-7xl mx-auto px-6 py-10">
        
//         {/* TITLE */}
//         <h1 className="text-center mb-10 text-4xl md:text-5xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
//           {title}
//         </h1>

//         {/* MAIN GRID */}
//         <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">

//           {/* LEFT: BOOK SPREAD */}
//           <AnimatePresence mode="wait">
//             <motion.div
//               key={index}
//               initial={{ opacity: 0, y: 16 }}
//               animate={{ opacity: 1, y: 0 }}
//               exit={{ opacity: 0, y: -16 }}
//               transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
//               className="bg-white rounded-[2.75rem] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] px-8 py-10"
//             >
//               <div className="grid gap-8 md:grid-cols-2">
//                 <PageCard page={spreads[index][0]} />
//                 <PageCard page={spreads[index][1]} />
//               </div>

//               {/* NAV */}
//               <div className="mt-10 flex items-center justify-between border-t border-stone-100 pt-6">
//                 <button
//                   disabled={index === 0}
//                   onClick={() => setIndex(i => i - 1)}
//                   className="px-5 py-2 rounded-full font-bold text-sm bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-30"
//                 >
//                   ← Previous
//                 </button>

//                 <button
//                   disabled={index === spreads.length - 1}
//                   onClick={() => setIndex(i => i + 1)}
//                   className="px-5 py-2 rounded-full font-bold text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:scale-[1.04] transition disabled:opacity-30"
//                 >
//                   Next →
//                 </button>
//               </div>
//             </motion.div>
//           </AnimatePresence>

//           {/* RIGHT: CHAT PANEL */}
//           <div className="sticky top-8 space-y-6">

//             {/* CHAT INTERFACE - Always visible */}
//             <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
              
//               {/* Chat Header */}
//               <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4 flex items-center gap-3">
//                 <MessageSquare className="w-5 h-5 text-white" />
//                 <h3 className="font-bold text-white">Discuss Your Story</h3>
//               </div>

//               {/* Messages */}
//               <div className="h-[400px] overflow-y-auto p-4 space-y-4">
//                 {messages.length === 0 && (
//                   <div className="text-center text-stone-400 py-12">
//                     <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
//                     <p className="text-sm">
//                       Loading your author's note...
//                     </p>
//                   </div>
//                 )}

//                 {messages.map((msg, i) => (
//                   <div
//                     key={i}
//                     className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
//                   >
//                     <div
//                       className={`
//                         max-w-[80%] rounded-2xl px-4 py-3 text-sm
//                         ${msg.role === 'user'
//                           ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
//                           : 'bg-stone-100 text-stone-800'
//                         }
//                       `}
//                     >
//                       <FormattedMessage content={msg.content} isUser={msg.role === 'user'} />
//                     </div>
//                   </div>
//                 ))}

//                 {isLoading && (
//                   <div className="flex justify-start">
//                     <div className="bg-stone-100 rounded-2xl px-4 py-3">
//                       <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
//                     </div>
//                   </div>
//                 )}

//                 <div ref={messagesEndRef} />
//               </div>

//               {/* Input */}
//               <div className="border-t border-stone-200 p-4">
//                 <div className="flex gap-2">
//                   <input
//                     type="text"
//                     value={input}
//                     onChange={(e) => setInput(e.target.value)}
//                     onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
//                     placeholder="Describe the changes you'd like..."
//                     className="flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700"
//                     disabled={isLoading}
//                   />
//                   <button
//                     onClick={handleSendMessage}
//                     disabled={!input.trim() || isLoading}
//                     className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-2 hover:scale-105 transition disabled:opacity-40"
//                   >
//                     <Send className="w-5 h-5" />
//                   </button>
//                 </div>
//               </div>

//               {/* Apply Button */}
//               {messages.length > 1 && (
//                 <div className="border-t border-stone-200 p-4">
//                   <button
//                     onClick={applyEditsToStory}
//                     disabled={isLoading}
//                     className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:scale-[1.02] transition disabled:opacity-40"
//                   >
//                     Apply Edits to Story
//                   </button>
//                 </div>
//               )}
//             </div>

//             {/* CONTINUE BUTTON */}
//             <button
//               onClick={handleConfirmStory}
//               className="w-full py-4 rounded-full bg-[#4635B1] text-white font-black shadow-xl shadow-[#4635B1]/30 flex items-center justify-center gap-2 hover:scale-[1.03] transition"
//             >
//               <Check className="w-5 h-5 text-[#AEEA94]" />
//               Confirm Story & Continue
//             </button>

//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ======================================================
//    HELPERS
// ====================================================== */

// function PageCard({ page }: { page?: StoryPage }) {
//   return (
//     <div className="rounded-3xl bg-white p-8 shadow-inner min-h-[320px]">
//       {page ? (
//         <>
//           <div className="text-xs font-bold text-stone-400 mb-3">
//             Page {page.pageNumber}
//           </div>
//           <p className="text-lg leading-relaxed text-stone-800 whitespace-pre-line">
//             {page.text}
//           </p>
//         </>
//       ) : (
//         <div className="h-full flex items-center justify-center text-stone-300 italic">
//           Blank page
//         </div>
//       )}
//     </div>
//   );
// }

// function chunkIntoSpreads(pages: StoryPage[]) {
//   const spreads: [StoryPage?, StoryPage?][] = [];
//   for (let i = 0; i < pages.length; i += 2) {
//     spreads.push([pages[i], pages[i + 1]]);
//   }
//   return spreads;
// }

// function formatAuthorLetterAsMessage(letter: AuthorLetterApiResponse): string {
//   let message = letter.opening;
  
//   if (letter.intention.length > 0) {
//     message += "\n\n**What I focused on:**";
//     letter.intention.forEach(item => {
//       message += `\n• ${item}`;
//     });
//   }
  
//   if (letter.optionalTweaks.length > 0) {
//     message += "\n\n**Optional ideas to explore:**";
//     letter.optionalTweaks.forEach(item => {
//       message += `\n• ${item}`;
//     });
//   }
  
//   message += "\n\n*" + letter.invitation + "*";
  
//   return message;
// }

// function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
//   return (
//     <div className="space-y-1">
//       {content.split('\n').map((line, idx) => {
//         // Bold text **like this**
//         if (line.includes('**')) {
//           const parts = line.split('**');
//           return (
//             <div key={idx}>
//               {parts.map((part, i) => 
//                 i % 2 === 1 ? <strong key={i} className="font-bold">{part}</strong> : <span key={i}>{part}</span>
//               )}
//             </div>
//           );
//         }
//         // Bullet points
//         if (line.trim().startsWith('•')) {
//           return (
//             <div key={idx} className="flex gap-2 ml-2">
//               <span>•</span>
//               <span>{line.trim().substring(1).trim()}</span>
//             </div>
//           );
//         }
//         // Italic text *like this*
//         if (line.match(/^\*(.+)\*$/)) {
//           return <div key={idx} className="italic">{line.replace(/^\*|\*$/g, '')}</div>;
//         }
//         // Regular text
//         if (line.trim()) {
//           return <div key={idx}>{line}</div>;
//         }
//         // Empty line for spacing
//         return <div key={idx} className="h-2" />;
//       })}
//     </div>
//   );
// }

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import {
  Check,
  Send,
  Loader2,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Edit3,
  X,
  ChevronDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

/* ======================================================
   TYPES
====================================================== */

type StoryPage = {
  pageNumber: number;
  text: string;
};

type AuthorLetter = {
  opening: string;
  intention: string[];
  optionalTweaks: string[];
  invitation: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

type ViewMode = 'reading' | 'letter' | 'editing';

/* ======================================================
   COMPONENT
====================================================== */

export default function MobileStoryReader({
  title,
  pages,
  id,
}: {
  title: string;
  pages: StoryPage[];
  id: string;
}) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // State
  const [currentPage, setCurrentPage] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('reading');
  const [authorLetter, setAuthorLetter] = useState<AuthorLetter | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);
  const [showCompletion, setShowCompletion] = useState(false);

  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, -100], [0, 1]);

  // Load author letter
  useEffect(() => {
    fetch(`/api/stories/${id}/author-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, pages }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (res && typeof res.opening === 'string') {
          setAuthorLetter(res);
          const letterMessage = formatAuthorLetterAsMessage(res);
          const initialMessage: Message = {
            role: 'assistant',
            content: letterMessage,
            timestamp: new Date(),
          };
          setMessages([initialMessage]);
          setConversationHistory([{ role: 'assistant', content: letterMessage }]);
        }
      })
      .catch(console.error);
  }, [title, pages, id]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show completion after last page
  useEffect(() => {
    if (currentPage === pages.length - 1) {
      const timer = setTimeout(() => setShowCompletion(true), 800);
      return () => clearTimeout(timer);
    }
  }, [currentPage, pages.length]);

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`/api/stories/${id}/rewrite-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory,
          currentSpread: {
            index: Math.floor(currentPage / 2),
            pages: [pages[currentPage], pages[currentPage + 1]].filter(Boolean),
          },
          storyContext: {
            title,
            allPages: pages,
          },
        }),
      });

      const data = await response.json();

      if (data.reply) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setConversationHistory(data.conversationHistory || []);
      }
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyEditsToStory = async () => {
    setIsLoading(true);

    try {
      const instruction = conversationHistory
        .filter((msg) => msg.role === 'user')
        .map((msg) => msg.content)
        .join('\n\n');

      const response = await fetch(`/api/stories/${id}/global-rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: instruction || 'Apply the discussed changes to the story.',
        }),
      });

      const data = await response.json();

      if (data.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Edit error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      fetch(`/api/stories/${id}/derive-intent`, { method: 'POST' }).catch(() => {});
    } catch {}
    router.push(`/api/stories/${id}/extract`);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.y < -50 && viewMode === 'reading') {
      setViewMode('letter');
    } else if (info.offset.y > 50 && viewMode !== 'reading') {
      setViewMode('reading');
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-[#FFF9F0] relative">
      {/* HEADER */}
      <header className="absolute top-0 left-0 right-0 z-30 bg-gradient-to-b from-[#FFF9F0] to-transparent px-5 pt-3 pb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>

          <div className="flex-1 text-center mx-4">
            <h1 className="text-lg font-black text-gray-900 truncate">{title}</h1>
            <p className="text-xs font-semibold text-gray-500">
              Page {currentPage + 1} of {pages.length}
            </p>
          </div>

          <button
            onClick={() => setViewMode(viewMode === 'editing' ? 'reading' : 'editing')}
            className={`
              w-10 h-10 rounded-full backdrop-blur-sm shadow-lg flex items-center justify-center active:scale-95 transition
              ${viewMode === 'editing' 
                ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white' 
                : 'bg-white/80 text-gray-700'
              }
            `}
          >
            {viewMode === 'editing' ? <X className="w-5 h-5" /> : <Edit3 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* STORY PAGE */}
      <div className="h-full flex flex-col justify-center px-6 pb-28 pt-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-xl mx-auto"
          >
            <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl p-8 min-h-[400px] flex flex-col">
              <div className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">
                Page {pages[currentPage]?.pageNumber}
              </div>
              <div
                className="flex-1 text-lg leading-[1.8] text-gray-800 font-serif"
                style={{ fontFamily: "'Merriweather', Georgia, serif" }}
              >
                {pages[currentPage]?.text}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* PAGE NAVIGATION */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#FFF9F0] via-[#FFF9F0] to-transparent px-5 pb-6 pt-8">
        <div className="flex items-center justify-between gap-4 max-w-xl mx-auto">
          <button
            disabled={currentPage === 0}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-white shadow-lg flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>

          {/* Progress Bar */}
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500"
              initial={{ width: '0%' }}
              animate={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <button
            disabled={currentPage === pages.length - 1}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30 flex items-center justify-center disabled:opacity-30 active:scale-95 transition"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Swipe Up Hint */}
        {viewMode === 'reading' && !showCompletion && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.5 }}
            className="mt-6 flex flex-col items-center gap-2"
          >
            <ChevronDown className="w-5 h-5 text-gray-400 animate-bounce" />
            <p className="text-xs font-semibold text-gray-500">
              Swipe up for author's notes & editing
            </p>
          </motion.div>
        )}
      </div>

      {/* BOTTOM SHEET - AUTHOR LETTER */}
      <AnimatePresence>
        {viewMode === 'letter' && (
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-0 top-20 bg-white rounded-t-[2rem] shadow-2xl z-40 overflow-hidden"
          >
            {/* Drag Handle */}
            <div className="pt-3 pb-4 flex justify-center">
              <div className="w-12 h-1.5 rounded-full bg-gray-300" />
            </div>

            <div className="px-6 pb-6 overflow-y-auto h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-gray-900">Author's Note</h2>
                  <p className="text-sm text-gray-600">About your story</p>
                </div>
              </div>

              {authorLetter && (
                <div className="space-y-6 pb-24">
                  <div className="prose prose-sm">
                    <p className="text-gray-700 leading-relaxed">{authorLetter.opening}</p>
                  </div>

                  {authorLetter.intention.length > 0 && (
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-3">What I focused on:</h3>
                      <ul className="space-y-2">
                        {authorLetter.intention.map((item, i) => (
                          <li key={i} className="flex gap-3">
                            <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {authorLetter.optionalTweaks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-black text-gray-900 mb-3">
                        Optional ideas to explore:
                      </h3>
                      <ul className="space-y-2">
                        {authorLetter.optionalTweaks.map((item, i) => (
                          <li key={i} className="flex gap-3">
                            <Sparkles className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-purple-50 rounded-2xl p-4 border-2 border-purple-200">
                    <p className="text-sm italic text-purple-900">{authorLetter.invitation}</p>
                  </div>

                  <button
                    onClick={() => setViewMode('editing')}
                    className="w-full py-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black shadow-lg shadow-purple-500/30 active:scale-98 transition"
                  >
                    Start Editing
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM SHEET - EDITING */}
      <AnimatePresence>
        {viewMode === 'editing' && (
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-0 top-20 bg-[#F8F9FF] rounded-t-[2rem] shadow-2xl z-40 overflow-hidden flex flex-col"
          >
            {/* Drag Handle */}
            <div className="pt-3 pb-4 flex justify-center flex-shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-gray-300" />
            </div>

            {/* Chat Header */}
            <div className="px-6 pb-4 flex items-center gap-3 flex-shrink-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-black text-gray-900">Edit Your Story</h2>
                <p className="text-sm text-gray-600">Chat with AI to refine it</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-6 pb-4">
              <div className="space-y-4 pb-4">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`
                        max-w-[85%] rounded-3xl px-5 py-3.5 text-sm shadow-md
                        ${
                          msg.role === 'user'
                            ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                            : 'bg-white text-gray-800'
                        }
                      `}
                    >
                      <FormattedMessage content={msg.content} isUser={msg.role === 'user'} />
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white rounded-3xl px-5 py-3.5 shadow-md">
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4 space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="What would you like to change?"
                  className="flex-1 rounded-full border-2 border-gray-200 px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isLoading}
                  className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white p-3 active:scale-95 transition disabled:opacity-40 shadow-lg shadow-purple-500/30"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {messages.length > 1 && (
                <button
                  onClick={applyEditsToStory}
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/30 active:scale-98 transition disabled:opacity-40"
                >
                  Apply Changes to Story
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMPLETION OVERLAY */}
      <AnimatePresence>
        {showCompletion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 15 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-2xl shadow-emerald-500/50"
                >
                  <Check className="w-10 h-10 text-white" strokeWidth={3} />
                </motion.div>

                <h2 className="text-2xl font-black text-gray-900 mb-3">Story Complete!</h2>
                <p className="text-gray-600 mb-8">
                  You've read every page. Ready to bring your story to life with illustrations?
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleConfirm}
                    className="w-full py-4 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 text-white font-black shadow-lg shadow-purple-500/30 active:scale-98 transition"
                  >
                    Continue to Illustrations
                  </button>

                  <button
                    onClick={() => setShowCompletion(false)}
                    className="w-full py-3 rounded-full bg-gray-100 text-gray-700 font-bold active:scale-98 transition"
                  >
                    Read Again
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ======================================================
   HELPERS
====================================================== */

function formatAuthorLetterAsMessage(letter: AuthorLetter): string {
  let message = letter.opening;

  if (letter.intention.length > 0) {
    message += '\n\n**What I focused on:**';
    letter.intention.forEach((item) => {
      message += `\n• ${item}`;
    });
  }

  if (letter.optionalTweaks.length > 0) {
    message += '\n\n**Optional ideas to explore:**';
    letter.optionalTweaks.forEach((item) => {
      message += `\n• ${item}`;
    });
  }

  message += '\n\n*' + letter.invitation + '*';

  return message;
}

function FormattedMessage({ content, isUser }: { content: string; isUser: boolean }) {
  return (
    <div className="space-y-1">
      {content.split('\n').map((line, idx) => {
        if (line.includes('**')) {
          const parts = line.split('**');
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
        if (line.trim().startsWith('•')) {
          return (
            <div key={idx} className="flex gap-2 ml-2">
              <span>•</span>
              <span>{line.trim().substring(1).trim()}</span>
            </div>
          );
        }
        if (line.match(/^\*(.+)\*$/)) {
          return (
            <div key={idx} className="italic">
              {line.replace(/^\*|\*$/g, '')}
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