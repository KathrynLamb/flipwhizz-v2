// src/components/ChristmasDeliveryNotice.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { christmasDelivery } from "@/lib/christmas-delivery";

export function confirmChristmasDelivery(productType: string, bookType = "storybook"): boolean {
  const notice = christmasDelivery(productType, bookType);
  return !notice?.late || window.confirm(`${notice.message}\n\nContinue with a printed book for delivery after Christmas?`);
}

// Legacy print entry points resolve the book type before their final submission.
export async function confirmChristmasPrintOrder(storyId: string): Promise<boolean> {
  if (!christmasDelivery("print")) return true;
  try {
    const response = await fetch(`/api/stories/${storyId}/product`);
    if (!response.ok) throw new Error("Could not check delivery");
    const product = await response.json();
    return confirmChristmasDelivery("print", product.bookType ?? "storybook");
  } catch {
    window.alert("We could not check Christmas delivery. Please try again before ordering.");
    return false;
  }
}

export default function ChristmasDeliveryNotice({
  productType, bookType, storyId, digitalHref, onChooseDigital,
}: {
  productType: string;
  bookType?: string | null;
  storyId?: string;
  digitalHref: string;
  onChooseDigital?: () => void;
}) {
  const [resolvedBookType, setResolvedBookType] = useState<string | null>(null);
  useEffect(() => {
    if (bookType || !storyId) return;
    const controller = new AbortController();
    fetch(`/api/stories/${storyId}/product`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((product) => { if (product) setResolvedBookType(product.bookType ?? "storybook"); })
      .catch(() => {});
    return () => controller.abort();
  }, [bookType, storyId]);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = setInterval(refresh, 1000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, []);
  const notice = now && (bookType || !storyId || resolvedBookType) ? christmasDelivery(productType, bookType ?? resolvedBookType ?? "storybook", now) : null;
  if (!notice) return null;
  const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-lg border border-[#9B88CF] bg-white px-3 py-2 text-sm font-semibold text-[#30213c] hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700";
  return (
    <aside aria-label="Christmas delivery information" aria-live="polite"
      className="my-4 rounded-xl border-l-4 p-4 text-left"
      style={{ background: notice.late ? "#fff1f2" : "#faf5ff", borderColor: notice.late ? "#be123c" : "#9B88CF", color: "#30213c" }}>
      <p className="text-sm font-bold leading-relaxed">{notice.message}</p>
      <p className="mt-2 text-xs leading-relaxed">{notice.estimate}</p>
      {notice.late && <div className="mt-3 flex flex-wrap gap-2">
        {onChooseDigital
          ? <button type="button" className={buttonClass} onClick={onChooseDigital}>Choose the digital edition</button>
          : <Link className={buttonClass} href={digitalHref}>Choose the digital edition</Link>}
        <Link className={buttonClass} href="/christmas#gift-card">Gift cards (coming soon)</Link>
      </div>}
    </aside>
  );
}
