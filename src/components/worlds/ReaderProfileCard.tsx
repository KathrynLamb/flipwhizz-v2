// ReaderProfileCard.tsx
// Drop into: src/components/worlds/ReaderProfileCard.tsx
//
// Compact, mobile-first card for displaying a reader profile.
// Used in WorldDashboard, WorldDetail, and the story creation flow.

"use client";

import { useState } from "react";
import {
  User,
  Heart,
  Star,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";

interface ReaderProfile {
  id: string;
  name: string;
  age: number | null;
  pronouns: string | null;
  personalityNotes: string | null;
  interests: string[];
  fears: string[];
  readingLevel: string | null;
  referenceImageUrl: string | null;
  activeInsights?: Array<{
    type: string;
    content: string;
  }>;
}

interface ReaderProfileCardProps {
  reader: ReaderProfile;
  onEdit?: (readerId: string) => void;
  compact?: boolean; // for use in lists
  role?: string; // "protagonist", "sidekick", etc.
}

export default function ReaderProfileCard({
  reader,
  onEdit,
  compact = false,
  role,
}: ReaderProfileCardProps) {
  const [expanded, setExpanded] = useState(false);

  const pronounLabel =
    reader.pronouns === "she/her"
      ? "She"
      : reader.pronouns === "he/him"
      ? "He"
      : reader.pronouns === "they/them"
      ? "They"
      : reader.name;

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 p-3 rounded-[14px] bg-white 
                    border border-[#2D2235]/8"
      >
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden 
                      bg-gradient-to-br from-[#D94590]/20 to-[#7B5EA7]/20"
        >
          {reader.referenceImageUrl ? (
            <img
              src={reader.referenceImageUrl}
              alt={reader.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-5 h-5 text-[#D94590]/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#2D2235] text-sm truncate">
              {reader.name}
            </span>
            {reader.age && (
              <span className="text-xs text-[#2D2235]/50">
                age {reader.age}
              </span>
            )}
          </div>
          {role && (
            <span className="text-xs text-[#D94590]/80 capitalize">{role}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[22px] bg-white border border-[#2D2235]/8 overflow-hidden">
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-[12px] flex-shrink-0 overflow-hidden 
                        bg-gradient-to-br from-[#D94590]/20 to-[#7B5EA7]/20"
          >
            {reader.referenceImageUrl ? (
              <img
                src={reader.referenceImageUrl}
                alt={reader.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-8 h-8 text-[#D94590]/40" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <h3
                  className="text-lg font-bold text-[#2D2235]"
                  style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
                >
                  {reader.name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  {reader.age && (
                    <span className="text-sm text-[#2D2235]/50">
                      Age {reader.age}
                    </span>
                  )}
                  {reader.pronouns && (
                    <span className="text-sm text-[#2D2235]/40">
                      ({reader.pronouns})
                    </span>
                  )}
                  {role && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full bg-[#D94590]/10 
                                   text-[#D94590] font-medium capitalize"
                    >
                      {role}
                    </span>
                  )}
                </div>
              </div>

              {onEdit && (
                <button
                  onClick={() => onEdit(reader.id)}
                  className="p-2 rounded-full hover:bg-[#2D2235]/5 transition-colors"
                >
                  <Pencil className="w-4 h-4 text-[#2D2235]/40" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Quick glance */}
        <div className="flex flex-wrap gap-2 mt-4">
          {reader.readingLevel && (
            <span
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 
                         rounded-full bg-[#A8D5BA]/20 text-[#2D6A4F]"
            >
              <BookOpen className="w-3 h-3" />
              {reader.readingLevel}
            </span>
          )}
          {reader.interests.slice(0, 3).map((interest) => (
            <span
              key={interest}
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 
                         rounded-full bg-[#7B5EA7]/10 text-[#7B5EA7]"
            >
              <Star className="w-3 h-3" />
              {interest}
            </span>
          ))}
          {reader.interests.length > 3 && (
            <span className="text-xs text-[#2D2235]/40 self-center">
              +{reader.interests.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Expandable detail */}
      {(reader.personalityNotes ||
        reader.fears.length > 0 ||
        (reader.activeInsights && reader.activeInsights.length > 0)) && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-5 py-2.5 border-t border-[#2D2235]/5 
                       flex items-center justify-between text-sm text-[#2D2235]/50 
                       hover:bg-[#2D2235]/3 transition-colors"
          >
            <span>{expanded ? "Less detail" : "More about " + reader.name}</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {expanded && (
            <div className="px-5 pb-5 space-y-3">
              {reader.personalityNotes && (
                <div>
                  <p className="text-xs font-semibold text-[#2D2235]/40 uppercase tracking-wide mb-1">
                    Personality
                  </p>
                  <p className="text-sm text-[#2D2235]/70">
                    {reader.personalityNotes}
                  </p>
                </div>
              )}

              {reader.fears.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#2D2235]/40 uppercase tracking-wide mb-1">
                    Working through
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {reader.fears.map((fear) => (
                      <span
                        key={fear}
                        className="text-xs px-2 py-0.5 rounded-full 
                                   bg-amber-50 text-amber-700"
                      >
                        {fear}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {reader.activeInsights && reader.activeInsights.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#2D2235]/40 uppercase tracking-wide mb-1">
                    Recent insights
                  </p>
                  <div className="space-y-1.5">
                    {reader.activeInsights.slice(0, 5).map((insight, i) => (
                      <div
                        key={i}
                        className="text-sm text-[#2D2235]/60 flex items-start gap-2"
                      >
                        <Heart className="w-3 h-3 text-[#D94590]/50 mt-1 flex-shrink-0" />
                        <span>{insight.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}