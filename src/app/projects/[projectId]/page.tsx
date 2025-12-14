import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PagesBox from "@/app/projects/components/PagesBox";
import IllustrationsBox from "@/app/projects/components/IllustrationsBox";

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
      <main className="min-h-screen bg-[#0b0b10] text-white">
        <div className="mx-auto max-w-3xl p-8">
          <div className="rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
            <p className="text-lg font-semibold">You must be signed in.</p>
            <p className="mt-1 text-sm text-white/70">
              Please sign in to view your story projects.
            </p>
            <div className="mt-4">
              <Link
                href="/api/auth/signin"
                className="inline-flex items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black"
              >
                Sign in
              </Link>
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
      <main className="min-h-screen bg-[#0b0b10] text-white">
        <div className="mx-auto max-w-3xl p-8">
          <div className="rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
            <p className="text-lg font-semibold">Project not found.</p>
            <p className="mt-1 text-sm text-white/70">
              It may have been deleted or you might not have access.
            </p>
            <div className="mt-4">
              <Link
                href="/projects"
                className="inline-flex items-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black"
              >
                Back to projects
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

  console.log("PROJECT IN project page +> ", project)

  const stageLabel = hasFullStory
    ? "Story drafted"
    : hasBrief || hasBasePrompt
      ? "Story taking shape"
      : "Just getting started";

  const stageHint = hasFullStory
    ? "You can refine, split into pages, then illustrate."
    : hasBrief || hasBasePrompt
      ? "A few more chat turns will lock in the perfect vibe."
      : "Add your child’s details and choose the tone.";

  const progressPct = hasFullStory ? 70 : (hasBrief || hasBasePrompt ? 35 : 10);

  return (
    <main className="min-h-screen bg-[#0b0b10] text-white">
      {/* Soft gradient wash */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute top-[10%] right-[-140px] h-[520px] w-[520px] rounded-full bg-sky-400/20 blur-3xl" />
        <div className="absolute bottom-[-160px] left-[15%] h-[520px] w-[520px] rounded-full bg-emerald-400/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-4xl px-5 pb-28 pt-6 sm:px-8 sm:pt-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/10 hover:bg-white/15 transition"
          >
            <span className="text-base">←</span>
            Your library
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80 ring-1 ring-white/10">
              MVP
            </span>
            <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80 ring-1 ring-white/10">
              Auto-saves as you go
            </span>
          </div>
        </div>

        {/* Title block */}
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wide text-white/50">
            Your story project
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {project.name}
          </h1>
        </div>

        {/* Status / Progress card */}
        <div className="mt-6 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 backdrop-blur-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80 ring-1 ring-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {stageLabel}
              </div>
              <p className="mt-3 text-sm text-white/75">
                {stageHint}
              </p>
            </div>

            {/* Tiny “Story Seed” delight */}
            <div className="shrink-0 rounded-2xl bg-white/10 px-3 py-2 text-center ring-1 ring-white/10">
              <div className="text-lg">✨</div>
              <div className="text-[10px] font-semibold text-white/80">
                Story Seed
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 w-full rounded-full bg-white/10">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-sky-400 via-fuchsia-400 to-emerald-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                  hasBrief
                    ? "bg-emerald-400/15 text-emerald-100 ring-emerald-300/20"
                    : "bg-white/5 text-white/50 ring-white/10"
                }`}
              >
                Reader & vibe
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                  hasBasePrompt
                    ? "bg-sky-400/15 text-sky-100 ring-sky-300/20"
                    : "bg-white/5 text-white/50 ring-white/10"
                }`}
              >
                Story direction
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ${
                  hasFullStory
                    ? "bg-fuchsia-400/15 text-fuchsia-100 ring-fuchsia-300/20"
                    : "bg-white/5 text-white/50 ring-white/10"
                }`}
              >
                Draft complete
              </span>
              <span
                className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/50 ring-1 ring-white/10"
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
            className="group rounded-3xl bg-gradient-to-br from-sky-500/20 via-fuchsia-500/15 to-emerald-400/15 p-5 ring-1 ring-white/10 hover:ring-white/20 transition sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black shadow-sm">
                <span className="text-xl">💬</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    Continue story chat
                  </h2>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/80 ring-1 ring-white/10">
                    Recommended
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/75">
                  Add details, lock the tone, and generate the full story.
                </p>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80 ring-1 ring-white/10">
                  <span className="text-base leading-none">⚡</span>
                  Best next step for this project
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
            className="group rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 hover:ring-white/20 transition sm:p-6"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
                <span className="text-xl">📚</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold">Export</h2>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/70 ring-1 ring-white/10">
                    Soon
                  </span>
                </div>
                <p className="mt-1 text-sm text-white/70">
                  Create a print-ready PDF for keepsakes and gifting.
                </p>
                <p className="mt-3 text-[11px] text-white/50">
                  You’ll be able to export once your pages + art are ready.
                </p>
              </div>
            </div>
          </Link>
        </div>

        {/* Gentle reassurance block */}
        <div className="mt-8 rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">
                You’re building something lovely.
              </p>
              <p className="mt-1 text-xs text-white/70">
                This is your cosy control room — simple steps, no overwhelm.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80 ring-1 ring-white/10">
                Mobile-first
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80 ring-1 ring-white/10">
                Gift-friendly
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold text-white/80 ring-1 ring-white/10">
                Built for bedtime wins
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0b0b10]/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-white/50">
              Next best step
            </p>
            <p className="truncate text-sm font-semibold">
              Continue chat to generate the full story
            </p>
          </div>
          <Link
            href={`/chat?project=${project.id}`}
            className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black"
          >
            Open chat
          </Link>
        </div>
      </div>
    </main>
  );
}
