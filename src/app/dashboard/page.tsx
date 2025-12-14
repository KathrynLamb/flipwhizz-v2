import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProjectDashboard({
  params,
}: {
  params: { projectId: string };
}) {
  const projectId = params?.projectId;
  if (!projectId) redirect("/projects");

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .then((rows) => rows[0]);

  if (!project) {
    return <div className="p-10">Project not found.</div>;
  }

  return (
    <main className="p-10 space-y-6">
      <h1 className="text-3xl font-semibold">{project.name}</h1>
      <p className="text-muted-foreground">Project dashboard</p>

      <div className="grid gap-4">
        <Link
          href={`/chat?project=${project.id}`}
          className="p-4 bg-blue-600 text-white rounded-md"
        >
          Open Story Editor
        </Link>

        <Link
          href={`/projects/${project.id}/images`}
          className="p-4 bg-gray-100 rounded-md"
        >
          Generate Images
        </Link>

        <Link
          href={`/projects/${project.id}/export`}
          className="p-4 bg-gray-100 rounded-md"
        >
          Export PDF
        </Link>
      </div>
    </main>
  );
}
