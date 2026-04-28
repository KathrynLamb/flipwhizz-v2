// src/app/projects/components/HomeContent.tsx
"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  BookOpen,
  Sparkles,
  Globe2,
  Clock,
  Pencil,
  Check,
  X,
  Camera,
  Loader2,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface Story {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: string;
  paymentStatus: string;
  readerId: string | null;
  worldId: string | null;
  bookNumber: number | null;
  coverImageUrl: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface WorldData {
  id: string;
  name: string;
  description: string | null;
  tonality: string | null;
  themes: string[];
  coverImageUrl: string | null;
  role: string | null;
  stories: Story[];
}

interface ReaderData {
  id: string;
  name: string | null;
  gender: string | null;
  aiSummary: string | null;
  interests?: string[] | null;
  avatarUrl?: string | null;
  worlds: WorldData[];
  standaloneStories: Story[];
}

interface HomeContentProps {
  readers: ReaderData[];
  orphanStories: Story[];
  totalStories: number;
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS: Record<string, { bg: string; text: string; label: string }> = {
  planning:         { bg: "rgba(245,168,98,0.10)",  text: "#B87A3D", label: "Planning" },
  draft:            { bg: "rgba(245,168,98,0.10)",  text: "#B87A3D", label: "Draft" },
  paged:            { bg: "rgba(109,188,224,0.10)",  text: "#4A8FB0", label: "Story ready" },
  extracting:       { bg: "rgba(167,139,218,0.10)",  text: "#7B5EA7", label: "Building world" },
  pages_ready:      { bg: "rgba(109,188,224,0.10)",  text: "#4A8FB0", label: "Pages ready" },
  ready:            { bg: "rgba(109,188,224,0.10)",  text: "#4A8FB0", label: "Ready" },
  generating:       { bg: "rgba(167,139,218,0.10)",  text: "#7B5EA7", label: "Illustrating" },
  illustrating:     { bg: "rgba(167,139,218,0.10)",  text: "#7B5EA7", label: "Illustrating" },
  covers_complete:  { bg: "rgba(125,212,168,0.10)",  text: "#2D6A4F", label: "Ready to order" },
  complete:         { bg: "rgba(125,212,168,0.10)",  text: "#2D6A4F", label: "Complete" },
};

// ============================================================================
// MAIN
// ============================================================================

export default function HomeContent({
  readers,
  orphanStories,
  totalStories,
}: HomeContentProps) {
  const hasContent = readers.length > 0 || orphanStories.length > 0;

  return (
    <div className="relative z-10">
      <section className="px-5 lg:px-8 pt-8 lg:pt-12 pb-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1
                className="text-2xl lg:text-4xl font-extrabold tracking-tight"
                style={{ color: "#2D2235", fontFamily: "Bricolage Grotesque, sans-serif" }}
              >
                Your Stories
              </h1>
              <p className="mt-1 text-sm lg:text-base text-gray-400 max-w-md">
                Every adventure starts here.
              </p>
            </div>
            {totalStories > 0 && (
              <span
                className="text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(217,69,144,0.08)", color: "#D94590" }}
              >
                {totalStories} {totalStories === 1 ? "story" : "stories"}
              </span>
            )}
          </div>
          <div
            className="mt-4 h-[2px] rounded-full w-24"
            style={{
              background:
                "linear-gradient(90deg, #F28B7B, #F5A862, #F5CE62, #7DD4A8, #6DBCE0, #A78BDA)",
            }}
          />
        </div>
      </section>

      <section className="px-5 lg:px-8 pb-24">
        <div className="mx-auto max-w-5xl">
          {!hasContent ? (
            <EmptyState />
          ) : (
            <div className="mt-4 space-y-8">
              {readers.map((reader) => (
                <ReaderSection key={reader.id} reader={reader} />
              ))}
              {orphanStories.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-300 uppercase tracking-wider mb-3">
                    Earlier stories
                  </p>
                  <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                    {orphanStories.map((story) => (
                      <OrphanCard key={story.id} story={story} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// READER
// ============================================================================

function ReaderSection({ reader }: { reader: ReaderData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(reader.name || "");
  const [avatarUrl, setAvatarUrl] = useState(reader.avatarUrl || null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalBooks =
    reader.worlds.reduce((sum, w) => sum + w.stories.length, 0) +
    reader.standaloneStories.length;
  const totalWorlds = reader.worlds.length;

  const interests = (reader as any).interests as string[] | undefined;

  async function saveReaderName() {
    if (!nameValue.trim()) return;
    try {
      await fetch(`/api/readers/${reader.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
    } catch {}
    setEditingName(false);
  }

  async function uploadAvatar(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("readerId", reader.id);
      const res = await fetch("/api/readers/upload-avatar", { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.url);
        router.refresh();
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  const initials = (reader.name || "?").charAt(0).toUpperCase();

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 group mb-3 cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setExpanded(!expanded);
        }}
      >
        {/* Avatar */}
        <div
          className="relative w-10 h-10 rounded-full flex-shrink-0 overflow-hidden cursor-pointer"
          onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
          title="Upload a photo"
        >
          {uploading ? (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #D94590, #7B5EA7)" }}>
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          ) : avatarUrl ? (
            <img src={avatarUrl} alt={reader.name || ""} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #D94590, #7B5EA7)" }}>
              <span className="text-white text-sm font-semibold">{initials}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center 
                          opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
        </div>

        {/* Name + stats */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input type="text" value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveReaderName(); if (e.key === "Escape") setEditingName(false); }}
                  className="text-lg font-bold text-[#2D2235] bg-transparent border-b-2 border-[#D94590] outline-none w-36"
                  style={{ fontFamily: "Bricolage Grotesque, sans-serif" }} autoFocus />
                <button onClick={saveReaderName} className="p-1 hover:bg-[#D94590]/10 rounded-full">
                  <Check className="w-3.5 h-3.5 text-[#D94590]" />
                </button>
                <button onClick={() => setEditingName(false)} className="p-1 hover:bg-gray-100 rounded-full">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-[#2D2235] truncate"
                  style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}>
                  {reader.name || "Unnamed Reader"}
                </h2>
                <button onClick={(e) => { e.stopPropagation(); setEditingName(true); }}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-100 rounded-full transition-opacity">
                  <Pencil className="w-3 h-3 text-gray-400" />
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
            <span>{totalWorlds} {totalWorlds === 1 ? "world" : "worlds"}</span>
            <span className="text-gray-200">·</span>
            <span>{totalBooks} {totalBooks === 1 ? "book" : "books"}</span>
            {interests && interests.length > 0 && (
              <>
                <span className="text-gray-200">·</span>
                <span className="truncate">Loves {interests.slice(0, 3).join(", ")}</span>
              </>
            )}
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform flex-shrink-0 ${expanded ? "" : "-rotate-90"}`} />
      </div>

      {expanded && (
        <div className="ml-[52px] space-y-5">
          {reader.worlds.map((world) => (
            <WorldSection key={world.id} world={world} readerName={reader.name} />
          ))}
          {reader.standaloneStories.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider mb-2">Standalone</p>
              <div className="space-y-2 sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:gap-3 sm:space-y-0">
                {reader.standaloneStories.map((s) => <BookCard key={s.id} story={s} />)}
              </div>
            </div>
          )}
            <Link href={`/projects/new?readerId=${reader.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full 
                        border border-dashed border-[#D94590]/20 text-[#D94590]/60 
                        hover:text-[#D94590] hover:bg-[#D94590]/5 hover:border-[#D94590]/30 transition-all">
              <Plus className="w-3 h-3" />
              New story for {reader.name || "this reader"}
            </Link>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WORLD
// ============================================================================

function WorldSection({ world, readerName }: { world: WorldData; readerName: string | null }) {
  const [expanded, setExpanded] = useState(true);
  const nextBookNumber = world.stories.length > 0
    ? Math.max(...world.stories.map((s) => s.bookNumber ?? 0)) + 1 : 1;

  return (
    <div>
      <div onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 group mb-2 cursor-pointer select-none"
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setExpanded(!expanded); }}>
        <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center"
          style={{ background: "rgba(123,94,167,0.08)" }}>
          <Globe2 className="w-3.5 h-3.5 text-[#7B5EA7]" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <h3 className="text-sm font-bold text-[#2D2235] truncate"
            style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}>{world.name}</h3>
          <span className="text-[11px] text-gray-300">{world.stories.length} {world.stories.length === 1 ? "book" : "books"}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          {world.themes.slice(0, 2).map((t) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(123,94,167,0.06)", color: "#7B5EA7" }}>{t}</span>
          ))}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform flex-shrink-0 ${expanded ? "" : "-rotate-90"}`} />
      </div>

      {expanded && (
        <div className="ml-8">
          {/* Desktop grid */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {world.stories.map((s) => <BookCard key={s.id} story={s} showBookNumber />)}
            <Link href={`/projects/new?worldId=${world.id}&bookNumber=${nextBookNumber}`}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#D94590]/15 
                         text-[#D94590]/50 hover:border-[#D94590]/30 hover:text-[#D94590] hover:bg-[#D94590]/3 
                         transition-all min-h-[120px] group">
              <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium">Book {nextBookNumber}</span>
            </Link>
          </div>
          {/* Mobile rows */}
          <div className="sm:hidden space-y-2">
            {world.stories.map((s) => <MobileBookRow key={s.id} story={s} />)}
            <Link href={`/projects/new?worldId=${world.id}&bookNumber=${nextBookNumber}`}
              className="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed 
                         border-[#D94590]/15 text-[#D94590]/50 hover:text-[#D94590] transition-all">
              <Plus className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Book {nextBookNumber}</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// BOOK CARD (desktop)
// ============================================================================

function BookCard({ story, showBookNumber = false }: { story: Story; showBookNumber?: boolean }) {

  const effectiveStatus =
    story.paymentStatus === "paid"
      ? "complete"
      : story.status;
  const status = STATUS[effectiveStatus] ?? STATUS.planning;

  return (
    <Link href={story.paymentStatus === "paid" ? `/stories/${story.id}/book` : `/stories/${story.id}`}
      className="block rounded-xl bg-white border border-gray-100 overflow-hidden 
                 hover:border-[#D94590]/20 hover:shadow-md transition-all group">
      <div className="relative h-24 bg-gradient-to-br from-[#D94590]/6 to-[#7B5EA7]/6 overflow-hidden">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-8 h-8 text-[#D94590]/15" />
          </div>
        )}
        {showBookNumber && story.bookNumber && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-sm"
            style={{ color: "#D94590" }}>
            Book {story.bookNumber}
          </div>
        )}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-semibold backdrop-blur-sm"
          style={{ background: status.bg, color: status.text }}>
          {status.label}
        </div>
      </div>
      <div className="p-3">
        <h4 className="font-bold text-[#2D2235] text-xs truncate group-hover:text-[#D94590] transition-colors"
          style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}>{story.title}</h4>
        {story.updatedAt && (
          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-gray-300">
            <Clock className="w-2.5 h-2.5" />
            {new Date(story.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </div>
        )}
      </div>
    </Link>
  );
}

// ============================================================================
// MOBILE BOOK ROW
// ============================================================================

function MobileBookRow({ story }: { story: Story }) {

  const effectiveStatus =
    story.paymentStatus === "paid"
      ? "complete"
      : story.status;
  const status = STATUS[effectiveStatus] ?? STATUS.planning;
  return (
    <Link href={story.paymentStatus === "paid" ? `/stories/${story.id}/book` : `/stories/${story.id}`}
      className="flex items-center gap-3 rounded-xl bg-white border border-gray-100 
                 overflow-hidden hover:border-[#D94590]/20 transition-all active:scale-[0.98]">
      <div className="w-16 h-16 flex-shrink-0 bg-gradient-to-br from-[#D94590]/6 to-[#7B5EA7]/6 overflow-hidden">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#D94590]/15" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 py-2 pr-3">
        <div className="flex items-center gap-2">
          {story.bookNumber && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
              style={{ background: "rgba(217,69,144,0.08)", color: "#D94590" }}>
              {story.bookNumber}
            </span>
          )}
          <h4 className="text-sm font-bold text-[#2D2235] truncate"
            style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}>{story.title}</h4>
        </div>
        <span className="inline-block mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{ background: status.bg, color: status.text }}>{status.label}</span>
      </div>
    </Link>
  );
}

// ============================================================================
// ORPHAN CARD (smaller, for earlier stories)
// ============================================================================

function OrphanCard({ story }: { story: Story }) {
  return (
    <Link href={story.paymentStatus === "paid" ? `/stories/${story.id}/book` : `/stories/${story.id}`}
      className="block rounded-lg bg-white border border-gray-100 overflow-hidden 
                 hover:border-[#D94590]/15 hover:shadow-sm transition-all group">
      <div className="h-16 bg-gradient-to-br from-[#D94590]/5 to-[#7B5EA7]/5 overflow-hidden">
        {story.coverImageUrl ? (
          <img src={story.coverImageUrl} alt={story.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-[#D94590]/10" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h4 className="font-semibold text-[#2D2235] text-[11px] truncate"
          style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}>{story.title}</h4>
      </div>
    </Link>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  return (
    <div className="mt-6 rounded-[22px] overflow-hidden border border-gray-100">
      <div className="bg-white px-6 py-14 lg:py-20 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, #D94590, #7B5EA7)", boxShadow: "0 8px 24px rgba(217,69,144,0.2)" }}>
          <Sparkles className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl lg:text-3xl font-extrabold mb-2 tracking-tight"
          style={{ color: "#2D2235", fontFamily: "Bricolage Grotesque, sans-serif" }}>
          No stories yet
        </h2>
        <p className="text-gray-400 max-w-xs mx-auto mb-8 text-sm leading-relaxed">
          Ready to create something magical? Tell us about your little one and we'll build a world just for them.
        </p>
        <Link href="/projects/new"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold 
                     shadow-lg hover:shadow-xl transition-all"
          style={{ background: "linear-gradient(135deg, #D94590, #7B5EA7)" }}>
          <Sparkles className="w-4 h-4" />
          Create your first story
        </Link>
      </div>
    </div>
  );
}