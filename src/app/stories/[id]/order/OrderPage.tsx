"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Gift,
  Star,
  Tag,
  MapPin,
  Plus,
  Minus,
  Check,
  Loader2,
  Share2,
  Truck,
  Heart,
} from "lucide-react";

// ─── Types ───
interface Props {
  story: {
    id: string;
    title: string;
    coverSpreadUrl: string | null;
    pdfUrl: string | null;
  };
  pricing: {
    basePrice: number; // pence
    currency: string;
    productType: string;
  };
  hasReview: boolean;
  reviewPromoCode: string | null;
  reviewPromoDiscount: number | null;
  previousOrderCount: number;
  lastShippingAddress: {
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postCode?: string;
    countryIsoCode?: string;
    email?: string;
    phone?: string;
  } | null;
}

interface ShippingAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postCode: string;
  countryIsoCode: string;
  email: string;
  phone: string;
}

// ─── Helpers ───
function formatPrice(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}

const EMPTY_ADDRESS: ShippingAddress = {
  firstName: "",
  lastName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postCode: "",
  countryIsoCode: "GB",
  email: "",
  phone: "",
};

// ─── Main ───
export default function OrderPage({
  story,
  pricing,
  hasReview,
  reviewPromoCode,
  reviewPromoDiscount,
  previousOrderCount,
  lastShippingAddress,
}: Props) {
  const router = useRouter();

  // Order config
  const [coverType, setCoverType] = useState<"soft" | "hard">(
    pricing?.productType === "gift" ? "hard" : "soft"
  );
  const [quantity, setQuantity] = useState(1);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");

  // Promo code
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discount: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);

  // Shipping
  const [usePreviousAddress, setUsePreviousAddress] = useState(
    !!lastShippingAddress
  );
  const [address, setAddress] = useState<ShippingAddress>(
    lastShippingAddress
      ? {
          firstName: lastShippingAddress.firstName || "",
          lastName: lastShippingAddress.lastName || "",
          addressLine1: lastShippingAddress.addressLine1 || "",
          addressLine2: lastShippingAddress.addressLine2 || "",
          city: lastShippingAddress.city || "",
          state: lastShippingAddress.state || "",
          postCode: lastShippingAddress.postCode || "",
          countryIsoCode: lastShippingAddress.countryIsoCode || "GB",
          email: lastShippingAddress.email || "",
          phone: lastShippingAddress.phone || "",
        }
      : EMPTY_ADDRESS
  );

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-apply review promo if available
  useEffect(() => {
    if (reviewPromoCode && reviewPromoDiscount && !appliedPromo) {
      setAppliedPromo({
        code: reviewPromoCode,
        discount: reviewPromoDiscount,
      });
      setPromoInput(reviewPromoCode);
    }
  }, [reviewPromoCode, reviewPromoDiscount, appliedPromo]);

  // ─── Pricing calculation ───
  const PRICES = { soft: 2900, hard: 3900 }; // pence
  const basePrice = PRICES[coverType];
  const subtotal = basePrice * quantity;
  const bulkDiscount = quantity >= 3 ? Math.round(subtotal * 0.1) : 0;
  const promoDiscount = appliedPromo
    ? Math.round((subtotal - bulkDiscount) * (appliedPromo.discount / 100))
    : 0;
  const total = subtotal - bulkDiscount - promoDiscount;

  // ─── Promo code validation ───
  async function checkPromoCode() {
    if (!promoInput.trim()) return;
    setPromoChecking(true);
    setPromoError(null);

    try {
      const res = await fetch(`/api/promo/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim().toUpperCase() }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPromoError(data.error || "Invalid code");
        setAppliedPromo(null);
      } else {
        const data = await res.json();
        setAppliedPromo({
          code: data.code,
          discount: data.discountPercent,
        });
        setPromoError(null);
      }
    } catch {
      setPromoError("Could not verify code");
    } finally {
      setPromoChecking(false);
    }
  }

  // ─── Form validation ───
  function isFormValid() {
    const a = usePreviousAddress && lastShippingAddress ? lastShippingAddress : address;
    return (
      a.firstName?.trim() &&
      a.lastName?.trim() &&
      a.addressLine1?.trim() &&
      a.city?.trim() &&
      a.postCode?.trim() &&
      a.email?.trim()
    );
  }

  // ─── PayPal: create order ───
  async function createPayPalOrder() {
    const res = await fetch("/api/paypal/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId: story.id,
        currency: pricing.currency,
        price: (total / 100).toFixed(2),
        promoCode: appliedPromo?.code,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to create payment");

    if (data.free) {
      // Promo made it free — skip PayPal, go straight to Gelato order
      await submitGelatoOrder();
      return null; // signals no PayPal approval needed
    }

    return data.orderID;
  }

  // ─── PayPal: capture after approval ───
  async function capturePayPalOrder(orderID: string) {
    const res = await fetch("/api/paypal/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Payment capture failed");

    return data;
  }

  // ─── Submit to Gelato after payment ───
  async function submitGelatoOrder() {
    setSubmitting(true);
    setError(null);

    const shippingAddr =
      usePreviousAddress && lastShippingAddress
        ? lastShippingAddress
        : address;

    try {
      const res = await fetch(`/api/stories/${story.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shippingAddress: shippingAddr,
          quantity,
          isGift,
          giftMessage: isGift ? giftMessage : undefined,
          promoCode: appliedPromo?.code,
          productType: coverType === "hard" ? "gift" : "print",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order failed");

      router.push(`/stories/${story.id}/book`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  // ─── Full PayPal flow ───
  async function handlePayPalApprove(orderID: string) {
    setSubmitting(true);
    setError(null);

    try {
      await capturePayPalOrder(orderID);
      await submitGelatoOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen bg-[#fafafa]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />

      {/* ─── Header ─── */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/stories/${story.id}/book`}
              className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-gray-200 text-gray-500 hover:bg-gray-50 transition"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-[15px] font-semibold text-gray-900">
                Order a Copy
              </h1>
              <p className="text-[12px] text-gray-400">
                {story.title.length > 40
                  ? story.title.slice(0, 40) + "…"
                  : story.title}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Content ─── */}
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Book preview */}
        {story.coverSpreadUrl && (
          <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200">
            <img
              src={story.coverSpreadUrl}
              alt={story.title}
              className="w-20 h-14 rounded-lg object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-gray-900 truncate">
                {story.title}
              </p>
              <p className="text-[12px] text-gray-400">
                {coverType === "hard" ? "Hardcover" : "Softcover"} · {formatPrice(basePrice)} each
              </p>
            </div>
          </div>
        )}

        {/* ─── Cover Type Selector ─── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="text-[13px] font-semibold text-gray-700 mb-3 block">
            Choose your cover
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCoverType("soft")}
              className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-[2px] transition-all ${
                coverType === "soft"
                  ? "border-green-400 bg-green-50/50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {coverType === "soft" && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={12} strokeWidth={3} className="text-white" />
                </div>
              )}
              <Package size={24} className={coverType === "soft" ? "text-green-600" : "text-gray-400"} />
              <div className="text-center">
                <p className={`text-[14px] font-semibold ${coverType === "soft" ? "text-green-900" : "text-gray-700"}`}>
                  Softcover
                </p>
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">
                  {formatPrice(2900)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Lightweight & flexible
                </p>
              </div>
            </button>

            <button
              onClick={() => setCoverType("hard")}
              className={`relative flex flex-col items-center gap-2 p-5 rounded-xl border-[2px] transition-all ${
                coverType === "hard"
                  ? "border-green-400 bg-green-50/50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {coverType === "hard" && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check size={12} strokeWidth={3} className="text-white" />
                </div>
              )}
              <Gift size={24} className={coverType === "hard" ? "text-green-600" : "text-gray-400"} />
              <div className="text-center">
                <p className={`text-[14px] font-semibold ${coverType === "hard" ? "text-green-900" : "text-gray-700"}`}>
                  Hardcover
                </p>
                <p className="text-[13px] font-bold text-gray-900 mt-0.5">
                  {formatPrice(3900)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Premium keepsake quality
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* ─── Review nudge (if no review yet) ─── */}
        {!hasReview && (
          <div className="p-5 bg-amber-50 rounded-2xl border border-amber-200/60">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Star size={18} className="text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-amber-900">
                  Get 15% off this order
                </p>
                <p className="text-[13px] text-amber-700 mt-1 leading-relaxed">
                  Write a quick review of your book and unlock a discount code
                  you can use right here.
                </p>
                <Link
                  href={`/stories/${story.id}/review`}
                  className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-semibold text-amber-600 hover:text-amber-700 transition"
                >
                  <Star size={14} />
                  Write a review
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* ─── Auto-applied review discount ─── */}
        {appliedPromo && reviewPromoCode && appliedPromo.code === reviewPromoCode && (
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl border border-green-200/60">
            <Check size={18} className="text-green-500 shrink-0" />
            <p className="text-[13px] text-green-700">
              <span className="font-semibold">Review discount applied!</span>{" "}
              {appliedPromo.discount}% off — thanks for sharing your feedback.
            </p>
          </div>
        )}

        {/* ─── Quantity + Gift toggle ─── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5">
          {/* Quantity */}
          <div>
            <label className="text-[13px] font-semibold text-gray-700 mb-3 block">
              How many copies?
            </label>
            <div className="flex items-center gap-4">
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition"
                  disabled={quantity <= 1}
                >
                  <Minus size={16} />
                </button>
                <span className="w-12 text-center text-[15px] font-semibold text-gray-900">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-50 transition"
                >
                  <Plus size={16} />
                </button>
              </div>

              {quantity >= 3 && (
                <span className="text-[12px] font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                  10% bulk discount!
                </span>
              )}
            </div>

            {quantity < 3 && (
              <p className="text-[11px] text-gray-400 mt-2">
                Order 3+ copies and save 10% — great for grandparents & family
              </p>
            )}
          </div>

          {/* Gift toggle */}
          <div className="border-t border-gray-100 pt-5">
            <button
              onClick={() => setIsGift(!isGift)}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-[1.5px] text-left transition-all ${
                isGift
                  ? "border-pink-300 bg-pink-50/50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  isGift ? "bg-pink-100" : "bg-gray-100"
                }`}
              >
                <Gift
                  size={18}
                  className={isGift ? "text-pink-500" : "text-gray-400"}
                />
              </div>
              <div className="flex-1">
                <p
                  className={`text-[14px] font-semibold ${
                    isGift ? "text-pink-900" : "text-gray-700"
                  }`}
                >
                  Send as a gift
                </p>
                <p className="text-[12px] text-gray-400">
                  Ship to someone else with a personal message
                </p>
              </div>
              <div
                className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                  isGift
                    ? "bg-pink-500 border-pink-500"
                    : "bg-white border-gray-300"
                }`}
              >
                {isGift && (
                  <Check size={14} strokeWidth={3} className="text-white" />
                )}
              </div>
            </button>

            {/* Gift message */}
            {isGift && (
              <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[12px] font-semibold text-gray-600 mb-2 block">
                  Gift message (optional)
                </label>
                <textarea
                  value={giftMessage}
                  onChange={(e) => setGiftMessage(e.target.value)}
                  placeholder="To [name], we made this story just for you…"
                  rows={3}
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-[14px] text-gray-800 placeholder:text-gray-300 focus:outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 transition resize-none"
                />
                <p className="text-[11px] text-gray-400 mt-1 text-right">
                  {giftMessage.length}/200
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── Shipping Address ─── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-gray-400" />
            <h3 className="text-[14px] font-semibold text-gray-800">
              {isGift ? "Recipient's Address" : "Shipping Address"}
            </h3>
          </div>

          {/* Use previous address toggle */}
          {lastShippingAddress && !isGift && (
            <button
              onClick={() => {
                setUsePreviousAddress(!usePreviousAddress);
                if (!usePreviousAddress && lastShippingAddress) {
                  setAddress({
                    firstName: lastShippingAddress.firstName || "",
                    lastName: lastShippingAddress.lastName || "",
                    addressLine1: lastShippingAddress.addressLine1 || "",
                    addressLine2: lastShippingAddress.addressLine2 || "",
                    city: lastShippingAddress.city || "",
                    state: lastShippingAddress.state || "",
                    postCode: lastShippingAddress.postCode || "",
                    countryIsoCode:
                      lastShippingAddress.countryIsoCode || "GB",
                    email: lastShippingAddress.email || "",
                    phone: lastShippingAddress.phone || "",
                  });
                }
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-[1.5px] text-left mb-4 transition-all ${
                usePreviousAddress
                  ? "border-green-300 bg-green-50/50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                  usePreviousAddress
                    ? "bg-green-500 border-green-500"
                    : "bg-white border-gray-300"
                }`}
              >
                {usePreviousAddress && (
                  <Check size={12} strokeWidth={3} className="text-white" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-medium text-gray-700">
                  Same address as last order
                </p>
                <p className="text-[11px] text-gray-400">
                  {lastShippingAddress.addressLine1},{" "}
                  {lastShippingAddress.city},{" "}
                  {lastShippingAddress.postCode}
                </p>
              </div>
            </button>
          )}

          {/* Address form */}
          {(!usePreviousAddress || isGift) && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-300">
              <InputField
                label="First name"
                value={address.firstName}
                onChange={(v) =>
                  setAddress((a) => ({ ...a, firstName: v }))
                }
                required
              />
              <InputField
                label="Last name"
                value={address.lastName}
                onChange={(v) =>
                  setAddress((a) => ({ ...a, lastName: v }))
                }
                required
              />
              <InputField
                label="Address line 1"
                value={address.addressLine1}
                onChange={(v) =>
                  setAddress((a) => ({ ...a, addressLine1: v }))
                }
                className="col-span-2"
                required
              />
              <InputField
                label="Address line 2"
                value={address.addressLine2}
                onChange={(v) =>
                  setAddress((a) => ({ ...a, addressLine2: v }))
                }
                className="col-span-2"
              />
              <InputField
                label="City"
                value={address.city}
                onChange={(v) => setAddress((a) => ({ ...a, city: v }))}
                required
              />
              <InputField
                label="Postcode"
                value={address.postCode}
                onChange={(v) =>
                  setAddress((a) => ({ ...a, postCode: v }))
                }
                required
              />
              <InputField
                label="Email"
                type="email"
                value={address.email}
                onChange={(v) =>
                  setAddress((a) => ({ ...a, email: v }))
                }
                className="col-span-2"
                required
              />
              <InputField
                label="Phone (optional)"
                type="tel"
                value={address.phone}
                onChange={(v) =>
                  setAddress((a) => ({ ...a, phone: v }))
                }
                className="col-span-2"
              />
            </div>
          )}
        </div>

        {/* ─── Promo Code ─── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Tag size={16} className="text-gray-400" />
            <h3 className="text-[14px] font-semibold text-gray-800">
              Promo Code
            </h3>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-800 uppercase tracking-wide placeholder:text-gray-300 placeholder:normal-case focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition"
              disabled={!!appliedPromo}
            />
            {appliedPromo ? (
              <button
                onClick={() => {
                  setAppliedPromo(null);
                  setPromoInput("");
                }}
                className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-red-500 border border-red-200 hover:bg-red-50 transition"
              >
                Remove
              </button>
            ) : (
              <button
                onClick={checkPromoCode}
                disabled={!promoInput.trim() || promoChecking}
                className="px-5 py-2.5 rounded-xl text-[13px] font-semibold bg-gray-900 text-white hover:bg-gray-800 transition disabled:bg-gray-200 disabled:text-gray-400"
              >
                {promoChecking ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  "Apply"
                )}
              </button>
            )}
          </div>
          {promoError && (
            <p className="text-[12px] text-red-500 mt-2">{promoError}</p>
          )}
          {appliedPromo && (
            <p className="text-[12px] text-green-600 font-medium mt-2">
              {appliedPromo.discount}% discount applied
            </p>
          )}
        </div>

        {/* ─── Order Summary ─── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-[14px] font-semibold text-gray-800 mb-4">
            Order Summary
          </h3>
          <div className="space-y-2.5">
            <SummaryRow
              label={`${quantity}× ${coverType === "hard" ? "Hardcover" : "Softcover"} book`}
              value={formatPrice(subtotal)}
            />
            {bulkDiscount > 0 && (
              <SummaryRow
                label="Bulk discount (10%)"
                value={`-${formatPrice(bulkDiscount)}`}
                highlight
              />
            )}
            {promoDiscount > 0 && (
              <SummaryRow
                label={`Promo: ${appliedPromo?.code}`}
                value={`-${formatPrice(promoDiscount)}`}
                highlight
              />
            )}
            <SummaryRow label="Shipping" value="Included" muted />
            <div className="border-t border-gray-100 pt-3 mt-3">
              <SummaryRow
                label="Total"
                value={formatPrice(total)}
                bold
              />
            </div>
          </div>
        </div>

        {/* ─── Gift viral insert note ─── */}
        {isGift && (
          <div className="flex items-start gap-3 p-4 bg-violet-50 rounded-2xl border border-violet-200/60">
            <Heart size={16} className="text-violet-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-violet-700 leading-relaxed">
              Every gift book includes a{" "}
              <span className="font-semibold">
                "Make a book for YOUR child"
              </span>{" "}
              card with a special discount for the recipient. The best
              recommendations come from people who love the product.
            </p>
          </div>
        )}

        {/* ─── Payment ─── */}
        <div className="space-y-3">
          {error && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200/60">
              <p className="text-[13px] text-red-600">{error}</p>
            </div>
          )}

          {submitting ? (
            <div className="w-full py-4 rounded-xl bg-gray-100 flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin text-gray-400" />
              <span className="text-[15px] font-semibold text-gray-400">
                Processing order…
              </span>
            </div>
          ) : !isFormValid() ? (
            <div className="w-full py-4 rounded-xl bg-gray-100 text-center">
              <span className="text-[15px] font-semibold text-gray-300">
                Fill in shipping details to continue
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-white rounded-2xl border border-gray-200">
                <p className="text-[13px] text-gray-500 text-center mb-3">
                  Pay {formatPrice(total)} securely with PayPal
                </p>
                <PayPalButton
                  createOrder={async () => {
                    try {
                      const orderID = await createPayPalOrder();
                      if (!orderID) return ""; // free order, already handled
                      return orderID;
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Payment setup failed"
                      );
                      return "";
                    }
                  }}
                  onApprove={async (orderID: string) => {
                    await handlePayPalApprove(orderID);
                  }}
                  onError={(err: any) => {
                    setError("Payment was cancelled or failed. Please try again.");
                  }}
                />
              </div>
            </div>
          )}

          <p className="text-[11px] text-gray-400 text-center">
            Printed and shipped by Gelato · Estimated delivery 5-7 business
            days
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Input Field ───
function InputField({
  label,
  value,
  onChange,
  type = "text",
  required,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-[11px] font-semibold text-gray-500 mb-1 block">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-[14px] text-gray-800 focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100 transition"
      />
    </div>
  );
}

// ─── Summary Row ───
function SummaryRow({
  label,
  value,
  bold,
  highlight,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline">
      <span
        className={`text-[13px] ${
          bold
            ? "font-semibold text-gray-900"
            : muted
            ? "text-gray-400"
            : "text-gray-600"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-[13px] ${
          bold
            ? "font-bold text-gray-900 text-[15px]"
            : highlight
            ? "font-semibold text-green-600"
            : muted
            ? "text-gray-400"
            : "text-gray-700"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── PayPal Button Wrapper ───
function PayPalButton({
  createOrder,
  onApprove,
  onError,
}: {
  createOrder: () => Promise<string>;
  onApprove: (orderID: string) => Promise<void>;
  onError: (err: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      console.error("Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID");
      return;
    }
    if ((window as any).paypal) {
      setSdkReady(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=GBP`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    script.onerror = () => onError("Failed to load PayPal");
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    const paypal = (window as any).paypal;
    if (!paypal?.Buttons) return;
    containerRef.current.innerHTML = "";
    paypal.Buttons({
      style: { layout: "vertical", color: "gold", shape: "rect", label: "pay", height: 48 },
      createOrder: async () => await createOrder(),
      onApprove: async (data: any) => await onApprove(data.orderID),
      onError: (err: any) => onError(err),
      onCancel: () => onError("Payment cancelled"),
    }).render(containerRef.current);
  }, [sdkReady, createOrder, onApprove, onError]);

  if (!sdkReady) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={20} className="animate-spin text-gray-300" />
      </div>
    );
  }
  return <div ref={containerRef} />;
}