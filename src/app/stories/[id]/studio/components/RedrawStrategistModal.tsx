"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Loader2,
  Sparkles,
  MessageCircle,
  Wand2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  User,
  MapPin,
  Shirt,
  Palette,
  ChevronRight,
  RefreshCcw,
  Brush,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ---------------------------------- Types --------------------------------- */

export type StrategistCharacter = {
  characterId: string;
  name: string;
  imageUrl: string | null;
  role?: string | null;
  outfitKey?: string | null;
};

export type StrategistLocation = {
  id: string;
  name: string;
  imageUrl: string | null;
};

export type StrategistMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt?: string;
};

export type RedrawPlan = {
  diagnosis: string[];
  strategy:
    | "standard_redraw"
    | "identity_repair"
    | "cast_simplification"
    | "split_into_two_pages";
  executionMode:
    | "single_spread_identity_repair"
    | "single_spread_with_reduced_cast"
    | "split_into_two_single_pages";
  keepUnifiedSpread: boolean;
  splitIntoTwoPages: boolean;

  featuredCharacterIds: string[];
  backgroundCharacterIds: string[];
  hiddenCharacterIds: string[];
  outfitOverrides?: Record<string, string>;

  recommendedPrompt: string;
  notesToUser?: string;

  leftPagePrompt?: string;
  rightPagePrompt?: string;

  leftPageFeaturedCharacterIds?: string[];
  rightPageFeaturedCharacterIds?: string[];

  leftPageBackgroundCharacterIds?: string[];
  rightPageBackgroundCharacterIds?: string[];

  leftPageHiddenCharacterIds?: string[];
  rightPageHiddenCharacterIds?: string[];
};

export type RedrawStrategistContext = {
  storyTitle: string;
  spreadLabel: string;
  sceneSummary?: string | null;
  illustrationBrief?: string | null; // ✅ locked art director prompt from buildSpreadPrompts
  mood?: string | null;              // ✅ intended mood from story_spread_scene
  leftPageText?: string | null;
  rightPageText?: string | null;
  currentSpreadImageUrl?: string | null;
  styleGuideSummary?: string | null;
  styleGuideLabel?: string | null;
  characters: StrategistCharacter[];
  locations?: StrategistLocation[];
};

type SendPayload = {
  userMessage: string;
  messages: StrategistMessage[];
};

/* --------------------------------- Helpers -------------------------------- */

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function findCharacterName(
  characters: StrategistCharacter[],
  characterId: string
) {
  return characters.find((c) => c.characterId === characterId)?.name ?? characterId;
}

function strategyLabel(strategy: RedrawPlan["strategy"]) {
  switch (strategy) {
    case "standard_redraw":
      return "Standard redraw";
    case "identity_repair":
      return "Identity repair";
    case "cast_simplification":
      return "Cast simplification";
    case "split_into_two_pages":
      return "Split into two pages";
    default:
      return "Redraw";
  }
}

function sanitiseAssistantMessage(content: string): string {
  return content
    .replace(/<redraw_plan_json>[\s\S]*?<\/redraw_plan_json>/g, "")
    .trim();
}

/* --------------------------- Plan Preview Panel ---------------------------- */

