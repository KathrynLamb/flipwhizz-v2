

// "use client";

// import { useSearchParams, useRouter } from "next/navigation";
// import { useEffect, useMemo, useRef, useState } from "react";
// import { motion, AnimatePresence } from "framer-motion";
// import { 
//   Send, 
//   Sparkles, 
//   ArrowRight, 
//   Check, 
//   Loader2, 
//   Library,
//   Feather
// } from "lucide-react";

// type ChatMsg = { role: "user" | "assistant"; content: string };

// export default function ChatPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const projectId = useMemo(() => searchParams.get("project"), [searchParams]);
  
//   const [messages, setMessages] = useState<ChatMsg[]>([]);
//   const [input, setInput] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [isSyncing, setIsSyncing] = useState(true);
//   const [storyCreating, setStoryCreating] = useState(false);
//   const [storyId, setStoryId] = useState<string | null>(null);
//   const bottomRef = useRef<HTMLDivElement | null>(null);
//   const textareaRef = useRef<HTMLTextAreaElement>(null);

//   // 1. Initial Load: Sync everything from Database
//   useEffect(() => {
//     async function initializeStudio() {
//       if (!projectId) return;

//       try {
//         const chatRes = await fetch(`/api/chat/history?projectId=${projectId}`);
//         const chatData = await chatRes.json();
//         if (chatData.messages) {
//           setMessages(chatData.messages);
//         }

//         const storyRes = await fetch(`/api/stories/by-project?projectId=${projectId}`);
//         const storyData = await storyRes.json();
//         if (storyData.storyId) {
//           router.push(`/stories/${storyData.storyId}`);
//         }
//       } catch (err) {
//         console.error("Studio sync failed:", err);
//       } finally {
//         setIsSyncing(false);
//       }
//     }
//     initializeStudio();
//   }, [projectId, router]);

//   // 2. Auto-scroll & Local Backup
//   useEffect(() => {
//     if (projectId && messages.length > 0) {
//       localStorage.setItem(`chat_backup_${projectId}`, JSON.stringify(messages));
//     }
//     // Delayed scroll for better UX after animation
//     setTimeout(() => {
//       bottomRef.current?.scrollIntoView({ behavior: "smooth" });
//     }, 100);
//   }, [messages, projectId]);

//   // Auto-resize textarea
//   useEffect(() => {
//     if (textareaRef.current) {
//       textareaRef.current.style.height = "auto";
//       textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
//     }
//   }, [input]);

//   // 3. Core Functions
//   async function sendMessage() {
//     if (!input.trim() || loading) return;

//     const text = input.trim();
//     const userMessage: ChatMsg = { role: "user", content: text };
//     const nextHistory = [...messages, userMessage];

//     setMessages(nextHistory);
//     setInput("");
//     setLoading(true);

//     // Reset height
//     if (textareaRef.current) textareaRef.current.style.height = "auto";

//     try {
//       const res = await fetch("/api/chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ message: text, history: nextHistory, projectId }),
//       });

//       const data = await res.json();
//       const assistantMessage: ChatMsg = {
//         role: "assistant",
//         content: data.reply ?? "(The ink paused... please try again)",
//       };

//       setMessages((m) => [...m, assistantMessage]);
//     } catch (err) {
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   }
//   async function createStoryFromChat() {
//     if (!projectId || storyCreating) return;
//     setStoryCreating(true);
  
//     try {
//       const res = await fetch("/api/stories/create-from-chat", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ projectId }),
//       });
  
//       const data = await res.json();
  
//       if (data.storyId) {
//         setStoryId(data.storyId);
//         router.push(`/stories/${data.storyId}`); // ✅ navigate immediately
//       }
//     } catch (err) {
//       console.error("Story creation failed:", err);
//     } finally {
//       setStoryCreating(false);
//     }
//   }
  
//   if (!projectId) return (
//     <div className="flex h-screen items-center justify-center bg-stone-50 text-stone-400 font-serif italic">
//       Project context required...
//     </div>
//   );

//   return (
//     <div className="min-h-screen bg-stone-50 text-stone-800 font-sans selection:bg-orange-100 selection:text-orange-900">
      
//       {/* ================= HEADER ================= */}
//       <nav className="fixed top-0 w-full z-40 bg-stone-50/80 backdrop-blur-md border-b border-stone-100 transition-all duration-300">
//         <div className="max-w-5xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
//           <div className="flex items-center gap-2 group cursor-pointer">
//             <div className="bg-orange-500 text-white p-1.5 rounded-lg rotate-3 group-hover:rotate-0 transition-transform duration-300">
//               <Feather className="w-4 h-4" />
//             </div>
//             <span className="font-serif font-bold text-lg tracking-tight text-stone-900">
//               FlipWhizz
//             </span>
//           </div>

