// src/app/stories/[id]/print/PrintPage.tsx
"use client";

import { useState } from "react";
import {
  BookOpen,
  Loader2,
  Check,
  Truck,
  AlertCircle,
  X,
  Package,
  Download,
  Sparkles,
  Clock,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import UnifiedStoryHeader from "@/app/stories/components/StoryHeader";
import type { StepKey } from "@/lib/storySteps";

/* -------------------------------------------------------------------------- */
/*                                   TYPES                                    */
/* -------------------------------------------------------------------------- */

type Story = {
  id: string;
  projectId: string;
  title: string;
  coverSpreadUrl: string | null;
  pdfUrl: string | null;
  status: string | null;
  paymentStatus: string | null;
  completedSteps: string[];
};

type Order = {
  id: string;
  status: string;
  gelatoOrderId: string | null;
  gelatoStatus: string | null;
  createdAt: string | null;
};

type ShippingAddress = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postCode: string;
  countryIsoCode: string;
  email: string;
  phone: string;
};

type Props = {
  story: Story;
  order: Order | null;
  productType: string;
};

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

const EMPTY_ADDRESS: ShippingAddress = {
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postCode: "",
  countryIsoCode: "GB",
  email: "",
  phone: "",
};

/* -------------------------------------------------------------------------- */
/*                             PRODUCT LABELS                                 */
/* -------------------------------------------------------------------------- */

function getProductLabel(type: string): string {
  switch (type) {
    case "digital":
      return "Digital PDF";
    case "print":
      return "Softcover Book";
    case "gift":
      return "Hardcover Gift Edition";
    default:
      return "Book";
  }
}

function getProductIcon(type: string) {
  switch (type) {
    case "digital":
      return Download;
    case "gift":
      return Sparkles;
    default:
      return BookOpen;
  }
}

/* -------------------------------------------------------------------------- */
/*                              MAIN COMPONENT                                */
/* -------------------------------------------------------------------------- */

