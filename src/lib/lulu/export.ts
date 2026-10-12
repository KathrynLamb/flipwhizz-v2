import { db } from "@/db";
import { stories, storyPages } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { uploadPdfToR2 } from "@/lib/uploadPdfToR2";
import { luluClient, colouringPodPackageId } from "./client";
import { buildColouringInterior, buildColouringCover } from "./pdf";
import { randomUUID } from "node:crypto";

async function image(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error("Could not load book artwork");
  return Buffer.from(await response.arrayBuffer());
}
export async function buildColouringFiles(storyId: string, print: boolean, save = true) {
  const story = await db.query.stories.findFirst({ where: eq(stories.id, storyId) });
  if (!story || story.bookType !== "colouring_storybook") throw new Error("Colouring storybook not found");
  if (!story.coverSpreadUrl) throw new Error("Create your cover first");
  const pages = await db.query.storyPages.findMany({ where: eq(storyPages.storyId, storyId), orderBy: asc(storyPages.pageNumber) });
  if (!pages.length || pages.some(p => !p.imageUrl)) throw new Error("Finish all illustrations before exporting");
  const cover = await image(story.coverSpreadUrl);
  const spreads = [];
  // Bounded downloading avoids a burst of large images at export time.
  for (let i = 0; i < pages.length; i += 2) spreads.push({ image: await image(pages[i].imageUrl!), hasRightPage: Boolean(pages[i + 1]) });
  const interior = await buildColouringInterior({ title: story.title, cover, spreads, titleInColour: !print });
  const version = randomUUID();
  const interiorUrl = await uploadPdfToR2(interior.buffer, `${storyId}-colouring-interior-${version}`);
  let coverUrl: string | null = null;
  let podPackageId: string | null = null;
  if (print) {
    podPackageId = colouringPodPackageId();
    const dimensions = await luluClient().coverDimensions(podPackageId, interior.pageCount);
    if (dimensions.unit !== "pt") throw new Error("Lulu returned unexpected cover units");
    const coverPdf = await buildColouringCover(cover, { width: Number(dimensions.width), height: Number(dimensions.height) });
    coverUrl = await uploadPdfToR2(coverPdf, `${storyId}-colouring-cover-${version}`);
    if (save) await db.update(stories).set({ luluInteriorPdfUrl: interiorUrl, luluCoverPdfUrl: coverUrl, luluPodPackageId: podPackageId, luluPageCount: interior.pageCount }).where(eq(stories.id, storyId));
  } else if (save) {
    await db.update(stories).set({ pdfUrl: interiorUrl, pdfUpdatedAt: new Date() }).where(eq(stories.id, storyId));
  }
  return { interiorUrl, coverUrl, pageCount: interior.pageCount, podPackageId, sources: { cover: story.coverSpreadUrl, pictures: pages.filter((_, i) => i % 2 === 0).map(p => p.imageUrl!) } };
}
