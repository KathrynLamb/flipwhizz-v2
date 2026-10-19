// src/components/home/HomeFaq.tsx
"use client";

import posthog from "posthog-js";
import type { Faq } from "@/content/homeFaqs";

export default function HomeFaq({ faqs, location = "home" }: { faqs: Faq[]; location?: string }) {
  return (
    <div className="border-t-[1.5px] border-[#EFE7F5]">
      {faqs.map((faq) => (
        <details
          key={faq.question}
          className="fw-faq group border-b-[1.5px] border-[#EFE7F5]"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open) {
              posthog.capture("faq_opened", { question: faq.question, location });
            }
          }}
        >
          <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-6 py-5 text-[19px] font-bold text-[#24182F] transition-colors hover:text-[#6F4BB0] [&::-webkit-details-marker]:hidden">
            {faq.question}
            <span
              aria-hidden="true"
              className="fw-plus flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F6F1FC] text-[22px] leading-none text-[#6F4BB0] transition-transform duration-300 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="m-0 max-w-[62ch] pb-6 text-[17px] leading-[1.6] text-[#4E4259]">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
