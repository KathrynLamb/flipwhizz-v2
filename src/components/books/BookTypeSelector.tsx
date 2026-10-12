"use client";
import { BookOpen, Pencil } from "lucide-react";
import type { BookType } from "@/lib/books/bookType";

export default function BookTypeSelector({ value, onChange, disabled = false, compact = false }: {
  value: BookType; onChange: (value: BookType) => void; disabled?: boolean; compact?: boolean;
}) {
  if (compact) return (
    <fieldset disabled={disabled} className="flex items-center gap-3">
      <legend className="sr-only">Book format</legend>
      <span className="hidden text-xs font-medium text-slate-500 sm:block">Book format</span>
      <div className="flex rounded-xl border border-slate-200 bg-white p-1">
        {([{ value: "storybook", title: "Storybook", Icon: BookOpen },
          { value: "colouring_storybook", title: "Colouring storybook", Icon: Pencil }] as const).map(option => (
          <label key={option.value} className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-purple-500 ${value === option.value ? "bg-[#EEE8F6] text-[#62468B]" : "text-slate-500 hover:bg-slate-50"} ${disabled ? "cursor-wait opacity-60" : ""}`}>
            <input type="radio" name="bookType" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
            <option.Icon aria-hidden="true" className="h-3.5 w-3.5" />{option.title}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return <fieldset disabled={disabled} className="mx-auto w-full max-w-xl px-2 py-4">
    <legend className="text-sm font-semibold text-slate-700">What would you like to make?</legend>
    <div className="grid grid-cols-2 gap-3">
      {([{ value: "storybook", title: "A story to read", detail: "Finished colour illustrations", Icon: BookOpen },
         { value: "colouring_storybook", title: "A story to read and colour", detail: "Outline pictures to make your own", Icon: Pencil }] as const).map(option =>
        <label key={option.value} className={`relative cursor-pointer rounded-2xl border-2 p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-purple-500 ${value === option.value ? "border-[#9B88CF] bg-purple-50" : "border-slate-200 bg-white"} ${disabled ? "opacity-60" : ""}`}>
          <input type="radio" name="bookType" value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} className="sr-only" />
          <option.Icon aria-hidden="true" className="mb-2 h-5 w-5 text-[#7960AF]" />
          <span className="block text-sm font-semibold">{option.title}</span>
          <span className="mt-1 block text-xs text-slate-600">{option.detail}</span>
        </label>)}
    </div>
  </fieldset>;
}
