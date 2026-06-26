// src/app/stories/[id]/checkout/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Sparkles,
  CheckCircle,
  BookOpen,
  Loader2,
  Lock,
  ChevronRight,
  ChevronDown,
  Download,
  Gift,
  Printer,
  Check,
  Tag,
  X,
  Globe,
} from 'lucide-react';
import type { StepKey } from '@/lib/storySteps';
import UnifiedStoryHeader from '@/app/stories/components/StoryHeader';
import {
  CURRENCIES,
  PRICES,
  formatPrice,
  getPriceCents,
  applyDiscount,
  resolvePromoDiscount,
  type CurrencyCode,
  type ProductType,
} from '@/lib/pricing';

type TierKey = ProductType;

type TierDef = {
  key: TierKey;
  label: string;
  badge?: string;
  icon: React.ReactNode;
  features: string[];
  description: string;
};

const TIER_DEFS: TierDef[] = [
  {
    key: 'digital',
    label: 'Print at home PDF',
    icon: <Download className="w-4 h-4" />,
    description: 'Read on any device, print at home',
    features: [
      'Fully personalised story',
      'Custom AI illustrations',
      'High-quality PDF download',
      'Unlimited re-reads',
    ],
  },
  {
    key: 'print',
    label: 'Printed Storybook',
    badge: 'Most Loved',
    icon: <Printer className="w-4 h-4" />,
    description: 'Premium softcover, delivered to your door',
    features: [
      'Everything in Digital',
      'Premium soft-touch cover',
      'Beautiful full-colour pages',
      'Free delivery',
    ],
  },
  {
    key: 'gift',
    label: 'Gift Edition',
    icon: <Gift className="w-4 h-4" />,
    description: 'Hardcover keepsake, gift-ready',
    features: [
      'Deluxe hardcover book',
      'Gift-ready presentation',
      'Designed to be kept forever',
      'Free delivery',
    ],
  },
];

function getTierDef(key: string): TierDef {
  return TIER_DEFS.find((t) => t.key === key) || TIER_DEFS[1];
}

function FontLoader() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      rel="stylesheet"
    />
  );
}

