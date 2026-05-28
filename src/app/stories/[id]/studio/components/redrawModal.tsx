"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  X,
  Sparkles,
  Wand2,
  Plus,
  ChevronDown,
  ChevronUp,
  MapPin,
  User,
  Shirt,
  Palette,
  Info,
  Eye,
  EyeOff,
  RotateCcw,
  Star,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* ---------------------------------- Types --------------------------------- */

type OutfitOption = {
  outfitKey: string;
  outfitDescription: string;
  isDefault: boolean;
};

type AssignedCharacter = {
  characterId: string;
  name: string;
  portraitImageUrl: string | null;
  fullBodyImageUrl: string | null;
  referenceImageUrl: string | null;
  role: string | null;
  currentOutfitKey: string | null;
  currentOutfitDescription: string | null;
  availableOutfits: OutfitOption[];
};

type AvailableCharacter = {
  characterId: string;
  name: string;
  portraitImageUrl: string | null;
  fullBodyImageUrl: string | null;
  referenceImageUrl: string | null;
  role: string | null;
  availableOutfits: OutfitOption[];
};

type LocationData = {
  id: string;
  name: string;
  portraitImageUrl: string | null;
  referenceImageUrl: string | null;
  description: string | null;
  significance: string | null;
};

type AssignedLocation = LocationData & {
  role?: "primary" | "secondary" | "background" | "referenced" | "memory" | null;
};

type StyleGuideData = {
  summary: string | null;
  artStyle: string | null;
  sampleIllustrationUrl: string | null;
};

type SpreadReferences = {
  spread: {
    id: string;
    spreadIndex: number;
    sceneSummary: string | null;
  };
  pages: {
    id: string;
    pageNumber: number;
    text: string;
    imageUrl: string | null;
  }[];
  assignedCharacters: AssignedCharacter[];
  availableCharacters: AvailableCharacter[];
  assignedLocation?: LocationData | null;
  assignedLocations?: AssignedLocation[];
  availableLocations: LocationData[];
  styleGuide: StyleGuideData | null;
};

/* ─────────── Constants ─────────── */

const MAX_FEATURED_CHARACTERS = 5;

/* ─────────── Helpers ─────────── */

function bestCharacterImage(c: {
  portraitImageUrl?: string | null;
  fullBodyImageUrl?: string | null;
  referenceImageUrl?: string | null;
}) {
  return c.portraitImageUrl || c.fullBodyImageUrl || c.referenceImageUrl || null;
}

function bestLocationImage(l: {
  portraitImageUrl?: string | null;
  referenceImageUrl?: string | null;
}) {
  return l.portraitImageUrl || l.referenceImageUrl || null;
}

/* ─────────── New Outfit Form ─────────── */

function NewOutfitForm({
  characterName,
  onSave,
  onCancel,
  isSaving,
}: {
  characterName: string;
  onSave: (name: string, description: string) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div
        className="mt-1 p-3 rounded-xl space-y-2.5"
        style={{
          background: "rgba(176,92,230,0.04)",
          border: "1.5px solid rgba(176,92,230,0.15)",
        }}
      >
        <p className="text-[11px] font-bold text-purple-700">
          New outfit for {characterName}
        </p>

        <input
          type="text"
          placeholder="Outfit name (e.g. Swimwear, Party Dress)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSaving}
          className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
        />

        <textarea
          placeholder="Describe the outfit in detail for the AI illustrator…&#10;e.g. Light purple one-piece swimsuit with small white polka dots, pink shoulder straps, golden hair clips"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isSaving}
          rows={3}
          className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none leading-relaxed"
        />

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim() && description.trim()) {
                onSave(name.trim(), description.trim());
              }
            }}
            disabled={isSaving || !name.trim() || !description.trim()}
            className="flex-1 text-xs py-1.5 rounded-lg bg-purple-600 text-white font-bold hover:bg-purple-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            {isSaving ? "Saving…" : "Save Outfit"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─────────── Character Row ─────────── */

