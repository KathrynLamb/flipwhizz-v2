"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const storyId = searchParams.get("storyId");

  const [loading, setLoading] = useState(true);
  const [story, setStory] = useState<any>(null);

  type PaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "dev_bypass";

  // Load story details to show what they are buying
  useEffect(() => {
    if (!storyId) return;
    fetch(`/api/stories/${storyId}`)
      .then((res) => res.json())
      .then((data) => {
        setStory(data.story);
        setLoading(false);
      });
  }, [storyId]);

  if (!storyId) return <div className="p-10 text-white">Missing Story ID</div>;
  if (loading) return <div className="p-10 text-white">Loading checkout...</div>;

  return (
    <div className="min-h-screen bg-[#0b0b10] text-white flex flex-col items-center justify-center p-6">
      
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        
        {/* LEFT: Order Summary */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl">
          <div className="text-[10px] uppercase text-white/50 mb-2 font-bold tracking-widest">
            Order Summary
          </div>
          <h1 className="text-3xl font-bold mb-4">{story.title}</h1>
          {story.sampleIllustrationUrl && (
                <div className="p-7 border-b border-white/10">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-bold text-white/85">
                      Your style preview
                    </div>
                    <div className="text-xs text-white/45">
                      Final book will match this
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black">
                    <img
                      src={story.sampleIllustrationUrl}
                      alt="Sample illustration preview"
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
          <p className="text-white/60 mb-6 text-sm leading-relaxed">
            Unlocks full AI generation for this story. Includes high-resolution 
            illustrations for every page based on your custom style guide.
          </p>
          
          <div className="flex justify-between items-center py-4 border-t border-white/10">
            <span>Full Story Generation</span>
            <span className="font-semibold">£29.99</span>
          </div>
          <div className="flex justify-between items-center py-4 border-t border-white/10 text-lg font-bold text-green-400">
            <span>Total</span>
            <span>£29.99</span>
          </div>
        </div>

        {/* RIGHT: PayPal Button */}
        <div className="w-full">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Secure Payment</h2>
            <p className="text-xs text-white/40">Powered by PayPal. Secure checkout.</p>
          </div>

          <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!, currency: "GBP" }}>
            <PayPalButtons
              style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay" }}
              createOrder={(data, actions) => {
                return actions.order.create({
                  intent: "CAPTURE", // Required for immediate capture
                  purchase_units: [
                    {
                      amount: {
                        currency_code: "GBP",
                        value: "29.99",
                      },
                      description: `FlipWhizz Book: ${story.title}`,
                    },
                  ],
                });
              }}
              onApprove={async (data, actions) => {
                if (!actions.order) return;
                
                // 1. Capture payment at PayPal
                const details = await actions.order.capture();
                const name = details.payer?.name?.given_name;

                // 2. Record in our Database
                const res = await fetch(`/api/stories/${storyId}/checkout`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: data.orderID }),
                });

                if (res.ok) {
                  // 3. Redirect to the Generation Page
                  // Note: You need to create this page next!
                  router.push(`/stories/${storyId}/illustrations`); 
                } else {
                  alert("Payment processed, but failed to save. Please contact support.");
                }
              }}
            />
          </PayPalScriptProvider>

          <div className="mt-6 text-center">
             <button 
               onClick={() => router.back()}
               className="text-xs text-white/30 hover:text-white underline"
             >
               Cancel and go back
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// "use client";

// import { useEffect, useMemo, useState } from "react";
// import { useSearchParams, useRouter } from "next/navigation";
// import {
//   PayPalScriptProvider,
//   PayPalButtons,
//   PayPalMarks,
// } from "@paypal/react-paypal-js";
// import { motion } from "framer-motion";
// import {
//   ShieldCheck,
//   Sparkles,
//   Lock,
//   ArrowLeft,
//   CheckCircle2,
//   Wand2,
// } from "lucide-react";

// // PayPal FUNDING is available on window.paypal.FUNDING, but in React wrapper
// // we can still pass fundingSource as strings in many setups.
// // We'll use safe string constants to avoid type/version mismatches.
// const FUNDING = {
//   CARD: "card",
//   APPLEPAY: "applepay",
//   PAYPAL: "paypal",
// } as const;

// type StoryCheckoutDto = {
//   id: string;
//   title: string;
//   status?: string | null;
//   sampleIllustrationUrl?: string | null;
// };

// const PRICE_GBP = "29.99";

