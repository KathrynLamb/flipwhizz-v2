// src/app/stories/[id]/print/PrintPage.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import {
  BookOpen, Loader2, Check, Truck, AlertCircle, X, Package,
  Download, Sparkles, Clock, Printer, ArrowUpRight, Lock, Gift, Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";
import type { StepKey } from "@/lib/storySteps";
import {
  CURRENCIES, formatPrice, getPriceCents, getUpgradePriceCents,
  type CurrencyCode, type ProductType,
} from "@/lib/pricing";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type Story = {
  id: string; projectId: string; title: string;
  coverSpreadUrl: string | null; pdfUrl: string | null;
  status: string | null; paymentStatus: string | null; completedSteps: string[];
};

type Order = {
  id: string; status: string; gelatoOrderId: string | null;
  gelatoStatus: string | null; createdAt: string | null;
};

type ShippingAddress = {
  firstName: string; lastName: string; addressLine1: string; addressLine2: string;
  city: string; postCode: string; countryIsoCode: string; email: string; phone: string;
};

type Props = {
  story: Story; order: Order | null; productType: string;
  initialShippingAddress: ShippingAddress | null;
  initialCurrency?: string;
};

type UpgradeTier = "print" | "gift";

type PromoState = {
  code: string; valid: boolean; label: string;
  discountPercent: number; isFree: boolean;
  discountedCents: number; savings: string;
} | null;

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

const EMPTY_ADDRESS: ShippingAddress = {
  firstName: "", lastName: "", addressLine1: "", addressLine2: "",
  city: "", postCode: "", countryIsoCode: "GB", email: "", phone: "",
};

const UPGRADE_TIER_DEFS: { key: UpgradeTier; label: string; icon: typeof Package; description: string }[] = [
  { key: "print", label: "Softcover Book", icon: Printer, description: "Premium softcover, delivered to your door" },
  { key: "gift", label: "Hardcover Gift Edition", icon: Gift, description: "Deluxe hardcover keepsake, gift-ready" },
];

/* -------------------------------------------------------------------------- */
/*                             HELPERS                                         */
/* -------------------------------------------------------------------------- */

function getProductLabel(type: string): string {
  switch (type) {
    case "digital": return "Digital PDF";
    case "print": return "Softcover Book";
    case "gift": return "Hardcover Gift Edition";
    default: return "Book";
  }
}