export default function PrintPage({ story, order, productType }: Props) {
  const [currentOrder, setCurrentOrder] = useState<Order | null>(order);
  const [flowStatus, setFlowStatus] = useState<
    "idle" | "address" | "processing" | "success" | "error"
  >(order ? "idle" : "idle");
  const [processingStep, setProcessingStep] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [savedAddress, setSavedAddress] = useState<ShippingAddress | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const hasOrder = !!currentOrder;
  const isDigitalOnly = productType === "digital";
  const ProductIcon = getProductIcon(productType);

  /* ----------------------------- ORDER FLOW ------------------------------ */

  async function handleOrder(address: ShippingAddress) {
    setSavedAddress(address);
    setFlowStatus("processing");

    try {
      // Step 1: Export PDF
      setProcessingStep("Preparing your book for print…");
      const exportRes = await fetch(
        `/api/stories/${story.id}/export-complete`,
        { method: "POST" }
      );

      if (!exportRes.ok) {
        const data = await exportRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to prepare PDF");
      }

      // Step 2: Place Gelato order
      setProcessingStep("Placing your order…");
      const orderRes = await fetch(`/api/stories/${story.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: address }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to place order");
      }

      const orderData = await orderRes.json();
      setCurrentOrder({
        id: orderData.orderId ?? orderData.id ?? "",
        status: "submitted",
        gelatoOrderId: orderData.gelatoOrderId ?? null,
        gelatoStatus: orderData.gelatoStatus ?? "submitted",
        createdAt: new Date().toISOString(),
      });

      setFlowStatus("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setFlowStatus("error");
    }
  }

  async function handleExportPDF() {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const res = await fetch(`/api/stories/${story.id}/export-complete`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to export");
      window.open(data.url, "_blank");
    } catch {
      alert("Failed to export PDF");
    } finally {
      setIsExporting(false);
    }
  }

  function handleRetry() {
    if (savedAddress) {
      handleOrder(savedAddress);
    } else {
      setFlowStatus("address");
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                   RENDER                                   */
  /* -------------------------------------------------------------------------- */

  return (
    <div
      className="min-h-screen relative"
      style={{ fontFamily: FONT }}
    >
      {/* ── Background ──────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%),
            #F9F5FF
          `,
        }}
      >
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <UnifiedStoryHeader
        storyId={story.id}
        title={story.title || "Print"}
        currentStep={"print" as StepKey}
        completedSteps={(story.completedSteps ?? []) as StepKey[]}
        paymentStatus={story.paymentStatus}
        coverSpreadUrl={story.coverSpreadUrl}
      />

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ── Cover Preview ─────────────────────────────────────────────── */}
        {story.coverSpreadUrl && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div
              className="overflow-hidden rounded-[22px]"
              style={{
                boxShadow:
                  "0 12px 48px rgba(100,60,140,0.15), 0 2px 8px rgba(100,60,140,0.08)",
                border: "1px solid rgba(180,150,210,0.1)",
              }}
            >
              <img
                src={story.coverSpreadUrl}
                alt="Your book cover"
                className="w-full"
                draggable={false}
              />
            </div>
          </motion.div>
        )}

        {/* ── Product Badge ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center mb-6"
        >
          <div
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3"
            style={{
              background: "rgba(199,125,255,0.1)",
              color: "#9B59D0",
            }}
          >
            <ProductIcon className="w-3.5 h-3.5" />
            {getProductLabel(productType)}
          </div>
          <h2
            className="text-2xl sm:text-3xl font-extrabold mb-2"
            style={{ color: "#2D2235", letterSpacing: "-0.03em" }}
          >
            {hasOrder ? "Your order" : "Order your book"}
          </h2>
          <p
            className="text-sm max-w-sm mx-auto leading-relaxed"
            style={{ color: "#7B6E90" }}
          >
            {hasOrder
              ? "Your book is on its way to being printed and delivered."
              : isDigitalOnly
                ? "Download your print-ready PDF below."
                : "Add your shipping details and we'll print and ship your book."}
          </p>
        </motion.div>

        {/* ── Order Status (if order exists) ─────────────────────────────── */}
        {hasOrder && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-6"
          >
            <OrderStatusCard order={currentOrder!} />
          </motion.div>
        )}

        {/* ── Action Cards ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-3"
        >
          {/* Order / Reorder button (print products) */}
          {!isDigitalOnly && (
            <button
              onClick={() => setFlowStatus("address")}
              disabled={false}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-bold text-white transition-all active:scale-[0.98]"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
                boxShadow: "0 4px 20px rgba(176,92,230,0.25)",
                border: "none",
                fontFamily: FONT,
              }}
            >
              <Package className="w-5 h-5" />
              {hasOrder ? "Order Another Copy" : "Order Book"}
            </button>
          )}

          {/* Download PDF */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl text-base font-bold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{
              background: isDigitalOnly
                ? "linear-gradient(135deg, #B05CE6, #D45DA0)"
                : "rgba(180,150,210,0.08)",
              color: isDigitalOnly ? "white" : "#6B5C80",
              boxShadow: isDigitalOnly
                ? "0 4px 20px rgba(176,92,230,0.25)"
                : "none",
              border: isDigitalOnly
                ? "none"
                : "1px solid rgba(180,150,210,0.15)",
              fontFamily: FONT,
            }}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Preparing PDF…
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download PDF
              </>
            )}
          </button>
        </motion.div>
      </main>

      {/* ── Overlays ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {flowStatus === "address" && (
          <AddressSheet
            onClose={() => setFlowStatus("idle")}
            onSubmit={handleOrder}
            isSubmitting={false}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flowStatus === "processing" && (
          <ProcessingOverlay step={processingStep} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flowStatus === "success" && (
          <SuccessOverlay onDone={() => setFlowStatus("idle")} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flowStatus === "error" && (
          <ErrorOverlay
            message={errorMessage}
            onRetry={handleRetry}
            onClose={() => setFlowStatus("idle")}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ORDER STATUS CARD                                                          */
/* -------------------------------------------------------------------------- */

function OrderStatusCard({ order }: { order: Order }) {
  const statusConfig = getStatusConfig(order.gelatoStatus ?? order.status);

  return (
    <div
      className="rounded-[22px] overflow-hidden"
      style={{
        background: "white",
        border: "1px solid rgba(180,150,210,0.12)",
        boxShadow: "0 2px 12px rgba(100,60,140,0.06)",
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{
          borderBottom: "1px solid rgba(180,150,210,0.08)",
          background: "rgba(249,245,255,0.5)",
        }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: statusConfig.iconBg }}
        >
          <statusConfig.icon
            className="w-4 h-4"
            style={{ color: statusConfig.iconColor }}
          />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: "#2D2235" }}>
            {statusConfig.title}
          </p>
          <p className="text-[11px]" style={{ color: "#A897BD" }}>
            {statusConfig.description}
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Status steps */}
        <div className="flex items-center gap-3">
          <StatusDot active done />
          <span className="text-xs font-semibold" style={{ color: "#2D2235" }}>
            Order placed
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot
            active={["processing", "shipped", "delivered"].includes(
              order.gelatoStatus ?? ""
            )}
            done={["shipped", "delivered"].includes(
              order.gelatoStatus ?? ""
            )}
          />
          <span
            className="text-xs font-semibold"
            style={{
              color: ["processing", "shipped", "delivered"].includes(
                order.gelatoStatus ?? ""
              )
                ? "#2D2235"
                : "#C4B5D4",
            }}
          >
            Printing
          </span>
        </div>
        <div className="flex items-center gap-3">
          <StatusDot
            active={["shipped", "delivered"].includes(
              order.gelatoStatus ?? ""
            )}
            done={order.gelatoStatus === "delivered"}
          />
          <span
            className="text-xs font-semibold"
            style={{
              color: ["shipped", "delivered"].includes(
                order.gelatoStatus ?? ""
              )
                ? "#2D2235"
                : "#C4B5D4",
            }}
          >
            Shipped
          </span>
        </div>

        {/* Gelato order ID */}
        {order.gelatoOrderId && (
          <p className="text-[11px] pt-1" style={{ color: "#A897BD" }}>
            Order ref: {order.gelatoOrderId}
          </p>
        )}
      </div>
    </div>
  );
}

function StatusDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
      style={{
        background: done
          ? "rgba(67,184,156,0.15)"
          : active
            ? "rgba(176,92,230,0.12)"
            : "rgba(180,150,210,0.08)",
        border: done
          ? "2px solid #43B89C"
          : active
            ? "2px solid #B05CE6"
            : "2px solid rgba(180,150,210,0.15)",
      }}
    >
      {done && <Check className="w-3 h-3" style={{ color: "#2FA482" }} />}
      {active && !done && (
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: "#B05CE6" }}
        />
      )}
    </div>
  );
}

function getStatusConfig(status: string) {
  switch (status) {
    case "shipped":
      return {
        icon: Truck,
        iconBg: "rgba(67,184,156,0.1)",
        iconColor: "#2FA482",
        title: "On its way!",
        description: "Your book has been shipped",
      };
    case "delivered":
      return {
        icon: Check,
        iconBg: "rgba(67,184,156,0.1)",
        iconColor: "#2FA482",
        title: "Delivered",
        description: "Your book has arrived",
      };
    case "processing":
      return {
        icon: Clock,
        iconBg: "rgba(176,92,230,0.1)",
        iconColor: "#B05CE6",
        title: "Being printed",
        description: "Your book is at the printers",
      };
    case "error":
    case "failed":
      return {
        icon: AlertCircle,
        iconBg: "rgba(233,30,99,0.08)",
        iconColor: "#E91E63",
        title: "Issue with order",
        description: "Something went wrong — please try again",
      };
    default:
      return {
        icon: Package,
        iconBg: "rgba(176,92,230,0.1)",
        iconColor: "#B05CE6",
        title: "Order submitted",
        description: "We're preparing your book",
      };
  }
}

