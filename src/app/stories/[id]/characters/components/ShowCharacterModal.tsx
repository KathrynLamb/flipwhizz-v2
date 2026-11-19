// src/app/stories/[id]/characters/components/ShowCharacterModal.tsx
//
// "Show this character": a short chat to agree how a character who is in the
// story but not drawn should appear in the pictures. When agreed, it makes
// their character card, then shows them (which re-plans the scenes).
// Server side: ../../../../api/stories/[id]/characters/[characterId]/show-chat
// and .../visibility.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
type Phase = 'chatting' | 'making-card' | 'saving' | 'done';

export default function ShowCharacterModal({ storyId, character, onClose, onDone }: {
  storyId: string;
  character: { id: string; name: string; appearanceNote?: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const opener = character.appearanceNote
    ? `Last time we talked about this: “${character.appearanceNote}”. Shall we use that, or change it?`
    : `How would you like ${character.name} to appear in the pictures? For example on every page, only on one special page, or in a photo on the wall.`;
  const [messages, setMessages] = useState<Msg[]>([{ role: 'assistant', content: opener }]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [phase, setPhase] = useState<Phase>('chatting');
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, phase]);

  async function send() {
    const text = draft.trim();
    if (!text || sending || phase !== 'chatting') return;
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next); setDraft(''); setSending(true); setError(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/characters/${character.id}/show-chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      setMessages(m => [...m, { role: 'assistant', content: data.reply }]);
      if (data.saved?.howToShow) {
        setPlan(data.saved.howToShow);
        await bringIn();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setSending(false);
    }
  }

  // Card first, so finished pictures that now include them can be redrawn with it.
  async function bringIn() {
    setPhase('making-card');
    let cardMade = true;
    try {
      const res = await fetch('/api/characters/use-ai-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, outfitMode: 'story' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) cardMade = false;
    } catch {
      cardMade = false;
    }
    setPhase('saving');
    try {
      const res = await fetch(`/api/stories/${storyId}/characters/${character.id}/visibility`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shown: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not add them to the pictures. Please try again.');
      setPhase('done');
      if (!cardMade) setError(`We couldn't make ${character.name}'s picture just now. Use “Generate” on their card to try again.`);
    } catch (e) {
      setPhase('chatting');
      setError(e instanceof Error ? e.message : 'Could not add them to the pictures. Please try again.');
    }
  }

  const busy = sending || phase === 'making-card' || phase === 'saving';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="show-character-title">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 id="show-character-title" className="text-base font-semibold">Show {character.name} in the pictures</h2>
          <button onClick={phase === 'done' ? onDone : onClose} disabled={busy} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <p className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-6 ${m.role === 'user' ? 'bg-[#7655A3] text-white' : 'bg-slate-100 text-slate-800'}`}>{m.content}</p>
            </div>
          ))}
          {sending && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Thinking…</div>}
          {plan && phase !== 'chatting' && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-[#7655A3]">The plan</p>
              <p className="mt-1">{plan}</p>
              <p className="mt-2 flex items-center gap-2 text-slate-600">
                {phase === 'making-card' && <><Loader2 className="h-4 w-4 animate-spin" /> Making {character.name}’s picture. This takes about a minute; please keep this page open.</>}
                {phase === 'saving' && <><Loader2 className="h-4 w-4 animate-spin" /> Adding {character.name} to your book…</>}
                {phase === 'done' && <><Sparkles className="h-4 w-4 text-[#7655A3]" /> Done. Approve {character.name}’s picture with the others, and the pages with {character.name} are planned again.</>}
              </p>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <div ref={endRef} />
        </div>

        {phase === 'done' ? (
          <div className="border-t border-slate-200 p-4">
            <button onClick={onDone} className="min-h-11 w-full rounded-xl bg-[#7655A3] px-5 py-3 text-sm font-semibold text-white hover:bg-[#62438F]">Back to my characters</button>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); void send(); }} className="flex items-end gap-2 border-t border-slate-200 p-4">
            <textarea value={draft} onChange={e => setDraft(e.target.value)} disabled={busy} rows={2} maxLength={1500}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder={`How should ${character.name} appear?`} aria-label="Your message"
              className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#7655A3] focus:outline-none disabled:bg-slate-50" />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#7655A3] text-white hover:bg-[#62438F] disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>
        )}
      </div>
    </div>
  );
}
