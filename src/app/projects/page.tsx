import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// import { authOptions } from "@/api/auth/[...nextauth]/route";

export default async function ProjectsIndexPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return (
      <main className="min-h-screen bg-[#0b0b10] text-white p-8">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-3xl font-semibold mb-4">Your Stories</h1>
          <p className="text-white/70 mb-6">
            You need to sign in to view or create story projects.
          </p>

          <Link
            href="/api/auth/signin"
            className="inline-flex items-center rounded-2xl bg-white px-5 py-2.5 text-black font-semibold shadow transition hover:bg-white/90"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  // Fetch all projects for this user
  const list = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, session.user.id));

  return (
    <main className="min-h-screen bg-[#0b0b10] text-white p-8">
      <div className="mx-auto max-w-3xl">
        {/* header */}
        <h1 className="text-4xl font-semibold tracking-tight mb-6">
          Your Library
        </h1>

        <p className="text-white/70 mb-8">
          Your magical story projects — ready when you are.
        </p>

        {/* Create new project button */}
        <div className="mb-8">
          <Link
            href="/projects/create"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black shadow hover:bg-white/90 transition"
          >
            <span className="text-lg">➕</span> New Project
          </Link>
        </div>

        {/* Projects list */}
        {list.length === 0 ? (
          <p className="text-white/50 text-sm">
            You haven't created any projects yet.
          </p>
        ) : (
          <ul className="space-y-4">
            {list.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 hover:ring-white/20 hover:bg-white/10 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{p.name}</h2>
                      <p className="text-white/60 text-sm mt-1">
                      Created{" "}
{p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "—"}

                      </p>
                    </div>

                    <span className="text-xl">→</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
