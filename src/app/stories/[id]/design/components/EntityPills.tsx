"use client";

import { motion } from "framer-motion";
import { BookOpen, Users, MapPin } from "lucide-react";

/* Local types - not imported from anywhere */
type EntityUI = {
  id: string;
  kind: "character" | "location";
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  imageUrl: string | null;
};

export type SpreadUI = {
  spreadIndex: number;
  sceneSummary: string | null;
  leftPage: { id: string; pageNumber: number | null; text: string } | null;
  rightPage: { id: string; pageNumber: number | null; text: string } | null;
  entities: EntityUI[];
};

/* Inline EntityPills to avoid import issues */
function EntityPills({ entities }: { entities: EntityUI[] }) {
  const characters = entities.filter((e) => e.kind === "character");
  const locations = entities.filter((e) => e.kind === "location");

  if (entities.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-purple-400">
          No characters or locations defined for this spread yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Characters */}
      {characters.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-purple-600" />
            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">
              Characters ({characters.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {characters.map((char) => (
              <div
                key={char.id}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-purple-100 border border-purple-200 hover:bg-purple-150 transition-all"
              >
                {char.imageUrl ? (
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-purple-200 shrink-0">
                    <img
                      src={char.imageUrl}
                      alt={char.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-300 to-pink-300 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">
                      {char.name.charAt(0)}
                    </span>
                  </div>
                )}
                <span className="text-sm font-semibold text-purple-900">
                  {char.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations */}
      {locations.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-emerald-600" />
            <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
              Location ({locations.length})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {locations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-emerald-100 border border-emerald-200 hover:bg-emerald-150 transition-all"
              >
                {loc.imageUrl ? (
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-200 shrink-0">
                    <img
                      src={loc.imageUrl}
                      alt={loc.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-300 to-teal-300 flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="text-sm font-semibold text-emerald-900">
                  {loc.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* Main component */
export default function SpreadPreviewCard({ spread }: { spread: SpreadUI }) {
  return (
    <div className="space-y-4">
      {/* Book spread visual */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-200 via-pink-200 to-purple-200 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-500" />

        <div className="relative bg-white rounded-[2rem] shadow-xl border border-purple-100 overflow-hidden">
          {/* Book spine */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-purple-200 to-transparent" />
          <div className="absolute left-1/2 -ml-8 top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-purple-50/50 to-transparent pointer-events-none" />

          <div className="grid grid-cols-2">
            {/* Left page */}
            <div className="relative p-8 min-h-[240px] flex flex-col justify-center">
              <div className="absolute top-4 left-8 text-[10px] font-bold text-purple-300 uppercase tracking-widest">
                Page {spread.leftPage?.pageNumber ?? "—"}
              </div>
              <motion.div
                key={spread.spreadIndex + "L"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-serif text-base leading-relaxed text-purple-900"
              >
                {spread.leftPage?.text || (
                  <span className="text-purple-300 italic">Empty page</span>
                )}
              </motion.div>
            </div>

            {/* Right page */}
            <div className="relative p-8 min-h-[240px] flex flex-col justify-center border-l border-purple-50">
              <div className="absolute top-4 right-8 text-[10px] font-bold text-purple-300 uppercase tracking-widest">
                Page {spread.rightPage?.pageNumber ?? "—"}
              </div>
              <motion.div
                key={spread.spreadIndex + "R"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-serif text-base leading-relaxed text-purple-900"
              >
                {spread.rightPage?.text || (
                  <span className="text-purple-300 italic">Empty page</span>
                )}
              </motion.div>
            </div>
          </div>

          {/* Scene summary footer */}
          {spread.sceneSummary && (
            <div className="px-8 py-3 bg-purple-50/50 border-t border-purple-100">
              <p className="text-xs text-purple-700 italic">
                &ldquo;{spread.sceneSummary}&rdquo;
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Entities pills */}
      <div className="bg-white rounded-2xl border border-purple-100 shadow-md p-5">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-4 h-4 text-purple-600" />
          <h4 className="text-sm font-bold text-purple-900">In this spread</h4>
        </div>
        <EntityPills entities={spread.entities} />
      </div>
    </div>
  );
}