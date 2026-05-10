// src/app/basket/page.tsx

import { db } from "@/db";
import { stories, storyProducts, readers } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { projects } from "@/db/schema";
import BasketClient from "./BasketClient";

export default async function BasketPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Load all unpaid ready stories for this user
  const userProjects = await db.query.projects.findMany({
    where: eq(projects.userId, userId),
    columns: { id: true },
  });

  const projectIds = userProjects.map(p => p.id);
  if (projectIds.length === 0) redirect("/projects");

  const allStories = await db.query.stories.findMany({
    where: (s, { and, inArray, eq, notInArray }) => and(
      inArray(s.projectId, projectIds),
      eq(s.paymentStatus, "pending"),
    ),
    columns: {
      id: true,
      title: true,
      coverSpreadUrl: true,
      paymentStatus: true,
      readerId: true,
      completedSteps: true,
      length: true,
    },
    orderBy: (s, { desc }) => desc(s.createdAt),
  });

  // Only show stories that have completed the preview step
  const readyStories = allStories.filter(s => {
    const steps = (s.completedSteps ?? []) as string[];
    return steps.includes("preview");
  });

  if (readyStories.length === 0) redirect("/projects");

  // Load products for pricing
  const storyIds = readyStories.map(s => s.id);
  const products = await db.query.storyProducts.findMany({
    where: inArray(storyProducts.storyId, storyIds),
    columns: { storyId: true, productType: true, currency: true, estimatedPrice: true },
  });

  const productMap = Object.fromEntries(products.map(p => [p.storyId, p]));

  // Load reader names
  const readerIds = readyStories.map(s => s.readerId).filter(Boolean) as string[];
  const readerMap: Record<string, string> = {};
  if (readerIds.length > 0) {
    const readerRows = await db.query.readers.findMany({
      where: inArray(readers.id, readerIds),
      columns: { id: true, name: true },
    });
    for (const r of readerRows) {
      if (r.name) readerMap[r.id] = r.name;
    }
  }

  const basketStories = readyStories.map(s => ({
    id: s.id,
    title: s.title,
    coverSpreadUrl: s.coverSpreadUrl,
    readerName: s.readerId ? (readerMap[s.readerId] ?? null) : null,
    length: s.length,
    productType: productMap[s.id]?.productType ?? "digital",
    currency: productMap[s.id]?.currency ?? "GBP",
    estimatedPrice: productMap[s.id]?.estimatedPrice ?? 1400,
  }));

  return <BasketClient stories={basketStories} />;
}