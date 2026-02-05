'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Send, Loader2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import MobileStoryLayout from '@/app/stories/components/MobileStoryLayout';
import StoryHeader from '@/app/stories/[id]/pages/components/StoryHeader';
import StoryFooter from '@/app/stories/[id]/pages/components/StoryFooter';

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
  const [authorLetter, setAuthorLetter] =
    useState<AuthorLetterApiResponse | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<any[]>([]);

  /* ======================================================
     DATA FETCHING
  ====================================================== */

  useEffect(() => {
    fetch(`/api/stories/${id}/author-letter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, pages, storyId: id }),
    })
      .then(res => res.json())
      .then(res => {
        if (
          res &&
          typeof res.opening === 'string' &&
          Array.isArray(res.intention) &&
          Array.isArray(res.optionalTweaks) &&
          typeof res.invitation === 'string'
        ) {
          setAuthorLetter(res);

          const letterMessage = formatAuthorLetterAsMessage(res);

          setMessages([
            { role: 'assistant', content: letterMessage },
          ]);

          setConversationHistory([
            { role: 'assistant', content: letterMessage },
          ]);
        }
      })
      .catch(console.error);
  }, [id, title, pages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ======================================================
     ACTIONS
  ====================================================== */

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input.trim();
    setInput('');
    setIsLoading(true);

    setMessages(prev => [...prev, { role: 'user', content: userContent }]);

    try {
      const res = await fetch(`/api/stories/${id}/rewrite-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userContent,
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

      const data = await res.json();

      if (data.reply) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.reply },
        ]);

        setConversationHistory(data.conversationHistory || []);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry — something went wrong.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyEditsToStory = async () => {
    setIsLoading(true);

    try {
      const instruction = conversationHistory
        .filter(m => m.role === 'user')
        .map(m => m.content)
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
      await fetch(`/api/stories/${id}/lock`, { method: 'POST' });
      fetch(`/api/stories/${id}/ensure-world`, { method: 'POST' }).catch(
        () => {}
      );
      router.push(`/stories/${id}/extract`);
    } catch {
      alert('Failed to lock story. Please try again.');
    }
  };

  /* ======================================================
     RENDER
  ====================================================== */

  return (
    <>
      {/* Mobile layout always mounted, hidden via CSS */}
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

      {/* Desktop layout always mounted */}
      <div className="hidden md:block min-h-screen bg-gradient-to-br from-violet-50 via-fuchsia-50 to-amber-50">
        <StoryHeader title={title} subtitle="Review Your Story" />

        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="grid lg:grid-cols-[1fr_420px] gap-8 items-start">
            {/* BOOK */}
            <AnimatePresence mode="wait">
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35 }}
                className="bg-white rounded-[2.75rem] shadow-xl px-8 py-10"
              >
                <div className="grid gap-8 md:grid-cols-2">
                  <PageCard page={spreads[index][0]} />
                  <PageCard page={spreads[index][1]} />
                </div>
              </motion.div>
            </AnimatePresence>

            {/* CHAT */}
            <ChatPanel
              messages={messages}
              input={input}
              setInput={setInput}
              isLoading={isLoading}
              onSend={handleSendMessage}
              onApply={applyEditsToStory}
              messagesEndRef={messagesEndRef}
            />
          </div>
        </div>

        <StoryFooter
          currentStep={1}
          totalSteps={3}
          primaryAction={{
            label: 'Confirm & Continue',
            onClick: handleConfirmStory,
            icon: <Check className="w-5 h-5" />,
          }}
        />
      </div>
    </>
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

function formatAuthorLetterAsMessage(letter: AuthorLetterApiResponse): string {
  let msg = letter.opening;

  if (letter.intention.length) {
    msg += '\n\n**What I focused on:**';
    letter.intention.forEach(i => (msg += `\n• ${i}`));
  }

  if (letter.optionalTweaks.length) {
    msg += '\n\n**Optional ideas to explore:**';
    letter.optionalTweaks.forEach(i => (msg += `\n• ${i}`));
  }

  return msg + `\n\n*${letter.invitation}*`;
}

/* ======================================================
   CHAT PANEL (extracted for clarity)
====================================================== */

function ChatPanel({
  messages,
  input,
  setInput,
  isLoading,
  onSend,
  onApply,
  messagesEndRef,
}: any) {
  return (
    <div className="sticky top-8 bg-white rounded-3xl shadow-xl overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-4 text-white font-bold">
        Discuss Your Story
      </div>

      <div className="h-[400px] overflow-y-auto p-4 space-y-4">
        {messages.map((m: Message, i: number) => (
          <div
            key={i}
            className={`flex ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-violet-600 text-white'
                  : 'bg-stone-100'
              }`}
            >
              <FormattedMessage content={m.content} isUser={m.role === 'user'} />
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onSend()}
          className="flex-1 rounded-full border px-4 py-2 text-sm"
          placeholder="Describe the changes you'd like..."
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          className="rounded-full bg-violet-600 text-white p-2"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {messages.length > 1 && (
        <div className="border-t p-4">
          <button
            onClick={onApply}
            className="w-full rounded-full bg-emerald-500 text-white py-3 font-bold"
          >
            Apply Edits to Story
          </button>
        </div>
      )}
    </div>
  );
}

function FormattedMessage({
  content,
}: {
  content: string;
  isUser: boolean;
}) {
  return (
    <div className="space-y-1">
      {content.split('\n').map((l, i) => (
        <div key={i}>{l}</div>
      ))}
    </div>
  );
}
