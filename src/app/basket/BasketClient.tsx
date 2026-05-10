"use client";

// src/app/basket/BasketClient.tsx

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingBag, Tag, X, Check, Loader2, Sparkles,
  BookOpen, ChevronRight, ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

type BasketStory = {
  id: string;
  title: string;
  coverSpreadUrl: string | null;
  readerName: string | null;
  length: number | null;
  productType: string;
  currency: string;
  estimatedPrice: number; // cents
};

type PromoState = {
  code: string;
  valid: boolean;
  isFree: boolean;
  discountPercent: number;
  label: string;
  savings: string;
} | null;

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

function formatPrice(cents: number, currency: string) {
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export default function BasketClient({ stories }: { stories: BasketStory[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(stories.map(s => s.id)));
  const [promoInput, setPromoInput] = useState("");
  const [promoState, setPromoState] = useState<PromoState>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState<{ storyId: string; success: boolean }[]>([]);

  const selectedStories = stories.filter(s => selected.has(s.id));
  const currency = selectedStories[0]?.currency ?? "GBP";

  const subtotalCents = selectedStories.reduce((sum, s) => sum + s.estimatedPrice, 0);
  const discountCents = promoState?.isFree
    ? subtotalCents
    : promoState?.discountPercent
      ? Math.round(subtotalCents * promoState.discountPercent / 100)
      : 0;
  const totalCents = Math.max(0, subtotalCents - discountCents);
  const isFreeOrder = totalCents === 0 && selectedStories.length > 0;

  function toggleStory(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function validatePromo(code: string) {
    if (!code.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    try {
      // Validate against the first selected story's product type
      const firstStory = selectedStories[0];
      const res = await fetch(`/api/stories/${firstStory.id}/validate-promo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), productType: firstStory.productType }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setPromoError(data.error ?? "Invalid promo code");
        setPromoState(null);
      } else {
        setPromoState({
          code: data.code,
          valid: true,
          isFree: data.isFree,
          discountPercent: data.discountPercent ?? 0,
          label: data.label ?? code,
          savings: formatPrice(discountCents, currency),
        });
        setPromoError("");
      }
    } catch {
      setPromoError("Could not validate code");
    } finally {
      setPromoLoading(false);
    }
  }

  async function handleFreeCheckout() {
    if (!isFreeOrder || !promoState?.valid) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/basket/claim-free", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyIds: selectedStories.map(s => s.id),
          promoCode: promoState.code,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");

      // Mark complete-step for each successful story
      for (const result of data.results ?? []) {
        if (result.success) {
          await fetch(`/api/stories/${result.storyId}/complete-step`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: "pay" }),
          });
        }
      }

      setResults(data.results ?? []);
      setDone(true);
    } catch (err: any) {
      alert(err?.message ?? "Something went wrong");
    } finally {
      setProcessing(false);
    }
  }

  // ── Done state ──
  if (done) {
    const succeeded = results.filter(r => r.success);
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ fontFamily: FONT, background: "#F9F5FF" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-md bg-white rounded-[24px] p-8 text-center shadow-xl"
          style={{ border: "1.5px solid rgba(67,184,156,0.2)" }}
        >
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: "linear-gradient(135deg, #43B89C, #2FA482)", boxShadow: "0 6px 20px rgba(67,184,156,0.3)" }}
          >
            <Check className="w-8 h-8 text-white" />
          </motion.div>
          <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#2D2235" }}>
            {succeeded.length === 1 ? "Book Unlocked!" : `${succeeded.length} Books Unlocked!`}
          </h2>
          <p className="text-sm mb-6" style={{ color: "#7B6E90" }}>
            Illustrations are generating now. This usually takes a few minutes per book.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mb-8" style={{ background: "rgba(67,184,156,0.08)", color: "#2FA482" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
              <Loader2 className="w-3.5 h-3.5" />
            </motion.div>
            Generating illustrations…
          </div>
          <div className="space-y-2.5">
            {succeeded.map(r => {
              const story = stories.find(s => s.id === r.storyId);
              return (
                <Link
                  key={r.storyId}
                  href={`/stories/${r.storyId}/studio`}
                  className="flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all hover:-translate-y-[2px]"
                  style={{ background: "rgba(67,184,156,0.04)", border: "1px solid rgba(67,184,156,0.12)" }}
                >
                  <BookOpen className="w-4 h-4 flex-shrink-0" style={{ color: "#43B89C" }} />
                  <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: "#2D2235" }}>
                    {story?.title ?? r.storyId}
                  </span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "#A897BD" }} />
                </Link>
              );
            })}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Main basket view ──
  return (
    <div className="min-h-screen px-4 py-8" style={{ fontFamily: FONT, background: "#F9F5FF" }}>
      {/* Background blobs */}
      <div className="fixed inset-0 -z-10 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%),
          radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%),
          #F9F5FF
        `
      }} />

      <div className="max-w-[640px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={() => router.push("/projects")}
            className="w-9 h-9 rounded-[10px] border flex items-center justify-center transition hover:bg-white/60"
            style={{ border: "1.5px solid rgba(180,150,210,0.2)", color: "#6B5C80", background: "white" }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: "#2D2235", letterSpacing: "-0.03em" }}>
              Your Basket
            </h1>
            <p className="text-[12px]" style={{ color: "#A897BD" }}>
              {selectedStories.length} of {stories.length} {stories.length === 1 ? "story" : "stories"} selected
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Story cards */}
          {stories.map((story, i) => {
            const isSelected = selected.has(story.id);
            return (
              <motion.div
                key={story.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => toggleStory(story.id)}
                className="flex items-center gap-4 p-4 rounded-[18px] cursor-pointer transition-all"
                style={{
                  background: isSelected ? "white" : "rgba(255,255,255,0.5)",
                  border: isSelected ? "2px solid rgba(176,92,230,0.25)" : "2px solid rgba(180,150,210,0.1)",
                  boxShadow: isSelected ? "0 4px 20px rgba(176,92,230,0.08)" : "none",
                  opacity: isSelected ? 1 : 0.6,
                }}
              >
                {/* Cover thumbnail */}
                <div
                  className="w-16 h-10 rounded-xl overflow-hidden flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #E8D5FF, #FFD5E5)" }}
                >
                  {story.coverSpreadUrl && (
                    <img src={story.coverSpreadUrl} alt={story.title} className="w-full h-full object-cover" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate" style={{ color: "#2D2235" }}>{story.title}</p>
                  <p className="text-[11px]" style={{ color: "#A897BD" }}>
                    {story.readerName ? `For ${story.readerName}` : ""}
                    {story.readerName && story.length ? " · " : ""}
                    {story.length ? `${story.length} pages` : ""}
                    {" · "}
                    <span className="capitalize">{story.productType}</span>
                  </p>
                </div>

                {/* Price + checkbox */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[14px] font-extrabold" style={{ color: "#2D2235" }}>
                    {formatPrice(story.estimatedPrice, story.currency)}
                  </span>
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center transition-all"
                    style={{
                      background: isSelected ? "linear-gradient(135deg, #B05CE6, #D45DA0)" : "white",
                      border: isSelected ? "none" : "2px solid rgba(180,150,210,0.3)",
                    }}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Promo + Summary card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: stories.length * 0.05 + 0.1 }}
            className="rounded-[18px] overflow-hidden"
            style={{ background: "white", border: "1.5px solid rgba(180,150,210,0.12)", boxShadow: "0 4px 20px rgba(100,60,140,0.06)" }}
          >
            {/* Promo code */}
            <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(180,150,210,0.08)" }}>
              <AnimatePresence mode="wait">
                {promoState?.valid ? (
                  <motion.div
                    key="applied"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                    style={{ background: "rgba(67,184,156,0.06)", border: "1px solid rgba(67,184,156,0.15)" }}
                  >
                    <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#2FA482" }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-bold" style={{ color: "#2FA482" }}>{promoState.code}</span>
                      <span className="text-[11px] ml-1.5" style={{ color: "#7B6E90" }}>
                        {promoState.isFree ? "Free!" : `${promoState.discountPercent}% off`}
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPromoState(null); setPromoInput(""); setPromoOpen(false); }}
                      className="p-1 rounded-full"
                      style={{ background: "rgba(67,184,156,0.1)", border: "none", color: "#2FA482", cursor: "pointer" }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ) : promoOpen ? (
                  <motion.div key="input" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className="flex gap-2">
                      <input
                        value={promoInput}
                        onChange={e => setPromoInput(e.target.value.toUpperCase())}
                        placeholder="Enter promo code"
                        disabled={promoLoading}
                        className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none"
                        style={{
                          border: promoError ? "1.5px solid rgba(233,30,99,0.4)" : "1.5px solid rgba(180,150,210,0.2)",
                          background: "#FDFBFF",
                          color: "#2D2235",
                          fontFamily: FONT,
                        }}
                        onKeyDown={e => e.key === "Enter" && promoInput.trim() && validatePromo(promoInput)}
                      />
                      <button
                        onClick={() => promoInput.trim() && validatePromo(promoInput)}
                        disabled={!promoInput.trim() || promoLoading}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                        style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", border: "none", fontFamily: FONT, cursor: "pointer" }}
                      >
                        {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                    {promoError && <p className="text-[11px] mt-1.5 font-semibold" style={{ color: "#E91E63" }}>{promoError}</p>}
                  </motion.div>
                ) : (
                  <motion.button
                    key="link"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setPromoOpen(true)}
                    className="text-[12px] font-medium flex items-center gap-1.5"
                    style={{ color: "#A897BD", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}
                  >
                    <Tag className="w-3 h-3" /> Have a promo code?
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Totals */}
            <div className="px-5 py-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[13px]" style={{ color: "#7B6E90" }}>
                  Subtotal ({selectedStories.length} {selectedStories.length === 1 ? "book" : "books"})
                </span>
                <span className="text-[13px] font-semibold" style={{ color: "#2D2235" }}>
                  {formatPrice(subtotalCents, currency)}
                </span>
              </div>

              {discountCents > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-[13px]" style={{ color: "#2FA482" }}>Discount</span>
                  <span className="text-[13px] font-semibold" style={{ color: "#2FA482" }}>
                    −{formatPrice(discountCents, currency)}
                  </span>
                </div>
              )}

              <div
                className="flex justify-between items-center pt-2"
                style={{ borderTop: "1px solid rgba(180,150,210,0.1)" }}
              >
                <span className="text-base font-extrabold" style={{ color: "#2D2235" }}>Total</span>
                <span className="text-xl font-extrabold" style={{ color: "#2FA482" }}>
                  {isFreeOrder ? "FREE" : formatPrice(totalCents, currency)}
                </span>
              </div>
            </div>

            {/* CTA */}
            <div className="px-5 pb-5">
              {isFreeOrder ? (
                <button
                  onClick={handleFreeCheckout}
                  disabled={processing || selectedStories.length === 0}
                  className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #43B89C, #2FA482)",
                    boxShadow: "0 4px 20px rgba(67,184,156,0.3)",
                    border: "none",
                    fontFamily: FONT,
                  }}
                >
                  {processing ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Unlocking…</>
                  ) : (
                    <><Sparkles className="w-5 h-5" /> Unlock {selectedStories.length} {selectedStories.length === 1 ? "Book" : "Books"} Free</>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-center text-[12px]" style={{ color: "#A897BD" }}>
                    Apply a promo code above, or pay for each book individually.
                  </p>
                  <div className="space-y-2">
                    {selectedStories.map(story => (
                      <Link
                        key={story.id}
                        href={`/stories/${story.id}/checkout`}
                        className="flex items-center justify-between px-4 py-3 rounded-xl text-[13px] font-semibold transition-all hover:-translate-y-[1px]"
                        style={{
                          background: "rgba(176,92,230,0.04)",
                          border: "1.5px solid rgba(176,92,230,0.12)",
                          color: "#2D2235",
                        }}
                      >
                        <span className="truncate flex-1 mr-2">{story.title}</span>
                        <span className="flex items-center gap-1 flex-shrink-0" style={{ color: "#B05CE6" }}>
                          {formatPrice(story.estimatedPrice, story.currency)}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}