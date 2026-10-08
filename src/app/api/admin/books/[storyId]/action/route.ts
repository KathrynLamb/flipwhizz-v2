// src/app/api/admin/books/[storyId]/action/route.ts
//
// The ONE door for admin actions on a book. Enforces, on the server, the
// same rules the Book page shows: confirmation by risk (type the title on a
// customer's book), one whole-book run at a time, a snapshot before
// anything that changes pictures, and a log line for everything.

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { stories, storySpreads, storyPages, storyProducts } from "@/db/schema";
import { inngest } from "@/inngest/client";
import { withAccess, getAuthUser } from "@/lib/authz";
import { ACTIONS, BOOK_STATUSES, confirmNeeded, isActionKey, titleMatches, type ActionKey } from "@/lib/admin/catalog";
import {
  loadBookIdentity,
  bookBusy,
  describeBusy,
  logAction,
  finishAdminAction,
  takeSnapshot,
  snapshotExists,
  restoreSnapshot,
  stopBook,
} from "@/lib/admin/server";
import { adminTablesReady } from "@/lib/admin/data";
import { copyBookTo, applyCopyToOriginal } from "@/lib/admin/copy";
import { reExtractCharacters } from "@/lib/admin/reExtract";
import { ensureReferenceSheet, storyCharacterIds } from "@/lib/illustrate/sheets";
import { getCastSheet } from "@/lib/characters/consistency";
import { createGelatoOrder } from "print/gelato/createOrder";
import { getPrintSpec } from "@/lib/printSpecs";

export const dynamic = "force-dynamic";
// Copying a book, re-extracting and drawing a reference sheet run inline.
export const maxDuration = 300;

type Body = {
  action?: string;
  confirmed?: boolean;
  confirmText?: string;
  artModel?: string;
  spreadId?: string;
  characterId?: string;
  feedback?: string;
  snapshotId?: string;
  status?: string;
  characters?: boolean;
  plans?: boolean;
};

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

