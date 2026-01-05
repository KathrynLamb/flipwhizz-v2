'use client';

import Link from "next/link";
import {
  BookOpen,
  Sparkles,
  Palette,
  Paintbrush,
  Lock,
  Clock,
  Loader2,
  PackageCheck,
  Users2,
} from "lucide-react";

type Story = {
  id: string;
  title: string;
  updatedAt: Date | null;
  status: string;
  coverImageUrl: string | null;
};

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: any;
  href: (id: string) => string;
  badge: string;
}> = {
  draft: {
    label: "Draft",
    icon: BookOpen,
    href: id => `/stories/${id}/hub`,
    badge: "bg-amber-200 text-black",
  },
  extracting: {
    label: "Finding characters",
    icon: Sparkles,
    href: id => `/stories/${id}/hub`,
    badge: "bg-purple-200 text-black",
  },
  world_ready: {
    label: "Characters",
    icon: Users2,
    href: id => `/stories/${id}/characters`,
    badge: "bg-indigo-200 text-black",
  },
  style_ready: {
    label: "Style",
    icon: Palette,
    href: id => `/stories/${id}/design`,
    badge: "bg-sky-200 text-black",
  },
  awaiting_payment: {
    label: "Unlock art",
    icon: Lock,
    href: id => `/stories/${id}/checkout`,
    badge: "bg-rose-200 text-black",
  },
  generating: {
    label: "Illustrating",
    icon: Paintbrush,
    href: id => `/stories/${id}/studio`,
    badge: "bg-indigo-200 text-black",
  },
  publishing: {
    label: "Printing",
    icon: Loader2,
    href: () => "#",
    badge: "bg-stone-200 text-black",
  },
  completed: {
    label: "Complete",
    icon: PackageCheck,
    href: id => `/orders/${id}`,
    badge: "bg-emerald-200 text-black",
  },
};

export default function StoriesCard({ story }: { story: Story }) {
  const config = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = config.icon;

  return (
    <div
      className="
        group relative
        bg-white border-4 border-black rounded-3xl
        overflow-hidden
        hover:scale-[1.02] transition-transform
        hover:shadow-2xl
      "
    >
      {/* COVER */}
      <div className="relative aspect-[4/3] bg-gradient-to-br from-stone-100 to-stone-200">
        {story.coverImageUrl ? (
          <img
            src={story.coverImageUrl}
            alt={story.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-16 h-16 text-black/20" />
          </div>
        )}

        {/* STATUS BADGE */}
        <div className="absolute top-3 left-3">
          <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${config.badge}`}>
            <StatusIcon className="w-3 h-3" />
            {config.label}
          </span>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-5 flex flex-col gap-3">
        <h3 className="font-black text-xl leading-tight line-clamp-2">
          {story.title || "Untitled story"}
        </h3>

        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {story.updatedAt
            ? `Updated ${new Date(story.updatedAt).toLocaleDateString()}`
            : "Just created"}
        </p>

        <Link
          href={config.href(story.id)}
          className="
            mt-2 inline-flex items-center justify-center
            rounded-xl bg-black text-white
            py-3 text-sm font-bold
            hover:scale-105 transition
          "
        >
          Open story
        </Link>
      </div>
    </div>
  );
}
