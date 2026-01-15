'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Send, Loader2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import AuthorLetter from '@/app/stories/components/AuthorLetter';
import MobileStoryLayout from '@/app/stories/components/MobileStoryLayout';

/* ======================================================
   TYPES
====================================================== */

type StoryPage = {
  pageNumber: number;
  text: string;
};

export type AuthorLetterApiResponse = {
  letter: string;
  whatICenteredOn: string[];
  thingsYouMightTweak: string[];
  invitation: string;
};

export type AuthorLetterUI = {
  opening: string;
  intention: string[];
  optionalTweaks: string[];
  invitation: string;
};

type EditMode = 'undecided' | 'accepted' | 'editing';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

/* ======================================================
   COMPONENT
====================================================== */

export default function StoryReaderClient({
  title,
  pages,
  id,
}: {
  title: string;
  pages: StoryPage[];
  id: string;
}) {
  const router = useRouter();
  const spreads = chunkIntoSpreads(pages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [index, setIndex] = useState(0);
  const [editMode, setEditMode] = useState<EditMode>('undecided');
  const [mounted, setMounted] = useState(false);
  const [authorLetter, setAuthorLetter] = useState<AuthorLetterApiResponse | null>(null);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetch(`/api/stories/${id}/author-letter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, pages }),
    })
      .then(res => res.json())
      .then((res) => {
        if (
          res &&
          typeof res.letter === "string" &&
          Array.isArray(res.whatICenteredOn) &&
          Array.isArray(res.thingsYouMightTweak) &&
          typeof res.invitation === "string"
        ) {
          setAuthorLetter(res);
        }
      })
      .catch(console.error);
  }, [title, pages, id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const adaptedAuthorLetter = authorLetter && {
    opening: authorLetter.letter,
    intention: authorLetter.whatICenteredOn ?? [],
    optionalTweaks: authorLetter.thingsYouMightTweak ?? [],
    invitation: authorLetter.invitation,
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
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
            index,
            pages: spreads[index],
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

        setMessages(prev => [...prev, assistantMessage]);
        setConversationHistory(data.conversationHistory || []);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyEdit = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/stories/${id}/rewrite-spread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadIndex: index,
          conversationHistory,
          pages: spreads[index],
        }),
      });

      const data = await response.json();

      if (data.success && data.updatedPages) {
        // Update local state with new pages
        window.location.reload(); // Simple refresh, or implement optimistic update
      }
    } catch (error) {
      console.error('Edit error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return isMobile ? (
    <MobileStoryLayout
      page={<PageCard page={pages[index]} />}
      authorLetter={adaptedAuthorLetter}
      onAccept={() => setEditMode('accepted')}
      onEdit={() => setEditMode('editing')}
    />
  ) : (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
      <div className="max-w-7xl mx-auto px-6 py-10">
        
        {/* TITLE */}
        <h1 className="text-center mb-10 text-4xl md:text-5xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
          {title}
        </h1>

        {/* MAIN GRID */}
        <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">

          {/* LEFT: BOOK SPREAD */}
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white rounded-[2.75rem] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] px-8 py-10"
            >
              <div className="grid gap-8 md:grid-cols-2">
                <PageCard page={spreads[index][0]} />
                <PageCard page={spreads[index][1]} />
              </div>

              {/* NAV */}
              <div className="mt-10 flex items-center justify-between border-t border-stone-100 pt-6">
                <button
                  disabled={index === 0}
                  onClick={() => setIndex(i => i - 1)}
                  className="px-5 py-2 rounded-full font-bold text-sm bg-stone-100 text-stone-700 hover:bg-stone-200 disabled:opacity-30"
                >
                  ← Previous
                </button>

                <button
                  disabled={index === spreads.length - 1}
                  onClick={() => setIndex(i => i + 1)}
                  className="px-5 py-2 rounded-full font-bold text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:scale-[1.04] transition disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* RIGHT: COLLABORATIVE PANEL */}
          <div className="sticky top-8 space-y-6">

            {adaptedAuthorLetter && editMode === 'undecided' && (
              <AuthorLetter
                data={adaptedAuthorLetter}
                onRespond={() => setEditMode('editing')}
                onContinue={() => setEditMode('accepted')}
              />
            )}

            {editMode === 'undecided' && (
              <div className="bg-white rounded-3xl shadow-lg p-6 space-y-3">
                <button
                  onClick={() => setEditMode('accepted')}
                  className="w-full py-4 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black shadow-md hover:scale-[1.03] transition"
                >
                  Accept this as-is
                </button>

                <button
                  onClick={() => setEditMode('editing')}
                  className="w-full py-4 rounded-full border border-stone-300 text-stone-700 font-bold hover:bg-stone-50 transition"
                >
                  Make edits with the author
                </button>
              </div>
            )}

            {/* CHAT INTERFACE */}
            {editMode === 'editing' && (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                
                {/* Chat Header */}
                <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4 flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-white" />
                  <h3 className="font-bold text-white">Discuss Edits</h3>
                </div>

                {/* Messages */}
                <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 && (
                    <div className="text-center text-stone-400 py-12">
                      <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">
                        Start a conversation about changes you'd like to make to this spread.
                      </p>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`
                          max-w-[80%] rounded-2xl px-4 py-3 text-sm
                          ${msg.role === 'user'
                            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white'
                            : 'bg-stone-100 text-stone-800'
                          }
                        `}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-stone-100 rounded-2xl px-4 py-3">
                        <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-stone-200 p-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Describe the changes you'd like..."
                      className="flex-1 rounded-full border border-stone-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                      disabled={isLoading}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!input.trim() || isLoading}
                      className="rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-2 hover:scale-105 transition disabled:opacity-40"
                    >
                      <Send className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Apply Button */}
                {messages.length > 0 && (
                  <div className="border-t border-stone-200 p-4">
                    <button
                      onClick={handleApplyEdit}
                      disabled={isLoading}
                      className="w-full py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold hover:scale-[1.02] transition disabled:opacity-40"
                    >
                      Apply Edits to This Spread
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CONTINUE BUTTON */}
            <button
              onClick={() => router.push(`/stories/${id}/extract`)}
              disabled={editMode === 'editing'}
              className="w-full py-4 rounded-full bg-[#4635B1] text-white font-black shadow-xl shadow-[#4635B1]/30 flex items-center justify-center gap-2 hover:scale-[1.03] transition disabled:opacity-40"
            >
              <Check className="w-5 h-5 text-[#AEEA94]" />
              Confirm Story & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   HELPERS
====================================================== */

function PageCard({ page }: { page?: StoryPage }) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-inner min-h-[320px]">
      {page ? (
        <>
          <div className="text-xs font-bold text-stone-400 mb-3">
            Page {page.pageNumber}
          </div>
          <p className="text-lg leading-relaxed text-stone-800 whitespace-pre-line">
            {page.text}
          </p>
        </>
      ) : (
        <div className="h-full flex items-center justify-center text-stone-300 italic">
          Blank page
        </div>
      )}
    </div>
  );
}

function chunkIntoSpreads(pages: StoryPage[]) {
  const spreads: [StoryPage?, StoryPage?][] = [];
  for (let i = 0; i < pages.length; i += 2) {
    spreads.push([pages[i], pages[i + 1]]);
  }
  return spreads;
}