async function _POST(req: Request, { params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  const body = ((await req.json().catch(() => ({}))) ?? {}) as Body;
  const user = await getAuthUser();
  if (!user?.isAdmin) return fail(404, "Not found");
  if (!isActionKey(body.action)) return fail(400, "Unknown action");
  const action: ActionKey = body.action;
  const info = ACTIONS[action];
  const artModel = body.artModel === "nb21" || body.artModel === "pro" ? body.artModel : undefined;

  const book = await loadBookIdentity(storyId);
  if (!book) return fail(404, "Book not found");
  if (!(await adminTablesReady())) {
    return fail(409, "Run the admin migration (scripts/sql/admin-controls.sql) in Neon first. It adds the snapshot and activity tables.");
  }

  // "Apply" changes the ORIGINAL book, so its protection is the original's.
  const target = action === "apply-to-original" ? (book.originalStoryId ? await loadBookIdentity(book.originalStoryId) : null) : book;
  if (!target) return fail(400, "This book isn't a test copy, so there's no original to apply it to.");

  const log = (status: "started" | "sent" | "done" | "failed", result: string | null, snapshotId?: string | null) =>
    logAction({ storyId: target.id, action, label: info.label, status, result, snapshotId, adminEmail: user.email, detail: body });

  // A background job logged as "started" keeps the book busy until it
  // reports back, so anything that stops it from starting must close it.
  let startedId: string | null = null;
  const refuse = async (why: string, status = 400) => {
    if (startedId) await finishAdminAction(startedId, { status: "failed", result: why });
    await logAction({ storyId: target.id, action, label: info.label, status: "refused", result: why, adminEmail: user.email, detail: body });
    return fail(status, why);
  };

  /* ---------------------------- 1. Confirmation --------------------------- */
  const need = confirmNeeded(action, target.kind);
  if (need === "type-title" && !titleMatches(body.confirmText, target.title)) {
    return refuse(`Type the book's title ("${target.title}") to confirm.`);
  }
  if (need === "confirm" && body.confirmed !== true) return refuse("Please confirm first.");

  /* --------------------- 2. Everything checkable up front -------------------- */
  let spread: typeof storySpreads.$inferSelect | undefined;
  if (action === "redraw-spread" || action === "fix-character-spread") {
    spread = await db.query.storySpreads.findFirst({
      where: and(eq(storySpreads.id, body.spreadId ?? ""), eq(storySpreads.storyId, storyId)),
    });
    if (!spread?.leftPageId) return refuse("That spread isn't in this book.");
  }
  if (action === "fix-character-spread" || action === "refresh-character" || action === "redraw-sheet") {
    const characterId = body.characterId ?? "";
    if (!(await storyCharacterIds(storyId, [characterId])).includes(characterId)) return refuse("Choose a character from this book.");
  }
  if (action === "redraw-cover" && !book.hasCoverStrategy) return refuse("This book has no saved cover plan yet. Make the cover in the cover chat first.");
  if (action === "restore-snapshot" && !(body.snapshotId && (await snapshotExists(storyId, body.snapshotId)))) return refuse("That snapshot isn't there any more.");
  if (action === "fix-status" && !BOOK_STATUSES.some((s) => s.value === body.status)) return refuse("Choose a status.");
  if (action === "test-print-order" && !book.pdfUrl) return refuse("No PDF yet. Export the PDF first.");

  const snapshotOpts =
    spread ? { spreadId: spread.id }
    : action === "replan-all" ? { plans: true, characters: true }
    : action === "restore-snapshot" ? { plans: true, characters: true, keep: [body.snapshotId!] }
    : {};

  try {
    /* ---- 3. Under a per-book lock: busy check, snapshot, job recorded ---- */
    let snapshotId: string | null = null;
    const prepare = async (): Promise<string | null> => {
      if (info.locks) {
        const busy = await bookBusy(target.id);
        if (busy.busy) return `This book is busy: ${describeBusy(busy)}. Wait for it, or press Stop first.`;
      }
      // "Apply" snapshots the original itself, with exactly what it changes.
      if (info.snapshot && action !== "apply-to-original") {
        snapshotId = await takeSnapshot(storyId, action === "restore-snapshot" ? "Before restoring a snapshot" : `Before: ${info.label}`, snapshotOpts);
      }
      if (info.long) startedId = await log("started", null, snapshotId);
      return null;
    };
    const busyWhy = info.locks
      ? await db.transaction(async (tx) => {
          // Two tabs pressing at once: the second waits here, then sees the first's job.
          await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"admin-book:" + target.id}))`);
          return prepare();
        })
      : await prepare();
    if (busyWhy) return refuse(busyWhy, 409);

    /* ------------------------------- 4. Do it ------------------------------- */
    switch (action) {
      case "redraw-spread": {
        const s = spread!;
        const [page] = await db.select({ imageUrl: storyPages.imageUrl }).from(storyPages).where(eq(storyPages.id, s.leftPageId!)).limit(1);
        const feedback = body.feedback?.trim();
        await inngest.send({
          name: "story/generate.single.spread",
          data: {
            storyId,
            leftPageId: s.leftPageId,
            rightPageId: s.rightPageId,
            pageLabel: `Spread ${s.spreadIndex}`,
            ...(artModel ? { artModel } : {}),
            // A note means "change this", so the current picture is the base.
            ...(feedback ? { feedback, existingSpreadImageUrl: page?.imageUrl ?? null } : {}),
          },
        });
        await log("sent", `Spread ${s.spreadIndex}${feedback ? `: "${feedback.slice(0, 120)}"` : ""}`, snapshotId);
        return NextResponse.json({ ok: true, message: `Spread ${s.spreadIndex} is being redrawn. The page keeps its current picture until the new one is checked and saved.` });
      }

      case "fix-character-spread":
      case "refresh-character": {
        await inngest.send({
          name: "story/refresh-character",
          data: {
            storyId,
            characterId: body.characterId,
            ...(artModel ? { artModel } : {}),
            ...(spread ? { spreadIds: [spread.id] } : {}),
            adminActionId: startedId,
          },
        });
        return NextResponse.json({ ok: true, message: spread ? `Fixing that character on spread ${spread.spreadIndex}.` : "Updating that character on every page they appear on." });
      }

      case "redraw-sheet": {
        const characterId = body.characterId!;
        // Drop this book's cached sheet, then draw a fresh one now.
        await db.execute(sql`
          UPDATE characters SET visual_details = coalesce(visual_details, '{}'::jsonb) #- ${`{sheets,${storyId}}`}::text[]
          WHERE id = ${characterId}
        `);
        const castSheet = await getCastSheet(storyId).catch(() => null);
        const url = await ensureReferenceSheet(characterId, storyId, { modelKey: artModel, line: castSheet?.lines?.[characterId] });
        if (!url) {
          await log("failed", "Couldn't draw a sheet (no card or photo?)");
          return fail(500, "Couldn't draw a new reference sheet. Does this character have a card or a photo?");
        }
        await log("done", url);
        return NextResponse.json({ ok: true, message: "New reference sheet drawn. Pages change when they're next redrawn or fixed." });
      }

      case "draw-missing":
      case "redraw-all":
      case "replan-all": {
        await db.update(stories).set({ status: "generating", updatedAt: new Date() }).where(eq(stories.id, storyId));
        await inngest.send({
          name: action === "replan-all" ? "story/ensure-world" : "story/generate-spreads",
          data: {
            storyId,
            allowUnpaid: true,
            ...(action === "draw-missing" ? {} : { force: true }),
            ...(artModel ? { artModel } : {}),
            adminActionId: startedId,
          },
        });
        return NextResponse.json({ ok: true, message: `${info.label}: started. Follow it on the Pages tab.` });
      }

      case "redraw-cover": {
        await db.update(stories).set({ status: "generating_covers", updatedAt: new Date() }).where(eq(stories.id, storyId));
        await inngest.send({ name: "story/generate.cover.spread", data: { storyId, adminActionId: startedId } });
        return NextResponse.json({ ok: true, message: "Cover redraw started." });
      }

      case "copy-to-me": {
        const newStoryId = await copyBookTo(storyId, user.id);
        await log("done", `Copy made: ${newStoryId}`);
        await logAction({ storyId: newStoryId, action, label: "Made as a test copy", status: "done", result: `Copied from ${storyId}`, adminEmail: user.email });
        return NextResponse.json({ ok: true, message: "Test copy made in your account.", newStoryId });
      }

      case "apply-to-original": {
        const res = await applyCopyToOriginal(storyId, { characters: body.characters !== false, plans: body.plans !== false });
        const result = [res.summary, ...res.warnings].join(" ");
        await log("done", result, res.snapshotId);
        await logAction({ storyId, action, label: "Applied to the original", status: "done", result, adminEmail: user.email });
        return NextResponse.json({ ok: true, message: result, originalStoryId: res.originalStoryId });
      }

      case "restore-snapshot": {
        const message = await restoreSnapshot(storyId, body.snapshotId!);
        await log("done", message, snapshotId);
        return NextResponse.json({ ok: true, message: `${message} The state just before this restore was snapshotted too.` });
      }

      case "stop": {
        const closed = await stopBook(storyId, (e) => inngest.send(e as any));
        await log("done", `Stopped${closed ? ` (${closed} job${closed === 1 ? "" : "s"} closed)` : ""}`);
        return NextResponse.json({ ok: true, message: "Stopped. Anything already saved stays; nothing half-finished will be saved." });
      }

      case "re-extract": {
        const res = await reExtractCharacters(storyId);
        await log("done", res.message);
        return NextResponse.json({ ok: true, message: res.message });
      }

      case "fix-status": {
        const status = body.status!;
        await db.update(stories).set({ status, updatedAt: new Date() }).where(eq(stories.id, storyId));
        await log("done", `${book.status ?? "none"} → ${status}`);
        return NextResponse.json({ ok: true, message: `Status set to ${status}.` });
      }

      case "test-print-order": {
        const [product] = await db.select().from(storyProducts).where(eq(storyProducts.storyId, storyId)).limit(1);
        let spec;
        try {
          spec = getPrintSpec(product?.productType);
        } catch {
          spec = getPrintSpec("print");
        }
        const result = await createGelatoOrder({
          orderReferenceId: `flipwhizz-test-${uuidv4()}`,
          customerReferenceId: "admin-test",
          pdfUrl: book.pdfUrl!,
          productUid: spec.gelatoProductUid,
          pageCount: spec.totalProductPageCount,
          currency: product?.currency ?? "GBP",
          shippingAddress: {
            firstName: "Katy",
            lastName: "Lamb",
            addressLine1: "Manor House",
            city: "Stockton-on-tees",
            postCode: "TS16 0QT",
            countryIsoCode: "GB",
            email: process.env.ADMIN_EMAIL ?? user.email ?? "",
          },
        });
        const msg = result.draft
          ? `Gelato saved it as a draft (${result.id ?? "no id"}): check the address in Gelato.`
          : `Gelato order ${result.id} placed (${result.fulfillmentStatus}).`;
        await log("done", msg);
        return NextResponse.json({ ok: true, message: msg });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[admin action ${action}] ${storyId}:`, err);
    if (startedId) await finishAdminAction(startedId, { status: "failed", result: message });
    else await log("failed", message.slice(0, 1000));
    return fail(500, message);
  }
  return fail(400, "Unknown action");
}

export const POST = withAccess({ admin: true }, _POST);
