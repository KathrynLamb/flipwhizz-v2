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
    badge: "bg-amber-100 text-amber-800",
  },
  extracting: {
    label: "Finding characters",
    icon: Sparkles,
    href: id => `/stories/${id}/hub`,
    badge: "bg-fuchsia-100 text-fuchsia-700",
  },
  world_ready: {
    label: "Characters",
    icon: Users2,
    href: id => `/stories/${id}/characters`,
    badge: "bg-indigo-100 text-indigo-700",
  },
  style_ready: {
    label: "Style",
    icon: Palette,
    href: id => `/stories/${id}/design`,
    badge: "bg-sky-100 text-sky-700",
  },
  awaiting_payment: {
    label: "Unlock art",
    icon: Lock,
    href: id => `/stories/${id}/checkout`,
    badge: "bg-rose-100 text-rose-700",
  },
  generating: {
    label: "Illustrating",
    icon: Paintbrush,
    href: id => `/stories/${id}/studio`,
    badge: "bg-violet-100 text-violet-700",
  },
  publishing: {
    label: "Printing",
    icon: Loader2,
    href: () => "#",
    badge: "bg-stone-100 text-stone-700",
  },
  completed: {
    label: "Complete",
    icon: PackageCheck,
    href: id => `/orders/${id}`,
    badge: "bg-emerald-100 text-emerald-700",
  },
};

export default function StoriesCard({ story }: { story: Story }) {
  const config = STATUS_CONFIG[story.status] ?? STATUS_CONFIG.draft;
  const StatusIcon = config.icon;

  return (
    <div
      className="
        group relative
        bg-white
        rounded-[1rem]
        border border-slate-200
        overflow-hidden
        shadow-[0_20px_40px_-20px_rgba(0,0,0,0.25)]
        transition
        hover:-translate-y-1
        hover:shadow-[0_30px_70px_-25px_rgba(168,85,247,0.45)]
      "
    >
      {/* COVER */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {story.coverImageUrl ? (
          <img
            src={story.coverImageUrl}
            alt={story.title}
            className="
              absolute inset-0 h-full w-full object-cover
              transition-transform duration-500
              group-hover:scale-[1.05]
            "
          />
        ) : (
          <div className="
            absolute inset-0
            flex items-center justify-center
            bg-gradient-to-br from-pink-100 via-violet-100 to-blue-100
          ">
            <BookOpen className="w-16 h-16 text-violet-400" />
          </div>
        )}

        {/* STATUS BADGE */}
        <div className="absolute top-4 left-4">
          <span
            className={`
              inline-flex items-center gap-1.5
              px-3 py-1.5
              rounded-full
              text-xs font-semibold
              backdrop-blur
              ${config.badge}
            `}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            {config.label}
          </span>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-6 flex flex-col gap-4">
        <h3 className="
          font-black text-xl leading-tight
          line-clamp-2
          text-slate-900
        ">
          {story.title || "Untitled story"}
        </h3>

        <p className="text-xs text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {story.updatedAt
            ? `Updated ${new Date(story.updatedAt).toLocaleDateString()}`
            : "Just created"}
        </p>

        <Link
          href={config.href(story.id)}
          className="
            mt-2 inline-flex items-center justify-center
            rounded-full
            bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500
            px-6 py-3
            text-sm font-black text-white
            shadow-md
            transition
            hover:scale-[1.04]
            hover:shadow-lg
          "
        >
          Open story
        </Link>
      </div>
    </div>
  );
}