function getProductIcon(type: string) {
  switch (type) {
    case "digital": return Download;
    case "gift": return Sparkles;
    default: return BookOpen;
  }
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function PrintPage({ story, order, productType: initialProductType, initialShippingAddress, initialCurrency }: Props) {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(order);
  const [productType, setProductType] = useState(initialProductType);
  const [currency, setCurrency] = useState<CurrencyCode>(
    (initialCurrency && initialCurrency in CURRENCIES ? initialCurrency : "GBP") as CurrencyCode
  );
  const [flowStatus, setFlowStatus] = useState<
    "idle" | "address" | "processing" | "success" | "error" | "upgrade"
  >("idle");
  const [processingStep, setProcessingStep] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [savedAddress, setSavedAddress] = useState<ShippingAddress | null>(initialShippingAddress ?? null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isExportingPrint, setIsExportingPrint] = useState(false);

  // Upgrade state
  const [selectedUpgradeTier, setSelectedUpgradeTier] = useState<UpgradeTier>("print");
  const [upgradeProcessing, setUpgradeProcessing] = useState(false);
  const [upgradeSavingProduct, setUpgradeSavingProduct] = useState(false);

  const hasOrder = !!currentOrder;
  const isDigitalOnly = productType === "digital";
  const isPhysical = productType === "print" || productType === "gift";
  const ProductIcon = getProductIcon(productType);

  const saveProductSelection = useCallback(async (newType: string) => {
    setUpgradeSavingProduct(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/product`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productType: newType, currency }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save product selection");
      }
    } finally {
      setUpgradeSavingProduct(false);
    }
  }, [story.id, currency]);

  /* ----------------------------- DOWNLOAD PDF ------------------------------ */
  async function handleDownloadPDF() {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/export-home-print`, { method: "POST" });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "Failed to generate PDF"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (story.title || "FlipWhizz-Book").replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
      a.download = `${safeName}-print-at-home.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to download PDF"); }
    finally { setIsDownloading(false); }
  }

  /* ----------------------------- PRINT AT HOME ----------------------------- */
  async function handlePrintAtHome() {
    if (isExportingPrint) return;
    setIsExportingPrint(true);
    try {
      const res = await fetch(`/api/stories/${story.id}/export-home-print`, { method: "POST" });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || "Failed to generate PDF"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = (story.title || "FlipWhizz-Book").replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
      a.download = `${safeName}-print-at-home.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert(err instanceof Error ? err.message : "Failed to download PDF"); }
    finally { setIsExportingPrint(false); }
  }

  /* ----------------------------- ORDER FLOW -------------------------------- */
  async function handleOrder(address: ShippingAddress) {
    setSavedAddress(address);
    setFlowStatus("processing");
    try {
      setProcessingStep("Preparing your book for print…");
      const exportRes = await fetch(`/api/stories/${story.id}/export-complete`, { method: "POST" });
      if (!exportRes.ok) { const data = await exportRes.json().catch(() => ({})); throw new Error(data.error || "Failed to prepare PDF"); }
      setProcessingStep("Placing your order…");
      const orderRes = await fetch(`/api/stories/${story.id}/order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: address }),
      });
      if (!orderRes.ok) { const data = await orderRes.json().catch(() => ({})); throw new Error(data.error || "Failed to place order"); }
      const orderData = await orderRes.json();
      setCurrentOrder({ id: orderData.orderId ?? orderData.id ?? "", status: "submitted", gelatoOrderId: orderData.gelatoOrderId ?? null, gelatoStatus: orderData.gelatoStatus ?? "submitted", createdAt: new Date().toISOString() });
      setFlowStatus("success");
    } catch (err) { setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred"); setFlowStatus("error"); }
  }

  function handleRetry() { if (savedAddress) handleOrder(savedAddress); else setFlowStatus("address"); }

  function handleUpgradeSuccess() { setProductType(selectedUpgradeTier); setFlowStatus("idle"); }

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */
  return (
    <div className="min-h-screen relative" style={{ fontFamily: FONT }}>
      <div className="fixed inset-0 -z-10" style={{ background: `radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%), #F9F5FF` }}>
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
      </div>

      <UnifiedStoryHeader storyId={story.id} title={story.title || "Print"} currentStep={"print" as StepKey} completedSteps={(story.completedSteps ?? []) as StepKey[]} paymentStatus={story.paymentStatus} coverSpreadUrl={story.coverSpreadUrl} hasPages storyConfirmed />

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {story.coverSpreadUrl && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="overflow-hidden rounded-[22px]" style={{ boxShadow: "0 12px 48px rgba(100,60,140,0.15), 0 2px 8px rgba(100,60,140,0.08)", border: "1px solid rgba(180,150,210,0.1)" }}>
              <img src={story.coverSpreadUrl} alt="Your book cover" className="w-full" draggable={false} />
            </div>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: "rgba(199,125,255,0.1)", color: "#9B59D0" }}>
            <ProductIcon className="w-3.5 h-3.5" />
            {getProductLabel(productType)}
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: "#2D2235", letterSpacing: "-0.03em" }}>
            {hasOrder ? "Your order" : isDigitalOnly ? "Download your book" : "Order your book"}
          </h2>
          <p className="text-sm max-w-sm mx-auto leading-relaxed" style={{ color: "#7B6E90" }}>
            {hasOrder ? "Your book is on its way to being printed and delivered."
              : isDigitalOnly ? "Your print-at-home PDF is ready. Download it below and follow the simple instructions to make your book."
              : "Choose to order a professionally printed copy, or download a print-at-home PDF."}
          </p>
        </motion.div>

        {hasOrder && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
            <OrderStatusCard order={currentOrder!} />
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-3">
          {isDigitalOnly && (
            <button onClick={handleDownloadPDF} disabled={isDownloading} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 20px rgba(176,92,230,0.25)", border: "none", fontFamily: FONT }}>
              {isDownloading ? (<><Loader2 className="w-5 h-5 animate-spin" />Preparing PDF…</>) : (<><Download className="w-5 h-5" />Download Print-at-Home PDF</>)}
            </button>
          )}

          {isDigitalOnly && (
            <button onClick={() => setFlowStatus("upgrade")} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-bold transition-all active:scale-[0.98]" style={{ background: "rgba(176,92,230,0.06)", color: "#8B5CB8", border: "1.5px solid rgba(176,92,230,0.18)", fontFamily: FONT }}>
              <Package className="w-5 h-5" />Upgrade to Printed Book<ArrowUpRight className="w-4 h-4 opacity-60" />
            </button>
          )}

          {isPhysical && (
            <button onClick={() => setFlowStatus("address")} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-bold text-white transition-all active:scale-[0.98]" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", boxShadow: "0 4px 20px rgba(176,92,230,0.25)", border: "none", fontFamily: FONT }}>
              <Package className="w-5 h-5" />{hasOrder ? "Order Another Copy" : "Order Book"}
            </button>
          )}

          {isPhysical && (
            <button onClick={handlePrintAtHome} disabled={isExportingPrint} className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50" style={{ background: "rgba(180,150,210,0.08)", color: "#6B5C80", border: "1px solid rgba(180,150,210,0.15)", fontFamily: FONT }}>
              {isExportingPrint ? (<><Loader2 className="w-5 h-5 animate-spin" />Preparing PDF…</>) : (<><Printer className="w-5 h-5" />Print at Home (PDF)</>)}
            </button>
          )}
        </motion.div>
      </main>

      <AnimatePresence>
        {flowStatus === "upgrade" && (
          <UpgradeSheet storyId={story.id} selectedTier={selectedUpgradeTier} onSelectTier={setSelectedUpgradeTier} onClose={() => setFlowStatus("idle")} onSuccess={handleUpgradeSuccess} saveProductSelection={saveProductSelection} processing={upgradeProcessing} setProcessing={setUpgradeProcessing} savingProduct={upgradeSavingProduct} currency={currency} />
        )}
      </AnimatePresence>
      <AnimatePresence>{flowStatus === "address" && <AddressSheet onClose={() => setFlowStatus("idle")} onSubmit={handleOrder} isSubmitting={false} initialAddress={initialShippingAddress} />}</AnimatePresence>
      <AnimatePresence>{flowStatus === "processing" && <ProcessingOverlay step={processingStep} />}</AnimatePresence>
      <AnimatePresence>{flowStatus === "success" && <SuccessOverlay onDone={() => setFlowStatus("idle")} />}</AnimatePresence>
      <AnimatePresence>{flowStatus === "error" && <ErrorOverlay message={errorMessage} onRetry={handleRetry} onClose={() => setFlowStatus("idle")} />}</AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  UPGRADE SHEET                                                              */
