// src/components/books/BookTypeSelector.tsx
"use client";
import Image from "next/image";
import { BookOpen, Pencil, Check } from "lucide-react";
import type { BookType } from "@/lib/books/bookType";

// Storybook or colouring storybook. The full version shows a real page from
// each kind of book so the difference is obvious at a glance; the compact
// version is a small segmented switch for the story studio.

const OPTIONS = [
  { value: "storybook", title: "A story to read", short: "Storybook", detail: "Finished colour illustrations", img: "/LandingPage/books/sam-dog.webp", Icon: BookOpen },
  { value: "colouring_storybook", title: "A story to read and colour", short: "Colouring storybook", detail: "Outline pictures to colour in", img: "/LandingPage/books/colouring.webp", Icon: Pencil },
] as const;

export default function BookTypeSelector({ value, onChange, disabled = false, compact = false }: {
  value: BookType; onChange: (value: BookType) => void; disabled?: boolean; compact?: boolean;
}) {
  if (compact) return (
    <fieldset disabled={disabled} className="m-0 flex items-center gap-3 border-0 p-0">
      <legend className="sr-only">Book format</legend>
      <div className="flex rounded-full bg-[#F1ECF7] p-1">
        {OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <label key={o.value} className={`flex min-h-[38px] cursor-pointer items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#6F4BB0] ${on ? "bg-white text-[#24182F] shadow-[0_2px_8px_-2px_rgba(36,24,47,0.25)]" : "text-[#6A5E73] hover:text-[#24182F]"} ${disabled ? "cursor-wait opacity-60" : ""}`}>
              <input type="radio" name="bookType" value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              <o.Icon aria-hidden="true" className="h-4 w-4" />{o.short}
            </label>
          );
        })}
      </div>
    </fieldset>
  );

  return (
    <fieldset disabled={disabled} className="m-0 w-full min-w-0 border-0 p-0">
      <legend className="mb-3 p-0 text-[15px] font-bold text-[#24182F]">What would you like to make?</legend>
      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <label key={o.value} className={`group relative block cursor-pointer overflow-hidden rounded-[20px] bg-white transition-all has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#A270C9]/30 ${on ? "ring-2 ring-[#24182F]" : "ring-[1.5px] ring-[#E4DCF0] hover:ring-[#A270C9]"} ${disabled ? "opacity-60" : ""}`}>
              <input type="radio" name="bookType" value={o.value} checked={on} onChange={() => onChange(o.value)} className="sr-only" />
              <span className="relative block aspect-[16/7] overflow-hidden bg-[#F6F1FC]">
                <Image src={o.img} alt="" fill sizes="(min-width: 640px) 300px, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                {on && (
                  <span className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#24182F] text-white">
                    <Check className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="block px-3.5 pb-3.5 pt-3">
                <span className="block text-[15px] font-bold leading-tight text-[#24182F] sm:text-[16px]">{o.title}</span>
                <span className="mt-1 block text-[13px] leading-snug text-[#6A5E73] sm:text-[14px]">{o.detail}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
