'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Sparkles,
  CheckCircle,
  Wand2,
  BookOpen,
  Palette,
  Loader2,
  Lock,
  ChevronRight,
} from 'lucide-react';
import type { StepKey } from '@/lib/storySteps';
import UnifiedStoryHeader from '@/app/stories/components/StoryHeader';

const PRICE_GBP = '29.99';

function FontLoader() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600;12..96,700;12..96,800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap"
      rel="stylesheet"
    />
  );
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<any>(null);
  const [completedSteps, setCompletedSteps] = useState<StepKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    fetch(`/api/stories/${storyId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load story');
        return data;
      })
      .then((data) => {
        if (cancelled) return;
        setStory(data.story);
        setCompletedSteps((data.story.completedSteps as StepKey[]) || []);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.message || 'Failed to load checkout');
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [storyId]);

  /* ── MISSING STORY ID ── */
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

  /* ── LOADING ── */
  if (loading) {
    return (
      <Shell>
        <div className="max-w-md mx-auto">
          <Card>
            <div className="p-12 flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin mb-3" style={{ color: '#C77DFF' }} />
              <p className="text-sm font-medium" style={{ color: '#7B6E90' }}>Loading checkout…</p>
            </div>
          </Card>
        </div>
      </Shell>
    );
  }

  /* ── ERROR ── */
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

  /* ── PAYMENT COMPLETE ── */
  if (paymentComplete) {
    return (
      <Shell storyId={storyId} storyTitle={story.title} currentStep="pay" completedSteps={completedSteps}>
        <div className="max-w-lg mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 200 }}>
            <Card border="green">
              <div className="p-8 sm:p-12 text-center">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: 'linear-gradient(135deg, #43B89C, #2FA482)', boxShadow: '0 6px 20px rgba(67,184,156,0.3)' }}
                >
                  <CheckCircle className="w-8 h-8 text-white" />
                </motion.div>
                <h2 className="text-2xl font-extrabold mb-2" style={{ color: '#2D2235' }}>Payment Complete!</h2>
                <p className="text-sm mb-2 max-w-sm mx-auto" style={{ color: '#7B6E90' }}>
                  Your book is now unlocked. We're generating illustrations for every page — this usually takes a few minutes.
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold mb-8 mt-4" style={{ background: 'rgba(67,184,156,0.08)', color: '#2FA482' }}>
                  <Sparkles className="w-3.5 h-3.5" /> Generation in progress
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

  /* ── MAIN CHECKOUT ── */
  return (
    <Shell storyId={storyId} storyTitle={story.title} currentStep="pay" completedSteps={completedSteps}>
      <div className="max-w-[960px] mx-auto">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: 'rgba(199,125,255,0.1)', color: '#9B59D0' }}>
            <Sparkles className="w-3 h-3" /> Unlock Your Book
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2" style={{ color: '#2D2235', letterSpacing: '-0.03em' }}>
            Bring Your Story to Life
          </h2>
          <p className="text-sm sm:text-base max-w-lg mx-auto leading-relaxed" style={{ color: '#7B6E90' }}>
            One payment unlocks full AI illustration generation for{' '}
            <strong style={{ color: '#2D2235' }}>{story.title}</strong>.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* LEFT: Order Summary */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader icon={<BookOpen className="w-4 h-4" style={{ color: '#B05CE6' }} />} title="Order Summary" subtitle="What you're unlocking" />

              <div className="px-6 pt-5 pb-4">
                <h4 className="text-lg font-extrabold mb-1" style={{ color: '#2D2235', fontFamily: "'Lora', serif", fontStyle: 'italic' }}>
                  {story.title}
                </h4>
              </div>

              {story.sampleIllustrationUrl && (
                <div className="px-6 pb-5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[12px] font-bold" style={{ color: '#6B5C80' }}>Your style preview</span>
                    <span className="text-[11px]" style={{ color: '#A897BD' }}>Final book matches this</span>
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(180,150,210,0.12)', boxShadow: '0 4px 16px rgba(100,60,140,0.08)' }}>
                    <img src={story.sampleIllustrationUrl} alt="Style preview" className="w-full h-auto object-cover" loading="lazy" />
                  </div>
                </div>
              )}

              <div className="px-6 pb-5 space-y-2.5">
                <Feature icon={<Palette className="w-3.5 h-3.5" />}>HD illustrations for every page</Feature>
                <Feature icon={<Wand2 className="w-3.5 h-3.5" />}>Style-locked to your chosen aesthetic</Feature>
                <Feature icon={<BookOpen className="w-3.5 h-3.5" />}>Studio editing + print-ready PDF</Feature>
              </div>

              <PriceRow label="Full Story Generation" value={`\u00A3${PRICE_GBP}`} />
              <TotalRow label="Total" value={`\u00A3${PRICE_GBP}`} />
            </Card>
          </motion.div>

          {/* RIGHT: Payment */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardHeader icon={<Lock className="w-4 h-4" style={{ color: '#B05CE6' }} />} title="Secure Payment" subtitle="Card or PayPal balance" />

              <div className="px-6 py-6">
                {processing && (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#B05CE6' }} />
                    <span className="text-sm font-semibold" style={{ color: '#6B5C80' }}>Processing payment…</span>
                  </div>
                )}

                <div style={{ display: processing ? 'none' : 'block' }}>
                  <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!, currency: 'GBP', intent: 'capture' }}>
                    <PayPalButtons
                      style={{ layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 48 }}
                      createOrder={async () => {
                        const res = await fetch('/api/paypal/order', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            storyId,
                            product: `FlipWhizz Book: ${story.title}`,
                            price: PRICE_GBP,
                            currency: 'GBP',
                          }),
                        });
                        const data = await res.json();
                        if (!data.orderID) throw new Error('Failed to create order');
                        return data.orderID;
                      }}
                      onApprove={async (data) => {
                        setProcessing(true);
                        try {
                          const res = await fetch('/api/paypal/capture', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ orderID: data.orderID }),
                          });
                          const result = await res.json();

                          if (result.success) {
                            await fetch(`/api/stories/${storyId}/complete-step`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ step: 'pay' }),
                            });
                            setPaymentComplete(true);
                          } else {
                            alert(result.error || 'Payment capture failed.');
                          }
                        } catch (err) {
                          console.error('Capture error:', err);
                          alert('Payment processed but something went wrong. Please contact support.');
                        } finally {
                          setProcessing(false);
                        }
                      }}
                      onError={(err) => {
                        console.error('PayPal error:', err);
                        setProcessing(false);
                        alert('Payment failed. Please try again.');
                      }}
                      onCancel={() => setProcessing(false)}
                    />
                  </PayPalScriptProvider>
                </div>
              </div>

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
          </motion.div>
        </div>
      </div>
    </Shell>
  );
}

/* ── LAYOUT SHELL ── */
function Shell({
  children,
  storyId,
  storyTitle,
  currentStep,
  completedSteps = [],
}: {
  children: React.ReactNode;
  storyId?: string;
  storyTitle?: string;
  currentStep?: StepKey;
  completedSteps?: StepKey[];
}) {
  return (
    <>
      <FontLoader />
      <div className="min-h-screen relative" style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
        <div className="fixed inset-0 -z-10" style={{ background: `radial-gradient(ellipse 80% 60% at 20% 10%, rgba(232,190,255,0.3) 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 85% 80%, rgba(255,182,210,0.25) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(200,210,255,0.15) 0%, transparent 50%), #F9F5FF` }}>
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c4b5d4' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
        </div>
        {storyId && storyTitle && currentStep && (
          <UnifiedStoryHeader
            storyId={storyId}
            title={storyTitle}
            currentStep={currentStep}
            completedSteps={completedSteps}
          />
        )}
        <main className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10">{children}</main>
      </div>
    </>
  );
}