function CharacterRow({
  characterId,
  name,
  imageUrl,
  role,
  isIncluded,
  onToggle,
  outfitKey,
  outfits,
  onOutfitChange,
  onOutfitCreated,
  storyId,
}: {
  characterId: string;
  name: string;
  imageUrl: string | null;
  role: string | null;
  isIncluded: boolean;
  onToggle: () => void;
  outfitKey: string | null;
  outfits: OutfitOption[];
  onOutfitChange?: (key: string) => void;
  onOutfitCreated?: (outfit: OutfitOption) => void;
  storyId: string;
}) {
  const [showOutfits, setShowOutfits] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSaveOutfit(outfitName: string, description: string) {
    setIsSaving(true);
    try {
      const res = await fetch("/api/character-outfits/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          characterId,
          outfitKey: outfitName,
          outfitDescription: description,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create outfit");
      }

      const data = await res.json();
      const newOutfit: OutfitOption = {
        outfitKey: data.outfit.outfitKey,
        outfitDescription: data.outfit.outfitDescription,
        isDefault: false,
      };

      onOutfitCreated?.(newOutfit);
      onOutfitChange?.(newOutfit.outfitKey);
      setShowNewForm(false);
    } catch (err: any) {
      alert(err.message || "Failed to save outfit");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className={`rounded-xl border transition-all ${
        isIncluded
          ? "border-purple-300 bg-white"
          : "border-gray-200 bg-gray-50/50"
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <div
          className={`w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 ${
            isIncluded ? "ring-2 ring-purple-400" : "opacity-50"
          }`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
              <User className="w-5 h-5" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-bold truncate ${
              isIncluded ? "text-gray-900" : "text-gray-400"
            }`}
          >
            {name}
          </p>
          {role && (
            <p className="text-[10px] text-gray-500 capitalize">{role}</p>
          )}
        </div>

        {isIncluded && onOutfitChange && (
          <button
            onClick={() => {
              setShowOutfits(!showOutfits);
              if (showOutfits) setShowNewForm(false);
            }}
            className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium px-2 py-1 rounded-lg hover:bg-purple-50 transition-colors"
          >
            <Shirt className="w-3.5 h-3.5" />
            <span className="max-w-[80px] truncate capitalize">
              {outfitKey?.replace(/_/g, " ") ?? "Default"}
            </span>
            {showOutfits ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
        )}

        <button
          onClick={onToggle}
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            isIncluded
              ? "bg-purple-600 text-white hover:bg-purple-700"
              : "bg-gray-200 text-gray-500 hover:bg-gray-300"
          }`}
        >
          {isIncluded ? (
            <Eye className="w-4 h-4" />
          ) : (
            <EyeOff className="w-4 h-4" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {showOutfits && isIncluded && onOutfitChange && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-1">
              {outfits.map((o) => (
                <button
                  key={o.outfitKey}
                  onClick={() => {
                    onOutfitChange(o.outfitKey);
                    setShowOutfits(false);
                    setShowNewForm(false);
                  }}
                  className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-colors ${
                    outfitKey === o.outfitKey
                      ? "bg-purple-100 text-purple-800 font-bold"
                      : "bg-gray-50 hover:bg-gray-100 text-gray-700"
                  }`}
                >
                  <span className="font-medium capitalize">
                    {o.outfitKey.replace(/_/g, " ")}
                  </span>
                  {o.isDefault && (
                    <span className="ml-1.5 text-purple-500 text-[10px]">
                      default
                    </span>
                  )}
                  <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                    {o.outfitDescription}
                  </p>
                </button>
              ))}

              {!showNewForm && (
                <button
                  onClick={() => setShowNewForm(true)}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-lg border border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors font-medium flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create new outfit
                </button>
              )}

              <AnimatePresence>
                {showNewForm && (
                  <NewOutfitForm
                    characterName={name}
                    onSave={handleSaveOutfit}
                    onCancel={() => setShowNewForm(false)}
                    isSaving={isSaving}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────── Multi Location Picker ─────────── */

function MultiLocationPicker({
  all,
  includedLocationIds,
  primaryLocationId,
  onToggleLocation,
  onSetPrimary,
}: {
  all: LocationData[];
  includedLocationIds: Set<string>;
  primaryLocationId: string | null;
  onToggleLocation: (locationId: string) => void;
  onSetPrimary: (locationId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const included = all.filter((loc) => includedLocationIds.has(loc.id));
  const available = all.filter((loc) => !includedLocationIds.has(loc.id));

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {included.length > 0 ? (
          included.map((loc) => {
            const img = bestLocationImage(loc);
            const isPrimary = primaryLocationId === loc.id;

            return (
              <div
                key={loc.id}
                className="rounded-xl border border-purple-300 bg-white p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-lg overflow-hidden flex-shrink-0 ${
                      isPrimary ? "ring-2 ring-yellow-400" : "ring-2 ring-purple-400"
                    }`}
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={loc.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">
                        <MapPin className="w-5 h-5" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {loc.name}
                    </p>
                    {loc.description && (
                      <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                        {loc.description}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => onSetPrimary(loc.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-colors ${
                      isPrimary
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-purple-50 text-purple-700 hover:bg-purple-100"
                    }`}
                  >
                    <Star className="w-3.5 h-3.5" />
                    {isPrimary ? "Primary" : "Make primary"}
                  </button>

                  <button
                    onClick={() => onToggleLocation(loc.id)}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors bg-purple-600 text-white hover:bg-purple-700"
                    title="Remove location"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-xs text-gray-500">
            No locations selected yet.
          </div>
        )}
      </div>

      {available.length > 0 && (
        <div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-xs text-purple-600 hover:text-purple-700 font-bold w-full py-1"
          >
            <Plus className="w-3.5 h-3.5" />
            Add locations not currently included ({available.length})
            {isOpen ? (
              <ChevronUp className="w-3.5 h-3.5 ml-auto" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 ml-auto" />
            )}
          </button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-1">
                  {available.map((loc) => {
                    const img = bestLocationImage(loc);

                    return (
                      <button
                        key={loc.id}
                        onClick={() => {
                          onToggleLocation(loc.id);
                          if (!primaryLocationId) onSetPrimary(loc.id);
                        }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50/50 hover:bg-purple-50 hover:border-purple-300 transition-colors text-left"
                      >
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0 opacity-70">
                          {img ? (
                            <img
                              src={img}
                              alt={loc.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <MapPin className="w-5 h-5" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-700 truncate">
                            {loc.name}
                          </p>
                          {loc.description && (
                            <p className="text-[10px] text-gray-500 line-clamp-1 mt-0.5">
                              {loc.description}
                            </p>
                          )}
                        </div>

                        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 text-gray-500 hover:bg-gray-300 transition-colors">
                          <EyeOff className="w-4 h-4" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ─────────── Section Header ─────────── */

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: any;
  label: string;
  count?: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-purple-600" />
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
        {label}
      </h4>
      {count !== undefined && (
        <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full font-bold">
          {count}
        </span>
      )}
    </div>
  );
}

/* ─────────── Main Modal ─────────── */

export default function RedrawModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  storyId,
  spreadId,
  spreadLabel,
  initialIncludedCharacterIds
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    feedback: string;
    includedCharacterIds: string[];
    outfitOverrides: Record<string, string>;
    primaryLocationId: string | null;
    includedLocationIds: string[];
    freshStart?: boolean;

  }) => void;
  isSubmitting: boolean;
  storyId: string;
  spreadId: string;
  spreadLabel: string;
  initialIncludedCharacterIds?: string[]
}) {
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refs, setRefs] = useState<SpreadReferences | null>(null);

  const [includedCharacterIds, setIncludedCharacterIds] = useState<Set<string>>(
    new Set()
  );
  const [outfitOverrides, setOutfitOverrides] = useState<Record<string, string>>(
    {}
  );

  const [includedLocationIds, setIncludedLocationIds] = useState<Set<string>>(
    new Set()
  );
  const [primaryLocationId, setPrimaryLocationId] = useState<string | null>(null);

  const [showAvailable, setShowAvailable] = useState(false);

  useEffect(() => {
    if (!isOpen || !spreadId) return;

    setFeedback("");
    setError(null);
    setIsLoading(true);
    setShowAvailable(false);

    fetch(`/api/stories/${storyId}/spreads/${spreadId}/references`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load references");
        return res.json();
      })
      .then((data: SpreadReferences) => {
        setRefs(data);

        setIncludedCharacterIds(
          initialIncludedCharacterIds && initialIncludedCharacterIds.length > 0
            ? new Set(initialIncludedCharacterIds)
            : new Set(data.assignedCharacters.map((c) => c.characterId))
        );
        
        const outfits: Record<string, string> = {};
        for (const c of data.assignedCharacters) {
          if (c.currentOutfitKey) {
            outfits[c.characterId] = c.currentOutfitKey;
          }
        }
        setOutfitOverrides(outfits);

        const assignedLocations =
          data.assignedLocations && data.assignedLocations.length > 0
            ? data.assignedLocations
            : data.assignedLocation
              ? [{ ...data.assignedLocation, role: "primary" as const }]
              : [];

        setIncludedLocationIds(new Set(assignedLocations.map((loc) => loc.id)));

        const foundPrimary =
          assignedLocations.find((loc) => loc.role === "primary")?.id ??
          assignedLocations[0]?.id ??
          null;

        setPrimaryLocationId(foundPrimary);
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [isOpen, storyId, spreadId]);

  if (!isOpen) return null;

  function toggleCharacter(id: string) {
    setIncludedCharacterIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleLocation(locationId: string) {
    setIncludedLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(locationId)) {
        next.delete(locationId);

        if (primaryLocationId === locationId) {
          const remaining = Array.from(next);
          setPrimaryLocationId(remaining[0] ?? null);
        }
      } else {
        next.add(locationId);
      }
      return next;
    });
  }

  function choosePrimaryLocation(locationId: string) {
    setIncludedLocationIds((prev) => {
      const next = new Set(prev);
      next.add(locationId);
      return next;
    });
    setPrimaryLocationId(locationId);
  }

  function setOutfit(characterId: string, outfitKey: string) {
    setOutfitOverrides((prev) => ({ ...prev, [characterId]: outfitKey }));
  }

  function handleOutfitCreated(characterId: string, outfit: OutfitOption) {
    setRefs((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        assignedCharacters: prev.assignedCharacters.map((c) =>
          c.characterId === characterId
            ? { ...c, availableOutfits: [...c.availableOutfits, outfit] }
            : c
        ),
        availableCharacters: prev.availableCharacters.map((c) =>
          c.characterId === characterId
            ? { ...c, availableOutfits: [...c.availableOutfits, outfit] }
            : c
        ),
      };
    });
  }

  const includedChars = refs
    ? refs.assignedCharacters.map((c) => ({
        characterId: c.characterId,
        name: c.name,
        imageUrl: bestCharacterImage(c),
        role: c.role,
        outfits: c.availableOutfits,
        outfitDescription: c.currentOutfitDescription,
      }))
    : [];

  const availableChars = refs
    ? refs.availableCharacters.map((c) => ({
        characterId: c.characterId,
        name: c.name,
        imageUrl: bestCharacterImage(c),
        role: c.role,
        outfits: c.availableOutfits,
        outfitDescription: null as string | null,
      }))
    : [];

  const allChars = [...includedChars, ...availableChars];
  const includedCount = allChars.filter((c) =>
    includedCharacterIds.has(c.characterId)
  ).length;
  const exceedsFocusLimit = includedCount > MAX_FEATURED_CHARACTERS;

  function submitPayload(freshStart?: boolean) {
    if (exceedsFocusLimit) return;

    onSubmit({
      feedback: freshStart ? "" : feedback,
      includedCharacterIds: Array.from(includedCharacterIds),
      outfitOverrides,
      primaryLocationId,
      includedLocationIds: Array.from(includedLocationIds),
      freshStart,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-6"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white shadow-2xl w-full md:max-w-xl md:rounded-2xl rounded-t-2xl overflow-hidden border border-gray-200/50 flex flex-col max-h-[92vh] md:max-h-[calc(100vh-48px)]"
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="font-bold text-base flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-600" />
              Redraw Spread
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {spreadLabel} — edit references &amp; tell the AI what to change
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
              <p className="text-sm text-gray-500">Loading reference pack…</p>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-500 text-sm">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 text-sm text-purple-600 font-medium"
              >
                Close
              </button>
            </div>
          ) : refs ? (
            <>
              {refs.spread.sceneSummary && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <SectionHeader icon={Info} label="Scene Plan" />
                  <p className="text-xs text-gray-600 leading-relaxed italic">
                    {refs.spread.sceneSummary}
                  </p>
                </div>
              )}

              <div>
                <SectionHeader
                  icon={MapPin}
                  label="Locations"
                  count={includedLocationIds.size}
                />
                <MultiLocationPicker
                  all={refs.availableLocations}
                  includedLocationIds={includedLocationIds}
                  primaryLocationId={primaryLocationId}
                  onToggleLocation={toggleLocation}
                  onSetPrimary={choosePrimaryLocation}
                />
              </div>

              <div>
                <SectionHeader
                  icon={User}
                  label="Featured characters"
                  count={includedCount}
                />

                <p className="text-[11px] text-gray-500 mb-3">
                  Choose up to {MAX_FEATURED_CHARACTERS} characters to match most closely.
                </p>

                {exceedsFocusLimit && (
                  <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-amber-900">
                        Too many featured characters selected
                      </p>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        For the best likeness, keep this spread focused on up to{" "}
                        {MAX_FEATURED_CHARACTERS} featured characters.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {includedChars.map((c) => (
                    <CharacterRow
                      key={c.characterId}
                      characterId={c.characterId}
                      name={c.name}
                      imageUrl={c.imageUrl}
                      role={c.role}
                      isIncluded={includedCharacterIds.has(c.characterId)}
                      onToggle={() => toggleCharacter(c.characterId)}
                      outfitKey={outfitOverrides[c.characterId] ?? null}
                      outfits={c.outfits}
                      onOutfitChange={(key) => setOutfit(c.characterId, key)}
                      onOutfitCreated={(outfit) =>
                        handleOutfitCreated(c.characterId, outfit)
                      }
                      storyId={storyId}
                    />
                  ))}
                </div>

                {availableChars.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowAvailable(!showAvailable)}
                      className="flex items-center gap-2 text-xs text-purple-600 hover:text-purple-700 font-bold w-full py-2"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add characters not in this scene ({availableChars.length})
                      {showAvailable ? (
                        <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                      )}
                    </button>

                    <AnimatePresence>
                      {showAvailable && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-2 pt-1">
                            {availableChars.map((c) => (
                              <CharacterRow
                                key={c.characterId}
                                characterId={c.characterId}
                                name={c.name}
                                imageUrl={c.imageUrl}
                                role={c.role}
                                isIncluded={includedCharacterIds.has(c.characterId)}
                                onToggle={() => toggleCharacter(c.characterId)}
                                outfitKey={outfitOverrides[c.characterId] ?? null}
                                outfits={c.outfits}
                                onOutfitChange={(key) =>
                                  setOutfit(c.characterId, key)
                                }
                                onOutfitCreated={(outfit) =>
                                  handleOutfitCreated(c.characterId, outfit)
                                }
                                storyId={storyId}
                              />
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {refs.styleGuide && (
                <div>
                  <SectionHeader icon={Palette} label="Style Guide" />
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    {refs.styleGuide.sampleIllustrationUrl && (
                      <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={refs.styleGuide.sampleIllustrationUrl}
                          alt="Style"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {refs.styleGuide.artStyle && (
                        <p className="text-xs font-bold text-gray-700">
                          {refs.styleGuide.artStyle}
                        </p>
                      )}
                      {refs.styleGuide.summary && (
                        <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">
                          {refs.styleGuide.summary}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wand2 className="w-4 h-4 text-purple-600" />
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                    Additional feedback
                  </h4>
                  <span className="text-[10px] text-gray-400 normal-case">
                    optional
                  </span>
                </div>

                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 h-24 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="e.g. Make the sky more dramatic, position Sophia on the left, add more flowers…"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={() => submitPayload(true)}
            disabled={isSubmitting || isLoading || exceedsFocusLimit}
            className="w-full px-4 py-2 rounded-xl border border-orange-300 text-orange-600 hover:bg-orange-50 transition-colors font-medium text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Fresh Start — regenerate from scratch
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => submitPayload(false)}
              disabled={isSubmitting || isLoading || exceedsFocusLimit}
              className="flex-1 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors disabled:opacity-50 text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Regenerate
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}