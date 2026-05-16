"use client";

// MobileLocationStack.tsx — parity with MobileCharacterStack
// No group photo FAB (locations don't need one)

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import { MobileLocationCard, type Location } from "./MobileLocationCard";

/* ------------------------------------------------------------------ */
/* PREVIEW CARD (background stack depth)                              */
/* ------------------------------------------------------------------ */

function LocationPreviewCard({
  location,
  index,
}: {
  location: Location;
  index: number;
}) {
  const GRADIENTS = [
    { from: "#f59e0b", to: "#ef4444" },
    { from: "#ec4899", to: "#8b5cf6" },
    { from: "#8b5cf6", to: "#06b6d4" },
    { from: "#06b6d4", to: "#10b981" },
    { from: "#84cc16", to: "#06b6d4" },
    { from: "#f59e0b", to: "#ec4899" },
  ];
  const grad = GRADIENTS[index % GRADIENTS.length];
  const displayImage = location.portraitImageUrl || location.referenceImageUrl;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-xl"
      style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}>
      {displayImage && (
        <img src={displayImage} alt={location.name} className="w-full h-full object-cover" draggable={false} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* END OF STACK CARD                                                   */
/* ------------------------------------------------------------------ */

function EndOfStackCard({
  storyId,
  locations,
  onGoBack,
  onConfirmAndContinue,
}: {
  storyId: string;
  locations: Location[];
  onGoBack: () => void;
  onConfirmAndContinue: () => void;
}) {
  const lockedCount = locations.filter((l) => l.locked).length;
  const allLocked = lockedCount === locations.length && locations.length > 0;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl bg-white flex flex-col items-center justify-center px-8 py-10 text-center"
      style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>

      <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{
          background: allLocked
            ? "linear-gradient(135deg, #43B89C, #2FA482)"
            : "linear-gradient(135deg, #8b5cf6, #d946ef)",
          boxShadow: allLocked
            ? "0 8px 28px rgba(67,184,156,0.3)"
            : "0 8px 28px rgba(139,92,246,0.3)",
        }}>
        <MapPin className="w-9 h-9 text-white" />
      </div>

      {allLocked ? (
        <>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#2D2235" }}>
            All Locations Locked 🗺️
          </h2>
          <p className="text-sm mb-3 leading-relaxed max-w-xs" style={{ color: "#7B6E90" }}>
            Every location is confirmed. Ready to preview your illustrated story.
          </p>

          <div className="flex gap-2 mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: "rgba(67,184,156,0.1)", color: "#2FA482" }}>
              ✓ {lockedCount}/{locations.length} locked
            </span>
          </div>

          <button onClick={onConfirmAndContinue}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-3"
            style={{ background: "linear-gradient(135deg, #43B89C, #2FA482)", boxShadow: "0 6px 24px rgba(67,184,156,0.25)", border: "none" }}>
            Continue to Preview →
          </button>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#2D2235" }}>
            Almost There
          </h2>
          <p className="text-sm mb-2 leading-relaxed max-w-xs" style={{ color: "#7B6E90" }}>
            {lockedCount}/{locations.length} locations locked. Go back to lock the remaining ones.
          </p>
          <p className="text-xs mb-6" style={{ color: "#A897BD" }}>
            Swipe right on each location card to lock it in.
          </p>

          <button onClick={onGoBack}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-all mb-3"
            style={{ background: "linear-gradient(135deg, #8b5cf6, #d946ef)", boxShadow: "0 6px 24px rgba(139,92,246,0.25)", border: "none" }}>
            ← Go back through stack
          </button>
        </>
      )}

      <button onClick={onGoBack} className="text-sm font-semibold py-2 active:scale-95 transition-transform"
        style={{ color: "#A897BD" }}>
        ← Back through stack
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* STACK                                                              */
/* ------------------------------------------------------------------ */

export function MobileLocationStack({
  storyId,
  locations,
  onUpdate,
  onConfirmAndContinue,
}: {
  storyId: string;
  locations: Location[];
  onUpdate?: () => void;
  onConfirmAndContinue?: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localLocs, setLocalLocs] = useState(locations);

  useEffect(() => {
    setLocalLocs(locations);
  }, [locations]);

  const isAtEnd = currentIndex >= localLocs.length;
  const safeIndex = Math.min(currentIndex, Math.max(0, localLocs.length - 1));
  const visibleCards = isAtEnd ? [] : localLocs.slice(safeIndex, safeIndex + 3);

  if (localLocs.length === 0) return null;

  return (
    <div className="relative w-full mx-auto max-w-md"
      style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>

      <AnimatePresence initial={false}>
        {isAtEnd && (
          <motion.div key="end-card" className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}>
            <EndOfStackCard
              storyId={storyId}
              locations={localLocs}
              onGoBack={() => setCurrentIndex(0)}
              onConfirmAndContinue={onConfirmAndContinue ?? (() => {})}
            />
          </motion.div>
        )}

        {visibleCards.map((loc, idx) => {
          const isTop = idx === 0;

          return (
            <motion.div key={loc.id} className="absolute inset-0"
              style={{ zIndex: 10 - idx, pointerEvents: isTop ? "auto" : "none", isolation: "isolate" }}
              initial={{ scale: 1 - idx * 0.03, y: -idx * 8, opacity: 0 }}
              animate={{ scale: 1 - idx * 0.03, y: -idx * 8, opacity: isTop ? 1 : 0.75 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 26 }}>

              {isTop ? (
                <MobileLocationCard
                  location={loc}
                  storyId={storyId}
                  index={safeIndex + idx}
                  onSwiped={(id) => {
                    setLocalLocs((prev) =>
                      prev.map((l) => l.id === id ? { ...l, locked: true } : l)
                    );
                    setCurrentIndex((prev) => prev + 1);
                  }}
                  onUpdate={() => {
                    onUpdate?.();
                  }}
                />
              ) : (
                <LocationPreviewCard location={loc} index={safeIndex + idx} />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}