/* ── UI PRIMITIVES ── */
function Card({ children, border = 'default' }: { children: React.ReactNode; border?: 'default' | 'green' }) {
  return (
    <div className="rounded-[22px] border overflow-hidden" style={{ background: 'white', borderColor: border === 'green' ? 'rgba(67,184,156,0.3)' : 'rgba(180,150,210,0.12)', boxShadow: border === 'green' ? '0 4px 24px rgba(67,184,156,0.1)' : '0 2px 8px rgba(100,60,140,0.05), 0 12px 40px rgba(100,60,140,0.07)' }}>
      {children}
    </div>
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
  const bg = color === 'amber' ? 'rgba(255,179,71,0.1)' : 'rgba(239,68,68,0.08)';
  return <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: bg }}>{children}</div>;
}

function Feature({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl" style={{ background: 'rgba(199,125,255,0.04)', border: '1px solid rgba(180,150,210,0.08)' }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(199,125,255,0.1)' }}>
        <span style={{ color: '#B05CE6' }}>{icon}</span>
      </div>
      <span className="text-[13px] font-medium" style={{ color: '#5A4D6B' }}>{children}</span>
    </div>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(180,150,210,0.1)', background: 'rgba(199,125,255,0.03)' }}>
      <span className="text-sm font-semibold" style={{ color: '#6B5C80' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: '#2D2235' }}>{value}</span>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(180,150,210,0.1)' }}>
      <span className="text-base font-extrabold" style={{ color: '#2D2235' }}>{label}</span>
      <span className="text-lg font-extrabold" style={{ color: '#2FA482' }}>{value}</span>
    </div>
  );
}

function TrustBadge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold" style={{ background: 'rgba(180,150,210,0.06)', color: '#8B7BA0', border: '1px solid rgba(180,150,210,0.1)' }}>
      {icon}{children}
    </span>
  );
}

function Btn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-[0.98]" style={{ background: 'linear-gradient(135deg, #B05CE6, #D45DA0)', boxShadow: '0 4px 16px rgba(176,92,230,0.25)', border: 'none', fontFamily: 'inherit' }}>
      {children}
    </button>
  );
}

function BtnSecondary({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all active:scale-95" style={{ color: '#6B5C80', background: 'white', border: '1.5px solid rgba(180,150,210,0.2)', fontFamily: 'inherit' }}>
      {children}
    </button>
  );
}