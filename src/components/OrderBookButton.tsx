"use client";

import { useState } from "react";
import {
  Loader2,
  BookOpen,
  X,
  MapPin,
  Check,
  Truck,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

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

type OrderStatus = "idle" | "address" | "processing" | "success" | "error";

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

const FONT = "'Bricolage Grotesque', system-ui, sans-serif";

/* -------------------------------------------------------------------------- */
/*                            Shipping Address Sheet                          */
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
  const [errors, setErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});

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
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) e.email = "Invalid email";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit() {
    if (validate()) onSubmit(address);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "rgba(20,8,40,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && !isSubmitting && onClose()}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-h-[92vh] flex flex-col"
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          fontFamily: FONT,
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(180,150,210,0.25)" }} />
        </div>

        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3.5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(180,150,210,0.1)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #B05CE6, #D946EF)" }}
            >
              <Truck className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold" style={{ color: "#2D2235" }}>
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
            style={{ background: "rgba(180,150,210,0.08)", border: "none", color: "#8B7BA0" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          <div className="flex flex-col gap-3.5">
            {/* Name row */}
            <div className="flex gap-2.5">
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

            {/* City + Postcode row */}
            <div className="flex gap-2.5">
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
        </div>

        {/* Submit — pinned to bottom */}
        <div
          className="flex-shrink-0 px-5 pt-3 pb-8"
          style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(8px)",
            borderTop: "1px solid rgba(180,150,210,0.1)",
          }}
        >
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform"
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
/*                              Input Field                                   */
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
    <div className="flex-1 min-w-0">
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
        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none transition-all disabled:opacity-50"
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
        <p className="text-[10px] mt-1 font-semibold" style={{ color: "#E91E63" }}>
          {error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          Processing Overlay                                */
/* -------------------------------------------------------------------------- */

function ProcessingOverlay({ step }: { step: string }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(20,8,40,0.7)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-6 p-8 rounded-3xl text-center"
        style={{ background: "white", maxWidth: 340 }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{ background: "linear-gradient(135deg, rgba(176,92,230,0.12), rgba(233,30,140,0.08))" }}
        >
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#B05CE6" }} />
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
/*                           Success Overlay                                  */
/* -------------------------------------------------------------------------- */

function SuccessOverlay({ onDone }: { onDone: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(20,8,40,0.7)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-6 p-8 rounded-3xl text-center"
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
/*                          Error Overlay                                     */
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
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(20,8,40,0.7)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mx-6 p-8 rounded-3xl text-center"
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

/* -------------------------------------------------------------------------- */
/*                           Main Order Button                                */
/* -------------------------------------------------------------------------- */

export default function OrderBookButton({ storyId }: { storyId: string }) {
  const [status, setStatus] = useState<OrderStatus>("idle");
  const [processingStep, setProcessingStep] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [savedAddress, setSavedAddress] = useState<ShippingAddress | null>(null);

  async function handleOrder(address: ShippingAddress) {
    setSavedAddress(address);
    setStatus("processing");

    try {
      /* Step 1: Export PDF */
      setProcessingStep("Preparing your book for print…");
      const exportRes = await fetch(`/api/stories/${storyId}/export-complete`, {
        method: "POST",
      });

      if (!exportRes.ok) {
        const data = await exportRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to prepare PDF");
      }

      /* Step 2: Place Gelato order */
      setProcessingStep("Placing your order…");
      const orderRes = await fetch(`/api/stories/${storyId}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: address }),
      });

      if (!orderRes.ok) {
        const data = await orderRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to place order");
      }

      setStatus("success");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred");
      setStatus("error");
    }
  }

  function handleRetry() {
    if (savedAddress) {
      handleOrder(savedAddress);
    } else {
      setStatus("address");
    }
  }

  return (
    <>
      {/* Order Book button */}
      <button
        onClick={() => setStatus("address")}
        className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        style={{
          background: "linear-gradient(135deg, #B05CE6, #E91E8C)",
          boxShadow: "0 4px 20px rgba(176,92,230,0.28)",
          border: "none",
          fontFamily: FONT,
        }}
      >
        <BookOpen className="w-5 h-5" />
        Order Book
      </button>

      {/* Overlays */}
      <AnimatePresence>
        {status === "address" && (
          <AddressSheet
            onClose={() => setStatus("idle")}
            onSubmit={handleOrder}
            isSubmitting={false}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === "processing" && <ProcessingOverlay step={processingStep} />}
      </AnimatePresence>

      <AnimatePresence>
        {status === "success" && <SuccessOverlay onDone={() => setStatus("idle")} />}
      </AnimatePresence>

      <AnimatePresence>
        {status === "error" && (
          <ErrorOverlay
            message={errorMessage}
            onRetry={handleRetry}
            onClose={() => setStatus("idle")}
          />
        )}
      </AnimatePresence>
    </>
  );
}