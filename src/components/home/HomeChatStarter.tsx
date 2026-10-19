// src/components/home/HomeChatStarter.tsx
"use client";

// The homepage's way in: a FlipWhizz chat bubble asking one small question,
// with tap-to-answer chips and (for "who") a name box. Answering sends the
// visitor to /projects/create with that answer already in the conversation.

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import { ABOUTS, OCCASIONS, RECIPIENTS, cleanName, starterHref } from "@/lib/chatStarter";

type Mode = "who" | "about" | "occasion";

const CHIPS: Record<Mode, { key: string; label: string }[]> = {
  who: RECIPIENTS,
  about: ABOUTS,
  occasion: OCCASIONS,
};

const PARAM: Record<Mode, "for" | "about" | "occasion"> = {
  who: "for",
  about: "about",
  occasion: "occasion",
};

export default function HomeChatStarter({
  position,
  mode = "who",
  question = "Hi! Who's this story for?",
  showNameInput = mode === "who",
  entry,
  fixedOccasion,
  tone = "light",
}: {
  /** Where on the page this starter sits; sent to analytics. */
  position: string;
  mode?: Mode;
  question?: string;
  showNameInput?: boolean;
  /** Analytics entry label for the create page. Defaults to home_<position>. */
  entry?: string;
  /** Gift pages pass their occasion so every answer carries it. */
  fixedOccasion?: string;
  tone?: "light" | "tinted";
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [typedTracked, setTypedTracked] = useState(false);
  const entryLabel = entry ?? `home_${position}`;

  function go(params: Record<string, string | undefined>) {
    router.push(starterHref({ ...params, occasion: params.occasion ?? fixedOccasion, entry: entryLabel }));
  }

  function onChip(key: string) {
    posthog.capture("home_chat_chip_clicked", { position, chip: key, mode, entry: entryLabel });
    go({ [PARAM[mode]]: key });
  }

  function onSubmitName(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = cleanName(name);
    posthog.capture("home_chat_chip_clicked", { position, chip: "typed_name", mode, entry: entryLabel });
    go(cleaned ? { name: cleaned } : {});
  }

  return (
    <div className={`w-full max-w-xl rounded-[28px] p-5 sm:p-6 ${tone === "tinted" ? "bg-white" : "bg-[#F7F3FB]"}`}>
      <div className="flex items-end gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
          style={{ background: "linear-gradient(135deg, #F2546A, #F7A93E 35%, #8AC7E0 70%, #A270C9)" }}
        >
          F
        </span>
        <p className="rounded-[22px] rounded-bl-[6px] bg-[#9B88CF] px-5 py-3 text-[18px] leading-snug text-white shadow-sm">
          {question}
        </p>
      </div>

      <ul className="mt-5 flex flex-wrap gap-2.5" aria-label="Choose an answer">
        {CHIPS[mode].map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              onClick={() => onChip(chip.key)}
              className="min-h-[48px] rounded-full border-2 border-[#DB79AC] bg-white px-5 text-[17px] font-semibold text-[#A8336E] transition-colors hover:bg-[#DB79AC] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A8336E]"
            >
              {chip.label}
            </button>
          </li>
        ))}
      </ul>

      {showNameInput && (
        <form onSubmit={onSubmitName} className="mt-4 flex gap-2">
          <label htmlFor={`starter-name-${position}`} className="sr-only">
            Or type their name
          </label>
          <input
            id={`starter-name-${position}`}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!typedTracked && e.target.value.trim()) {
                setTypedTracked(true);
                posthog.capture("home_chat_typed", { position, entry: entryLabel });
              }
            }}
            placeholder="or type their name"
            autoComplete="off"
            maxLength={40}
            className="min-h-[52px] min-w-0 flex-1 rounded-full border border-[#E3D6ED] bg-white px-5 text-[17px] text-[#2D2235] outline-none placeholder:text-[#8A7E73] focus:border-[#A270C9] focus:ring-2 focus:ring-[#A270C9]/25"
          />
          <button
            type="submit"
            className="min-h-[52px] shrink-0 rounded-full bg-[#D94590] px-6 text-[17px] font-bold text-white shadow-[0_6px_20px_rgba(217,69,144,0.3)] transition-transform active:scale-[0.98]"
          >
            Start
          </button>
        </form>
      )}
    </div>
  );
}
