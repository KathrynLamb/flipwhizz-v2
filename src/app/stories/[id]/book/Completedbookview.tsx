"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Download,
  Package,
  Share2,
  Star,
  Sparkles,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Calendar,
  CreditCard,
  Mail,
  HelpCircle,
  ExternalLink,
  Truck,
} from "lucide-react";
import { ShareTikTokButton } from "@/components/ShareTikTokButton";

// ─── Types ───
interface StoryData {
  id: string;
  title: string;
  coverSpreadUrl: string | null;
  pdfUrl: string | null;
  readerId: string | null;
  worldId: string | null;
  bookNumber: number | null;
  length: number | null;
  createdAt: string | null;
  spreadImageUrls: string[] | null
}

interface OrderData {
  id: string;
  gelatoOrderId: string | null;
  status: string;
  trackingCode: string | null;
  trackingUrl: string | null;
  createdAt: string | null;
  amount: string | null;
  currency: string | null;
  shippingAddress: {
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    postCode?: string;
    countryIsoCode?: string;
    email?: string;
    phone?: string;
  } | null;
  minDeliveryDate: string | null;
  maxDeliveryDate: string | null;
  paymentId: string | null;
}

interface Props {
  story: StoryData;
  order: OrderData | null;
}

// ─── Status badge mapping ───
function getOrderBadge(status: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    submitted:  { label: "Order Placed",  color: "#f59e0b", bg: "#fef3c7" },
    confirmed:  { label: "Confirmed",     color: "#f59e0b", bg: "#fef3c7" },
    printing:   { label: "Being Printed", color: "#3b82f6", bg: "#dbeafe" },
    shipped:    { label: "Shipped",       color: "#8b5cf6", bg: "#ede9fe" },
    in_transit: { label: "In Transit",    color: "#8b5cf6", bg: "#ede9fe" },  // ← add this
    delivered:  { label: "Delivered",     color: "#10b981", bg: "#d1fae5" },
    canceled:   { label: "Canceled",      color: "#ef4444", bg: "#fee2e2" },
    failed:     { label: "Failed",        color: "#ef4444", bg: "#fee2e2" },
  };
  return map[status] || map.submitted;
}

// ─── Format date ───
function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShort(dateStr: string | null) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatDeliveryRange(min: string | null, max: string | null) {
  if (!min && !max) return null;
  if (min && max) return `${formatDateShort(min)} – ${formatDateShort(max)}`;
  return formatDateShort(min || max);
}

function formatPrice(amount: string | null, currency: string | null) {
  if (!amount) return null;
  const raw = parseFloat(amount);
  if (isNaN(raw)) return null;
  // Amount may be stored in pence/cents (e.g. "2900") or pounds (e.g. "29.00")
  const num = raw > 200 ? raw / 100 : raw;
  const symbol = currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$";
  return `${symbol}${num.toFixed(2)}`;
}

function formatCountry(code: string | undefined) {
  const map: Record<string, string> = {
    GB: "United Kingdom",
    US: "United States",
    CA: "Canada",
    AU: "Australia",
    DE: "Germany",
    FR: "France",
  };
  return code ? map[code] || code : "";
}

// ─── Timeline step mapping ───
const TIMELINE_STEPS = [
  { key: "submitted", label: "Order Placed", matchStatuses: ["submitted", "confirmed"] },
  { key: "printing", label: "Printing", matchStatuses: ["printing"] },
  { key: "shipped", label: "Shipped", matchStatuses: ["shipped", "in_transit"] },
  { key: "delivered", label: "Delivered", matchStatuses: ["delivered"] },

];

function getTimelineIndex(status: string): number {
  const idx = TIMELINE_STEPS.findIndex((s) =>
    s.matchStatuses.includes(status)
  );
  return idx >= 0 ? idx : 0;
}