// export default function CheckoutPage() {
//   const searchParams = useSearchParams();
//   const router = useRouter();
//   const storyId = searchParams.get("storyId");

//   const [loading, setLoading] = useState(true);
//   const [story, setStory] = useState<StoryCheckoutDto | null>(null);
//   const [error, setError] = useState<string | null>(null);

//   // Load story details (including sampleIllustrationUrl)
//   useEffect(() => {
//     if (!storyId) return;

//     let cancelled = false;
//     setLoading(true);
//     setError(null);

//     fetch(`/api/stories/${storyId}`)
//       .then(async (res) => {
//         const data = await res.json();
//         if (!res.ok) throw new Error(data?.error || "Failed to load story");
//         return data;
//       })
//       .then((data) => {
//         if (cancelled) return;
//         setStory(data.story);
//         setLoading(false);
//       })
//       .catch((e) => {
//         if (cancelled) return;
//         setError(e?.message || "Failed to load checkout");
//         setLoading(false);
//       });

//     return () => {
//       cancelled = true;
//     };
//   }, [storyId]);

//   const paypalOptions = useMemo(() => {
//     // Card + Apple Pay eligibility checks rely on these components.
//     // "marks" helps show funding marks (Apple Pay mark may show when eligible).
//     return {
//       clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!,
//       currency: "GBP",
//       intent: "CAPTURE",
//       components: "buttons,marks,funding-eligibility",
//     } as const;
//   }, []);

//   if (!storyId) {
//     return (
//       <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-8">
//         <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-8">
//           <div className="text-lg font-black mb-2">Missing Story ID</div>
//           <p className="text-white/60 text-sm">
//             Please return to your story and try checkout again.
//           </p>
//           <button
//             onClick={() => router.push("/projects")}
//             className="mt-6 w-full rounded-2xl bg-white text-black font-black py-3"
//           >
//             Go to Library
//           </button>
//         </div>
//       </div>
//     );
//   }

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-8">
//         <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-8">
//           <div className="flex items-center gap-3">
//             <div className="h-10 w-10 rounded-2xl bg-white/10 animate-pulse" />
//             <div className="flex-1">
//               <div className="h-4 w-40 rounded bg-white/10 animate-pulse" />
//               <div className="mt-2 h-3 w-64 rounded bg-white/10 animate-pulse" />
//             </div>
//           </div>
//           <div className="mt-6 h-48 rounded-2xl bg-white/10 animate-pulse" />
//           <div className="mt-6 h-12 rounded-2xl bg-white/10 animate-pulse" />
//         </div>
//       </div>
//     );
//   }

//   if (error || !story) {
//     return (
//       <div className="min-h-screen bg-[#07070b] text-white flex items-center justify-center p-8">
//         <div className="max-w-md w-full rounded-3xl border border-white/10 bg-white/5 p-8">
//           <div className="text-lg font-black mb-2">Checkout failed</div>
//           <p className="text-white/60 text-sm">{error || "Unknown error"}</p>
//           <button
//             onClick={() => router.back()}
//             className="mt-6 w-full rounded-2xl bg-white text-black font-black py-3"
//           >
//             Go back
//           </button>
//         </div>
//       </div>
//     );
//   }

//   async function recordPayment(orderId: string) {
//     const res = await fetch(`/api/stories/${storyId}/checkout`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({ orderId }),
//     });

//     if (!res.ok) {
//       const data = await res.json().catch(() => ({}));
//       throw new Error(data?.error || "Payment saved failed");
//     }
//   }

//   return (
//     <div className="min-h-screen bg-[#07070b] text-white">
//       {/* Top mini header */}
//       <div className="sticky top-0 z-50 border-b border-white/10 bg-[#07070b]/70 backdrop-blur-xl">
//         <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
//           <button
//             onClick={() => router.back()}
//             className="inline-flex items-center gap-2 text-white/70 hover:text-white transition"
//           >
//             <ArrowLeft className="w-5 h-5" />
//             Back
//           </button>

//           <div className="hidden md:flex items-center gap-2 text-xs text-white/60">
//             <Lock className="w-4 h-4" />
//             Secure checkout
//           </div>
//         </div>
//       </div>

//       <div className="mx-auto max-w-6xl px-6 py-10">
//         {/* Premium hero */}
//         <div className="mb-10">
//           <motion.div
//             initial={{ opacity: 0, y: 14 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.35 }}
//             className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70"
//           >
//             <Sparkles className="w-4 h-4" />
//             Unlock full-book illustration in your chosen style
//           </motion.div>

