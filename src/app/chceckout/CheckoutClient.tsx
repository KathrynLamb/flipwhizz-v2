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
          <p className="text-white/60 mb-6 text-sm leading-relaxed">
            Unlocks full AI generation for this story. Includes high-resolution 
            illustrations for every page based on your custom style guide.
          </p>
          
          <div className="flex justify-between items-center py-4 border-t border-white/10">
            <span>Full Story Generation</span>
            <span className="font-semibold">$9.99</span>
          </div>
          <div className="flex justify-between items-center py-4 border-t border-white/10 text-lg font-bold text-green-400">
            <span>Total</span>
            <span>$9.99</span>
          </div>
        </div>

        {/* RIGHT: PayPal Button */}
        <div className="w-full">
          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold mb-2">Secure Payment</h2>
            <p className="text-xs text-white/40">Powered by PayPal. Secure checkout.</p>
          </div>

          <PayPalScriptProvider options={{ clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID! }}>
            <PayPalButtons
              style={{ layout: "vertical", color: "gold", shape: "rect", label: "pay" }}
              createOrder={(data, actions) => {
                return actions.order.create({
                  intent: "CAPTURE", // Required for immediate capture
                  purchase_units: [
                    {
                      amount: {
                        currency_code: "USD",
                        value: "9.99",
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