//           <div className="flex items-center gap-4">
//             <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 rounded-full text-xs font-medium text-stone-500 shadow-sm">
//               {isSyncing ? (
//                 <>
//                   <Loader2 className="w-3 h-3 animate-spin" />
//                   <span>Syncing to cloud...</span>
//                 </>
//               ) : (
//                 <>
//                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
//                   <span>Auto-saved</span>
//                 </>
//               )}
//             </div>
//           </div>
//         </div>
//       </nav>

//       {/* ================= MAIN CONTENT ================= */}
//       <main className="max-w-2xl mx-auto pt-32 pb-48 px-4 md:px-0">
        
//         {/* WELCOME STATE */}
//         <AnimatePresence>
//           {messages.length === 0 && !isSyncing && (
//             <motion.div
//               initial={{ opacity: 0, scale: 0.95 }}
//               animate={{ opacity: 1, scale: 1 }}
//               exit={{ opacity: 0, y: -20 }}
//               className="text-center py-12 md:py-24 space-y-6"
//             >
//               <div className="inline-flex items-center justify-center p-4 bg-orange-100/50 rounded-full mb-2 ring-1 ring-orange-100">
//                 <Sparkles className="w-8 h-8 text-orange-500" />
//               </div>
//               <h1 className="text-4xl md:text-5xl font-serif font-medium text-stone-900 leading-[1.15]">
//                 What story shall we <br/>
//                 <span className="italic text-stone-400">write today?</span>
//               </h1>
//               <p className="text-lg text-stone-500 max-w-md mx-auto leading-relaxed">
//                 Tell me about a child, a favorite toy, or a magical place. 
//                 I'll handle the rest.
//               </p>
//             </motion.div>
//           )}
//         </AnimatePresence>

//         {/* MESSAGES */}
//         <div className="space-y-10">
//           {messages.map((msg, i) => (
//             <motion.div
//               key={i}
//               initial={{ opacity: 0, y: 15 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.4, ease: "easeOut" }}
//               className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
//             >
//               {msg.role === "user" ? (
//                 <div className="relative max-w-[85%]">
//                   <div className="bg-stone-900 text-stone-50 px-6 py-4 rounded-3xl rounded-tr-sm shadow-xl shadow-stone-200/50 text-[17px] leading-relaxed">
//                     {msg.content}
//                   </div>
//                 </div>
//               ) : (
//                 <div className="relative max-w-[90%] md:max-w-[85%]">
//                   <div className="flex gap-4">
//                     <div className="hidden md:flex flex-shrink-0 w-8 h-8 bg-white border border-stone-200 rounded-full items-center justify-center mt-1">
//                       <Sparkles className="w-4 h-4 text-orange-400" />
//                     </div>
//                     <div className="space-y-2">
//                        <div className="bg-white border border-stone-100 px-7 py-6 rounded-3xl rounded-tl-sm shadow-sm text-stone-700 text-[17px] leading-relaxed font-serif">
//                         {msg.content}
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               )}
//             </motion.div>
//           ))}

//           {/* LOADING INDICATOR */}
//           {loading && (
//             <motion.div 
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               className="flex items-center gap-3 pl-4 md:pl-14"
//             >
//               <div className="flex gap-1.5">
//                 <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }} className="w-2 h-2 bg-stone-300 rounded-full" />
//                 <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", delay: 0.1 }} className="w-2 h-2 bg-stone-300 rounded-full" />
//                 <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut", delay: 0.2 }} className="w-2 h-2 bg-stone-300 rounded-full" />
//               </div>
//             </motion.div>
//           )}

//           {/* CTA: CREATE BOOK */}
//           {messages.length >= 3 && !storyId && (
//             <motion.div
//               initial={{ opacity: 0, y: 20 }}
//               animate={{ opacity: 1, y: 0 }}
//               className="py-12 flex justify-center"
//             >
//               <div className="bg-white p-1 rounded-[2rem] border border-stone-100 shadow-2xl shadow-orange-900/5">
//                 <div className="bg-gradient-to-b from-orange-50 to-white rounded-[1.8rem] border border-orange-100 px-8 py-8 text-center max-w-sm">
//                   <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-2xl">📖</div>
//                   <h3 className="font-serif text-2xl font-semibold text-stone-900 mb-2">
//                     A story is born!
//                   </h3>
//                   <p className="text-stone-500 mb-6 text-sm leading-relaxed">
//                     We have enough magic to draft your book. Shall we illustrate it?
//                   </p>
                  
