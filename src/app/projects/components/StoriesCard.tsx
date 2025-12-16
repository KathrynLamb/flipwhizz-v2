"use client";

import Link from "next/link";
import { 
  BookOpen, 
  Sparkles, 
  Palette, 
  Paintbrush, 
  Lock, 
  Truck, 
  Clock,
  Loader2,
  PackageCheck
} from "lucide-react";

type Story = {
  id: string;
  title: string;
  updatedAt: Date | null;
  status: string; 
  storyConfirmed: boolean;
  paymentStatus: string;
  coverImageUrl: string | null;
};

export default function StoriesCard({ story }: { story: Story }) {
  
  // =========================================================
  // 🧠 THE STATE MACHINE LOGIC
  // =========================================================
  
  // Default State: Drafting
  let config = {
    label: "Drafting",
    icon: BookOpen,
    buttonText: "Review Draft",
    href: `/stories/${story.id}/view`,
    colorClass: "bg-amber-100 text-amber-800 border-amber-200",
    btnClass: "bg-[#F4A261] text-[#261C15] hover:bg-[#E76F51]",
    isDisabled: false,
  };

  // 1. DRAFTING PHASE
  if (!story.storyConfirmed) {
    // Keeps default config
  } 
  
  // 2. EXTRACTION PHASE (AI is finding characters)
  else if (story.status === "extracting") {
    config = {
      label: "Magic in Progress",
      icon: Sparkles,
      buttonText: "View Magic",
      href: `/stories/${story.id}/extract`,
      colorClass: "bg-purple-100 text-purple-800 border-purple-200 animate-pulse",
      btnClass: "bg-purple-600 text-white hover:bg-purple-700",
      isDisabled: false,
    };
  }

  // 3. STYLE SELECTION (Analysis done, needs art direction)
  else if (story.status === "needs_style") {
    config = {
      label: "Select Style",
      icon: Palette,
      buttonText: "Choose Art",
      href: `/stories/${story.id}/design`,
      colorClass: "bg-sky-100 text-sky-800 border-sky-200",
      btnClass: "bg-sky-600 text-white hover:bg-sky-700",
      isDisabled: false,
    };
  }

  // 4. PAYWALL (Style picked, needs payment to unlock studio)
  else if (story.status === "payment_pending" || (story.status === "generating" && story.paymentStatus !== "paid")) {
    config = {
      label: "Payment Needed",
      icon: Lock,
      buttonText: "Unlock Studio",
      href: `/stories/${story.id}/checkout`, // Redirects to Stripe/Payment page
      colorClass: "bg-rose-100 text-rose-800 border-rose-200",
      btnClass: "bg-[#261C15] text-white hover:bg-black ring-2 ring-[#261C15] ring-offset-2",
      isDisabled: false,
    };
  }

  // 5. STUDIO MODE (Paid, generating images, editing characters)
  else if (story.status === "generating") {
    config = {
      label: "Art Studio",
      icon: Paintbrush,
      buttonText: "Open Studio",
      href: `/stories/${story.id}/studio`,
      colorClass: "bg-indigo-100 text-indigo-800 border-indigo-200",
      btnClass: "bg-[#261C15] text-white hover:bg-black",
      isDisabled: false,
    };
  }

  // 6. PUBLISHING (PDF Generating / Sending to Gelato)
  else if (story.status === "publishing") {
    config = {
      label: "Printing...",
      icon: Loader2,
      buttonText: "Processing",
      href: "#",
      colorClass: "bg-stone-100 text-stone-600 border-stone-200 animate-pulse",
      btnClass: "bg-stone-200 text-stone-500 cursor-not-allowed",
      isDisabled: true,
    };
  }

  // 7. COMPLETED / SHIPPED
  else if (story.status === "completed") {
    config = {
      label: "Order Sent",
      icon: PackageCheck,
      buttonText: "Track Order",
      href: `/orders/${story.id}`, // Or a status page
      colorClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
      btnClass: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200",
      isDisabled: false,
    };
  }

  const StatusIcon = config.icon;

  return (
    <div className="group relative flex flex-col h-[340px] w-full rounded-r-2xl rounded-l-md bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border border-stone-200">
      
      {/* SPINE (Left Edge) */}
      <div className="absolute bottom-0 left-0 top-0 z-20 flex w-3 flex-col items-center justify-center gap-1 rounded-l-md bg-[#261C15]">
        <div className="h-full w-[1px] bg-white/10"></div>
      </div>
      <div className="absolute bottom-0 left-3 top-0 z-10 w-1 bg-stone-300 shadow-inner"></div>

      {/* COVER IMAGE AREA */}
      <div className="relative ml-4 h-48 overflow-hidden rounded-tr-2xl bg-[#F3EAD3]">
        {story.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img 
            src={story.coverImageUrl} 
            alt={story.title} 
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-10">
            <BookOpen className="h-20 w-20 text-[#261C15]" />
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute right-3 top-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider shadow-sm ${config.colorClass}`}>
            <StatusIcon className={`h-3 w-3 ${config.label === "Printing..." ? "animate-spin" : ""}`} />
            {config.label}
          </span>
        </div>
      </div>

      {/* INFO AREA */}
      <div className="ml-4 flex flex-grow flex-col p-5">
        <h3 className="line-clamp-2 font-serif text-xl font-bold leading-tight text-[#261C15]">
          {story.title || "Untitled Adventure"}
        </h3>

        <p className="mt-2 flex items-center gap-1 text-xs text-[#8C7A6B]">
          <Clock className="h-3 w-3" />
          Updated {story.updatedAt ? new Date(story.updatedAt).toLocaleDateString() : 'Just now'}
        </p>

        <div className="mt-auto pt-4">
            {config.isDisabled ? (
                <button disabled className={`flex w-full items-center justify-center rounded-lg py-3 text-sm font-bold transition-all ${config.btnClass}`}>
                    {config.buttonText}
                </button>
            ) : (
                <Link
                    href={config.href}
                    className={`flex w-full items-center justify-center rounded-lg py-3 text-sm font-bold shadow-md transition-all active:scale-[0.98] ${config.btnClass}`}
                >
                    {config.buttonText}
                </Link>
            )}
        </div>
      </div>
    </div>
  );
}