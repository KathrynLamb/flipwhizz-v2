// src/app/stories/[id]/studio/components/StudioPaywall.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Lock,
  Sparkles,
  BookOpen,
  Gift,
  Monitor,
  CheckCircle,
  ChevronRight,
} from "lucide-react";

type Tier = "digital" | "print" | "gift";

const TIERS: {
  key: Tier;
  label: string;
  price: string;
  description: string;
  icon: typeof Monitor;
  features: string[];
  popular?: boolean;
}[] = [
  {
    key: "digital",
    label: "Print at home PDF",
    price: "£2",
    description: "Read on any device, download the PDF, keep forever.",
    icon: Monitor,
    features: [
      "Fully personalised story",
      "Custom illustrations",
      "High-quality PDF download",
      "Unlimited re-reads",
    ],
  },
  {
    key: "print",
    label: "Printed Storybook",
    price: "£29",
    description: "A real book to hold, read at bedtime, and treasure.",
    icon: BookOpen,
    popular: true,
    features: [
      "Everything in Digital",
      "Premium softcover book",
      "Beautiful full-colour pages",
      "Delivered to your door",
    ],
  },
  {
    key: "gift",
    label: "Gift Edition",
    price: "£39",
    description: "Hardcover, dedication page — made for giving.",
    icon: Gift,
    features: [
      "Everything in Printed",
      "Hardcover binding",
      "Personal dedication page",
      "Gift-ready presentation",
    ],
  },
];

export default function StudioPaywall({
  storyId,
  storyTitle,
  previewSpreadUrl,
}: {
  storyId: string;
  storyTitle: string;
  previewSpreadUrl?: string | null;
}) {
  const router = useRouter();
  const [selectedTier, setSelectedTier] = useState<Tier>("print");
  const [saving, setSaving] = useState(false);

  async function handleContinue() {
    if (saving) return;
    setSaving(true);

    try {
      // Update the story product with the selected tier
      await fetch(`/api/stories/${storyId}/product`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productType: selectedTier }),
      });

      // Route to checkout
      router.push(`/stories/${storyId}/checkout`);
    } catch {
      // Still route to checkout even if product update fails
      router.push(`/stories/${storyId}/checkout`);
    }
  }

  return (
    <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold mb-4"
          style={{
            background: "linear-gradient(135deg, #E8D5FF, #FFD5E5)",
            color: "#7B3FA0",
          }}
        >
          <Lock className="w-3.5 h-3.5" />
          Unlock Your Book
        </div>
        <h2
          className="text-2xl sm:text-3xl font-extrabold mb-3"
          style={{ color: "#2D2235", letterSpacing: "-0.03em" }}
        >
          Your story is ready to come alive
        </h2>
        <p className="text-base max-w-xl mx-auto" style={{ color: "#7B6E90" }}>
          We&apos;ll generate custom illustrations for every page of{" "}
          <strong style={{ color: "#2D2235" }}>{storyTitle}</strong>. Choose how
          you&apos;d like to receive it.
        </p>
      </motion.div>

      {/* Preview spread teaser */}
      {previewSpreadUrl && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="max-w-3xl mx-auto mb-12"
        >
          <div className="relative rounded-2xl overflow-hidden shadow-lg border border-purple-100">
            <img
              src={previewSpreadUrl}
              alt="Style preview from your story"
              className="w-full h-auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <span className="text-white/90 text-sm font-semibold">
                Your illustration style
              </span>
              <span
                className="text-xs font-bold px-3 py-1 rounded-full"
                style={{
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  backdropFilter: "blur(8px)",
                }}
              >
                14 more pages to generate
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto mb-10">
        {TIERS.map((tier, i) => {
          const isSelected = selectedTier === tier.key;
          const Icon = tier.icon;

          return (
            <motion.button
              key={tier.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              onClick={() => setSelectedTier(tier.key)}
              className={`relative text-left rounded-2xl border-2 p-6 transition-all duration-200 ${
                isSelected
                  ? "border-purple-500 shadow-lg shadow-purple-100 scale-[1.02]"
                  : "border-gray-200 hover:border-purple-200 hover:shadow-md"
              }`}
              style={{ background: "white" }}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span
                    className="text-[11px] font-bold px-3 py-1 rounded-full text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, #B05CE6, #D45DA0)",
                    }}
                  >
                    Most Loved
                  </span>
                </div>
              )}

              {/* Selection indicator */}
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, #B05CE6, #D45DA0)"
                      : "linear-gradient(135deg, #E8D5FF, #FFD5E5)",
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: isSelected ? "white" : "#B05CE6" }}
                  />
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected
                      ? "border-purple-500 bg-purple-500"
                      : "border-gray-300"
                  }`}
                >
                  {isSelected && (
                    <CheckCircle className="w-4 h-4 text-white" />
                  )}
                </div>
              </div>

              <h3
                className="text-lg font-extrabold mb-1"
                style={{ color: "#2D2235" }}
              >
                {tier.label}
              </h3>
              <p
                className="text-xs mb-4 leading-relaxed"
                style={{ color: "#7B6E90" }}
              >
                {tier.description}
              </p>

              <div className="mb-4">
                <span
                  className="text-3xl font-extrabold"
                  style={{
                    color: isSelected ? "#B05CE6" : "#2D2235",
                  }}
                >
                  {tier.price}
                </span>
                <span className="text-sm ml-1" style={{ color: "#7B6E90" }}>
                  one-off
                </span>
              </div>

              <div className="space-y-2">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-start gap-2">
                    <Sparkles
                      className="w-3 h-3 mt-0.5 flex-shrink-0"
                      style={{
                        color: isSelected ? "#B05CE6" : "#C4B5D4",
                      }}
                    />
                    <span
                      className="text-xs"
                      style={{ color: "#5A4D6B" }}
                    >
                      {f}
                    </span>
                  </div>
                ))}
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-center"
      >
        <button
          onClick={handleContinue}
          disabled={saving}
          className="inline-flex items-center gap-2 px-10 py-4 rounded-2xl text-base font-bold text-white transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
            boxShadow: "0 6px 24px rgba(176,92,230,0.3)",
          }}
        >
          {saving ? (
            "Redirecting…"
          ) : (
            <>
              Continue to Checkout
              <ChevronRight className="w-5 h-5" />
            </>
          )}
        </button>
        <p className="text-xs mt-4" style={{ color: "#A897BD" }}>
          No subscriptions. No hidden fees. One payment, your book forever.
        </p>
      </motion.div>
    </div>
  );
}