//                   <button
//                     onClick={createStoryFromChat}
//                     disabled={storyCreating}
//                     className="w-full py-4 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 active:scale-95 transition-all flex items-center justify-center gap-2 group shadow-lg shadow-stone-900/20"
//                   >
//                     {storyCreating ? (
//                       <Loader2 className="w-5 h-5 animate-spin" />
//                     ) : (
//                       <>
//                         <span>Draft my Book</span>
//                         <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
//                       </>
//                     )}
//                   </button>
//                 </div>
//               </div>
//             </motion.div>
//           )}
          
//           <div ref={bottomRef} className="h-4" />
//         </div>
//       </main>

//       {/* ================= INPUT AREA ================= */}
//       <div className="fixed bottom-0 w-full z-50 pointer-events-none">
//         {/* Gradient fade to hide text behind input */}
//         <div className="absolute bottom-0 w-full h-48 bg-gradient-to-t from-stone-50 via-stone-50/90 to-transparent pointer-events-none" />

//         <div className="max-w-3xl mx-auto px-4 pb-8 md:pb-10 pt-4 pointer-events-auto relative">
//           <motion.div 
//             layout
//             className={`
//               relative bg-white rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] 
//               border border-stone-200/60 overflow-hidden ring-4 ring-transparent transition-all
//               ${input.trim().length > 0 ? "ring-orange-100 border-orange-200" : ""}
//             `}
//           >
//             <div className="flex items-end p-2 gap-2">
//               <textarea
//                 ref={textareaRef}
//                 value={input}
//                 onChange={(e) => setInput(e.target.value)}
//                 onKeyDown={(e) => {
//                   if (e.key === "Enter" && !e.shiftKey) {
//                     e.preventDefault();
//                     sendMessage();
//                   }
//                 }}
//                 placeholder="Type a detail (e.g., 'His dog is named Barnaby')..."
//                 className="w-full max-h-40 bg-transparent border-0 focus:ring-0 text-lg placeholder:text-stone-300 text-stone-800 py-4 pl-6 resize-none min-h-[60px]"
//                 rows={1}
//               />
              
//               <button
//                 onClick={sendMessage}
//                 disabled={!input.trim() || loading}
//                 className={`
//                   mb-1.5 mr-1.5 h-12 w-12 rounded-full flex items-center justify-center transition-all duration-300
//                   ${input.trim() 
//                     ? "bg-stone-900 text-white shadow-md hover:scale-105 active:scale-90" 
//                     : "bg-stone-100 text-stone-300 cursor-not-allowed"}
//                 `}
//               >
//                 {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-0.5" />}
//               </button>
//             </div>
            
//             {/* Progress bar hint */}
//             <div className="h-1 w-full bg-stone-50">
//                <motion.div 
//                  className="h-full bg-gradient-to-r from-orange-400 to-amber-400"
//                  initial={{ width: "0%" }}
//                  animate={{ width: `${Math.min(messages.length * 20, 100)}%` }}
//                />
//             </div>
//           </motion.div>

//           <div className="mt-4 flex justify-between items-center px-4 text-xs font-medium text-stone-400">
//              <span>Press Enter to send</span>
//              {messages.length > 0 && <span>{messages.length} story beats added</span>}
//           </div>
//         </div>
//       </div>

//     </div>
//   );
// }


