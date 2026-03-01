'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Send, Loader2, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MobileStoryLayout from '@/app/stories/components/MobileStoryLayout';
import StoryFooter from '@/app/stories/[id]/pages/components/StoryFooter';
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";
import type { StepKey } from "@/lib/storySteps";

/* ======================================================
   TYPES
====================================================== */

type StoryPage = {
  pageNumber: number;
  text: string;
};

export type AuthorLetterApiResponse = {
  opening: string;
  intention: string[];
  optionalTweaks: string[];
  invitation: string;
};

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

/* ======================================================
   GOOGLE FONTS — loaded once
====================================================== */

function FontLoader() {
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      rel="stylesheet"
    />
  );
}

/* ======================================================
   MAIN COMPONENT
====================================================== */

export default function StoryReaderClient({
  title,
  pages,
  id,
  currentStep = "write",
  completedSteps = [],
}: {
  title: string;
  pages: StoryPage[];
  id: string;
  currentStep?: StepKey;
  completedSteps?: StepKey[];
}) {
  const router = useRouter();
  const spreads = chunkIntoSpreads(pages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [spreadIndex, setSpreadIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState(0); // -1 or 1 for animation
  const [authorLetter, setAuthorLetter] =
    useState<AuthorLetterApiResponse | null>(null);

  // Sidebar mode
  const [sidebarMode, setSidebarMode] = useState<'note' | 'chat'>('note');
  const [showTweaks, setShowTweaks] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);

  /* ======================================================
     DATA FETCHING
  ====================================================== */

  useEffect(() => {
    fetch(`/api/stories/${id}/author-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, pages, storyId: id }),
    })
      .then((res) => res.json())
      .then((res) => {
        if (
          res &&
          typeof res.opening === 'string' &&
          Array.isArray(res.intention) &&
          Array.isArray(res.optionalTweaks) &&
          typeof res.invitation === 'string'
        ) {
          setAuthorLetter(res);
        }
      })
      .catch(console.error);
  }, [id, title, pages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ======================================================
     PAGE NAVIGATION
  ====================================================== */

  const goToSpread = (dir: number) => {
    const next = spreadIndex + dir;
    if (next < 0 || next >= spreads.length) return;
    setPageDirection(dir);
    setSpreadIndex(next);
  };

  /* ======================================================
     CHAT ACTIONS
  ====================================================== */

  const startEditing = () => {
    setSidebarMode('chat');
    if (messages.length === 0) {
      const initialMsg: Message = {
        role: 'assistant',
        content:
          "I'm ready to help you refine the story! What changes would you like to explore? You can ask about specific pages, suggest new ideas, or pick from the optional tweaks I mentioned.",
      };
      setMessages([initialMsg]);
      setConversationHistory([initialMsg]);
    }
    setTimeout(() => inputRef.current?.focus(), 350);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    setInput('');
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: 'user', content: userContent }]);

    try {
      const res = await fetch(`/api/stories/${id}/rewrite-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userContent,
          conversationHistory,
          currentSpread: {
            index: spreadIndex,
            pages: spreads[spreadIndex],
          },
          storyContext: {
            title,
            allPages: pages,
          },
        }),
      });

      const data = await res.json();

      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.reply },
        ]);
        setConversationHistory(data.conversationHistory || []);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry — something went wrong.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyEditsToStory = async () => {
    setIsLoading(true);

    try {
      const instruction = conversationHistory
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n');

      const res = await fetch(`/api/stories/${id}/global-rewrite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction:
            instruction || 'Apply the discussed changes to the story.',
        }),
      });

      const data = await res.json();

      if (data.ok) {
        window.location.reload();
      } else {
        alert('Failed to apply edits.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmStory = async () => {
    try {
      const res = await fetch(`/api/stories/${id}/lock`, { method: 'POST' });
      const data = await res.json();
      
      if (data.alreadyConfirmed) {
        // Already extracted — go straight to characters (or wherever they left off)
        router.push(`/stories/${id}/characters`);
        return;
      }
      
      // First time — trigger extraction
      fetch(`/api/stories/${id}/ensure-world`, { method: 'POST' }).catch(() => {});
      router.push(`/stories/${id}/extract`);
    } catch {
      alert('Failed to lock story. Please try again.');
    }
  };

  /* ======================================================
     ANIMATION VARIANTS
  ====================================================== */

  const spreadVariants = {
    enter: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? 60 : -60,
      rotateY: dir > 0 ? -2 : 2,
    }),
    center: {
      opacity: 1,
      x: 0,
      rotateY: 0,
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: dir > 0 ? -60 : 60,
      rotateY: dir > 0 ? 2 : -2,
    }),
  };

  const currentSpread = spreads[spreadIndex];

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <>
      <FontLoader />

      {/* Mobile layout */}
      <div className="block md:hidden">
        <MobileStoryLayout
          story={{ id, title }}
          pages={pages}
          authorNote={
            authorLetter
              ? {
                  summary: authorLetter.opening,
                  focusedOn: authorLetter.intention,
                  optionalIdeas: authorLetter.optionalTweaks,
                }
              : undefined
          }
          onConfirm={handleConfirmStory}
        />
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block min-h-screen relative" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
        {/* ── Background ── */}
        <div className="fixed inset-0 -z-10" style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232, 190, 255, 0.35) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255, 182, 210, 0.3) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200, 210, 255, 0.2) 0%, transparent 50%),
            #F9F5FF
          `,
        }}>
          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-50" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* ── Header ── */}
        <UnifiedStoryHeader
          storyId={id}
          title={title}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />

        {/* ── Main Content ── */}
        <div className="max-w-[1320px] mx-auto px-6 lg:px-8 py-9 pb-28">
          <div className="grid lg:grid-cols-[1fr_390px] gap-8 items-start">
            {/* BOOK AREA */}
            <div className="flex flex-col gap-5">
              {/* Book spread */}
              <div style={{ perspective: '1200px' }}>
                <AnimatePresence mode="wait" custom={pageDirection}>
                  <motion.div
                    key={spreadIndex}
                    custom={pageDirection}
                    variants={spreadVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="grid grid-cols-2 min-h-[420px] overflow-hidden relative"
                    style={{
                      background: '#FFFBF5',
                      borderRadius: '6px 22px 22px 6px',
                      boxShadow: `
                        0 1px 2px rgba(100, 60, 140, 0.06),
                        0 8px 32px rgba(100, 60, 140, 0.08),
                        0 30px 60px -10px rgba(100, 60, 140, 0.1)
                      `,
                    }}
                  >
                    {/* Spine effect */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 z-[3]" style={{
                      background: 'linear-gradient(to bottom, transparent, rgba(180,150,210,0.2) 20%, rgba(180,150,210,0.2) 80%, transparent)',
                    }} />
                    <div className="absolute left-1/2 -translate-x-3 top-0 bottom-0 w-6 z-[2]" style={{
                      background: 'linear-gradient(to right, transparent, rgba(100,60,140,0.015) 30%, rgba(100,60,140,0.03) 50%, rgba(100,60,140,0.015) 70%, transparent)',
                    }} />

                    <PageCard page={currentSpread[0]} />
                    <PageCard page={currentSpread[1]} />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Page navigation */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => goToSpread(-1)}
                  disabled={spreadIndex === 0}
                  className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:shadow-md disabled:opacity-25 disabled:cursor-default"
                  style={{
                    borderColor: 'rgba(180,150,210,0.2)',
                    background: 'white',
                    color: '#8B7BA0',
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex gap-1.5 items-center">
                  {spreads.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setPageDirection(i > spreadIndex ? 1 : -1);
                        setSpreadIndex(i);
                      }}
                      className="h-1.5 rounded-full border-0 p-0 transition-all"
                      style={{
                        width: i === spreadIndex ? 26 : 6,
                        background: i === spreadIndex
                          ? 'linear-gradient(135deg, #C77DFF, #E07ABA)'
                          : 'rgba(180,150,210,0.25)',
                        cursor: 'pointer',
                      }}
                    />
                  ))}
                </div>

                <button
                  onClick={() => goToSpread(1)}
                  disabled={spreadIndex === spreads.length - 1}
                  className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all hover:shadow-md disabled:opacity-25 disabled:cursor-default"
                  style={{
                    borderColor: 'rgba(180,150,210,0.2)',
                    background: 'white',
                    color: '#8B7BA0',
                  }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <span className="text-xs font-medium ml-1" style={{ color: '#A897BD' }}>
                  Pages {currentSpread[0]?.pageNumber ?? ''}–{currentSpread[1]?.pageNumber ?? ''}
                </span>
              </div>
            </div>

            {/* SIDEBAR */}
            <div className="sticky top-24">
              <AnimatePresence mode="wait">
                {sidebarMode === 'note' ? (
                  <motion.div
                    key="note"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                  >
                    <AuthorNoteCard
                      letter={authorLetter}
                      showTweaks={showTweaks}
                      onToggleTweaks={() => setShowTweaks((v) => !v)}
                      onContinue={handleConfirmStory}
                      onEdit={startEditing}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChatPanel
                      messages={messages}
                      input={input}
                      setInput={setInput}
                      isLoading={isLoading}
                      onSend={handleSendMessage}
                      onApply={applyEditsToStory}
                      onBackToNote={() => setSidebarMode('note')}
                      messagesEndRef={messagesEndRef}
                      inputRef={inputRef}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t" style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderColor: 'rgba(180,150,210,0.12)',
        }}>
          <div className="max-w-[1320px] mx-auto px-6 lg:px-8 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium" style={{ color: '#A897BD' }}>Step 1 of 3</span>
              <div className="w-44 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(180,150,210,0.15)' }}>
                <div className="h-full rounded-full" style={{
                  width: '33%',
                  background: 'linear-gradient(90deg, #C77DFF, #E07ABA)',
                }} />
              </div>
              <span className="text-xs font-medium" style={{ color: '#A897BD' }}>Review</span>
            </div>

            <button
              onClick={handleConfirmStory}
              className="flex items-center gap-2 px-7 py-3 rounded-[14px] border-0 text-sm font-bold text-white cursor-pointer transition-all hover:-translate-y-px active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                boxShadow: '0 4px 16px rgba(176,92,230,0.2)',
              }}
            >
              <Check className="w-4 h-4" />
              Confirm & Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ======================================================
   PAGE CARD
