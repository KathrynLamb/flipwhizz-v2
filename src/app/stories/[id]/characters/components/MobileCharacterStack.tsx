// src/app/stories/[id]/characters/components/MobileCharacterStack.tsx
"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock,
  Check,
  ArrowLeft,
  MapPin,
  ImageIcon,
  Loader2,
  PawPrint,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { MobileCharacterCard, type Character } from "./MobileCharacterCard";

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

const CARD_GRADIENTS = [
  { from: "#C77DFF", to: "#E07ABA" },
  { from: "#FFB347", to: "#FF8A65" },
  { from: "#A78BFA", to: "#67E8F9" },
  { from: "#F472B6", to: "#C084FC" },
  { from: "#34D399", to: "#60A5FA" },
  { from: "#FBBF24", to: "#F472B6" },
];

/* ------------------------------------------------------------------ */
/* END-OF-STACK CARD                                                    */
/* ------------------------------------------------------------------ */

function EndOfStackCard({
  storyId,
  characters,
  onGoBack,
}: {
  storyId: string;
  characters: Character[];
  onGoBack: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const allLocked = characters.every((c) => c.locked);
  const allHaveImage = characters.every(
    (c) => c.portraitImageUrl || c.referenceImageUrl
  );
  const lockedCount = characters.filter((c) => c.locked).length;
  const imageCount = characters.filter(
    (c) => c.portraitImageUrl || c.referenceImageUrl
  ).length;
  const canProceed = allLocked && allHaveImage;

  async function handleContinue() {
    setConfirming(true);
    try {
      await fetch(`/api/stories/${storyId}/confirm-characters`, { method: "POST" });
      await fetch(`/api/stories/${storyId}/complete-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "characters" }),
      });
      router.push(`/stories/${storyId}/locations`);
    } catch {
      setConfirming(false);
    }
  }

  return (
    <div
      className="w-full h-full rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center px-8 py-10 text-center"
      style={{ background: "white", fontFamily: FONT }}
    >
      {/* Icon */}
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{
          background: canProceed
            ? "linear-gradient(135deg, #43B89C, #2FA482)"
            : "linear-gradient(135deg, #C77DFF, #E07ABA)",
          boxShadow: canProceed
            ? "0 8px 28px rgba(67,184,156,0.3)"
            : "0 8px 28px rgba(199,125,255,0.3)",
        }}
      >
        {canProceed ? <MapPin className="w-9 h-9 text-white" /> : <ArrowLeft className="w-9 h-9 text-white" />}
      </div>

      <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#2D2235" }}>
        {canProceed ? "All Set! 🎉" : "Almost There!"}
      </h2>
      <p className="text-sm mb-4 leading-relaxed max-w-xs" style={{ color: "#7B6E90" }}>
        {canProceed
          ? "Every character is locked and ready for illustration."
          : "Some characters still need attention before continuing."}
      </p>

      {/* Status pills */}
      <div className="flex flex-col gap-2 mb-6 w-full max-w-xs">
        <StatusPill
          icon={<Lock className="w-4 h-4" />}
          label={`${lockedCount}/${characters.length} locked`}
          done={allLocked}
        />
        <StatusPill
          icon={<ImageIcon className="w-4 h-4" />}
          label={`${imageCount}/${characters.length} have images`}
          done={allHaveImage}
        />
      </div>

      {canProceed ? (
        <>
          <button
            onClick={handleContinue}
            disabled={confirming}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 mb-3"
            style={{
              background: "linear-gradient(135deg, #43B89C, #2FA482)",
              boxShadow: "0 6px 24px rgba(67,184,156,0.25)",
              border: "none",
            }}
          >
            {confirming ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
            {confirming ? "Confirming…" : "Continue to Locations"}
          </button>
          <button onClick={onGoBack} className="text-sm font-semibold py-2 active:scale-95" style={{ color: "#A897BD" }}>
            ← Go back through stack
          </button>
        </>
      ) : (
        <button
          onClick={onGoBack}
          className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-3"
          style={{
            background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
            boxShadow: "0 6px 24px rgba(176,92,230,0.25)",
            border: "none",
          }}
        >
          <ArrowLeft className="w-5 h-5" /> Go Back Through Stack
        </button>
      )}
    </div>
  );
}

function StatusPill({ icon, label, done }: { icon: React.ReactNode; label: string; done: boolean }) {
  return (
    <div
      className="flex items-center gap-2.5 px-4 py-3 rounded-2xl"
      style={{
        background: done ? "rgba(67,184,156,0.06)" : "rgba(255,179,71,0.08)",
        border: done ? "1.5px solid rgba(67,184,156,0.15)" : "1.5px solid rgba(255,179,71,0.2)",
      }}
    >
      <span style={{ color: done ? "#2FA482" : "#FFB347" }}>{icon}</span>
      <span className="text-sm font-semibold" style={{ color: done ? "#2FA482" : "#C08030" }}>{label}</span>
      {done && <Check className="w-4 h-4 ml-auto" style={{ color: "#2FA482" }} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PREVIEW CARD (behind top card in stack)                              */
/* ------------------------------------------------------------------ */

function CardPreview({ character, index }: { character: Character; index: number }) {
  const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const img = character.portraitImageUrl || character.fullBodyImageUrl || character.referenceImageUrl;
  const isAnimal = character.species && character.species !== "human";

  return (
    <div
      className="w-full h-full rounded-3xl overflow-hidden shadow-xl"
      style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
    >
      {img ? (
        <img src={img} alt={character.name} className="w-full h-full object-cover" draggable={false} />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {isAnimal ? (
            <PawPrint className="w-20 h-20 text-white/15" />
          ) : (
            <span className="text-9xl font-black text-white/15 select-none">{character.name.charAt(0)}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* STACK CONTAINER                                                      */
/* ------------------------------------------------------------------ */

export default function MobileCharacterStack({
  storyId,
  characters,
  onUpdate,
}: {
  storyId: string;
  characters: Character[];
  onUpdate?: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localChars, setLocalChars] = useState(characters);

  useEffect(() => { setLocalChars(characters); }, [characters]);

  const isAtEnd = currentIndex >= localChars.length;
  const safeIndex = Math.min(currentIndex, Math.max(0, localChars.length - 1));
  const visibleCards = isAtEnd ? [] : localChars.slice(safeIndex, safeIndex + 3);

  if (localChars.length === 0) return null;

  return (
    <div className="relative w-full mx-auto max-w-md" style={{ height: "calc(100vh - 200px)", minHeight: "480px" }}>
      <AnimatePresence initial={false}>
        {isAtEnd && (
          <motion.div
            key="end-card"
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <EndOfStackCard
              storyId={storyId}
              characters={localChars}
              onGoBack={() => setCurrentIndex(0)}
            />
          </motion.div>
        )}

        {visibleCards.map((char, idx) => {
          const isTop = idx === 0;
          return (
            <motion.div
              key={char.id}
              className="absolute inset-0"
              style={{ zIndex: 10 - idx, pointerEvents: isTop ? "auto" : "none" }}
              initial={{ scale: 1 - idx * 0.03, y: -idx * 8, opacity: 0 }}
              animate={{ scale: 1 - idx * 0.03, y: -idx * 8, opacity: isTop ? 1 : 0.7 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
            >
              {isTop ? (
                <MobileCharacterCard
                  storyId={storyId}
                  character={char}
                  index={safeIndex + idx}
                  onUpdate={() => {
                    onUpdate?.();
                    // Refresh local chars
                    fetch(`/api/stories/${storyId}/world`)
                      .then(r => r.json())
                      .then(data => {
                        if (data.characters) {
                          setLocalChars(data.characters);
                        }
                      })
                      .catch(() => {});
                  }}
                  onSwiped={(id) => {
                    setLocalChars(prev => prev.map(c => c.id === id ? { ...c, locked: true } : c));
                    setCurrentIndex(prev => prev + 1);
                  }}
                />
              ) : (
                <CardPreview character={char} index={safeIndex + idx} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}