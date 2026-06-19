import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import Header from "@/components/Header";
import PagesBox from "@/app/projects/components/PagesBox";
import IllustrationsBox from "@/app/projects/components/IllustrationsBox";
import { AuthButton } from "@/components/auth-button";

function isFilled(v: unknown) {
  if (!v) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

export default async function ProjectDashboard(
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  const storyBundle = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/projects/${projectId}/story`,

    { cache: "no-store" }
  ).then(res => res.json());
  
  
  const { story, pages, characters, locations, styleGuide } = storyBundle;

  console.log('story', story,"pages, ", pages, "Chars", characters, "loc", locations, "Style", styleGuide)

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <Header session={null} minimal />
        <div className="mx-auto max-w-3xl p-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold">Sign in to pick up where you left off</p>
            <p className="mt-1 text-sm text-slate-600">
              Your story's been saved. Sign back in to keep going.
            </p>
  
            {/* ⬇️ THIS is what we change */}
            <div className="mt-4">
              <AuthButton />
            </div>
          </div>
        </div>
      </main>
    );
  }
  
  const project = await db.query.projects.findFirst({
    where: and(
      eq(projects.id, projectId),
      eq(projects.userId, session.user.id)
    ),
    // with: {
    //   stories: {
    //     with: {
    //       pages: true,
    //     },
    //   },
    // },
  });


  if (!project) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <Header session={session} minimal />
        <div className="mx-auto max-w-3xl p-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-semibold">We couldn't find this story</p>
            <p className="mt-1 text-sm text-slate-600">
              It may have been removed, or the link might not be quite right.
            </p>
            <div className="mt-4">
              <Link
                href="/projects" className="inline-flex items-center rounded-2xl bg-[#DE2E4A] px-4 py-2 text-sm font-semibold text-white"
              >
                Back to your library
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Lightweight “progress” signals for MVP
  const hasBrief = isFilled(project.storyBrief);
  const hasBasePrompt = isFilled(project.storyBasePrompt);
  const hasFullStory = isFilled(project.fullAiStory);

  const stageLabel = hasFullStory
    ? "First draft ready"
    : hasBrief || hasBasePrompt
      ? "Taking shape"
      : "Just getting started";

  const stageHint = hasFullStory
    ? "The story's drafted. Next: split it into pages and bring on the illustrations."
    : hasBrief || hasBasePrompt
      ? "You're most of the way there, a few more chat turns will lock in the story."
      : "Pick the conversation back up whenever you're ready, we've saved everything so far.";

  const progressPct = hasFullStory ? 70 : (hasBrief || hasBasePrompt ? 35 : 10);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900">
      {/* Real shared header, consistent with the rest of the site */}
      <Header session={session} minimal />

      <div className="relative mx-auto max-w-4xl px-5 pb-28 pt-8 sm:px-8 sm:pt-10">
        {/* Top row: back link + status badges */}
        <div className="flex items-center justify-between">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <span className="text-base">←</span>
            Your library
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-500">
              MVP
            </span>
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold text-slate-500">
              Auto-saves as you go
            </span>
          </div>
        </div>

        {/* Title block — warm welcome back, gradient treatment matching chat */}
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Welcome back to
          </p>
          <h1
            className="mt-1 text-3xl font-black tracking-tighter sm:text-4xl"
            style={{
              backgroundImage:
                "linear-gradient(90deg, #F2546A, #F7A93E, #8AC7E0, #A270C9)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {project.name}
          </h1>
        </div>

        {/* Status / Progress card */}
        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {stageLabel}
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {stageHint}
              </p>
            </div>

            {/* Tiny “Story Seed” delight */}
            <div className="shrink-0 rounded-2xl border border-slate-200 bg-[#FDFBFF] px-3 py-2 text-center">
              <div className="text-lg">✨</div>
              <div className="text-[10px] font-semibold text-slate-600">
                Story Seed
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full"
                style={{
                  width: `${progressPct}%`,
                  background:
                    "linear-gradient(90deg, #F2546A, #F7A93E, #8AC7E0, #A270C9)",
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                  hasBrief
                    ? "bg-[#DE2E4A]/10 text-[#DE2E4A] ring-[#DE2E4A]/20"
                    : "bg-slate-50 text-slate-400 ring-slate-200"
                }`}
              >
                Who it's for
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                  hasBasePrompt
                    ? "bg-[#5B6BD6]/10 text-[#5B6BD6] ring-[#5B6BD6]/20"
                    : "bg-slate-50 text-slate-400 ring-slate-200"
                }`}
              >
                The story idea
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                  hasFullStory
                    ? "bg-[#A270C9]/10 text-[#A270C9] ring-[#A270C9]/20"
                    : "bg-slate-50 text-slate-400 ring-slate-200"
                }`}
              >
                First draft
              </span>
              <span
                className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-400 ring-1 ring-slate-200"
              >
                Pages & art
              </span>
            </div>
          </div>
        </div>

        {/* Primary actions - mobile-first cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          
          
          {/* Chat */}
          <Link
            href={`/chat?project=${project.id}`}
            className="group rounded-3xl border border-slate-200 bg-gradient-to-br from-[#FFF6FB] via-[#FBF7FF] to-[#F6F4FF] p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#DE2E4A] text-white shadow-sm">
                <span className="text-xl">💬</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">
                    Pick up the conversation
                  </h2>
                  <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                    Recommended
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Jump back into the chat to keep shaping the story, right where you left off.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-[#DE2E4A] ring-1 ring-[#DE2E4A]/20">
                  <span className="text-base leading-none">⚡</span>
                  Your best next step
                </div>
              </div>
            </div>
          </Link>


        <PagesBox projectId={projectId} />
        
        <IllustrationsBox 
            projectId={projectId}
            style={styleGuide}
         />

          {/* PDF */}
          <Link
            href={`/projects/${project.id}/export`}
            className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-[#FDFBFF]">
                <span className="text-xl">📚</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900">Get the book</h2>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                    Soon
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  A print-ready copy for keeping, gifting, and reading at bedtime.
                </p>
                <p className="mt-3 text-[11px] text-slate-400">
                  Unlocks once the pages and art are ready.
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Gentle reassurance block */}
        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Nothing's lost, take this at your own pace.
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Everything's saved as you go, so you can step away and come back anytime.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-200 bg-[#FDFBFF] px-3 py-1 text-[10px] font-semibold text-slate-600">
                Mobile-first
              </span>
              <span className="rounded-full border border-slate-200 bg-[#FDFBFF] px-3 py-1 text-[10px] font-semibold text-slate-600">
                Gift-friendly
              </span>
              <span className="rounded-full border border-slate-200 bg-[#FDFBFF] px-3 py-1 text-[10px] font-semibold text-slate-600">
                Built for bedtime wins
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile action bar — the page's natural close, no separate footer */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-100 bg-white/95 backdrop-blur-xl">
        <div
          className="h-[3px] w-full"
          style={{
            background:
              "linear-gradient(90deg, #F2546A, #F7A93E, #8AC7E0, #A270C9)",
          }}
        />
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Up next
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              Keep chatting to finish the story
            </p>
          </div>
          <Link
            href={`/chat?project=${project.id}`}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#DE2E4A] px-4 py-2 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]"
          >
            Continue
          </Link>
        </div>
      </div>
    </main>
  );
}