//           <motion.h1
//             initial={{ opacity: 0, y: 14 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.35, delay: 0.05 }}
//             className="mt-4 text-3xl md:text-5xl font-black tracking-tight"
//           >
//             Finish your book in{" "}
//             <span className="bg-gradient-to-r from-fuchsia-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">
//               one click
//             </span>
//           </motion.h1>

//           <motion.p
//             initial={{ opacity: 0, y: 14 }}
//             animate={{ opacity: 1, y: 0 }}
//             transition={{ duration: 0.35, delay: 0.1 }}
//             className="mt-3 text-white/60 max-w-2xl"
//           >
//             You’re paying to unlock full generation for{" "}
//             <span className="text-white font-semibold">{story.title}</span>. Your
//             final illustrations will match your sample preview.
//           </motion.p>
//         </div>

//         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
//           {/* LEFT: Premium Summary */}
//           <div className="lg:col-span-6">
//             <motion.div
//               initial={{ opacity: 0, y: 14 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.35 }}
//               className="rounded-[28px] border border-white/10 bg-gradient-to-b from-white/7 to-white/3 shadow-[0_30px_120px_rgba(0,0,0,0.6)] overflow-hidden"
//             >
//               {/* Header */}
//               <div className="p-7 border-b border-white/10">
//                 <div className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold">
//                   Order Summary
//                 </div>
//                 <div className="mt-2 text-2xl md:text-3xl font-black leading-tight">
//                   {story.title}
//                 </div>
//                 <div className="mt-3 flex flex-wrap gap-2">
//                   <Badge icon={<ShieldCheck className="w-4 h-4" />}>
//                     Style-locked output
//                   </Badge>
//                   <Badge icon={<CheckCircle2 className="w-4 h-4" />}>
//                     HD illustrations
//                   </Badge>
//                   <Badge icon={<Wand2 className="w-4 h-4" />}>
//                     Auto page-by-page
//                   </Badge>
//                 </div>
//               </div>

//               {/* Sample Preview */}
//               {story.sampleIllustrationUrl ? (
//                 <div className="p-7 border-b border-white/10">
//                   <div className="flex items-center justify-between">
//                     <div className="text-sm font-bold text-white/85">
//                       Your style preview
//                     </div>
//                     <div className="text-xs text-white/45">
//                       Final book will match this
//                     </div>
//                   </div>

//                   <div className="mt-4 rounded-2xl overflow-hidden border border-white/10 bg-black">
//                     <img
//                       src={story.sampleIllustrationUrl}
//                       alt="Sample illustration preview"
//                       className="w-full h-auto object-cover"
//                       loading="lazy"
//                     />
//                   </div>
//                 </div>
//               ) : (
//                 <div className="p-7 border-b border-white/10">
//                   <div className="text-sm font-bold text-white/85">
//                     Your style preview
//                   </div>
//                   <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-white/55">
//                     No sample preview found. (You can still purchase and generate,
//                     but showing a sample here will convert better.)
//                   </div>
//                 </div>
//               )}

//               {/* Before / After mini explainer */}
//               <div className="p-7 border-b border-white/10">
//                 <div className="text-sm font-bold text-white/85">
//                   What changes after payment
//                 </div>

//                 <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
//                   <MiniCard
//                     title="Before"
//                     subtitle="Draft mode"
//                     points={[
//                       "You can write, review, and design the look",
//                       "You can generate a sample spread",
//                       "Full-book generation is locked",
//                     ]}
//                     tone="neutral"
//                   />
//                   <MiniCard
//                     title="After"
//                     subtitle="Unlocked"
//                     points={[
//                       "Generate every page illustration automatically",
//                       "High-res images for export & print",
//                       "Studio editing + regeneration tools",
//                     ]}
//                     tone="accent"
//                   />
//                 </div>
//               </div>

//               {/* Price */}
//               <div className="p-7">
//                 <Row label="Full Story Generation" value={`£${PRICE_GBP}`} />
//                 <Row label="Total" value={`£${PRICE_GBP}`} strong valueAccent />
//                 <div className="mt-4 text-xs text-white/45">
//                   By completing purchase you agree this unlock applies to this
//                   story only.
//                 </div>
//               </div>
//             </motion.div>
//           </div>