type PromoState = {
  code: string;
  valid: boolean;
  label: string;
  discountPercent: number;
  isFree: boolean;
  discountedCents: number;
  savings: string;
} | null;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<StepKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [generationStarted, setGenerationStarted] = useState(false);
  const [selectedTier, setSelectedTier] = useState<TierKey>('print');
  const [savingProduct, setSavingProduct] = useState(false);
  const [productReady, setProductReady] = useState(false);

  // Currency
  const [currency, setCurrency] = useState<CurrencyCode>('GBP');
  const [currencyOpen, setCurrencyOpen] = useState(false);

  // Promo
  const [promoInput, setPromoInput] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoState, setPromoState] = useState<PromoState>(null);
  const [promoError, setPromoError] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);

  const tierDef = getTierDef(selectedTier);
  const baseCents = getPriceCents(selectedTier, currency);
  const finalCents = promoState?.valid ? promoState.discountedCents : baseCents;
  const isFreeOrder = finalCents === 0;

  const saveProductSelection = useCallback(
    async (productType: TierKey, cur?: CurrencyCode) => {
      setSavingProduct(true);
      try {
        const res = await fetch(`/api/stories/${storyId}/product`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productType, currency: cur ?? currency }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to save product selection');
        setSelectedTier(productType);
        setProductReady(true);
        return data;
      } finally {
        setSavingProduct(false);
      }
    },
    [storyId, currency]
  );

  // Detect currency on mount
  useEffect(() => {
    fetch('/api/geo/currency')
      .then((r) => r.json())
      .then((data) => {
        if (data.currency && data.currency in CURRENCIES) {
          setCurrency(data.currency as CurrencyCode);
        }
      })
      .catch(() => {}); // fallback to GBP
  }, []);

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    async function load() {
      try {
        const [productRes, storyRes] = await Promise.all([
          fetch(`/api/stories/${storyId}/product`),
          fetch(`/api/stories/${storyId}`),
        ]);

        const productData = await productRes.json();
        const storyData = await storyRes.json();

        if (!storyRes.ok) throw new Error(storyData?.error || 'Failed to load story');
        if (cancelled) return;

        const s = storyData.story;
        setStory(s);
        setCompletedSteps((s.completedSteps as StepKey[]) || []);

        if (s.paymentStatus === 'paid') {
          router.replace(`/stories/${storyId}/studio`);
          return;
        }

        if (productRes.ok && productData?.productSelected && productData?.productType) {
          setSelectedTier(productData.productType as TierKey);
          if (productData.currency && productData.currency in CURRENCIES) {
            setCurrency(productData.currency as CurrencyCode);
          }
          setProductReady(true);
        } else {
          await saveProductSelection('print');
        }

        if (!cancelled) setLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load checkout');
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [storyId, router, saveProductSelection]);

  async function handleTierChange(newTier: TierKey) {
    if (newTier === selectedTier || savingProduct || processing) return;
    // Re-validate promo for new tier
    if (promoState?.valid) {
      await validatePromo(promoState.code, newTier);
    }
    try {
      await saveProductSelection(newTier);
    } catch (e: any) {
      alert(e?.message || 'Could not save your book format.');
    }
  }

  async function handleCurrencyChange(newCurrency: CurrencyCode) {
    setCurrency(newCurrency);
    setCurrencyOpen(false);
    // Re-validate promo for new currency
    if (promoState?.valid) {
      await validatePromo(promoState.code, selectedTier, newCurrency);
    }
    // Save currency to product
    try {
      await saveProductSelection(selectedTier, newCurrency);
    } catch {}
  }

  async function validatePromo(code: string, product?: TierKey, cur?: CurrencyCode) {
    setPromoLoading(true);
    setPromoError('');
    try {
      const res = await fetch('/api/promo/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          productType: product ?? selectedTier,
          currency: cur ?? currency,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setPromoState({
          code: data.code,
          valid: true,
          label: data.label,
          discountPercent: data.discountPercent,
          isFree: data.isFree,
          discountedCents: data.discountedCents,
          savings: data.savings,
        });
        setPromoError('');
      } else {
        setPromoState(null);
        setPromoError(data.reason || 'Invalid code');
      }
    } catch {
      setPromoError('Could not validate code');
    } finally {
      setPromoLoading(false);
    }
  }

  function clearPromo() {
    setPromoState(null);
    setPromoInput('');
    setPromoError('');
  }

  async function handleFreeCheckout() {
    if (!promoState?.valid || !promoState.isFree) return;
    setProcessing(true);
    try {
      await saveProductSelection(selectedTier);
      const res = await fetch(`/api/stories/${storyId}/claim-free`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promoCode: promoState.code }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data?.error || 'Failed to claim free product');
      await fetch(`/api/stories/${storyId}/complete-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: 'pay' }),
      });
      setCompletedSteps((prev) => (prev.includes('pay') ? prev : [...prev, 'pay']));
      setJustPaid(true);
      startGeneration();
    } catch (err: any) {
      alert(err?.message || 'Something went wrong.');
    } finally {
      setProcessing(false);
    }
  }

  async function startGeneration() {
    if (generationStarted) return;
    setGenerationStarted(true);
    try {
      await fetch(`/api/stories/${storyId}/generate-all`, { method: 'POST' });
    } catch {}
  }

  const curConfig = CURRENCIES[currency];

  /* ================================================================
     RENDER — Loading / Error / Success / Main
  ================================================================ */

  if (!storyId) {
    return (
      <Shell>
        <div className="max-w-md mx-auto">
          <Card>
            <div className="p-8 text-center">
              <IconBox color="amber"><BookOpen className="w-7 h-7" style={{ color: '#E8940A' }} /></IconBox>
              <h2 className="text-xl font-extrabold mb-2" style={{ color: '#2D2235' }}>Missing Story</h2>
              <p className="text-sm mb-6" style={{ color: '#7B6E90' }}>Please return to your story and try checkout again.</p>
              <Btn onClick={() => router.push('/projects')}>Go to Library</Btn>
            </div>
          </Card>
        </div>
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <div className="max-w-md mx-auto pt-12">
          <div className="flex flex-col items-center text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative mb-8">
              <motion.div animate={{ rotateY: [0, 15, -15, 0], scale: [1, 1.05, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #E8D5FF, #FFD5E5)', boxShadow: '0 8px 32px rgba(176,92,230,0.2)' }}>
                <BookOpen className="w-9 h-9" style={{ color: '#B05CE6' }} />
              </motion.div>
              <motion.div animate={{ y: [-4, 4, -4], opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -top-2 -right-2">
                <Sparkles className="w-4 h-4" style={{ color: '#C77DFF' }} />
              </motion.div>
            </motion.div>
            <motion.h3 initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-xl font-extrabold mb-2" style={{ color: '#2D2235' }}>Preparing your checkout</motion.h3>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-sm max-w-xs" style={{ color: '#7B6E90' }}>Loading your story details and pricing…</motion.p>
            <div className="flex gap-1.5 mt-6">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} animate={{ scale: [1, 1.4, 1], opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} className="w-2 h-2 rounded-full" style={{ background: '#B05CE6' }} />
              ))}
            </div>
          </div>
        </div>
      </Shell>
    );
  }

  if (error || !story) {
    return (
      <Shell>
        <div className="max-w-md mx-auto">
          <Card>
            <div className="p-8 text-center">
              <IconBox color="red"><ShieldCheck className="w-7 h-7" style={{ color: '#EF4444' }} /></IconBox>
              <h2 className="text-xl font-extrabold mb-2" style={{ color: '#2D2235' }}>Checkout Failed</h2>
              <p className="text-sm mb-6" style={{ color: '#7B6E90' }}>{error || 'Something went wrong.'}</p>
              <BtnSecondary onClick={() => router.back()}>Go Back</BtnSecondary>
            </div>
          </Card>
        </div>
      </Shell>
    );
  }

  if (justPaid) {
    return (
      <Shell storyId={storyId} storyTitle={story.title} currentStep="pay" completedSteps={completedSteps} paymentStatus="paid">
        <div className="max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200 }}>
            <Card border="green">
              <div className="p-8 sm:p-12 text-center">
                <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }} className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #43B89C, #2FA482)', boxShadow: '0 6px 20px rgba(67,184,156,0.3)' }}>
                  <CheckCircle className="w-8 h-8 text-white" />
                </motion.div>
                <h2 className="text-2xl font-extrabold mb-2" style={{ color: '#2D2235' }}>
                  {isFreeOrder ? 'Book Unlocked!' : 'Payment Complete!'}
                </h2>
                <p className="text-sm mb-2 max-w-sm mx-auto" style={{ color: '#7B6E90' }}>
                  Your book is unlocked and we&apos;re generating illustrations for every page now. This usually takes a few minutes.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mb-8 mt-4" style={{ background: 'rgba(67,184,156,0.08)', color: '#2FA482' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}><Loader2 className="w-3.5 h-3.5" /></motion.div>
                  Generating illustrations…
                </div>
                <div>
                  <Btn onClick={() => router.push(`/stories/${storyId}/studio`)}>
                    Go to Studio <ChevronRight className="w-4 h-4" />
                  </Btn>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </Shell>
    );
  }

  /* ================================================================
     MAIN CHECKOUT VIEW
  ================================================================ */

  return (
    <Shell storyId={storyId} storyTitle={story.title} currentStep="pay" completedSteps={completedSteps} paymentStatus={story.paymentStatus}>
      <div className="max-w-[960px] mx-auto">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: 'rgba(199,125,255,0.1)', color: '#9B59D0' }}>
            <Sparkles className="w-3 h-3" /> Unlock Your Book
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: '#2D2235', letterSpacing: '-0.03em' }}>Bring Your Story to Life</h2>
          <p className="text-sm sm:text-base max-w-lg mx-auto leading-relaxed" style={{ color: '#7B6E90' }}>
            Choose your format, then pay to unlock full AI illustration for{' '}
            <strong style={{ color: '#2D2235' }}>{story.title}</strong>.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT — Order Summary */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader icon={<BookOpen className="w-4 h-4" style={{ color: '#B05CE6' }} />} title="Order Summary" subtitle={story.title} />

              {story.coverSpreadUrl && (
                <div className="px-6 pt-5 pb-3">
                  <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(180,150,210,0.12)', boxShadow: '0 4px 16px rgba(100,60,140,0.08)' }}>
                    <img src={story.coverSpreadUrl} alt="Cover preview" className="w-full h-auto object-cover" loading="lazy" />
                  </div>
                </div>
              )}

              <div className="px-6 pt-4 pb-2">
                <h4 className="text-lg font-extrabold" style={{ color: '#2D2235', fontFamily: "'Lora', serif", fontStyle: 'italic' }}>{story.title}</h4>
              </div>

              {/* Currency picker */}
              <div className="px-6 pt-2 pb-1">
                <CurrencyPicker currency={currency} open={currencyOpen} setOpen={setCurrencyOpen} onChange={handleCurrencyChange} disabled={savingProduct || processing} />
              </div>

              {/* Tier dropdown */}
              <div className="px-6 py-4">
                <TierDropdown selected={selectedTier} onChange={handleTierChange} disabled={savingProduct || processing} currency={currency} promoState={promoState} />
                {savingProduct && (
                  <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: '#7B6E90' }}>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving book format…
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="px-6 pb-5">
                <AnimatePresence mode="wait">
                  <motion.div key={selectedTier} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="space-y-2">
                    {tierDef.features.map((f) => (
                      <div key={f} className="flex items-center gap-2.5">
                        <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#43B89C' }} />
                        <span className="text-[13px]" style={{ color: '#5A4D6B' }}>{f}</span>
                      </div>
                    ))}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Total */}
              <div className="px-6 py-4" style={{ borderTop: '1px solid rgba(180,150,210,0.1)' }}>
                {promoState?.valid && (
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" style={{ color: '#2FA482' }} />
                      <span className="text-xs font-semibold" style={{ color: '#2FA482' }}>{promoState.label}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: '#2FA482' }}>−{promoState.savings}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-base font-extrabold" style={{ color: '#2D2235' }}>Total</span>
                  <div className="flex items-center gap-2">
                    {promoState?.valid && (
                      <span className="text-sm line-through" style={{ color: '#A897BD' }}>{formatPrice(baseCents, currency)}</span>
                    )}
                    <span className="text-xl font-extrabold" style={{ color: isFreeOrder ? '#2FA482' : '#2FA482' }}>
                      {isFreeOrder ? 'FREE' : formatPrice(finalCents, currency)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* RIGHT — Payment */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="lg:sticky lg:top-28">
              <Card>
                <CardHeader icon={<Lock className="w-4 h-4" style={{ color: '#B05CE6' }} />} title="Secure Payment" subtitle="Card or PayPal balance" />

                <div className="px-6 py-6">
                  {/* Price summary */}
                  <div className="flex items-center justify-between mb-5 pb-4" style={{ borderBottom: '1px solid rgba(180,150,210,0.1)' }}>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#2D2235' }}>{tierDef.label}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: '#A897BD' }}>{tierDef.description}</p>
                    </div>
                    <p className="text-xl font-extrabold" style={{ color: '#2FA482' }}>
                      {isFreeOrder ? 'FREE' : formatPrice(finalCents, currency)}
                    </p>
                  </div>

                  {/* Promo code */}
                  <PromoCodeInput
                    promoInput={promoInput}
                    setPromoInput={setPromoInput}
                    promoState={promoState}
                    promoError={promoError}
                    promoLoading={promoLoading}
                    promoOpen={promoOpen}
                    setPromoOpen={setPromoOpen}
                    onValidate={() => validatePromo(promoInput)}
                    onClear={clearPromo}
                    disabled={processing}
                  />

                  {/* Loading state */}
                  {(processing || savingProduct || !productReady) && (
                    <div className="flex items-center justify-center gap-2 py-8">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#B05CE6' }} />
                      <span className="text-sm font-semibold" style={{ color: '#6B5C80' }}>
                        {savingProduct || !productReady ? 'Saving your selected format…' : 'Processing payment…'}
                      </span>
                    </div>
                  )}

                  {/* FREE checkout button */}
                  {isFreeOrder && !processing && !savingProduct && productReady && (
                    <button
                      onClick={handleFreeCheckout}
                      className="w-full py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 active:scale-[0.98] transition-transform mt-4"
                      style={{ background: 'linear-gradient(135deg, #43B89C, #2FA482)', boxShadow: '0 4px 20px rgba(67,184,156,0.3)', border: 'none', fontFamily: 'inherit' }}
                    >
                      <Sparkles className="w-5 h-5" />
                      Unlock Book for Free
                    </button>
                  )}

                  {/* PayPal buttons */}
                  <div style={{ display: isFreeOrder || processing || savingProduct || !productReady ? 'none' : 'block' }}>
                    <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!, currency, intent: 'capture' }}>
                      <PayPalButtons
                        key={`${selectedTier}-${currency}-${promoState?.code ?? 'none'}`}
                        style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 48 }}
                        createOrder={async () => {
                          await saveProductSelection(selectedTier);
                          const res = await fetch('/api/paypal/order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              storyId,
                              price: (finalCents / 100).toFixed(2),
                              currency,
                              promoCode: promoState?.valid ? promoState.code : undefined,
                            }),
                          });
                          const data = await res.json();
                          if (!res.ok || !data.orderID) throw new Error(data?.error || 'Failed to create order');
                          return data.orderID;
                        }}
                        onApprove={async (data) => {
                          setProcessing(true);
                          try {
                            const res = await fetch('/api/paypal/capture', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                orderID: data.orderID,
                                promoCode: promoState?.valid ? promoState.code : undefined,
                              }),
                            });
                            const result = await res.json();
                            if (!res.ok || !result.success) throw new Error(result?.error || 'Payment capture failed.');
                            await fetch(`/api/stories/${storyId}/complete-step`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ step: 'pay' }),
                            });
                            setCompletedSteps((prev) => prev.includes('pay') ? prev : [...prev, 'pay']);
                            setJustPaid(true);
                            startGeneration();
                          } catch (err: any) {
                            alert(err?.message || 'Payment processed but something went wrong.');
                          } finally {
                            setProcessing(false);
                          }
                        }}
                        onError={(err) => { console.error('PayPal error:', err); setProcessing(false); alert('Payment failed. Please try again.'); }}
                        onCancel={() => setProcessing(false)}
                      />
                    </PayPalScriptProvider>
                  </div>
                </div>

                {/* Trust badges */}
                <div className="px-6 pb-5 flex flex-wrap gap-2" style={{ borderTop: '1px solid rgba(180,150,210,0.08)', paddingTop: 16 }}>
                  <TrustBadge icon={<Lock className="w-3 h-3" />}>Encrypted</TrustBadge>
                  <TrustBadge icon={<ShieldCheck className="w-3 h-3" />}>Buyer protection</TrustBadge>
                  <TrustBadge icon={<Sparkles className="w-3 h-3" />}>Instant unlock</TrustBadge>
                </div>

                <div className="px-6 pb-6 text-center">
                  <button onClick={() => router.back()} className="text-[12px] font-medium underline" style={{ color: '#A897BD', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textUnderlineOffset: '3px' }}>
                    Cancel and go back
                  </button>
                </div>
              </Card>
            </div>
          </motion.div>
        </div>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/*  CURRENCY PICKER                                                            */
/* -------------------------------------------------------------------------- */

function CurrencyPicker({ currency, open, setOpen, onChange, disabled }: { currency: CurrencyCode; open: boolean; setOpen: (v: boolean) => void; onChange: (c: CurrencyCode) => void; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const config = CURRENCIES[currency];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, setOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
        style={{
          background: open ? 'rgba(176,92,230,0.08)' : 'rgba(180,150,210,0.06)',
          color: '#6B5C80',
          border: open ? '1.5px solid rgba(176,92,230,0.2)' : '1.5px solid rgba(180,150,210,0.1)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <Globe className="w-3 h-3" />
        {config.flag} {config.code}
        <ChevronDown className="w-3 h-3" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 left-0 mt-1.5 rounded-xl overflow-hidden"
            style={{ background: 'white', border: '1.5px solid rgba(180,150,210,0.15)', boxShadow: '0 8px 24px rgba(100,60,140,0.12)', minWidth: 180 }}
          >
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => {
              const c = CURRENCIES[code];
              const isSelected = code === currency;
              return (
                <button
                  key={code}
                  onClick={() => onChange(code)}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-xs font-semibold transition-colors"
                  style={{
                    background: isSelected ? 'rgba(176,92,230,0.04)' : 'transparent',
                    color: isSelected ? '#2D2235' : '#6B5C80',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    borderTop: code !== 'GBP' ? '1px solid rgba(180,150,210,0.06)' : 'none',
                  }}
                >
                  <span>{c.flag}</span>
                  <span className="flex-1">{c.label}</span>
                  <span style={{ color: '#A897BD' }}>{c.symbol}</span>
                  {isSelected && <Check className="w-3 h-3" style={{ color: '#B05CE6' }} />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  PROMO CODE INPUT                                                           */
/* -------------------------------------------------------------------------- */

function PromoCodeInput({ promoInput, setPromoInput, promoState, promoError, promoLoading, promoOpen, setPromoOpen, onValidate, onClear, disabled }: {
  promoInput: string; setPromoInput: (v: string) => void;
  promoState: PromoState; promoError: string; promoLoading: boolean;
  promoOpen: boolean; setPromoOpen: (v: boolean) => void;
  onValidate: () => void; onClear: () => void; disabled: boolean;
}) {
  if (promoState?.valid) {
    return (
      <div className="mb-5 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(67,184,156,0.06)', border: '1px solid rgba(67,184,156,0.15)' }}>
        <Tag className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#2FA482' }} />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold" style={{ color: '#2FA482' }}>{promoState.code}</span>
          <span className="text-[11px] ml-1.5" style={{ color: '#7B6E90' }}>
            {promoState.isFree ? 'Free!' : `${promoState.discountPercent}% off`} — saves {promoState.savings}
          </span>
        </div>
        <button onClick={onClear} disabled={disabled} className="p-1 rounded-full" style={{ background: 'rgba(67,184,156,0.1)', border: 'none', color: '#2FA482', cursor: 'pointer' }}>
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (!promoOpen) {
    return (
      <button
        onClick={() => setPromoOpen(true)}
        className="mb-5 text-[12px] font-medium flex items-center gap-1.5"
        style={{ color: '#A897BD', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <Tag className="w-3 h-3" /> Have a promo code?
      </button>
    );
  }

  return (
    <div className="mb-5">
      <div className="flex gap-2">
        <input
          value={promoInput}
          onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
          placeholder="Enter code"
          disabled={promoLoading || disabled}
          className="flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none"
          style={{ border: promoError ? '1.5px solid rgba(233,30,99,0.4)' : '1.5px solid rgba(180,150,210,0.2)', background: '#FDFBFF', color: '#2D2235', fontFamily: 'inherit' }}
          onKeyDown={(e) => e.key === 'Enter' && promoInput.trim() && onValidate()}
        />
        <button
          onClick={onValidate}
          disabled={!promoInput.trim() || promoLoading || disabled}
          className="px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #B05CE6, #D45DA0)', border: 'none', fontFamily: 'inherit', cursor: 'pointer' }}
        >
          {promoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Apply'}
        </button>
      </div>
      {promoError && <p className="text-[11px] mt-1.5 font-semibold" style={{ color: '#E91E63' }}>{promoError}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  TIER DROPDOWN                                                              */
/* -------------------------------------------------------------------------- */

function TierDropdown({ selected, onChange, disabled = false, currency, promoState }: {
  selected: TierKey; onChange: (t: TierKey) => void; disabled?: boolean; currency: CurrencyCode; promoState: PromoState;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const tier = getTierDef(selected);
  const priceCents = getPriceCents(selected, currency);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <label className="block text-[11px] font-bold uppercase mb-2" style={{ color: '#6B5C80', letterSpacing: '0.08em' }}>Book format</label>

      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all"
        style={{ background: 'white', border: open ? '2px solid #B05CE6' : '2px solid rgba(180,150,210,0.18)', boxShadow: open ? '0 2px 12px rgba(176,92,230,0.1)' : 'none', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.7 : 1, fontFamily: 'inherit' }}
      >
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #B05CE6, #D45DA0)', color: 'white' }}>{tier.icon}</div>
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold" style={{ color: '#2D2235' }}>{tier.label}</span>
            {tier.badge && <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: '#D94590' }}>{tier.badge}</span>}
          </div>
          <span className="text-[12px]" style={{ color: '#7B6E90' }}>{tier.description}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-extrabold" style={{ color: '#2D2235' }}>{formatPrice(priceCents, currency)}</span>
          <ChevronDown className="w-4 h-4 transition-transform" style={{ color: '#A897BD', transform: open ? 'rotate(180deg)' : 'none' }} />
        </div>
      </button>

      <AnimatePresence>
        {open && !disabled && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.98 }} transition={{ duration: 0.15 }} className="absolute z-50 left-0 right-0 mt-2 rounded-2xl overflow-hidden" style={{ background: 'white', border: '1.5px solid rgba(180,150,210,0.15)', boxShadow: '0 8px 32px rgba(100,60,140,0.12), 0 2px 8px rgba(100,60,140,0.06)' }}>
            {TIER_DEFS.map((t, i) => {
              const isSelected = t.key === selected;
              const cents = getPriceCents(t.key, currency);
              return (
                <button key={t.key} onClick={() => { onChange(t.key); setOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left" style={{ background: isSelected ? 'rgba(176,92,230,0.04)' : 'transparent', borderTop: i > 0 ? '1px solid rgba(180,150,210,0.08)' : 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: isSelected ? 'linear-gradient(135deg, #B05CE6, #D45DA0)' : 'rgba(199,125,255,0.08)', color: isSelected ? 'white' : '#9B59D0' }}>{t.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold" style={{ color: isSelected ? '#2D2235' : '#5A4D6B' }}>{t.label}</span>
                      {t.badge && <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full" style={{ background: '#D94590' }}>{t.badge}</span>}
                    </div>
                    <span className="text-[11px]" style={{ color: '#A897BD' }}>{t.description}</span>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0">
                    <span className="text-[15px] font-extrabold" style={{ color: isSelected ? '#2D2235' : '#7B6E90' }}>{formatPrice(cents, currency)}</span>
                    {isSelected && <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#B05CE6' }}><Check className="w-3 h-3 text-white" /></div>}
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SHELL + HELPERS                                                            */
/* -------------------------------------------------------------------------- */

function Shell({ children, storyId, storyTitle, currentStep, completedSteps = [], paymentStatus }: { children: React.ReactNode; storyId?: string; storyTitle?: string; currentStep?: StepKey; completedSteps?: StepKey[]; paymentStatus?: string | null }) {
  return (
    <>
      <FontLoader />
      <div className="min-h-screen relative" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
        <div className="fixed inset-0 -z-10" style={{ background: `radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%), #F9F5FF` }}>
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
        </div>
        {storyId && storyTitle && currentStep && <UnifiedStoryHeader storyId={storyId} title={storyTitle} currentStep={currentStep} completedSteps={completedSteps} paymentStatus={paymentStatus} hasPages={true} />}
        <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">{children}</main>
      </div>
    </>
  );
}

