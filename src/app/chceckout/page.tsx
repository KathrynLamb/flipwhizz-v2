// src/app/chceckout/page.tsx
import { Suspense } from "react";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic"; // optional but usually helps

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/60">Loading checkout…</div>}>
      <CheckoutClient />
    </Suspense>
  );
}
