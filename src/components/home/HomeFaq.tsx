// src/components/home/HomeFaq.tsx
"use client";

import posthog from "posthog-js";
import type { Faq } from "@/content/homeFaqs";

export default function HomeFaq({ faqs, location = "home" }: { faqs: Faq[]; location?: string }) {
  return (
    <div className="divide-y divide-[#E8DDCF] rounded-[24px] border border-[#E8DDCF] bg-white">
      {faqs.map((faq) => (
        <details
          key={faq.question}
          className="group px-6 py-5 sm:px-8"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) {
              posthog.capture("faq_opened", { question: faq.question, location });
            }
          }}
        >
          <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-bold text-[#2D2235] [&::-webkit-details-marker]:hidden">
            {faq.question}
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F7F3FB] text-xl text-[#7960AF] transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="mt-3 text-[17px] leading-relaxed text-[#5C5048]">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
