// src/lib/pageGuards.ts
//
// Server-side guards for PAGES (not API routes; those use withAccess).
//
// Why pages need their own check: in the Next.js App Router a layout and
// its page render in parallel. A redirect() in the layout does NOT stop the
// page from fetching data and streaming it into the HTML. So every page
// that loads private data must check access itself, before loading.

import { redirect } from "next/navigation";
import { getAuthUser, owns } from "@/lib/authz";

export async function requireUserPage() {
  const user = await getAuthUser();
  if (!user) redirect("/auth/signin");
  return user;
}

export async function requireAdminPage() {
  const user = await getAuthUser();
  if (!user?.isAdmin) redirect("/");
  return user;
}

export async function requireStoryOwnerPage(storyId: string) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/signin");
  if (user.isAdmin) return user;
  let ok = false;
  try {
    ok = await owns("story", storyId, user.id);
  } catch {
    ok = false;
  }
  if (!ok) redirect("/projects");
  return user;
}

export async function requireProjectOwnerPage(projectId: string) {
  const user = await getAuthUser();
  if (!user) redirect("/auth/signin");
  if (user.isAdmin) return user;
  let ok = false;
  try {
    ok = await owns("project", projectId, user.id);
  } catch {
    ok = false;
  }
  if (!ok) redirect("/projects");
  return user;
}