====================================================== */

function PageCard({ page }: { page?: StoryPage }) {
  return (
    <div className="py-11 px-10 flex flex-col relative">
      {page ? (
        <>
          <div
            className="text-[10px] font-bold uppercase mb-5"
            style={{ color: '#C7B8DA', letterSpacing: '0.18em' }}
          >
            Page {page.pageNumber}
          </div>
          <p
            className="text-lg leading-[1.8] whitespace-pre-line"
            style={{
              fontFamily: "'Lora', Georgia, serif",
              color: '#3A2E48',
              fontWeight: 400,
            }}
          >
            {page.text}
          </p>
        </>
      ) : (
        <div className="h-full flex items-center justify-center italic" style={{ color: '#C7B8DA' }}>
          Blank page
        </div>
      )}
    </div>
  );
}

/* ======================================================
   AUTHOR NOTE CARD
====================================================== */

function AuthorNoteCard({
  letter,
  showTweaks,
  onToggleTweaks,
  onContinue,
  onEdit,
}: {
  letter: AuthorLetterApiResponse | null;
  showTweaks: boolean;
  onToggleTweaks: () => void;
  onContinue: () => void;
  onEdit: () => void;
}) {
  if (!letter) {
    return (
      <div
        className="rounded-[22px] border p-8 flex items-center justify-center"
        style={{
          background: 'white',
          borderColor: 'rgba(180,150,210,0.12)',
          boxShadow: '0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)',
          minHeight: 200,
        }}
      >
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#C77DFF' }} />
      </div>
    );
  }

  return (
    <div
      className="rounded-[22px] border overflow-hidden"
      style={{
        background: 'white',
        borderColor: 'rgba(180,150,210,0.12)',
        boxShadow: '0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)',
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center gap-3 border-b"
        style={{ borderColor: 'rgba(180,150,210,0.1)' }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #E8D5FF, #FFD5E5)' }}
        >
          ✨
        </div>
        <div>
          <h3 className="text-[15px] font-bold" style={{ color: '#2D2235' }}>
            Your Co-Author
          </h3>
          <p className="text-[11px] mt-px" style={{ color: '#A897BD' }}>
            Notes on the first draft
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-5">
        <p className="text-sm leading-[1.7] mb-5" style={{ color: '#5A4D6B' }}>
          {letter.opening}
        </p>

        {/* What I focused on */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#B05CE6' }} />
          <span
            className="text-[10px] font-bold uppercase"
            style={{ color: '#6B5C80', letterSpacing: '0.12em' }}
          >
            What I focused on
          </span>
        </div>
        <ul className="flex flex-col gap-2 mb-4 list-none p-0 m-0">
          {letter.intention.map((item, i) => (
            <li
              key={i}
              className="text-[13px] leading-[1.6] py-2 px-3 rounded-[10px] border-l-[3px] transition-colors hover:bg-[rgba(200,180,220,0.1)]"
              style={{
                color: '#5A4D6B',
                background: 'rgba(200,180,220,0.06)',
                borderLeftColor: '#C77DFF',
              }}
            >
              {item}
            </li>
          ))}
        </ul>

        {/* Optional tweaks toggle */}
        {letter.optionalTweaks.length > 0 && (
          <>
            <button
              onClick={onToggleTweaks}
              className="flex items-center gap-1.5 text-xs font-semibold border-0 bg-transparent cursor-pointer py-1.5 mb-3 transition-colors"
              style={{ color: '#A897BD', fontFamily: 'inherit' }}
            >
              <ChevronRight
                className="w-3.5 h-3.5 transition-transform"
                style={{ transform: showTweaks ? 'rotate(90deg)' : 'none' }}
              />
              Optional ideas to explore
            </button>

            <AnimatePresence>
              {showTweaks && (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-2 mb-4 list-none p-0 m-0 overflow-hidden"
                >
                  {letter.optionalTweaks.map((item, i) => (
                    <li
                      key={i}
                      className="text-[13px] leading-[1.6] py-2 px-3 rounded-[10px] border-l-[3px] transition-colors hover:bg-[rgba(200,180,220,0.1)]"
                      style={{
                        color: '#5A4D6B',
                        background: 'rgba(200,180,220,0.06)',
                        borderLeftColor: '#E07ABA',
                      }}
                    >
                      {item}
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </>
        )}

        {/* Invitation */}
        <p
          className="text-[13px] italic leading-[1.6] pt-3.5 border-t"
          style={{
            fontFamily: "'Lora', serif",
            color: '#A897BD',
            borderColor: 'rgba(180,150,210,0.1)',
          }}
        >
          {letter.invitation}
        </p>
      </div>

      {/* Actions */}
      <div className="px-6 pb-6 flex flex-col gap-2.5">

        <button
          onClick={onEdit}
          className="w-full py-3.5 rounded-[14px] border text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 transition-all hover:border-[#C77DFF] hover:bg-[rgba(199,125,255,0.04)]"
          style={{
            borderColor: 'rgba(180,150,210,0.2)',
            background: 'white',
            color: '#6B5C80',
            fontFamily: 'inherit',
          }}
        >
          <PenLine className="w-4 h-4" />
          I'd like to make changes
        </button>

        <button
          onClick={onContinue}
          className="w-full py-3.5 rounded-[14px] border-0 text-sm font-bold text-white cursor-pointer flex items-center justify-center gap-2 transition-all hover:-translate-y-px active:scale-[0.98] relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
            boxShadow: '0 4px 16px rgba(176,92,230,0.25)',
            fontFamily: 'inherit',
          }}
        >
          <div className="absolute inset-0 rounded-[inherit]" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.15), transparent)',
          }} />
          <Check className="w-4 h-4 relative z-10" />
          <span className="relative z-10">Happy with this — continue</span>
        </button>
      </div>
    </div>
  );
}

/* ======================================================
   CHAT PANEL
====================================================== */

function ChatPanel({
  messages,
  input,
  setInput,
  isLoading,
  onSend,
  onApply,
  onBackToNote,
  messagesEndRef,
  inputRef,
}: {
  messages: Message[];
  input: string;
  setInput: (v: string) => void;
  isLoading: boolean;
  onSend: () => void;
  onApply: () => void;
  onBackToNote: () => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
}) {
  return (
    <div
      className="rounded-[22px] border overflow-hidden flex flex-col"
      style={{
        background: 'white',
        borderColor: 'rgba(180,150,210,0.12)',
        boxShadow: '0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between border-b flex-shrink-0"
        style={{ borderColor: 'rgba(180,150,210,0.1)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[14px]"
            style={{ background: 'linear-gradient(135deg, #E8D5FF, #FFD5E5)' }}
          >
            ✨
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: '#2D2235' }}>
              Refine your story
            </h3>
            <p className="text-[11px]" style={{ color: '#A897BD' }}>
              Chat with your co-author
            </p>
          </div>
        </div>
        <button
          onClick={onBackToNote}
          className="text-[11px] font-semibold border rounded-lg px-2.5 py-1 cursor-pointer transition-all hover:border-[#C77DFF] hover:text-[#7B5EA7]"
          style={{
            background: 'transparent',
            borderColor: 'rgba(180,150,210,0.15)',
            color: '#A897BD',
            fontFamily: 'inherit',
          }}
        >
          ← Note
        </button>
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2.5"
        style={{ height: 320 }}
      >
        {messages.map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            className={`max-w-[88%] px-4 py-3 text-[13.5px] leading-[1.65] ${
              m.role === 'user' ? 'self-end' : 'self-start'
            }`}
            style={{
              background:
                m.role === 'user'
                  ? 'linear-gradient(135deg, #B05CE6, #D45DA0)'
                  : '#F6F0FF',
              color: m.role === 'user' ? 'white' : '#4A3D5E',
              borderRadius:
                m.role === 'user'
                  ? '18px 18px 6px 18px'
                  : '18px 18px 18px 6px',
            }}
          >
            <FormattedMessage content={m.content} isUser={m.role === 'user'} />
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="self-start px-5 py-3.5 rounded-[18px] rounded-bl-[6px] flex gap-[5px]"
            style={{ background: '#F6F0FF' }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="w-[7px] h-[7px] rounded-full"
                style={{ background: '#C7B8DA' }}
                animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 1.3,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="flex-shrink-0 px-4 py-3.5 flex flex-col gap-2.5 border-t"
        style={{ borderColor: 'rgba(180,150,210,0.1)' }}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSend()}
            placeholder="What would you like to change?"
            disabled={isLoading}
            className="flex-1 py-2.5 px-4 rounded-xl border text-[13px] outline-none transition-all focus:ring-2 focus:border-transparent"
            style={{
              borderColor: 'rgba(180,150,210,0.18)',
              background: '#FDFBFF',
              color: '#2D2235',
              fontFamily: 'inherit',
              // @ts-ignore
              '--tw-ring-color': 'rgba(199,125,255,0.15)',
            }}
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-xl border-0 text-white cursor-pointer flex items-center justify-center transition-all hover:scale-105 disabled:opacity-30 disabled:cursor-default flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
              boxShadow: '0 3px 12px rgba(176,92,230,0.2)',
            }}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {messages.filter((m) => m.role === 'user').length > 0 && (
          <button
            onClick={onApply}
            disabled={isLoading}
            className="w-full py-3 rounded-xl border-0 text-[13px] font-bold text-white cursor-pointer flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #43B89C, #2FA482)',
              boxShadow: '0 3px 14px rgba(47,164,130,0.2)',
              fontFamily: 'inherit',
            }}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {isLoading ? 'Applying...' : 'Apply changes to story'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ======================================================
   HELPERS
====================================================== */

function chunkIntoSpreads(pages: StoryPage[]) {
  const spreads: [StoryPage?, StoryPage?][] = [];
  for (let i = 0; i < pages.length; i += 2) {
    spreads.push([pages[i], pages[i + 1]]);
  }
  return spreads;
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
      {content.split('\n').map((line, idx) => {
        // Bold text
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
        // Italic text
        if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
          return (
            <div key={idx} className="italic opacity-80">
              {line.slice(1, -1)}
            </div>
          );
        }
        // Bullet points
        if (line.trim().startsWith('•')) {
          return (
            <div key={idx} className="flex gap-2 ml-1">
              <span>•</span>
              <span>{line.trim().substring(1).trim()}</span>
            </div>
          );
        }
        // Empty lines
        if (!line.trim()) {
          return <div key={idx} className="h-2" />;
        }
        return <div key={idx}>{line}</div>;
      })}
    </div>
  );
}