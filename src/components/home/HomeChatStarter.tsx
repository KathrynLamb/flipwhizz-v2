// src/components/home/HomeChatStarter.tsx
"use client";

// The homepage's way in: a FlipWhizz chat bubble asking one small question,
// with tap-to-answer chips and (for "who") a name box. Answering sends the
// visitor to /projects/create with that answer already in the conversation.

import { useState } from "react";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import "@/app/home.css";
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
    <div className={`w-full max-w-xl ${tone === "tinted" ? "rounded-[28px] bg-white p-5 shadow-[0_24px_50px_-34px_rgba(36,24,47,0.45)] sm:p-6" : ""}`}>
      <p className="m-0 inline-block rounded-[22px] rounded-bl-[6px] bg-[#6F4BB0] px-5 py-3 text-[18px] font-semibold leading-snug text-white sm:text-[19px]">
        {question}
      </p>

      <ul className="mt-4 flex flex-wrap gap-2.5" aria-label="Choose an answer">
        {CHIPS[mode].map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              onClick={() => onChip(chip.key)}
              className="fw-chip min-h-[50px] px-5 text-[17px] focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-[#6F4BB0]"
            >
              {chip.label}
            </button>
          </li>
        ))}
      </ul>

      {showNameInput && (
        <form onSubmit={onSubmitName} className="mt-3 flex max-w-[460px] gap-2.5">
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
            className="min-h-[52px] min-w-0 flex-1 rounded-full border-[1.5px] border-[#E4DCF0] bg-white px-5 text-[17px] text-[#24182F] outline-none placeholder:text-[#8B7F95] focus:border-[#A270C9] focus:ring-2 focus:ring-[#A270C9]/25"
          />
          <button type="submit" className="fw-cta min-h-[52px] shrink-0 px-6 text-[17px]">
            Start
          </button>
        </form>
      )}
    </div>
  );
}