//           {/* RIGHT: Payment */}
//           <div className="lg:col-span-6">
//             <motion.div
//               initial={{ opacity: 0, y: 14 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ duration: 0.35, delay: 0.05 }}
//               className="rounded-[28px] border border-white/10 bg-white/5 shadow-[0_30px_120px_rgba(0,0,0,0.6)] overflow-hidden"
//             >
//               <div className="p-7 border-b border-white/10">
//                 <div className="text-[10px] uppercase tracking-[0.2em] text-white/45 font-bold">
//                   Payment
//                 </div>
//                 <div className="mt-2 text-xl md:text-2xl font-black">
//                   Pay securely
//                 </div>
//                 <div className="mt-2 text-sm text-white/60">
//                   Card-first checkout. Apple Pay shows when eligible on this
//                   device.
//                 </div>
//               </div>

//               <div className="p-7">
//                 {/* Funding marks (Apple Pay mark may appear when eligible) */}
//                 <div className="flex items-center justify-between mb-6">
//                   <div className="text-xs text-white/45">Supported methods</div>
//                   <div className="opacity-90">
//                     <PayPalScriptProvider options={paypalOptions}>
//                       <PayPalMarks />
//                     </PayPalScriptProvider>
//                   </div>
//                 </div>

//                 <PayPalScriptProvider options={paypalOptions}>
//                   <div className="space-y-4">
//                     {/* 1) CARD FIRST */}
//                     <PaymentButtonBlock
//                       title="Pay by card"
//                       subtitle="Visa / Mastercard / Amex (via PayPal)"
//                     >
//                       <PayPalButtons
//                         fundingSource={FUNDING.CARD as any}
//                         style={{
//                           layout: "vertical",
//                           shape: "rect",
//                           label: "pay",
//                           height: 48,
//                         }}
//                         createOrder={(data, actions) => {
//                           return actions.order.create({
//                             intent: "CAPTURE",
//                             purchase_units: [
//                               {
//                                 amount: {
//                                   currency_code: "GBP",
//                                   value: PRICE_GBP,
//                                 },
//                                 description: `FlipWhizz Book: ${story.title}`,
//                               },
//                             ],
//                           });
//                         }}
//                         onApprove={async (data, actions) => {
//                           if (!actions.order) return;
//                           await actions.order.capture();
//                           await recordPayment(data.orderID);
//                           router.push(`/stories/${storyId}/illustrations`);
//                         }}
//                         onError={(err) => {
//                           console.error(err);
//                           alert("Payment failed. Please try again.");
//                         }}
//                       />
//                     </PaymentButtonBlock>

//                     {/* 2) APPLE PAY (ELIGIBILITY DEPENDENT) */}
//                     <PaymentButtonBlock
//                       title="Apple Pay"
//                       subtitle="Shows only when eligible"
//                       subtle
//                     >
//                       <PayPalButtons
//                         fundingSource={FUNDING.APPLEPAY as any}
//                         style={{
//                           layout: "vertical",
//                           shape: "rect",
//                           label: "pay",
//                           height: 48,
//                         }}
//                         createOrder={(data, actions) => {
//                           return actions.order.create({
//                             intent: "CAPTURE",
//                             purchase_units: [
//                               {
//                                 amount: {
//                                   currency_code: "GBP",
//                                   value: PRICE_GBP,
//                                 },
//                                 description: `FlipWhizz Book: ${story.title}`,
//                               },
//                             ],
//                           });
//                         }}
//                         onApprove={async (data, actions) => {
//                           if (!actions.order) return;
//                           await actions.order.capture();
//                           await recordPayment(data.orderID);
//                           router.push(`/stories/${storyId}/illustrations`);
//                         }}
//                         onError={(err) => {
//                           console.error(err);
//                           // If not eligible, PayPal often hides it; this is for real errors.
//                         }}
//                       />
//                     </PaymentButtonBlock>

