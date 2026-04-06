"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X,
  Loader2,
  Sparkles,
  Star,
  Eye,
  EyeOff,
  Users,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type CharacterOption = {
  characterId: string;
  name: string;
  imageUrl: string | null;
  role?: string | null;
};

type CharacterSceneMode = "featured" | "background" | "hidden";

type FocusSceneSelection = {
  featuredCharacterIds: string[];
  backgroundCharacterIds: string[];
  hiddenCharacterIds: string[];
};

export default function FocusSceneModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  spreadLabel,
  characters,
  maxFeatured = 5,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (selection: FocusSceneSelection) => void;
  isSubmitting?: boolean;
  spreadLabel: string;
  characters: CharacterOption[];
  maxFeatured?: number;
}) {
  const initialModes = useMemo(() => {
    const map: Record<string, CharacterSceneMode> = {};
    characters.forEach((c, i) => {
      map[c.characterId] = i < maxFeatured ? "featured" : "background";
    });
    return map;
  }, [characters, maxFeatured]);

  const [modes, setModes] = useState<Record<string, CharacterSceneMode>>({});

  useEffect(() => {
    if (!isOpen) return;
    setModes(initialModes);
  }, [isOpen, initialModes]);

  const featuredCount = useMemo(
    () => Object.values(modes).filter((m) => m === "featured").length,
    [modes]
  );

  const featuredIds = useMemo(
    () =>
      Object.entries(modes)
        .filter(([, mode]) => mode === "featured")
        .map(([id]) => id),
    [modes]
  );

  const backgroundIds = useMemo(
    () =>
      Object.entries(modes)
        .filter(([, mode]) => mode === "background")
        .map(([id]) => id),
    [modes]
  );

  const hiddenIds = useMemo(
    () =>
      Object.entries(modes)
        .filter(([, mode]) => mode === "hidden")
        .map(([id]) => id),
    [modes]
  );

  function setCharacterMode(characterId: string, nextMode: CharacterSceneMode) {
    setModes((prev) => {
      const current = prev[characterId];

      if (current === nextMode) return prev;

      if (nextMode === "featured") {
        const currentFeatured = Object.values(prev).filter(
          (m) => m === "featured"
        ).length;

        if (currentFeatured >= maxFeatured) {
          return prev;
        }
      }

      return { ...prev, [characterId]: nextMode };
    });
  }

  function handleSubmit() {
    onSubmit({
      featuredCharacterIds: featuredIds,
      backgroundCharacterIds: backgroundIds,
      hiddenCharacterIds: hiddenIds,
    });
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white shadow-2xl w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl overflow-hidden border border-gray-200/50 flex flex-col max-h-[92vh]"
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              Focus This Scene
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {spreadLabel} — choose up to {maxFeatured} featured characters for
              the best likeness
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-gray-100 bg-purple-50/50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Featured characters get the strongest identity matching
              </p>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Keep up to {maxFeatured} as <span className="font-semibold">Featured</span>.
                Others can stay as <span className="font-semibold">Background</span> cameos
                or be <span className="font-semibold">Hidden</span> for this spread.
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 font-bold">
              Featured: {featuredCount}/{maxFeatured}
            </span>
            <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 font-bold">
              Background: {backgroundIds.length}
            </span>
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-bold">
              Hidden: {hiddenIds.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 min-h-0">
          {characters.map((character) => {
            const mode = modes[character.characterId] ?? "background";
            const isFeatured = mode === "featured";
            const isBackground = mode === "background";
            const isHidden = mode === "hidden";

            return (
              <div
                key={character.characterId}
                className={`rounded-xl border p-3 transition-all ${
                  isFeatured
                    ? "border-yellow-300 bg-yellow-50/50"
                    : isBackground
                      ? "border-blue-200 bg-blue-50/40"
                      : "border-gray-200 bg-gray-50/60 opacity-80"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 ${
                      isFeatured
                        ? "ring-2 ring-yellow-400"
                        : isBackground
                          ? "ring-2 ring-blue-300"
                          : ""
                    }`}
                  >
                    {character.imageUrl ? (
                      <img
                        src={character.imageUrl}
                        alt={character.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {character.name}
                    </p>
                    {character.role && (
                      <p className="text-[10px] text-gray-500 capitalize mt-0.5">
                        {character.role}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap justify-end">
                    <button
                      onClick={() =>
                        setCharacterMode(character.characterId, "featured")
                      }
                      disabled={
                        !isFeatured && featuredCount >= maxFeatured
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        isFeatured
                          ? "bg-yellow-500 text-white"
                          : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 disabled:opacity-40"
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" />
                      Featured
                    </button>

                    <button
                      onClick={() =>
                        setCharacterMode(character.characterId, "background")
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        isBackground
                          ? "bg-blue-500 text-white"
                          : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Background
                    </button>

                    <button
                      onClick={() =>
                        setCharacterMode(character.characterId, "hidden")
                      }
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        isHidden
                          ? "bg-gray-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      Hide
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || featuredCount === 0 || featuredCount > maxFeatured}
            className="flex-1 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Use Scene Focus
          </button>
        </div>
      </motion.div>
    </div>
  );
}