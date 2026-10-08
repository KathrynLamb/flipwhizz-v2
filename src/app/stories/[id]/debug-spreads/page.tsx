// src/app/stories/[id]/debug-spreads/page.tsx
//
// The scene plan for each spread now shows on the admin Book page (Pages
// tab, "Scene plan" under each spread). Old links redirect there.
import { redirect } from "next/navigation";

export default async function DebugSpreadsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/books/${id}?tab=pages`);
}