function PlanPreview({
  plan,
  characters,
  onUsePlan,
  isUsingPlan,
}: {
  plan: RedrawPlan;
  characters: StrategistCharacter[];
  onUsePlan: () => void;
  isUsingPlan?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-purple-200 bg-purple-50/50 overflow-hidden">
      <div className="p-4 space-y-4">
        {plan.notesToUser && (
          <p className="text-sm text-gray-700 leading-relaxed">
            {plan.notesToUser}
          </p>
        )}

        <button
          onClick={onUsePlan}
          disabled={isUsingPlan}
          className="w-full bg-purple-600 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
        >
          {isUsingPlan ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {isUsingPlan ? "Redrawing…" : "Redraw this spread"}
        </button>
      </div>
    </div>
  );
}

/* ---------------------------- Context Summary ------------------------------ */

function ContextSummary({
  context,
}: {
  context: RedrawStrategistContext;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/70 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-purple-600" />
        <h4 className="text-sm font-bold text-gray-900">Context loaded</h4>
      </div>

      <div className="p-4 space-y-4">
        {context.currentSpreadImageUrl && (
          <div className="rounded-xl overflow-hidden bg-white border border-gray-200">
            <div className="aspect-[2/1] bg-gray-100">
              <img
                src={context.currentSpreadImageUrl}
                alt={context.spreadLabel}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        )}

        {context.sceneSummary && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">
                Scene summary
              </p>
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {context.sceneSummary}
            </p>
          </div>
        )}

        {/* ✅ Art director brief from buildSpreadPrompts */}
        {context.illustrationBrief && (
          <div className="rounded-xl bg-white border border-purple-100 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Brush className="w-3.5 h-3.5 text-purple-600" />
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">
                Art director brief
              </p>
              {context.mood && (
                <span className="ml-auto text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full capitalize">
                  {context.mood}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">
              {context.illustrationBrief}
            </p>
          </div>
        )}

        {(context.leftPageText || context.rightPageText) && (
          <div className="grid grid-cols-1 gap-3">
            {context.leftPageText && (
              <div className="rounded-xl bg-white border border-gray-200 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5">
                  Left page text
                </p>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {context.leftPageText}
                </p>
              </div>
            )}

            {context.rightPageText && (
              <div className="rounded-xl bg-white border border-gray-200 p-3">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold mb-1.5">
                  Right page text
                </p>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {context.rightPageText}
                </p>
              </div>
            )}
          </div>
        )}

        {context.styleGuideSummary && (
          <div className="rounded-xl bg-white border border-gray-200 p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">
                Style guide
              </p>
            </div>
            {context.styleGuideLabel && (
              <p className="text-xs font-bold text-gray-800 mb-1">
                {context.styleGuideLabel}
              </p>
            )}
            <p className="text-xs text-gray-700 leading-relaxed">
              {context.styleGuideSummary}
            </p>
          </div>
        )}

        {context.characters.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-3.5 h-3.5 text-purple-600" />
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">
                Characters in context
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {context.characters.map((character) => (
                <div
                  key={character.characterId}
                  className="rounded-xl bg-white border border-gray-200 p-2.5 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {character.imageUrl ? (
                      <img
                        src={character.imageUrl}
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {character.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {character.role && (
                        <span className="text-[10px] text-gray-500 capitalize">
                          {character.role}
                        </span>
                      )}
                      {character.outfitKey && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">
                          <Shirt className="w-3 h-3" />
                          {character.outfitKey.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!!context.locations?.length && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3.5 h-3.5 text-purple-600" />
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-bold">
                Locations
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {context.locations.map((location) => (
                <div
                  key={location.id}
                  className="rounded-xl bg-white border border-gray-200 p-2.5 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    {location.imageUrl ? (
                      <img
                        src={location.imageUrl}
                        alt={location.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <MapPin className="w-4 h-4" />
                      </div>
                    )}
                  </div>

                  <p className="text-xs font-bold text-gray-900 truncate">
                    {location.name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- Main Modal ------------------------------- */

export default function RedrawStrategistModal({
  isOpen,
  onClose,
  context,
  messages,
  onSendMessage,
  isSending = false,
  plan = null,
  onUsePlan,
  isUsingPlan = false,
  onResetConversation,
  title = "Talk through this redraw!",
  isLoadingContext,
}: {
  isOpen: boolean;
  onClose: () => void;
  messages: StrategistMessage[];
  onSendMessage: (payload: SendPayload) => Promise<void> | void;
  isSending?: boolean;
  plan?: RedrawPlan | null;
  onUsePlan?: (plan: RedrawPlan) => void;
  isUsingPlan?: boolean;
  onResetConversation?: () => void;
  context: RedrawStrategistContext | null;
  isLoadingContext?: boolean;
  title?: string;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDraft("");
  }, [isOpen]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending, plan]);

  const hasMessages = messages.length > 0;

  const STARTER_MESSAGES = [
    (label: string) => `OK, I've got ${label} pulled up. What needs fixing?`,
    (label: string) => `I'm looking at ${label} now. What's bugging you about it?`,
    (label: string) => `Right, ${label} — what's not sitting right?`,
    (label: string) => `Got ${label} in front of me. What do you want to change?`,
    (label: string) => `${label} is loaded up. Talk me through what's off.`,
    (label: string) => `I can see ${label}. What jumped out at you?`,
    (label: string) => `Looking at ${label} — what caught your eye?`,
    (label: string) => `${label}, got it. What's bothering you?`,
  ];

  const starterText = useMemo(() => {
    if (!context?.spreadLabel) {
      return "Just pulling up this spread…";
    }
    const idx = Math.floor(Math.random() * STARTER_MESSAGES.length);
    return STARTER_MESSAGES[idx](context.spreadLabel);
  }, [context?.spreadLabel]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || isSending) return;

    const nextMessages: StrategistMessage[] = [
      ...messages,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
      },
    ];

    setDraft("");
    await onSendMessage({
      userMessage: trimmed,
      messages: nextMessages,
    });
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white shadow-2xl w-full md:max-w-6xl md:rounded-2xl rounded-t-2xl overflow-hidden border border-gray-200/50 flex flex-col max-h-[94vh]"
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-purple-600" />
              {title}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {context?.spreadLabel} — diagnose the issue, shape the fix, then build a better redraw brief
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onResetConversation && (
              <button
                onClick={onResetConversation}
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {(!context || isLoadingContext) ? (
          <div className="flex-1 min-h-0 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  Loading redraw strategist…
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Pulling in this spread, character references, and story context.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border-r border-gray-100 overflow-y-auto p-4 min-h-0 bg-white">
              <ContextSummary context={context} />
            </div>

            <div className="flex flex-col min-h-0 bg-white">
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0"
              >
                {!hasMessages && (
                  <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          Redraw strategist ready
                        </p>
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                          {starterText}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {messages.map((message) => {
                  const isAssistant = message.role === "assistant";

                  return (
                    <div
                      key={message.id}
                      className={classNames(
                        "flex",
                        isAssistant ? "justify-start" : "justify-end"
                      )}
                    >
                      <div
                        className={classNames(
                          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                          isAssistant
                            ? "bg-gray-100 text-gray-800 border border-gray-200"
                            : "bg-purple-600 text-white"
                        )}
                      >
                        {isAssistant ? sanitiseAssistantMessage(message.content) : message.content}
                      </div>
                    </div>
                  );
                })}

                {isSending && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-gray-100 text-gray-800 border border-gray-200 inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                      Thinking through the redraw…
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {plan && onUsePlan && context && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                    >
                      <PlanPreview
                        plan={plan}
                        characters={context.characters}
                        onUsePlan={() => onUsePlan(plan)}
                        isUsingPlan={isUsingPlan}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="border-t border-gray-100 p-4 flex-shrink-0 bg-white">
                <div className="rounded-2xl border border-gray-200 focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition-all bg-white">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={isSending || !context || isLoadingContext}
                    rows={4}
                    className="w-full px-4 py-3 rounded-t-2xl resize-none text-sm focus:outline-none"
                    placeholder="e.g. Oscar doesn't look like himself, his face changes between spreads — can we fix the identity and keep the bathroom setting?"
                  />

                  <div className="px-3 pb-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Ask for identity fixes, cast simplification, clearer composition, or whether this should become two linked single pages.
                    </p>

                    <button
                      onClick={handleSend}
                      disabled={!draft.trim() || isSending || !context || isLoadingContext}
                      className="flex-shrink-0 inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
                    >
                      {isSending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}