//                     {/* 3) PAYPAL */}
//                     <PaymentButtonBlock
//                       title="PayPal"
//                       subtitle="Pay with PayPal balance or linked bank"
//                       subtle
//                     >
//                       <PayPalButtons
//                         fundingSource={FUNDING.PAYPAL as any}
//                         style={{
//                           layout: "vertical",
//                           shape: "rect",
//                           label: "paypal",
//                           height: 48,
//                         }}
//                         createOrder={(data, actions) => {
//                           return actions.order.create({
//                             intent: "CAPTURE",
//                             purchase_units: [
//                               {
//                                 amount: {
//                                   currency_code: "GBP",
//                                   value: PRICE_GBP,
//                                 },
//                                 description: `FlipWhizz Book: ${story.title}`,
//                               },
//                             ],
//                           });
//                         }}
//                         onApprove={async (data, actions) => {
//                           if (!actions.order) return;
//                           await actions.order.capture();
//                           await recordPayment(data.orderID);
//                           router.push(`/stories/${storyId}/illustrations`);
//                         }}
//                         onError={(err) => {
//                           console.error(err);
//                           alert("Payment failed. Please try again.");
//                         }}
//                       />
//                     </PaymentButtonBlock>
//                   </div>
//                 </PayPalScriptProvider>

//                 {/* Trust row */}
//                 <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-white/55">
//                   <TrustPill icon={<Lock className="w-4 h-4" />}>
//                     Encrypted checkout
//                   </TrustPill>
//                   <TrustPill icon={<ShieldCheck className="w-4 h-4" />}>
//                     Buyer protection
//                   </TrustPill>
//                   <TrustPill icon={<CheckCircle2 className="w-4 h-4" />}>
//                     Instant unlock
//                   </TrustPill>
//                 </div>

//                 <button
//                   onClick={() => router.back()}
//                   className="mt-8 w-full text-center text-xs text-white/40 hover:text-white/70 underline underline-offset-4 transition"
//                 >
//                   Cancel and go back
//                 </button>
//               </div>
//             </motion.div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// /* ----------------------------- UI bits ----------------------------- */

// function Badge({
//   icon,
//   children,
// }: {
//   icon: React.ReactNode;
//   children: React.ReactNode;
// }) {
//   return (
//     <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
//       <span className="opacity-80">{icon}</span>
//       {children}
//     </span>
//   );
// }

// function Row({
//   label,
//   value,
//   strong,
//   valueAccent,
// }: {
//   label: string;
//   value: string;
//   strong?: boolean;
//   valueAccent?: boolean;
// }) {
//   return (
//     <div className="flex items-center justify-between py-3 border-t border-white/10">
//       <span className={strong ? "font-black" : "text-white/70"}>
//         {label}
//       </span>
//       <span
//         className={[
//           strong ? "font-black" : "text-white/70",
//           valueAccent ? "text-emerald-300" : "",
//         ].join(" ")}
//       >
//         {value}
//       </span>
//     </div>
//   );
// }

// function MiniCard({
//   title,
//   subtitle,
//   points,
//   tone,
// }: {
//   title: string;
//   subtitle: string;
//   points: string[];
//   tone: "neutral" | "accent";
// }) {
//   const accent =
//     tone === "accent"
//       ? "border-fuchsia-400/30 bg-gradient-to-b from-fuchsia-500/10 to-white/5"
//       : "border-white/10 bg-white/5";

//   return (
//     <div className={`rounded-2xl border ${accent} p-5`}>
//       <div className="flex items-baseline justify-between gap-3">
//         <div className="font-black">{title}</div>
//         <div className="text-xs text-white/45">{subtitle}</div>
//       </div>
//       <ul className="mt-3 space-y-2 text-sm text-white/65">
//         {points.map((p, i) => (
//           <li key={i} className="flex gap-2">
//             <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-white/40" />
//             <span>{p}</span>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

// function PaymentButtonBlock({
//   title,
//   subtitle,
//   children,
//   subtle,
// }: {
//   title: string;
//   subtitle: string;
//   children: React.ReactNode;
//   subtle?: boolean;
// }) {
//   return (
//     <div
//       className={[
//         "rounded-2xl border p-4",
//         subtle
//           ? "border-white/10 bg-white/3"
//           : "border-fuchsia-400/25 bg-gradient-to-b from-fuchsia-500/10 to-white/5",
//       ].join(" ")}
//     >
//       <div className="flex items-baseline justify-between gap-3 mb-3">
//         <div className="font-black">{title}</div>
//         <div className="text-xs text-white/45">{subtitle}</div>
//       </div>
//       {children}
//     </div>
//   );
// }

// function TrustPill({
//   icon,
//   children,
// }: {
//   icon: React.ReactNode;
//   children: React.ReactNode;
// }) {
//   return (
//     <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 flex items-center justify-center gap-2">
//       <span className="opacity-80">{icon}</span>
//       <span>{children}</span>
//     </div>
//   );
// }