/* -------------------------------------------------------------------------- */

function UpgradeSheet({ storyId, selectedTier, onSelectTier, onClose, onSuccess, saveProductSelection, processing, setProcessing, savingProduct, currency }: {
  storyId: string; selectedTier: UpgradeTier; onSelectTier: (t: UpgradeTier) => void;
  onClose: () => void; onSuccess: () => void;
  saveProductSelection: (type: string) => Promise<void>;
  processing: boolean; setProcessing: (v: boolean) => void; savingProduct: boolean;
  currency: CurrencyCode;
}) {
  const [promoInput, setPromoInput] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoState, setPromoState] = useState<PromoState>(null);
  const [promoError, setPromoError] = useState("");
  const [promoOpen, setPromoOpen] = useState(false);

  const upgradeCents = getUpgradePriceCents("digital", selectedTier, currency);
  const fullCents = getPriceCents(selectedTier, currency);
  const digitalCents = getPriceCents("digital", currency);

  // Apply promo to upgrade price
  const finalCents = promoState?.valid ? promoState.discountedCents : upgradeCents;

  async function validatePromo(code: string) {
    setPromoLoading(true); setPromoError("");
    try {
      // Validate against the UPGRADE price, not the full price
      // We use the target product type for discount resolution
      const res = await fetch("/api/promo/validate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, productType: selectedTier, currency }),
      });
      const data = await res.json();
      if (data.valid) {
        // Recalculate discount against upgrade price, not full price
        const discountPercent = data.discountPercent;
        const isFree = data.isFree;
        const discounted = isFree ? 0 : Math.round(upgradeCents * (1 - discountPercent / 100));
        setPromoState({
          code: data.code, valid: true, label: data.label,
          discountPercent, isFree,
          discountedCents: discounted,
          savings: formatPrice(upgradeCents - discounted, currency),
        });
      } else {
        setPromoState(null); setPromoError(data.reason || "Invalid code");
      }
    } catch { setPromoError("Could not validate code"); }
    finally { setPromoLoading(false); }
  }

  function clearPromo() { setPromoState(null); setPromoInput(""); setPromoError(""); }

  // Re-validate promo when tier changes
  useEffect(() => {
    if (promoState?.valid) validatePromo(promoState.code);
  }, [selectedTier]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(20,8,40,0.6)", backdropFilter: "blur(6px)" }} onClick={(e) => e.target === e.currentTarget && !processing && onClose()}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }} className="w-full max-h-[92vh] overflow-y-auto" style={{ background: "white", borderRadius: "24px 24px 0 0", fontFamily: FONT }}>
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-white z-10" style={{ borderRadius: "24px 24px 0 0" }}>
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />
        </div>

        <div className="flex items-center justify-between px-6 py-4 sticky top-5 bg-white z-10" style={{ borderBottom: "1px solid rgba(180,150,210,0.1)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #B05CE6, #D946EF)" }}>
              <ArrowUpRight className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold" style={{ color: "#2D2235" }}>Upgrade to Print</h3>
              <p className="text-[11px]" style={{ color: "#8B7BA0" }}>Your digital purchase is discounted</p>
            </div>
          </div>
          <button onClick={onClose} disabled={processing} className="p-1.5 rounded-full disabled:opacity-30" style={{ background: "rgba(180,150,210,0.08)", border: "none", color: "#8B7BA0" }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tier selection */}
        <div className="px-6 pt-5 pb-2 space-y-2.5">
          {UPGRADE_TIER_DEFS.map((t) => {
            const isSelected = t.key === selectedTier;
            const TierIcon = t.icon;
            const tierUpgradeCents = getUpgradePriceCents("digital", t.key, currency);
            const tierFullCents = getPriceCents(t.key, currency);
            return (
              <button key={t.key} onClick={() => !processing && onSelectTier(t.key)} disabled={processing} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all text-left" style={{ background: isSelected ? "rgba(176,92,230,0.04)" : "white", border: isSelected ? "2px solid #B05CE6" : "2px solid rgba(180,150,210,0.15)", cursor: processing ? "not-allowed" : "pointer", fontFamily: FONT }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isSelected ? "linear-gradient(135deg, #B05CE6, #D45DA0)" : "rgba(199,125,255,0.08)", color: isSelected ? "white" : "#9B59D0" }}>
                  <TierIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[14px] font-bold block" style={{ color: "#2D2235" }}>{t.label}</span>
                  <span className="text-[12px]" style={{ color: "#7B6E90" }}>{t.description}</span>
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-lg font-extrabold" style={{ color: "#2D2235" }}>{formatPrice(tierUpgradeCents, currency)}</span>
                  <span className="text-[10px] line-through" style={{ color: "#A897BD" }}>{formatPrice(tierFullCents, currency)}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Price breakdown */}
        <div className="mx-6 mt-3 mb-1 rounded-xl px-4 py-3" style={{ background: "rgba(67,184,156,0.06)", border: "1px solid rgba(67,184,156,0.12)" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold" style={{ color: "#2D2235" }}>Upgrade price</p>
              <p className="text-[11px]" style={{ color: "#7B6E90" }}>{formatPrice(fullCents, currency)} − {formatPrice(digitalCents, currency)} digital credit</p>
            </div>
            <div className="text-right">
              {promoState?.valid && <span className="text-xs line-through block" style={{ color: "#A897BD" }}>{formatPrice(upgradeCents, currency)}</span>}
              <p className="text-xl font-extrabold" style={{ color: "#2FA482" }}>{formatPrice(finalCents, currency)}</p>
            </div>
          </div>
          {promoState?.valid && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Tag className="w-3 h-3" style={{ color: "#2FA482" }} />
              <span className="text-[11px] font-semibold" style={{ color: "#2FA482" }}>{promoState.label} — saves {promoState.savings}</span>
            </div>
          )}
        </div>

        {/* Promo code */}
        <div className="px-6 pt-3 pb-1">
          {promoState?.valid ? (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: "rgba(67,184,156,0.06)", border: "1px solid rgba(67,184,156,0.15)" }}>
              <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#2FA482" }} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold" style={{ color: "#2FA482" }}>{promoState.code}</span>
                <span className="text-[11px] ml-1.5" style={{ color: "#7B6E90" }}>{promoState.isFree ? "Free!" : `${promoState.discountPercent}% off`}</span>
              </div>
              <button onClick={clearPromo} disabled={processing} className="p-1 rounded-full" style={{ background: "rgba(67,184,156,0.1)", border: "none", color: "#2FA482", cursor: "pointer" }}><X className="w-3 h-3" /></button>
            </div>
          ) : !promoOpen ? (
            <button onClick={() => setPromoOpen(true)} className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: "#A897BD", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              <Tag className="w-3 h-3" /> Have a promo code?
            </button>
          ) : (
            <div className="flex gap-2">
              <input value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} placeholder="Enter code" disabled={promoLoading || processing} className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none" style={{ border: promoError ? "1.5px solid rgba(233,30,99,0.4)" : "1.5px solid rgba(180,150,210,0.2)", background: "#FDFBFF", color: "#2D2235", fontFamily: "inherit" }} onKeyDown={(e) => e.key === "Enter" && promoInput.trim() && validatePromo(promoInput)} />
              <button onClick={() => validatePromo(promoInput)} disabled={!promoInput.trim() || promoLoading || processing} className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50" style={{ background: "linear-gradient(135deg, #B05CE6, #D45DA0)", border: "none", fontFamily: "inherit", cursor: "pointer" }}>
                {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
              </button>
            </div>
          )}
          {promoError && <p className="text-[11px] mt-1.5 font-semibold" style={{ color: "#E91E63" }}>{promoError}</p>}
        </div>

        {/* PayPal */}
        <div className="px-6 py-5">
          {(processing || savingProduct) && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#B05CE6" }} />
              <span className="text-sm font-semibold" style={{ color: "#6B5C80" }}>{savingProduct ? "Saving upgrade selection…" : "Processing payment…"}</span>
            </div>
          )}
          <div style={{ display: processing || savingProduct ? "none" : "block" }}>
            <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!, currency, intent: "capture" }}>
              <PayPalButtons
                key={`${selectedTier}-${currency}-${promoState?.code ?? "none"}`}
                style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 48 }}
                createOrder={async () => {
                  await saveProductSelection(selectedTier);
                  const res = await fetch("/api/paypal/order", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      storyId, price: (finalCents / 100).toFixed(2), currency,
                      upgradeFrom: "digital",
                      promoCode: promoState?.valid ? promoState.code : undefined,
                    }),
                  });
                  const data = await res.json();
                  if (!res.ok || !data.orderID) throw new Error(data?.error || "Failed to create upgrade order");
                  return data.orderID;
                }}
                onApprove={async (data) => {
                  setProcessing(true);
                  try {
                    const res = await fetch("/api/paypal/capture", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderID: data.orderID }) });
                    const result = await res.json();
                    if (!res.ok || !result.success) throw new Error(result?.error || "Payment capture failed.");
                    onSuccess();
                  } catch (err: any) { alert(err?.message || "Payment processed but something went wrong."); }
                  finally { setProcessing(false); }
                }}
                onError={(err) => { console.error("PayPal upgrade error:", err); setProcessing(false); saveProductSelection("digital").catch(() => {}); alert("Payment failed. Please try again."); }}
                onCancel={() => { setProcessing(false); saveProductSelection("digital").catch(() => {}); }}
              />
            </PayPalScriptProvider>
          </div>
          <div className="flex justify-center gap-3 mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: "rgba(180,150,210,0.06)", color: "#8B7BA0", border: "1px solid rgba(180,150,210,0.1)" }}>
              <Lock className="w-3 h-3" /> Secure payment
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ORDER STATUS CARD                                                          */
/* -------------------------------------------------------------------------- */