// ─── Action Card ───
function ActionCard({
  icon: Icon,
  title,
  description,
  href,
  onClick,
  variant = "default",
  tag,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "primary" | "growth" | "accent";
  tag?: { label: string; color: string; bg: string };
}) {
  const styles: Record<string, { iconBg: string; iconColor: string; hoverBorder: string }> = {
    default: { iconBg: "bg-green-50", iconColor: "text-green-500", hoverBorder: "hover:border-green-400" },
    primary: { iconBg: "bg-white/20", iconColor: "text-white", hoverBorder: "" },
    growth: { iconBg: "bg-amber-50", iconColor: "text-amber-500", hoverBorder: "hover:border-amber-400" },
    accent: { iconBg: "bg-violet-50", iconColor: "text-violet-500", hoverBorder: "hover:border-violet-400" },
  };

  const s = styles[variant];
  const isPrimary = variant === "primary";

  const inner = (
    <div
      className={`
        relative flex flex-col items-start gap-3 p-6 rounded-2xl
        border-[1.5px] transition-all duration-200 cursor-pointer
        hover:-translate-y-[3px] hover:shadow-lg
        ${isPrimary
          ? "bg-gradient-to-br from-green-500 to-green-600 border-transparent text-white"
          : `bg-white border-gray-200 ${s.hoverBorder}`
        }
      `}
    >
      {tag && (
        <span
          className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide"
          style={{ background: tag.bg, color: tag.color }}
        >
          {tag.label}
        </span>
      )}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg} ${s.iconColor}`}>
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <div>
        <div className={`text-base font-semibold mb-1 ${isPrimary ? "text-white" : "text-gray-900"}`}>
          {title}
        </div>
        <div className={`text-[13px] leading-relaxed ${isPrimary ? "text-white/85" : "text-gray-500"}`}>
          {description}
        </div>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{inner}</Link>;
  }

  return <button onClick={onClick} className="text-left w-full">{inner}</button>;
}

// ─── Main Component ───
export default function CompletedBookView({ story, order }: Props) {
  const [mounted, setMounted] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const orderStatus = order?.status || "submitted";
  const badge = getOrderBadge(orderStatus);
  const timelineIdx = getTimelineIndex(orderStatus);

  return (
    <div className="min-h-screen font-sans">
      {/* Nav */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/projects"
            className="flex items-center justify-center w-9 h-9 rounded-[10px] border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-[11px] font-bold">
              FW
            </div>
            <span className="text-[15px] font-semibold text-gray-900 max-w-[400px] truncate">
              {story.title}
            </span>
          </div>
        </div>

        {order && (
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold animate-in fade-in zoom-in-95 duration-500"
            style={{ background: badge.bg, color: badge.color }}
          >
            <Check size={14} strokeWidth={2.5} />
            {badge.label}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-[960px] mx-auto px-6 pt-10 pb-20">
        {/* Cover Hero */}
        {story.coverSpreadUrl && (
          <div className="relative rounded-2xl overflow-hidden shadow-2xl mb-8 animate-in fade-in zoom-in-[0.96] duration-700">
            <img
              src={story.coverSpreadUrl}
              alt={story.title}
              className="w-full block"
              style={{ aspectRatio: "16 / 9", objectFit: "cover" }}
            />
            {/* Gradient overlay */}
            <div className="absolute bottom-0 left-0 right-0 h-[120px] bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
            {/* Meta over cover */}
            <div className="absolute bottom-5 left-6 right-6 flex justify-between items-end">
              <div>
                {/* <div className="text-white/70 text-xs font-medium mb-1 tracking-wide uppercase">
                  Written by 
                </div> */}
                <div className="text-white text-xs opacity-60">
                  {story.length ? `${story.length} pages · ` : ""}
                  {story.createdAt ? `Created ${formatDate(story.createdAt)}` : ""}
                </div>
              </div>
              {story.bookNumber && (
                <div className="text-white text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white/15 backdrop-blur-sm">
                  Book #{story.bookNumber}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6 Action Cards — 2 col mobile, 3 col desktop */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-600 delay-200">
          {/* 1. Read Together */}
          <ActionCard
            icon={BookOpen}
            title="Read Together"
            description="Open the read-along and enjoy the story together."
            variant="primary"
            href={`/stories/${story.id}/reader`}
          />

          {/* 2. Download PDF */}
          {/* <ActionCard
            icon={Download}
            title="Download PDF"
            description={downloadStarted ? "Your download has started!" : "Your print-ready PDF to keep forever."}
            onClick={() => {
              if (story.pdfUrl) {
                setDownloadStarted(true);
                window.open(story.pdfUrl, "_blank");
              }
            }}
          /> */}

          {/* 2b. Export Print PDF */}
<ActionCard
  icon={Download}
  title="Export Print PDF"
  description="Generate a print-ready PDF for your records or home printing."
  onClick={async () => {
    const res = await fetch(`/api/stories/${story.id}/export-complete`, {
      method: "POST",
    });
    if (res.ok) {
      const data = await res.json();
      window.open(data.url, "_blank");
    } else {
      alert("Failed to export PDF");
    }
  }}
  variant="accent"
/>

          {/* 3. Order a Copy */}
          <ActionCard
            icon={Package}
            title="Order a Copy"
            description="Printed hardback — for yourself or sent as a gift."
            href={`/stories/${story.id}/order`}
          />

   {/* 4. Share to TikTok */}
{/* <div className="text-left w-full">
  <ShareTikTokButton
    storyId={story.id}
    imageUrls={story.spreadImageUrls}
    storyTitle={story.title}
  />
</div> */}

{/* 4. Share */}
<ActionCard
  icon={Share2}
  title="Share"
  description="Copy a link to share your book with anyone."
  onClick={() => {
    const url = story.pdfUrl || `${window.location.origin}/stories/${story.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert("Link copied to clipboard!");
    });
  }}