/* -------------------------------------------------------------------------- */
/*  ADDRESS SHEET                                                              */
/* -------------------------------------------------------------------------- */

function AddressSheet({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void;
  onSubmit: (address: ShippingAddress) => void;
  isSubmitting: boolean;
}) {
  const [address, setAddress] = useState<ShippingAddress>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<
    Partial<Record<keyof ShippingAddress, string>>
  >({});

  function update(field: keyof ShippingAddress, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validate(): boolean {
    const e: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!address.firstName.trim()) e.firstName = "Required";
    if (!address.lastName.trim()) e.lastName = "Required";
    if (!address.addressLine1.trim()) e.addressLine1 = "Required";
    if (!address.city.trim()) e.city = "Required";
    if (!address.postCode.trim()) e.postCode = "Required";
    if (!address.email.trim()) e.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email))
      e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (validate()) onSubmit(address);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{
        background: "rgba(20,8,40,0.6)",
        backdropFilter: "blur(6px)",
      }}
      onClick={(e) =>
        e.target === e.currentTarget && !isSubmitting && onClose()
      }
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-h-[92vh] overflow-y-auto"
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          fontFamily: FONT,
        }}
      >
        {/* Handle */}
        <div
          className="flex justify-center pt-3 pb-1 sticky top-0 bg-white z-10"
          style={{ borderRadius: "24px 24px 0 0" }}
        >
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "rgba(180,150,210,0.25)" }}
          />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 sticky top-5 bg-white z-10"
          style={{ borderBottom: "1px solid rgba(180,150,210,0.1)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #B05CE6, #D946EF)",
              }}
            >
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3
                className="text-base font-extrabold"
                style={{ color: "#2D2235" }}
              >
                Shipping Address
              </h3>
              <p className="text-[11px]" style={{ color: "#8B7BA0" }}>
                Where should we send your book?
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full disabled:opacity-30"
            style={{
              background: "rgba(180,150,210,0.08)",
              border: "none",
              color: "#8B7BA0",
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex gap-3">
            <InputField
              label="First name"
              value={address.firstName}
              onChange={(v) => update("firstName", v)}
              error={errors.firstName}
              disabled={isSubmitting}
            />
            <InputField
              label="Last name"
              value={address.lastName}
              onChange={(v) => update("lastName", v)}
              error={errors.lastName}
              disabled={isSubmitting}
            />
          </div>

          <InputField
            label="Address line 1"
            value={address.addressLine1}
            onChange={(v) => update("addressLine1", v)}
            error={errors.addressLine1}
            disabled={isSubmitting}
          />

          <InputField
            label="Address line 2 (optional)"
            value={address.addressLine2}
            onChange={(v) => update("addressLine2", v)}
            disabled={isSubmitting}
          />

          <div className="flex gap-3">
            <InputField
              label="City"
              value={address.city}
              onChange={(v) => update("city", v)}
              error={errors.city}
              disabled={isSubmitting}
            />
            <InputField
              label="Postcode"
              value={address.postCode}
              onChange={(v) => update("postCode", v)}
              error={errors.postCode}
              disabled={isSubmitting}
            />
          </div>

          <InputField
            label="Email"
            value={address.email}
            onChange={(v) => update("email", v)}
            error={errors.email}
            disabled={isSubmitting}
            type="email"
          />

          <InputField
            label="Phone (optional)"
            value={address.phone}
            onChange={(v) => update("phone", v)}
            disabled={isSubmitting}
            type="tel"
          />
        </div>

        {/* Submit */}
        <div className="px-6 pb-10 pt-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
              boxShadow: "0 4px 20px rgba(176,92,230,0.3)",
              border: "none",
              fontFamily: FONT,
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating your book…
              </>
            ) : (
              <>
                <BookOpen className="w-5 h-5" />
                Place Order
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  INPUT FIELD                                                                */
/* -------------------------------------------------------------------------- */

function InputField({
  label,
  value,
  onChange,
  error,
  disabled,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <div className="flex-1">
      <label
        className="block text-[11px] font-bold uppercase tracking-wider mb-1.5"
        style={{ color: error ? "#E91E63" : "#8B7BA0", fontFamily: FONT }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-xl px-3.5 py-3 text-sm outline-none transition-all disabled:opacity-50"
        style={{
          border: error
            ? "1.5px solid rgba(233,30,99,0.4)"
            : "1.5px solid rgba(180,150,210,0.2)",
          background: error ? "rgba(233,30,99,0.03)" : "#FDFBFF",
          color: "#2D2235",
          fontFamily: FONT,
        }}
      />
      {error && (
        <p
          className="text-[10px] mt-1 font-semibold"
          style={{ color: "#E91E63" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PROCESSING OVERLAY                                                         */
/* -------------------------------------------------------------------------- */

function ProcessingOverlay({ step }: { step: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(20,8,40,0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-8 p-8 rounded-3xl text-center"
        style={{ background: "white", maxWidth: 340 }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            background:
              "linear-gradient(135deg, rgba(176,92,230,0.12), rgba(233,30,140,0.08))",
          }}
        >
          <Loader2
            className="w-8 h-8 animate-spin"
            style={{ color: "#B05CE6" }}
          />
        </div>
        <h3
          className="text-lg font-extrabold mb-2"
          style={{ color: "#2D2235", fontFamily: FONT }}
        >
          Creating your book
        </h3>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "#8B7BA0", fontFamily: FONT }}
        >
          {step}
        </p>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SUCCESS OVERLAY                                                            */
/* -------------------------------------------------------------------------- */

function SuccessOverlay({ onDone }: { onDone: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(20,8,40,0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-8 p-8 rounded-3xl text-center"
        style={{ background: "white", maxWidth: 340 }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(67,184,156,0.12)" }}
        >
          <Check className="w-8 h-8" style={{ color: "#2FA482" }} />
        </div>
        <h3
          className="text-lg font-extrabold mb-2"
          style={{ color: "#2D2235", fontFamily: FONT }}
        >
          Order placed!
        </h3>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "#8B7BA0", fontFamily: FONT }}
        >
          Your book is being printed and will be shipped to you soon.
        </p>
        <button
          onClick={onDone}
          className="w-full py-3.5 rounded-2xl text-sm font-bold text-white active:scale-[0.98] transition-transform"
          style={{
            background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
            boxShadow: "0 4px 16px rgba(176,92,230,0.3)",
            border: "none",
            fontFamily: FONT,
          }}
        >
          Done
        </button>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ERROR OVERLAY                                                              */
/* -------------------------------------------------------------------------- */

function ErrorOverlay({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(20,8,40,0.7)",
        backdropFilter: "blur(8px)",
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-8 p-8 rounded-3xl text-center"
        style={{ background: "white", maxWidth: 340 }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
          style={{ background: "rgba(233,30,99,0.08)" }}
        >
          <AlertCircle className="w-8 h-8" style={{ color: "#E91E63" }} />
        </div>
        <h3
          className="text-lg font-extrabold mb-2"
          style={{ color: "#2D2235", fontFamily: FONT }}
        >
          Something went wrong
        </h3>
        <p
          className="text-sm leading-relaxed mb-6"
          style={{ color: "#8B7BA0", fontFamily: FONT }}
        >
          {message}
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold"
            style={{
              background: "rgba(180,150,210,0.08)",
              color: "#6B5C80",
              border: "none",
              fontFamily: FONT,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onRetry}
            className="flex-1 py-3.5 rounded-2xl text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
              border: "none",
              fontFamily: FONT,
            }}
          >
            Try Again
          </button>
        </div>
      </motion.div>
    </div>
  );
}