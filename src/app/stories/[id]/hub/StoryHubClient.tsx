'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, ChevronsLeft, Clock, Info } from "lucide-react";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type StoryHubClientProps = {
  story: {
    id: string;
    title: string;
 updatedAt: Date
  };

  hub: {
    progressPercent: number;
    steps: {
      write: { complete: boolean; pageCount: number };
      extract: {
        characters: number;
        locations: number;
        scenes: number;
      };
      design: {
        charactersConfirmed: number;
        charactersTotal: number;
      };
    };
  };

  mode: "live" | "edit";
};

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export default function StoryHubClient({ story, hub }: StoryHubClientProps) {
  const router = useRouter();
  const [whyLocked, setWhyLocked] = useState<string | null>(null);

  console.log('story', story)

  return (
    <div className="min-h-screen bg-[#FDF8F0] text-[#261C15]">
      {/* HEADER */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-stone-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between">
          <div>
            <h1 className="text-3xl font-serif font-bold">{story.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-[#8C7A6B]">
              <div className="flex items-center gap-2">
                <ProgressRing value={hub.progressPercent} />
                <span>{hub.progressPercent}% complete</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>
                  Updated {Math.round((Date.now() - new Date(story.updatedAt).getTime()) / 36e5)}h ago
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => router.push("/projects")}
            className="text-sm text-[#8C7A6B] hover:text-[#261C15]"
          >
            ← Back to Library
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
        <Intro />

        {/* STEP 1 */}
        <Step number={1} title="Write Your Story">
          ✓ {hub.steps.write.pageCount} pages written
        </Step>

        {/* STEP 2 */}
        <Step number={2} title="Review What We Found">
          <Stats
            characters={hub.steps.extract.characters}
            locations={hub.steps.extract.locations}
            scenes={hub.steps.extract.scenes}
          />
          <button
            onClick={() => console.log('hub', hub)}
          >We need to see what happens here</button>
        </Step>

        {/* STEP 3 */}
        <Step number={3} title="Design the Look of the Book" current>
          <ProgressBar
            label="Characters confirmed"
            current={hub.steps.design.charactersConfirmed}
            total={hub.steps.design.charactersTotal}
          />

          <Primary onClick={() => router.push(`/stories/${story.id}/ensure-world`)}>
            Continue designing <ChevronRight className="w-4 h-4" />
          </Primary>
        </Step>

        {/* STEP 4 */}
        <LockedStep
          number={4}
          title="Unlock the Art Studio"
          open={whyLocked === "pay"}
          onToggle={() => setWhyLocked(whyLocked === "pay" ? null : "pay")}
          reason="Finish confirming characters and style first."
        />
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* UI PARTS                                                            */
/* ------------------------------------------------------------------ */

function Intro() {
  return (
    <>
      <h2 className="text-2xl font-serif font-bold">Your Story Journey</h2>
      <p className="text-[#6B5D52]">
        One calm step at a time. You can pause and come back whenever you like.
      </p>
    </>
  );
}

function Step({ number, title, current, children }: any) {
  return (
    <div
      className={`rounded-2xl border-2 p-6 bg-white ${
        current ? "border-[#F4A261] ring-4 ring-[#F4A261]/10" : "border-emerald-200"
      }`}
    >
      <h3 className="font-serif text-xl font-bold">
        {number}. {title}
      </h3>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function LockedStep({ number, title, reason, open, onToggle }: any) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6">
      <div className="flex justify-between">
        <h3 className="font-serif text-xl font-bold">
          {number}. {title}
        </h3>
        <button onClick={onToggle}>
          <Info className="w-5 h-5 text-stone-400" />
        </button>
      </div>
      {open && (
        <div className="mt-4 text-sm bg-amber-50 border border-amber-200 rounded-lg p-4">
          🔒 {reason}
        </div>
      )}
    </div>
  );
}

function Primary({ children, ...props }: any) {
  return (
    <button
      {...props}
      className="mt-4 flex items-center gap-2 bg-[#261C15] text-white px-5 py-2.5 rounded-lg hover:bg-black"
    >
      {children}
    </button>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg className="w-8 h-8 -rotate-90">
      <circle cx="16" cy="16" r={r} stroke="#e7e5e4" strokeWidth="3" fill="none" />
      <circle
        cx="16"
        cy="16"
        r={r}
        stroke="#F4A261"
        strokeWidth="3"
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value / 100)}
      />
    </svg>
  );
}

function ProgressBar({ label, current, total }: any) {
  const pct = (current / total) * 100;
  return (
    <>
      <div className="flex justify-between text-sm mb-2">
        <span>{label}</span>
        <span className="font-bold">{current} of {total}</span>
      </div>
      <div className="h-2 bg-stone-200 rounded-full">
        <div className="h-full bg-[#F4A261]" style={{ width: `${pct}%` }} />
      </div>
    </>
  );
}

function Stats({ characters, locations, scenes }: any) {
  return (
    <div className="grid grid-cols-3 gap-6 text-sm">
      <Stat label="Characters" value={characters} />
      <Stat label="Locations" value={locations} />
      <Stat label="Scenes" value={scenes} />
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-sm text-[#6B5D52]">{label}</div>
    </div>
  );
}