/>

          {/* 5. Write a Review */}
          <ActionCard
            icon={Star}
            title="Write a Review"
            description="Tell us what you loved and unlock 15% off your next book."
            variant="growth"
            tag={{ label: "15% off", color: "#92400e", bg: "#fef3c7" }}
            href={`/stories/${story.id}/review`}
          />

          {/* 6. Next Adventure */}
          <ActionCard
            icon={Sparkles}
            title="Next Adventure"
            description={
              story.worldId
                ? "Continue the series with the same characters."
                : "Start a new story — same characters or all new."
            }
            variant="accent"
            href={
              story.worldId
                ? `/stories/new?worldId=${story.worldId}`
                : "/stories/new"
            }
          />
        </div>

        {/* Order Timeline + Details */}
        {order && !["canceled", "failed"].includes(orderStatus) && (
          <div className="mt-10 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-600 delay-400">

            {/* Timeline Card */}
            <div className="p-7 bg-white rounded-2xl border border-gray-200">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[15px] font-semibold text-gray-900">
                  Print Order
                </h3>
              </div>

              {/* Estimated delivery banner */}
              {formatDeliveryRange(order.minDeliveryDate, order.maxDeliveryDate) && (
                <div className="flex items-center gap-2.5 mb-4 px-4 py-3 bg-blue-50 rounded-xl">
                  <Calendar size={16} className="text-blue-500 shrink-0" />
                  <p className="text-[13px] text-blue-700">
                    <span className="font-semibold">Estimated delivery:</span>{" "}
                    {formatDeliveryRange(order.minDeliveryDate, order.maxDeliveryDate)}
                  </p>
                </div>
              )}

              {/* Tracking banner */}
              {order.trackingCode && order.trackingUrl && (
                <div className="flex items-center justify-between mb-6 px-4 py-3 bg-violet-50 rounded-xl">
                  <div className="flex items-center gap-2.5">
                    <Truck size={16} className="text-violet-500 shrink-0" />
                    <p className="text-[13px] text-violet-700">
                      <span className="font-semibold">Tracking:</span>{" "}
                      {order.trackingCode}
                    </p>
                  </div>
                  <a
                    href={order.trackingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[13px] font-semibold text-violet-600 hover:text-violet-700 transition"
                  >
                    Track
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              <div className="flex items-center">
                {TIMELINE_STEPS.map((step, i) => {
                  const isComplete = i <= timelineIdx;
                  const isCurrent = i === timelineIdx;

                  return (
                    <div key={step.key} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-2 min-w-[80px]">
                        <div
                          className={`
                            w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300
                            ${isComplete
                              ? "bg-green-500 text-white"
                              : isCurrent
                              ? "bg-blue-100 border-2 border-blue-500"
                              : "bg-gray-100 border-2 border-transparent"
                            }
                          `}
                        >
                          {isComplete && <Check size={14} strokeWidth={2.5} />}
                        </div>
                        <span
                          className={`text-xs ${
                            isComplete
                              ? "text-green-500 font-semibold"
                              : isCurrent
                              ? "text-blue-500 font-semibold"
                              : "text-gray-400"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 -mx-2 mb-7 transition-colors duration-300 ${
                            i < timelineIdx ? "bg-green-500" : "bg-gray-200"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Details (expandable) */}
            <OrderDetailsPanel order={order} />

            {/* Help link */}
            <div className="flex items-center justify-center py-2">
              <a
                href="mailto:katy@flipwhizz.co.uk?subject=Order%20Help%20-%20FlipWhizz"
                className="flex items-center gap-1.5 text-[13px] text-gray-400 hover:text-gray-600 transition"
              >
                <HelpCircle size={14} />
                Need help with your order?
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Order Details Panel ───
function OrderDetailsPanel({ order }: { order: OrderData }) {
  const [expanded, setExpanded] = useState(false);
  const addr = order.shippingAddress;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-7 py-5 text-left hover:bg-gray-50 transition"
      >
        <h3 className="text-[15px] font-semibold text-gray-900">
          Order Details
        </h3>
        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-xs">
            {order.createdAt ? formatDate(order.createdAt) : ""}
          </span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {expanded && (
        <div className="px-7 pb-6 pt-0 border-t border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-5">

            {/* Order Summary */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-2">
                <CreditCard size={14} className="text-gray-400" />
                Payment
              </div>

              <DetailRow
                label="Order ref"
                value={order.gelatoOrderId
                  ? order.gelatoOrderId.slice(0, 8).toUpperCase()
                  : order.id.slice(0, 8).toUpperCase()
                }
              />
              <DetailRow label="Date" value={formatDate(order.createdAt)} />
              {formatPrice(order.amount, order.currency) && (
                <DetailRow label="Amount" value={formatPrice(order.amount, order.currency)!} />
              )}
              {order.paymentId && (
                <DetailRow label="Payment ID" value={order.paymentId.slice(0, 16) + "…"} />
              )}
              <DetailRow label="Product" value="Printed Book" />
            </div>

            {/* Shipping Address */}
            {addr && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-2">
                  <MapPin size={14} className="text-gray-400" />
                  Shipping To
                </div>
                <div className="text-[13px] text-gray-600 leading-relaxed space-y-0.5">
                  {(addr.firstName || addr.lastName) && (
                    <p className="font-medium text-gray-800">
                      {[addr.firstName, addr.lastName].filter(Boolean).join(" ")}
                    </p>
                  )}
                  {addr.addressLine1 && <p>{addr.addressLine1}</p>}
                  {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                  {(addr.city || addr.postCode) && (
                    <p>
                      {[addr.city, addr.postCode].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {addr.countryIsoCode && (
                    <p>{formatCountry(addr.countryIsoCode)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Delivery & Contact */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-2">
                <Calendar size={14} className="text-gray-400" />
                Delivery
              </div>

              {formatDeliveryRange(order.minDeliveryDate, order.maxDeliveryDate) ? (
                <DetailRow
                  label="Estimated"
                  value={formatDeliveryRange(order.minDeliveryDate, order.maxDeliveryDate)!}
                />
              ) : (
                <p className="text-[13px] text-gray-400 italic">
                  Delivery estimate available once printing begins
                </p>
              )}

              {order.trackingCode && (
                <DetailRow label="Tracking" value={order.trackingCode} />
              )}

              {addr?.email && (
                <div className="pt-3 mt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-gray-700 mb-2">
                    <Mail size={14} className="text-gray-400" />
                    Contact
                  </div>
                  <p className="text-[13px] text-gray-600">{addr.email}</p>
                  {addr.phone && (
                    <p className="text-[13px] text-gray-600 mt-0.5">{addr.phone}</p>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

// ─── Detail Row helper ───
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-4">
      <span className="text-[12px] text-gray-400 shrink-0">{label}</span>
      <span className="text-[13px] text-gray-700 text-right">{value}</span>
    </div>
  );
}