function OrderStatusCard({ order }: { order: Order }) {
  const statusConfig = getStatusConfig(order.gelatoStatus ?? order.status);
  return (
    <div className="rounded-[22px] overflow-hidden" style={{ background: "white", border: "1px solid rgba(180,150,210,0.12)", boxShadow: "0 2px 12px rgba(100,60,140,0.06)" }}>
      <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: "1px solid rgba(180,150,210,0.08)", background: "rgba(249,245,255,0.5)" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: statusConfig.iconBg }}><statusConfig.icon className="w-4 h-4" style={{ color: statusConfig.iconColor }} /></div>
        <div className="flex-1"><p className="text-sm font-bold" style={{ color: "#2D2235" }}>{statusConfig.title}</p><p className="text-[11px]" style={{ color: "#A897BD" }}>{statusConfig.description}</p></div>
      </div>
      <div className="px-5 py-4 space-y-3">
        <div className="flex items-center gap-3"><StatusDot active done /><span className="text-xs font-semibold" style={{ color: "#2D2235" }}>Order placed</span></div>
        <div className="flex items-center gap-3"><StatusDot active={["processing","shipped","delivered"].includes(order.gelatoStatus??"")} done={["shipped","delivered"].includes(order.gelatoStatus??"")} /><span className="text-xs font-semibold" style={{ color: ["processing","shipped","delivered"].includes(order.gelatoStatus??"") ? "#2D2235" : "#C4B5D4" }}>Printing</span></div>
        <div className="flex items-center gap-3"><StatusDot active={["shipped","delivered"].includes(order.gelatoStatus??"")} done={order.gelatoStatus==="delivered"} /><span className="text-xs font-semibold" style={{ color: ["shipped","delivered"].includes(order.gelatoStatus??"") ? "#2D2235" : "#C4B5D4" }}>Shipped</span></div>
        {order.gelatoOrderId && <p className="text-[11px] pt-1" style={{ color: "#A897BD" }}>Order ref: {order.gelatoOrderId}</p>}
      </div>
    </div>
  );
}

