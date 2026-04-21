'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Package,
  FileText,
  CreditCard,
  Image as ImageIcon,
  ChevronRight,
  Truck,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { StepKey } from '@/lib/storySteps';
import UnifiedStoryHeader from '@/app/stories/components/StoryHeader';
import posthog from 'posthog-js';

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type OrderReadiness = {
  hasPdf: boolean;
  hasPayment: boolean;
  hasCovers: boolean;
  isReady: boolean;
  missingItems: string[];
};

type ShippingAddress = {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postCode: string;
  countryIsoCode: string;
  email: string;
  phone?: string;
};

const COUNTRY_OPTIONS: Array<{ code: string; name: string }> = [
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IE', name: 'Ireland' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
];

/* ------------------------------------------------------------------ */
/* FONT LOADER                                                         */
/* ------------------------------------------------------------------ */

function FontLoader() {
  return (
    // eslint-disable-next-line @next/next/no-page-custom-font
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      rel="stylesheet"
    />
  );
}

/* ------------------------------------------------------------------ */
/* MAIN COMPONENT                                                      */
/* ------------------------------------------------------------------ */

export default function OrderFlowClient({
  storyId,
  storyTitle,
  userId,
  currentStep = 'pay',
  completedSteps = [],
}: {
  storyId: string;
  storyTitle: string;
  userId: string;
  currentStep?: StepKey;
  completedSteps?: StepKey[];
}) {
  const router = useRouter();
  const [readiness, setReadiness] = useState<OrderReadiness | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    firstName: '',
    lastName: '',
    addressLine1: '',
    city: '',
    postCode: '',
    countryIsoCode: 'GB',
    email: '',
    phone: '',
    state: '',
    addressLine2: '',
  });

  useEffect(() => {
    async function checkReadiness() {
      const res = await fetch(`/api/orders/check-ready?storyId=${storyId}`);
      const data = await res.json();
      setReadiness(data);
    }
    checkReadiness();
  }, [storyId]);

  async function handleSubmitOrder() {
    if (!readiness?.isReady) return;

    if (
      !shippingAddress.firstName ||
      !shippingAddress.lastName ||
      !shippingAddress.addressLine1 ||
      !shippingAddress.city ||
      !shippingAddress.postCode ||
      !shippingAddress.email ||
      !shippingAddress.countryIsoCode
    ) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId, userId, shippingAddress }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to submit order');
        return;
      }

      // Mark pay step as complete
      await fetch(`/api/stories/${storyId}/complete-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'pay' }),
      });

      posthog.capture('order_form_submitted', {
        story_id: storyId,
        order_id: data.orderId,
        shipping_country: shippingAddress.countryIsoCode,
      });
      setOrderId(data.orderId);
    } catch (err) {
      console.error('Order submission failed:', err);
      posthog.captureException(err);
      alert('Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  }

  const needsState =
    shippingAddress.countryIsoCode === 'US' || shippingAddress.countryIsoCode === 'CA';

  const isFormValid =
    shippingAddress.firstName &&
    shippingAddress.lastName &&
    shippingAddress.addressLine1 &&
    shippingAddress.city &&
    shippingAddress.postCode &&
    shippingAddress.email &&
    shippingAddress.countryIsoCode &&
    (!needsState || shippingAddress.state);

  /* ------------------------------------------------------------------ */
  /* RENDER                                                              */
  /* ------------------------------------------------------------------ */

  return (
    <>
      <FontLoader />

      <div
        className="min-h-screen relative"
        style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
      >
        {/* Background */}
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

        {/* Header */}
        <UnifiedStoryHeader
          storyId={storyId}
          title={storyTitle}
          currentStep={currentStep}
          completedSteps={completedSteps}
        />

        {/* Body */}
        <main className="max-w-[820px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

          {/* Page Title */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8 sm:mb-10"
          >
            <div
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3"
              style={{ background: 'rgba(199,125,255,0.1)', color: '#9B59D0' }}
            >
              <Package className="w-3 h-3" /> Final Step
            </div>
            <h2
              className="text-2xl sm:text-3xl font-extrabold mb-2"
              style={{ color: '#2D2235', letterSpacing: '-0.03em' }}
            >
              Order Your Book
            </h2>
            <p
              className="text-sm sm:text-base max-w-md mx-auto leading-relaxed"
              style={{ color: '#7B6E90' }}
            >
              Your story is ready to become a real, printed book. Check everything looks
              good and we'll send it to print.
            </p>
          </motion.div>

          {/* ── LOADING STATE ── */}
          {!readiness && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-[22px] border p-12 flex flex-col items-center justify-center"
              style={{
                background: 'white',
                borderColor: 'rgba(180,150,210,0.12)',
                boxShadow: '0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)',
              }}
            >
              <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: '#C77DFF' }} />
              <p className="text-sm font-medium" style={{ color: '#7B6E90' }}>
                Checking order readiness…
              </p>
            </motion.div>
          )}

          {/* ── ORDER CONFIRMED ── */}
          {orderId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="rounded-[22px] border-2 p-8 sm:p-12 text-center"
              style={{
                background: 'white',
                borderColor: 'rgba(67,184,156,0.3)',
                boxShadow: '0 4px 24px rgba(67,184,156,0.1)',
              }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{
                  background: 'linear-gradient(135deg, #43B89C, #2FA482)',
                  boxShadow: '0 6px 20px rgba(67,184,156,0.3)',
                }}
              >
                <CheckCircle className="w-8 h-8 text-white" />
              </motion.div>

              <h2
                className="text-2xl font-extrabold mb-2"
                style={{ color: '#2D2235' }}
              >
                Order Submitted!
              </h2>
              <p className="text-sm mb-4 max-w-sm mx-auto" style={{ color: '#7B6E90' }}>
                Your book has been sent to printing. You'll receive an email when it ships.
              </p>

              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mb-8"
                style={{
                  background: 'rgba(67,184,156,0.08)',
                  color: '#2FA482',
                }}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Order ID: {orderId}
              </div>

              <div>
                <button
                  onClick={() => router.push(`/stories/${storyId}/studio`)}
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                    boxShadow: '0 4px 16px rgba(176,92,230,0.25)',
                    border: 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  Continue to Studio
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── MAIN FLOW ── */}
          {readiness && !orderId && (
            <div className="space-y-6">

              {/* Readiness Checklist */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-[22px] border overflow-hidden"
                style={{
                  background: 'white',
                  borderColor: readiness.isReady
                    ? 'rgba(67,184,156,0.2)'
                    : 'rgba(180,150,210,0.12)',
                  boxShadow: '0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)',
                }}
              >
                {/* Header */}
                <div
                  className="px-6 py-4 flex items-center gap-3 border-b"
                  style={{ borderColor: 'rgba(180,150,210,0.1)' }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{
                      background: readiness.isReady
                        ? 'linear-gradient(135deg, #43B89C, #2FA482)'
                        : 'linear-gradient(135deg, #E8D5FF, #FFD5E5)',
                    }}
                  >
                    {readiness.isReady ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <Sparkles className="w-4 h-4" style={{ color: '#B05CE6' }} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold" style={{ color: '#2D2235' }}>
                      {readiness.isReady ? 'Ready to Print' : 'Getting Ready'}
                    </h3>
                    <p className="text-[11px] mt-px" style={{ color: '#A897BD' }}>
                      {readiness.isReady
                        ? 'Everything checks out — your book is ready'
                        : 'A few things still needed before printing'}
                    </p>
                  </div>
                </div>

                {/* Checklist items */}
                <div className="px-6 py-5 space-y-3">
                  <ChecklistItem
                    ready={readiness.hasPdf}
                    icon={<FileText className="w-4 h-4" />}
                    label="PDF Generated"
                    description="Interior pages formatted and ready"
                  />
                  <ChecklistItem
                    ready={readiness.hasCovers}
                    icon={<ImageIcon className="w-4 h-4" />}
                    label="Cover Created"
                    description="Front, spine, and back cover prepared"
                  />
                  <ChecklistItem
                    ready={readiness.hasPayment}
                    icon={<CreditCard className="w-4 h-4" />}
                    label="Payment Confirmed"
                    description="Payment processed successfully"
                  />
                </div>

                {/* Missing items warning */}
                {readiness.missingItems.length > 0 && (
                  <div className="mx-6 mb-5">
                    <div
                      className="rounded-xl px-4 py-3.5"
                      style={{
                        background: 'rgba(255,179,71,0.08)',
                        border: '1px solid rgba(255,179,71,0.2)',
                      }}
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle
                          className="w-4 h-4 flex-shrink-0 mt-0.5"
                          style={{ color: '#E8940A' }}
                        />
                        <div>
                          <p
                            className="text-[13px] font-semibold mb-1"
                            style={{ color: '#8B6914' }}
                          >
                            Still needed
                          </p>
                          {readiness.missingItems.map((item, i) => (
                            <p
                              key={i}
                              className="text-[12px] leading-relaxed"
                              style={{ color: '#A88225' }}
                            >
                              {item}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>

              {/* Shipping Form */}
              <AnimatePresence>
                {readiness.isReady && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-[22px] border overflow-hidden"
                    style={{
                      background: 'white',
                      borderColor: 'rgba(180,150,210,0.12)',
                      boxShadow: '0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)',
                    }}
                  >
                    {/* Header */}
                    <div
                      className="px-6 py-4 flex items-center gap-3 border-b"
                      style={{ borderColor: 'rgba(180,150,210,0.1)' }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #E8D5FF, #FFD5E5)' }}
                      >
                        <Truck className="w-4 h-4" style={{ color: '#B05CE6' }} />
                      </div>
                      <div>
                        <h3 className="text-[15px] font-bold" style={{ color: '#2D2235' }}>
                          Shipping Details
                        </h3>
                        <p className="text-[11px] mt-px" style={{ color: '#A897BD' }}>
                          Where should we send your book?
                        </p>
                      </div>
                    </div>

                    {/* Form */}
                    <div className="px-6 py-5 space-y-4">

                      {/* Country */}
                      <div>
                        <label
                          className="block text-[12px] font-bold mb-1.5 uppercase"
                          style={{ color: '#6B5C80', letterSpacing: '0.08em' }}
                        >
                          Country
                        </label>
                        <select
                          value={shippingAddress.countryIsoCode}
                          onChange={(e) =>
                            setShippingAddress((prev) => ({
                              ...prev,
                              countryIsoCode: e.target.value,
                              state: '',
                            }))
                          }
                          className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all appearance-none"
                          style={{
                            border: '2px solid rgba(180,150,210,0.15)',
                            background: 'white',
                            color: '#2D2235',
                            fontFamily: 'inherit',
                          }}
                          onFocus={(e) => {
                            e.target.style.borderColor = '#C77DFF';
                            e.target.style.boxShadow = '0 0 0 4px rgba(199,125,255,0.1)';
                          }}
                          onBlur={(e) => {
                            e.target.style.borderColor = 'rgba(180,150,210,0.15)';
                            e.target.style.boxShadow = 'none';
                          }}
                        >
                          {COUNTRY_OPTIONS.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Name row */}
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput
                          placeholder="First name"
                          value={shippingAddress.firstName}
                          onChange={(v) => setShippingAddress({ ...shippingAddress, firstName: v })}
                          required
                        />
                        <FormInput
                          placeholder="Last name"
                          value={shippingAddress.lastName}
                          onChange={(v) => setShippingAddress({ ...shippingAddress, lastName: v })}
                          required
                        />
                      </div>

                      {/* Address */}
                      <FormInput
                        placeholder="Address line 1"
                        value={shippingAddress.addressLine1}
                        onChange={(v) => setShippingAddress({ ...shippingAddress, addressLine1: v })}
                        required
                      />

                      <FormInput
                        placeholder="Address line 2 (optional)"
                        value={shippingAddress.addressLine2 ?? ''}
                        onChange={(v) => setShippingAddress({ ...shippingAddress, addressLine2: v })}
                      />

                      {/* City + Postcode */}
                      <div className="grid grid-cols-2 gap-3">
                        <FormInput
                          placeholder="City"
                          value={shippingAddress.city}
                          onChange={(v) => setShippingAddress({ ...shippingAddress, city: v })}
                          required
                        />
                        <FormInput
                          placeholder="Postcode / Zip"
                          value={shippingAddress.postCode}
                          onChange={(v) => setShippingAddress({ ...shippingAddress, postCode: v })}
                          required
                        />
                      </div>

                      {/* State (US/CA only) */}
                      {needsState && (
                        <FormInput
                          placeholder="State / Province"
                          value={shippingAddress.state ?? ''}
                          onChange={(v) => setShippingAddress({ ...shippingAddress, state: v })}
                          required
                        />
                      )}

                      {/* Contact */}
                      <FormInput
                        type="email"
                        placeholder="Email address"
                        value={shippingAddress.email}
                        onChange={(v) => setShippingAddress({ ...shippingAddress, email: v })}
                        required
                      />

                      <FormInput
                        type="tel"
                        placeholder="Phone (optional)"
                        value={shippingAddress.phone ?? ''}
                        onChange={(v) => setShippingAddress({ ...shippingAddress, phone: v })}
                      />
                    </div>

                    {/* Submit */}
                    <div
                      className="px-6 pt-3 pb-6"
                      style={{ borderTop: '1px solid rgba(180,150,210,0.08)' }}
                    >
                      <button
                        onClick={handleSubmitOrder}
                        disabled={isSubmitting || !isFormValid}
                        className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2.5 active:scale-[0.98] transition-all disabled:opacity-40"
                        style={{
                          background: 'linear-gradient(135deg, #B05CE6, #D45DA0)',
                          boxShadow: '0 4px 16px rgba(176,92,230,0.25)',
                          border: 'none',
                          fontFamily: 'inherit',
                        }}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Submitting Order…
                          </>
                        ) : (
                          <>
                            <Package className="w-5 h-5" />
                            Submit Order to Print
                          </>
                        )}
                      </button>

                      <div className="flex items-center justify-center gap-2 mt-3">
                        <ShieldCheck className="w-3 h-3" style={{ color: '#A897BD' }} />
                        <span className="text-[11px] font-medium" style={{ color: '#A897BD' }}>
                          Printed by Gelato — shipped worldwide
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* CHECKLIST ITEM                                                      */
/* ------------------------------------------------------------------ */

function ChecklistItem({
  ready,
  icon,
  label,
  description,
}: {
  ready: boolean;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div
      className="flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all"
      style={{
        background: ready ? 'rgba(67,184,156,0.06)' : 'rgba(180,150,210,0.04)',
        border: ready
          ? '1px solid rgba(67,184,156,0.15)'
          : '1px solid rgba(180,150,210,0.08)',
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: ready
            ? 'linear-gradient(135deg, #43B89C, #2FA482)'
            : 'rgba(180,150,210,0.1)',
          boxShadow: ready ? '0 2px 8px rgba(67,184,156,0.2)' : 'none',
        }}
      >
        {ready ? (
          <CheckCircle className="w-4 h-4 text-white" />
        ) : (
          <span style={{ color: '#A897BD' }}>{icon}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-bold"
          style={{ color: ready ? '#2FA482' : '#6B5C80' }}
        >
          {label}
        </p>
        <p className="text-[11px]" style={{ color: '#A897BD' }}>
          {description}
        </p>
      </div>
      {ready && (
        <span className="text-[10px] font-bold flex-shrink-0" style={{ color: '#43B89C' }}>
          Done
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FORM INPUT                                                          */
/* ------------------------------------------------------------------ */

function FormInput({
  type = 'text',
  placeholder,
  value,
  onChange,
  required,
}: {
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
      style={{
        border: '2px solid rgba(180,150,210,0.15)',
        background: 'white',
        color: '#2D2235',
        fontFamily: 'inherit',
      }}
      onFocus={(e) => {
        e.target.style.borderColor = '#C77DFF';
        e.target.style.boxShadow = '0 0 0 4px rgba(199,125,255,0.1)';
      }}
      onBlur={(e) => {
        e.target.style.borderColor = 'rgba(180,150,210,0.15)';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}