function Card({ children, border = 'default' }: { children: React.ReactNode; border?: 'default' | 'green' }) {
  return (
    <div className="rounded-[22px] border" style={{ background: 'white', borderColor: border === 'green' ? 'rgba(67,184,156,0.3)' : 'rgba(180,150,210,0.12)', boxShadow: border === 'green' ? '0 4px 24px rgba(67,184,156,0.1)' : '0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)' }}>{children}</div>
  );
}

function CardHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="px-6 py-4 flex items-center gap-3 border-b" style={{ borderColor: 'rgba(180,150,210,0.1)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #E8D5FF, #FFD5E5)' }}>{icon}</div>
      <div>
        <h3 className="text-[15px] font-bold" style={{ color: '#2D2235' }}>{title}</h3>
        <p className="text-[11px] mt-px" style={{ color: '#A897BD' }}>{subtitle}</p>
      </div>
    </div>
  );
}

function IconBox({ children, color }: { children: React.ReactNode; color: 'amber' | 'red' }) {
  return <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: color === 'amber' ? 'rgba(255,179,71,0.1)' : 'rgba(239,68,68,0.08)' }}>{children}</div>;
}

function TrustBadge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(180,150,210,0.06)', color: '#8B7BA0', border: '1px solid rgba(180,150,210,0.1)' }}>{icon}{children}</span>;
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #B05CE6, #D45DA0)', boxShadow: '0 4px 16px rgba(176,92,230,0.25)', border: 'none', fontFamily: 'inherit' }}>{children}</button>;
}

function BtnSecondary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95" style={{ color: '#6B5C80', background: 'white', border: '1.5px solid rgba(180,150,210,0.2)', fontFamily: 'inherit' }}>{children}</button>;
}