"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Send, 
  Sparkles, 
  ArrowLeft,
  Loader2, 
  Zap,
  BookOpen
} from "lucide-react";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = useMemo(() => searchParams.get("project"), [searchParams]);
  
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(true);
  const [storyCreating, setStoryCreating] = useState(false);
  const [storyId, setStoryId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial Load
  useEffect(() => {
    async function initializeStudio() {
      if (!projectId) return;

      try {
        const chatRes = await fetch(`/api/chat/history?projectId=${projectId}`);
        const chatData = await chatRes.json();
        if (chatData.messages) {
          setMessages(chatData.messages);
        }

        const storyRes = await fetch(`/api/stories/by-project?projectId=${projectId}`);
        const storyData = await storyRes.json();
        if (storyData.storyId) {
          router.push(`/stories/${storyData.storyId}/hub`);
        }
      } catch (err) {
        console.error("Studio sync failed:", err);
      } finally {
        setIsSyncing(false);
      }
    }
    initializeStudio();
  }, [projectId, router]);

  // Auto-scroll
  useEffect(() => {
    if (projectId && messages.length > 0) {
      localStorage.setItem(`chat_backup_${projectId}`, JSON.stringify(messages));
    }
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }, [messages, projectId]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  async function sendMessage() {
    if (!input.trim() || loading) return;

    const text = input.trim();
    const userMessage: ChatMsg = { role: "user", content: text };
    const nextHistory = [...messages, userMessage];

    setMessages(nextHistory);
    setInput("");
    setLoading(true);

    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: nextHistory, projectId }),
      });

      const data = await res.json();
      const assistantMessage: ChatMsg = {
        role: "assistant",
        content: data.reply ?? "Hmm, let me think about that again...",
      };

      setMessages((m) => [...m, assistantMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function createStoryFromChat() {
    if (!projectId || storyCreating) return;
    setStoryCreating(true);
  
    try {
      const res = await fetch("/api/stories/create-from-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
  
      const data = await res.json();
  
      if (data.storyId) {
        setStoryId(data.storyId);
        router.push(`/stories/${data.storyId}/hub`);
      }
    } catch (err) {
      console.error("Story creation failed:", err);
    } finally {
      setStoryCreating(false);
    }
  }
  
  if (!projectId) return (
    <div className="flex h-screen items-center justify-center bg-white">
      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      
      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Projects</span>
          </button>

          <div className="flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full">
            {isSyncing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-purple-600" />
                <span className="text-sm font-bold text-purple-900">Syncing...</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-sm font-bold text-purple-900">Saved</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="pt-24 pb-32 px-6">
        <div className="max-w-4xl mx-auto">
          
          {/* Welcome State */}
          <AnimatePresence>
            {messages.length === 0 && !isSyncing && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                className="text-center py-24 space-y-8"
              >
                <div className="inline-flex items-center gap-2 mb-4">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                    />
                  ))}
                </div>

                <h1 className="text-7xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent mb-6">
                  Let's Write!
                </h1>
                
                <p className="text-xl text-gray-600 max-w-2xl mx-auto font-medium">
                  Tell me about a character, a magical place, or an adventure. I'll help bring your story to life! ✨
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Messages */}
          <div className="space-y-6">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "user" ? (
                  <div className="max-w-[80%]">
                    <div className="bg-black text-white px-6 py-4 rounded-3xl rounded-tr-md shadow-lg">
                      <p className="text-base font-medium leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%]">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div className="bg-gray-50 border-4 border-black rounded-3xl rounded-tl-md px-6 py-4 shadow-lg">
                        <p className="text-base text-gray-800 font-medium leading-relaxed">{msg.content}</p>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}

            {/* Loading */}
            {loading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex gap-2">
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="w-2 h-2 bg-purple-500 rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }}
                    className="w-2 h-2 bg-pink-500 rounded-full" 
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1] }} 
                    transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }}
                    className="w-2 h-2 bg-blue-500 rounded-full" 
                  />
                </div>
              </motion.div>
            )}

            {/* Create Story CTA */}
            {messages.length >= 3 && !storyId && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-12 flex justify-center"
              >
                <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-3xl p-1 max-w-md">
                  <div className="bg-white rounded-3xl p-8 text-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl">
                      📖
                    </div>
                    
                    <h3 className="text-3xl font-black text-black mb-3">
                      Ready to Create!
                    </h3>
                    
                    <p className="text-gray-600 mb-6 font-medium">
                      We have enough ideas to start building your book. Let's make it real!
                    </p>
                    
                    <button
                      onClick={createStoryFromChat}
                      disabled={storyCreating}
                      className="
                        w-full bg-black text-white
                        text-lg font-black px-8 py-4 rounded-2xl
                        hover:scale-105 transition-transform
                        active:scale-95 shadow-xl
                        flex items-center justify-center gap-2
                      "
                    >
                      {storyCreating ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span>Create My Book</span>
                          <BookOpen className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={bottomRef} />
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white via-white to-transparent pt-8 pb-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className={`
            relative bg-white rounded-3xl border-4 transition-colors
            ${input.trim() ? 'border-purple-500' : 'border-black'}
            shadow-2xl overflow-hidden
          `}>
            <div className="flex items-end gap-2 p-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Tell me about your story..."
                className="
                  w-full max-h-32 bg-transparent border-0 
                  focus:ring-0 focus:outline-none
                  text-lg text-black placeholder:text-gray-400
                  py-4 px-6 resize-none font-medium
                "
                rows={1}
              />
              
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className={`
                  mb-2 mr-2 w-12 h-12 rounded-2xl
                  flex items-center justify-center
                  transition-all duration-300
                  ${input.trim() 
                    ? "bg-black text-white hover:scale-110 active:scale-95 shadow-lg" 
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"}
                `}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
            
            {/* Progress Indicator */}
            {messages.length > 0 && messages.length < 3 && (
              <div className="px-6 pb-3">
                <div className="flex items-center gap-2 text-xs font-bold text-purple-600">
                  <Zap className="w-3 h-3" />
                  <span>{3 - messages.length} more detail{3 - messages.length !== 1 ? 's' : ''} to create your book</span>
                </div>
              </div>
            )}
          </div>

          <div className="mt-3 text-center text-xs font-medium text-gray-400">
            Press Enter to send • Shift + Enter for new line
          </div>
        </div>
      </div>
    </div>
  );
}