function StatusDot({ active, done }: { active: boolean; done: boolean }) {
  return <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: done ? "rgba(67,184,156,0.15)" : active ? "rgba(176,92,230,0.12)" : "rgba(180,150,210,0.08)", border: done ? "2px solid #43B89C" : active ? "2px solid #B05CE6" : "2px solid rgba(180,150,210,0.15)" }}>
    {done && <Check className="w-3 h-3" style={{ color: "#2FA482" }} />}
    {active && !done && <div className="w-2 h-2 rounded-full" style={{ background: "#B05CE6" }} />}
  </div>;
}

function getStatusConfig(status: string) {
  switch (status) {
    case "shipped": return { icon: Truck, iconBg: "rgba(67,184,156,0.1)", iconColor: "#2FA482", title: "On its way!", description: "Your book has been shipped" };
    case "delivered": return { icon: Check, iconBg: "rgba(67,184,156,0.1)", iconColor: "#2FA482", title: "Delivered", description: "Your book has arrived" };
    case "processing": return { icon: Clock, iconBg: "rgba(176,92,230,0.1)", iconColor: "#B05CE6", title: "Being printed", description: "Your book is at the printers" };
    case "error": case "failed": return { icon: AlertCircle, iconBg: "rgba(233,30,99,0.08)", iconColor: "#E91E63", title: "Issue with order", description: "Something went wrong — please try again" };
    default: return { icon: Package, iconBg: "rgba(176,92,230,0.1)", iconColor: "#B05CE6", title: "Order submitted", description: "We're preparing your book" };
  }
}

/* -------------------------------------------------------------------------- */
/*  ADDRESS SHEET                                                              */
/* -------------------------------------------------------------------------- */

function AddressSheet({ onClose, onSubmit, isSubmitting, initialAddress }: { onClose: () => void; onSubmit: (address: ShippingAddress) => void; isSubmitting: boolean; initialAddress?: ShippingAddress | null }) {
  const [address, setAddress] = useState<ShippingAddress>(initialAddress ?? EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});
  function update(field: keyof ShippingAddress, value: string) { setAddress((prev) => ({ ...prev, [field]: value })); if (errors[field]) setErrors((prev) => { const next = { ...prev }; delete next[field]; return next; }); }
  function validate(): boolean {
    const e: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!address.firstName.trim()) e.firstName = "Required"; if (!address.lastName.trim()) e.lastName = "Required";
    if (!address.addressLine1.trim()) e.addressLine1 = "Required"; if (!address.city.trim()) e.city = "Required";
    if (!address.postCode.trim()) e.postCode = "Required"; if (!address.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) e.email = "Invalid email";
    setErrors(e); return Object.keys(e).length === 0;
  }
  function handleSubmit() { if (validate()) onSubmit(address); }

  return (
    <div className="fixed inset-0 z-50 flex items-end" style={{ background: "rgba(20,8,40,0.6)", backdropFilter: "blur(6px)" }} onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}>
      <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }} className="w-full max-h-[92vh] overflow-y-auto" style={{ background: "white", borderRadius: "24px 24px 0 0", fontFamily: FONT }}>
        <div className="flex justify-center pt-3 pb-1 sticky top-0 bg-white z-10" style={{ borderRadius: "24px 24px 0 0" }}><div className="w-10 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} /></div>
        <div className="flex items-center justify-between px-6 py-4 sticky top-5 bg-white z-10" style={{ borderBottom: "1px solid rgba(180,150,210,0.1)" }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #B05CE6, #D946EF)" }}><Truck className="w-4 h-4 text-white" /></div>
            <div><h3 className="text-base font-extrabold" style={{ color: "#2D2235" }}>Shipping Address</h3><p className="text-[11px]" style={{ color: "#8B7BA0" }}>Where should we send your book?</p></div>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="p-1.5 rounded-full disabled:opacity-30" style={{ background: "rgba(180,150,210,0.08)", border: "none", color: "#8B7BA0" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex gap-3"><InputField label="First name" value={address.firstName} onChange={(v) => update("firstName", v)} error={errors.firstName} disabled={isSubmitting} /><InputField label="Last name" value={address.lastName} onChange={(v) => update("lastName", v)} error={errors.lastName} disabled={isSubmitting} /></div>
          <InputField label="Address line 1" value={address.addressLine1} onChange={(v) => update("addressLine1", v)} error={errors.addressLine1} disabled={isSubmitting} />
          <InputField label="Address line 2 (optional)" value={address.addressLine2} onChange={(v) => update("addressLine2", v)} disabled={isSubmitting} />
          <div className="flex gap-3"><InputField label="City" value={address.city} onChange={(v) => update("city", v)} error={errors.city} disabled={isSubmitting} /><InputField label="Postcode" value={address.postCode} onChange={(v) => update("postCode", v)} error={errors.postCode} disabled={isSubmitting} /></div>
          <InputField label="Email" value={address.email} onChange={(v) => update("email", v)} error={errors.email} disabled={isSubmitting} type="email" />
          <InputField label="Phone (optional)" value={address.phone} onChange={(v) => update("phone", v)} disabled={isSubmitting} type="tel" />
        </div>
        <div className="px-6 pb-10 pt-2">
          <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform" style={{ background: "linear-gradient(135deg, #B05CE6, #E91E8C)", boxShadow: "0 4px 20px rgba(176,92,230,0.3)", border: "none", fontFamily: FONT }}>
            {isSubmitting ? (<><Loader2 className="w-5 h-5 animate-spin" />Creating your book…</>) : (<><BookOpen className="w-5 h-5" />Place Order</>)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InputField({ label, value, onChange, error, disabled, type = "text" }: { label: string; value: string; onChange: (v: string) => void; error?: string; disabled?: boolean; type?: string }) {
  return (
    <div className="flex-1">
      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: error ? "#E91E63" : "#8B7BA0", fontFamily: FONT }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="w-full rounded-xl px-3.5 py-3 text-sm outline-none transition-all disabled:opacity-50" style={{ border: error ? "1.5px solid rgba(233,30,99,0.4)" : "1.5px solid rgba(180,150,210,0.2)", background: error ? "rgba(233,30,99,0.03)" : "#FDFBFF", color: "#2D2235", fontFamily: FONT }} />
      {error && <p className="text-[10px] mt-1 font-semibold" style={{ color: "#E91E63" }}>{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  OVERLAYS                                                                   */
/* -------------------------------------------------------------------------- */

function ProcessingOverlay({ step }: { step: string }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(20,8,40,0.7)", backdropFilter: "blur(8px)" }}><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-8 p-8 rounded-3xl text-center" style={{ background: "white", maxWidth: 340 }}><div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: "linear-gradient(135deg, rgba(176,92,230,0.12), rgba(233,30,140,0.08))" }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: "#B05CE6" }} /></div><h3 className="text-lg font-extrabold mb-2" style={{ color: "#2D2235", fontFamily: FONT }}>Creating your book</h3><p className="text-sm leading-relaxed" style={{ color: "#8B7BA0", fontFamily: FONT }}>{step}</p></motion.div></div>;
}

function SuccessOverlay({ onDone }: { onDone: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(20,8,40,0.7)", backdropFilter: "blur(8px)" }}><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-8 p-8 rounded-3xl text-center" style={{ background: "white", maxWidth: 340 }}><div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(67,184,156,0.12)" }}><Check className="w-8 h-8" style={{ color: "#2FA482" }} /></div><h3 className="text-lg font-extrabold mb-2" style={{ color: "#2D2235", fontFamily: FONT }}>Order placed!</h3><p className="text-sm leading-relaxed mb-6" style={{ color: "#8B7BA0", fontFamily: FONT }}>Your book is being printed and will be shipped to you soon.</p><button onClick={onDone} className="w-full py-3.5 rounded-2xl text-sm font-bold text-white active:scale-[0.98] transition-transform" style={{ background: "linear-gradient(135deg, #B05CE6, #E91E8C)", boxShadow: "0 4px 16px rgba(176,92,230,0.3)", border: "none", fontFamily: FONT }}>Done</button></motion.div></div>;
}

function ErrorOverlay({ message, onRetry, onClose }: { message: string; onRetry: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(20,8,40,0.7)", backdropFilter: "blur(8px)" }}><motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-8 p-8 rounded-3xl text-center" style={{ background: "white", maxWidth: 340 }}><div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(233,30,99,0.08)" }}><AlertCircle className="w-8 h-8" style={{ color: "#E91E63" }} /></div><h3 className="text-lg font-extrabold mb-2" style={{ color: "#2D2235", fontFamily: FONT }}>Something went wrong</h3><p className="text-sm leading-relaxed mb-6" style={{ color: "#8B7BA0", fontFamily: FONT }}>{message}</p><div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3.5 rounded-2xl text-sm font-semibold" style={{ background: "rgba(180,150,210,0.08)", color: "#6B5C80", border: "none", fontFamily: FONT }}>Cancel</button><button onClick={onRetry} className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #B05CE6, #E91E8C)", border: "none", fontFamily: FONT }}>Try Again</button></div></motion.div></div>;
}