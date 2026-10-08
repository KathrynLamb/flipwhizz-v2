// src/app/admin/books/[storyId]/BookClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ACTIONS, BOOK_STATUSES, confirmNeeded, titleMatches, type ActionKey, type BookKind } from "@/lib/admin/catalog";
import type { BookDetail, SpreadDetail, CharacterDetail, LocationDetail } from "@/lib/admin/data";
import { Card, Empty, KindBadge, MigrationBanner, Pill, thumb, when } from "../../ui";

export type BookTab = "overview" | "pages" | "characters" | "locations" | "redraw" | "activity";

type Original = { id: string; title: string; kind: BookKind; ownerEmail: string | null } | null;

type Fields = "note" | "character" | "status" | "apply";

type Dialog = {
  action: ActionKey;
  heading: string;
  payload: Record<string, unknown>;
  need: "none" | "confirm" | "type-title";
  titleToType: string;
  kind: BookKind;
  fields?: Fields;
  characterOptions?: { id: string; name: string }[];
};

const TAB_LABELS: Record<BookTab, string> = {
  overview: "Overview",
  pages: "Pages",
  characters: "Characters",
  locations: "Places",
  redraw: "Redraw",
  activity: "Activity",
};

const STATUS: Record<string, { label: string; tone: "green" | "red" | "amber" | "slate" }> = {
  ok: { label: "Checked: all correct", tone: "green" },
  fixed: { label: "Checked: fixed", tone: "green" },
  flagged: { label: "Needs attention", tone: "red" },
  unchecked: { label: "Check failed to run", tone: "amber" },
};

const MODELS = [
  { value: "nb21", label: "Nano Banana 2.1" },
  { value: "pro", label: "Gemini 3 Pro Image" },
];

const btn = "rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const btnPrimary = `${btn} bg-[#8B5CF6] text-white hover:bg-[#7C4DEB]`;
const btnQuiet = `${btn} border border-white/15 text-slate-200 hover:bg-white/5`;
const btnDanger = `${btn} bg-rose-600 text-white hover:bg-rose-500`;

export default function BookClient({ detail, tab, original }: { detail: BookDetail; tab: BookTab; original: Original }) {
  const router = useRouter();
  const { book, busy } = detail;
  const [model, setModel] = useState("nb21");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string; link?: { href: string; label: string } } | null>(null);

  // Keep the page live while something is drawing.
  useEffect(() => {
    if (!busy.busy) return;
    const t = setInterval(() => router.refresh(), 15000);
    return () => clearInterval(t);
  }, [busy.busy, router]);

  const busyText = useMemo(() => {
    const parts = busy.running.map((r) => `${r.label} (started ${when(r.createdAt)})`);
    if (busy.pendingSpreads.length) parts.push(`${busy.pendingSpreads.length} spread${busy.pendingSpreads.length === 1 ? "" : "s"} still drawing (${busy.pendingSpreads.join(", ")})`);
    return parts.join(" · ");
  }, [busy]);

  async function run(action: ActionKey, payload: Record<string, unknown>) {
    setSending(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/books/${book.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, artModel: model, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setMessage({ ok: false, text: data.error ?? `Failed (${res.status})` });
      } else {
        setMessage({
          ok: true,
          text: data.message ?? "Done.",
          link: data.newStoryId
            ? { href: `/admin/books/${data.newStoryId}`, label: "Open the copy →" }
            : data.originalStoryId
              ? { href: `/admin/books/${data.originalStoryId}?tab=pages`, label: "Open the original →" }
              : undefined,
        });
        setDialog(null);
      }
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSending(null);
    }
  }

  /** Ask first when the action's safeguard (or its extra fields) needs it. */
  function ask(action: ActionKey, payload: Record<string, unknown> = {}, opts: { heading?: string; fields?: Fields; characterOptions?: { id: string; name: string }[] } = {}) {
    const forOriginal = action === "apply-to-original" && original;
    const kind = forOriginal ? original.kind : book.kind;
    const need = confirmNeeded(action, kind);
    if (need === "none" && !opts.fields) {
      void run(action, payload);
      return;
    }
    setMessage(null);
    setDialog({
      action,
      heading: opts.heading ?? ACTIONS[action].label,
      payload,
      need,
      titleToType: forOriginal ? original.title : book.title,
      kind,
      fields: opts.fields,
      characterOptions: opts.characterOptions,
    });
  }

  const locked = (a: ActionKey) => ACTIONS[a].locks && busy.busy;

  return (
    <>
      {/* Header */}
      <div className="mb-4">
        <Link href="/admin/books" className="text-xs text-slate-500 hover:text-white">
          ← Books
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-white md:text-2xl">{book.title}</h1>
          <KindBadge kind={book.kind} />
        </div>
        <div className="mt-1 text-sm text-slate-400">
          {book.ownerId ? (
            <Link href={`/admin/customers/${book.ownerId}`} className="hover:text-white">
              {book.ownerEmail}
            </Link>
          ) : (
            "no owner"
          )}
          {" · "}
          {book.status ?? "no status"} · payment {book.paymentStatus ?? "none"}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={`/stories/${book.id}/studio`} className={btnQuiet}>Studio</a>
          <a href={`/stories/${book.id}/preview`} className={btnQuiet}>Preview</a>
          <a href={`/stories/${book.id}/book`} className={btnQuiet}>Book view</a>
          <label className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            Image model
            <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-white/15 bg-[#11111d] px-2 py-1.5 text-xs text-white">
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!detail.tablesReady && <MigrationBanner />}

      {book.kind === "customer-paid" && (
        <div className="mb-4 rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100">
          A paying customer&apos;s book. Every change is snapshotted first and can be undone from Activity.
          {original === null && detail.copies.length === 0 && " For big changes, make a test copy first (Overview)."}
        </div>
      )}

      {busy.busy && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-violet-400/40 bg-violet-500/10 p-3 text-sm text-violet-100">
          <span className="flex-1">Busy: {busyText}. This page refreshes itself.</span>
          <button className={btnDanger} disabled={!!sending} onClick={() => ask("stop")}>
            {sending === "stop" ? "Stopping…" : "Stop"}
          </button>
        </div>
      )}

      {message && (
        <div className={`mb-4 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm ${message.ok ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-rose-400/40 bg-rose-500/10 text-rose-100"}`}>
          <span className="flex-1">{message.text}</span>
          {message.link && <Link href={message.link.href} className="font-semibold underline">{message.link.label}</Link>}
          <button className="text-xs opacity-70 hover:opacity-100" onClick={() => setMessage(null)}>Dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-white/10">
        {(Object.keys(TAB_LABELS) as BookTab[]).map((t) => (
          <Link
            key={t}
            href={`/admin/books/${book.id}?tab=${t}`}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${tab === t ? "border-[#C4B5FD] font-semibold text-white" : "border-transparent text-slate-400 hover:text-white"}`}
          >
            {TAB_LABELS[t]}
            {t === "pages" && detail.spreads.some((s) => s.status === "flagged") ? " •" : ""}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview detail={detail} original={original} ask={ask} sending={sending} locked={locked} />}
      {tab === "pages" && <Pages spreads={detail.spreads} ask={ask} sending={sending} />}
      {tab === "characters" && <Characters characters={detail.characters} ask={ask} sending={sending} locked={locked} />}
      {tab === "locations" && <Places locations={detail.locations} spreads={detail.spreads} bookId={book.id} />}
      {tab === "redraw" && <Redraw detail={detail} ask={ask} sending={sending} locked={locked} />}
      {tab === "activity" && <Activity detail={detail} ask={ask} sending={sending} locked={locked} />}

      {dialog && (
        <ConfirmDialog
          dialog={dialog}
          sending={sending === dialog.action}
          error={message && !message.ok ? message.text : null}
          onCancel={() => {
            setDialog(null);
          }}
          onConfirm={(extra) => run(dialog.action, { ...dialog.payload, ...extra })}
        />
      )}
    </>
  );
}

type Ask = (action: ActionKey, payload?: Record<string, unknown>, opts?: { heading?: string; fields?: Fields; characterOptions?: { id: string; name: string }[] }) => void;

/* -------------------------------------------------------------------------- */
/*                                  Overview                                  */
/* -------------------------------------------------------------------------- */

function Overview({ detail, original, ask, sending, locked }: { detail: BookDetail; original: Original; ask: Ask; sending: string | null; locked: (a: ActionKey) => boolean }) {
  const { book } = detail;
  const drawn = detail.spreads.filter((s) => s.pageImageUrl).length;
  const flagged = detail.spreads.filter((s) => s.status === "flagged").length;
  const facts: [string, React.ReactNode][] = [
    ["Owner", book.ownerId ? <Link href={`/admin/customers/${book.ownerId}`} className="text-[#C4B5FD] hover:text-white">{book.ownerEmail}</Link> : "none"],
    ["Status", book.status ?? "none"],
    ["Payment", book.paymentStatus ?? "none"],
    ["Print order", book.orderStatus ?? "none"],
    ["Spreads drawn", `${drawn} of ${detail.spreads.length}${flagged ? `, ${flagged} need attention` : ""}`],
    ["PDF", book.pdfUrl ? <a href={book.pdfUrl} target="_blank" className="text-[#C4B5FD] hover:text-white">open ↗</a> : "not exported"],
    ["Created", when(book.createdAt)],
    ["Updated", when(book.updatedAt)],
    ["Story id", <span key="id" className="font-mono text-xs">{book.id}</span>],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="This book">
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 text-sm">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-slate-500">{k}</dt>
              <dd className="min-w-0 break-words text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>
        {detail.progress && (
          <div className="mt-3 flex flex-wrap gap-1">
            {Object.entries(detail.progress).map(([k, v]) => (
              <Pill key={k} tone={v === true ? "green" : v === false ? "red" : "slate"}>{k}</Pill>
            ))}
          </div>
        )}
      </Card>

      <Card title="Cover">
        {book.coverSpreadUrl ? (
          <a href={book.coverSpreadUrl} target="_blank">
            <img src={thumb(book.coverSpreadUrl, 720)} alt="Cover" className="w-full rounded-lg border border-white/10" />
          </a>
        ) : (
          <Empty>No cover yet.</Empty>
        )}
      </Card>

      <Card title="Test copies">
        {original ? (
          <div className="space-y-3 text-sm">
            <p>
              This is a test copy of{" "}
              <Link href={`/admin/books/${original.id}`} className="text-[#C4B5FD] hover:text-white">{original.title}</Link>{" "}
              <KindBadge kind={original.kind} /> ({original.ownerEmail}).
            </p>
            <p className="text-slate-400">{ACTIONS["apply-to-original"].detail}</p>
            <button className={btnPrimary} disabled={!!sending} onClick={() => ask("apply-to-original", {}, { fields: "apply" })}>
              {sending === "apply-to-original" ? "Applying…" : ACTIONS["apply-to-original"].label}
            </button>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-slate-400">{ACTIONS["copy-to-me"].detail}</p>
            {detail.copies.length > 0 && (
              <ul className="space-y-1">
                {detail.copies.map((c) => (
                  <li key={c.id}>
                    <Link href={`/admin/books/${c.id}`} className="text-[#C4B5FD] hover:text-white">Test copy from {when(c.createdAt)} →</Link>
                  </li>
                ))}
              </ul>
            )}
            <button className={btnQuiet} disabled={!!sending || !detail.tablesReady} onClick={() => ask("copy-to-me")}>
              {sending === "copy-to-me" ? "Copying… (up to a minute)" : ACTIONS["copy-to-me"].label}
            </button>
          </div>
        )}
      </Card>

      <Card title="Orders">
        {detail.orders.length === 0 ? (
          <p className="text-sm text-slate-500">No orders for this book.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {detail.orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-slate-500">{o.id.slice(0, 8)}</span>
                <Pill tone={o.status === "failed" || o.status === "pending_manual" ? "red" : "slate"}>{o.status}</Pill>
                <span className="text-slate-400">{o.paymentStatus}</span>
                {o.gelatoStatus && <span className="text-slate-400">Gelato: {o.gelatoStatus}</span>}
                {o.trackingUrl && <a href={o.trackingUrl} target="_blank" className="text-[#C4B5FD]">tracking ↗</a>}
                <span className="text-xs text-slate-500">{when(o.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="mb-2 text-xs text-slate-400">{ACTIONS["test-print-order"].detail}</p>
          <button className={btnQuiet} disabled={!!sending || !book.pdfUrl || locked("test-print-order")} onClick={() => ask("test-print-order")}>
            {sending === "test-print-order" ? "Ordering…" : book.pdfUrl ? ACTIONS["test-print-order"].label : "Test print order (needs a PDF)"}
          </button>
        </div>
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Pages                                    */
/* -------------------------------------------------------------------------- */

function Pages({ spreads, ask, sending }: { spreads: SpreadDetail[]; ask: Ask; sending: string | null }) {
  if (spreads.length === 0) return <Empty>No spreads yet. Plan the book first (Redraw tab).</Empty>;
  return (
    <div className="space-y-3">
      {spreads.map((s) => {
        const st = s.status ? STATUS[s.status] ?? { label: s.status, tone: "slate" as const } : { label: "Not checked (drawn before checks)", tone: "slate" as const };
        const problems = [...s.remaining, ...s.textProblems];
        return (
          <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              {s.pageImageUrl ? (
                <a href={s.pageImageUrl} target="_blank" className="shrink-0">
                  <img src={thumb(s.pageImageUrl, 480)} alt={`Spread ${s.index}`} className="w-full rounded-lg border border-white/10 sm:w-56" />
                </a>
              ) : (
                <div className="flex h-28 w-full shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs text-slate-500 sm:w-56">No picture</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b className="text-sm text-white">Spread {s.index}{s.pages ? ` · pages ${s.pages}` : ""}</b>
                  <Pill tone={st.tone}>{st.label}{s.fixesApplied ? ` · ${s.fixesApplied} fix${s.fixesApplied === 1 ? "" : "es"}` : ""}</Pill>
                  {s.pending && <Pill tone="violet">drawing…</Pill>}
                  {!s.pending && s.lastFailed && <Pill tone="amber">last redraw failed</Pill>}
                </div>
                {s.onPage === false && <p className="mt-1 text-xs text-rose-300">The page shows a different picture from the one this check is about. Redraw it once to settle it.</p>}
                {problems.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 text-xs text-rose-200">
                    {problems.map((p, i) => <li key={i}>{p}</li>)}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className={btnQuiet}
                    disabled={!!sending}
                    onClick={() => ask("redraw-spread", { spreadId: s.id }, { heading: `Redraw spread ${s.index}`, fields: "note" })}
                  >
                    Redraw
                  </button>
                  <button
                    className={btnQuiet}
                    disabled={!!sending || s.present.length === 0 || !s.pageImageUrl}
                    onClick={() =>
                      ask("fix-character-spread", { spreadId: s.id }, { heading: `Fix one character on spread ${s.index}`, fields: "character", characterOptions: s.present.map((p) => ({ id: p.id, name: p.name })) })
                    }
                  >
                    Fix one character
                  </button>
                  {s.artUrl && <a href={s.artUrl} target="_blank" className="self-center text-xs text-[#C4B5FD] hover:text-white">art without text ↗</a>}
                  {s.model && <span className="self-center text-xs text-slate-500">{s.model} · {when(s.at)}</span>}
                </div>
                <details className="mt-2 text-xs text-slate-400">
                  <summary className="cursor-pointer text-slate-500 hover:text-white">Scene plan</summary>
                  <div className="mt-2 space-y-1">
                    {s.location && <div><span className="text-slate-500">Place:</span> {s.location}</div>}
                    <div>
                      <span className="text-slate-500">Who:</span>{" "}
                      {s.present.length ? s.present.map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(", ") : "nobody planned"}
                    </div>
                    {(s.sceneBrief || s.sceneSummary) && <div><span className="text-slate-500">Scene:</span> {s.sceneBrief || s.sceneSummary}</div>}
                    {s.text && <div className="whitespace-pre-wrap"><span className="text-slate-500">Text:</span> {s.text}</div>}
                  </div>
                </details>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 Characters                                 */
/* -------------------------------------------------------------------------- */

function Characters({ characters, ask, sending, locked }: { characters: CharacterDetail[]; ask: Ask; sending: string | null; locked: (a: ActionKey) => boolean }) {
  if (characters.length === 0) return <Empty>No characters on this book yet.</Empty>;
  const img = (url: string | null, label: string) =>
    url ? (
      <a href={url} target="_blank" className="block">
        <img src={thumb(url, 240)} alt={label} className="h-24 w-full rounded border border-white/10 object-cover" />
        <span className="mt-1 block text-center text-[10px] text-slate-500">{label}</span>
      </a>
    ) : (
      <div>
        <div className="flex h-24 items-center justify-center rounded border border-dashed border-white/10 text-[10px] text-slate-600">none</div>
        <span className="mt-1 block text-center text-[10px] text-slate-500">{label}</span>
      </div>
    );
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {characters.map((c) => (
        <Card key={c.id} title={c.name} right={<span className="text-xs text-slate-500">{[c.role, c.species].filter(Boolean).join(" · ")}</span>}>
          <div className="grid grid-cols-3 gap-2">
            {img(c.portraitUrl, "card")}
            {img(c.photoUrl, "photo")}
            {img(c.sheetUrl, "reference sheet")}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {c.spreads.length ? `On spread${c.spreads.length === 1 ? "" : "s"} ${c.spreads.join(", ")}` : "Not planned on any spread"}
            {c.sheetStale && " · sheet is out of date (card or photo changed); it's redrawn on the next drawing"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={btnQuiet}
              disabled={!!sending || c.spreads.length === 0 || locked("refresh-character")}
              onClick={() => ask("refresh-character", { characterId: c.id }, { heading: `Update ${c.name} on every page` })}
            >
              Update on every page
            </button>
            <button className={btnQuiet} disabled={!!sending} onClick={() => ask("redraw-sheet", { characterId: c.id }, { heading: `Redraw ${c.name}'s reference sheet` })}>
              {sending === "redraw-sheet" ? "Drawing…" : "Redraw reference sheet"}
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Places                                   */
/* -------------------------------------------------------------------------- */

function Places({ locations, spreads, bookId }: { locations: LocationDetail[]; spreads: SpreadDetail[]; bookId: string }) {
  const unplaced = spreads.filter((s) => s.pageImageUrl && !s.locationId).map((s) => s.index);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <span>The picture shown is the one every drawing uses as the setting for that place.</span>
        <a href={`/stories/${bookId}/locations`} className={btnQuiet}>Edit places (customer view)</a>
      </div>
      {unplaced.length > 0 && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-2 text-xs text-amber-100">
          Spread{unplaced.length === 1 ? "" : "s"} {unplaced.join(", ")} {unplaced.length === 1 ? "has" : "have"} no place linked, so {unplaced.length === 1 ? "it was" : "they were"} drawn without a setting reference.
        </p>
      )}
      {locations.length === 0 ? (
        <Empty>No places on this book yet.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {locations.map((l) => {
            const mismatch = l.spreadsPlanned.filter((i) => !l.spreadsDrawn.includes(i));
            return (
              <Card key={l.id} title={l.name} right={l.significance ? <span className="text-xs text-slate-500">{l.significance}</span> : undefined}>
                {l.imageUrl ? (
                  <a href={l.imageUrl} target="_blank">
                    <img src={thumb(l.imageUrl, 480)} alt={l.name} className="h-40 w-full rounded-lg border border-white/10 object-cover" />
                  </a>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-white/10 text-xs text-slate-500">
                    No picture: drawings get only the place&apos;s name
                  </div>
                )}
                {l.description && <p className="mt-2 line-clamp-3 text-xs text-slate-400">{l.description}</p>}
                <p className="mt-2 text-xs text-slate-300">
                  {l.spreadsDrawn.length ? `Drawn here: spread${l.spreadsDrawn.length === 1 ? "" : "s"} ${l.spreadsDrawn.join(", ")}` : "Not used by any drawn spread"}
                </p>
                {mismatch.length > 0 && (
                  <p className="mt-1 text-xs text-amber-200">
                    The scene plan puts spread{mismatch.length === 1 ? "" : "s"} {mismatch.join(", ")} here, but {mismatch.length === 1 ? "it's" : "they're"} drawn with a different place.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   Redraw                                   */
/* -------------------------------------------------------------------------- */

function Redraw({ detail, ask, sending, locked }: { detail: BookDetail; ask: Ask; sending: string | null; locked: (a: ActionKey) => boolean }) {
  const whole: ActionKey[] = ["draw-missing", "redraw-all", "replan-all", "redraw-cover"];
  return (
    <div className="space-y-4">
      <Card title="Whole book">
        <div className="space-y-3">
          {whole.map((a) => {
            const disabled = !!sending || locked(a) || (a === "redraw-cover" && !detail.book.hasCoverStrategy);
            return (
              <div key={a} className="flex flex-col gap-2 rounded-lg border border-white/10 p-3 sm:flex-row sm:items-center">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-white">{ACTIONS[a].label}</div>
                  <div className="text-xs text-slate-400">
                    {ACTIONS[a].detail}
                    {a === "redraw-cover" && !detail.book.hasCoverStrategy && " (No saved cover plan yet: make the cover in the cover chat first.)"}
                  </div>
                </div>
                <button className={ACTIONS[a].safeguard === "type-title-snapshot" ? btnDanger : btnPrimary} disabled={disabled} onClick={() => ask(a)}>
                  {sending === a ? "Starting…" : locked(a) ? "Busy" : "Start"}
                </button>
              </div>
            );
          })}
        </div>
        {detail.busy.busy && <p className="mt-3 text-xs text-violet-200">Whole-book actions are paused while this book is busy. Wait, or press Stop.</p>}
      </Card>

      <details className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-white">Advanced</summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-col gap-2 rounded-lg border border-white/10 p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{ACTIONS["re-extract"].label}</div>
              <div className="text-xs text-slate-400">{ACTIONS["re-extract"].detail}</div>
            </div>
            <button className={btnQuiet} disabled={!!sending || locked("re-extract")} onClick={() => ask("re-extract")}>
              {sending === "re-extract" ? "Reading…" : "Re-extract"}
            </button>
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-white/10 p-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="text-sm font-semibold text-white">{ACTIONS["fix-status"].label}</div>
              <div className="text-xs text-slate-400">
                {ACTIONS["fix-status"].detail} Now: <b>{detail.book.status ?? "none"}</b>.
              </div>
            </div>
            <button className={btnQuiet} disabled={!!sending} onClick={() => ask("fix-status", {}, { fields: "status" })}>
              Set status
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  Activity                                  */
/* -------------------------------------------------------------------------- */

const ACTION_TONE: Record<string, "green" | "red" | "amber" | "violet" | "slate"> = {
  done: "green",
  sent: "green",
  started: "violet",
  failed: "red",
  refused: "amber",
  stopped: "amber",
};

function Activity({ detail, ask, sending, locked }: { detail: BookDetail; ask: Ask; sending: string | null; locked: (a: ActionKey) => boolean }) {
  return (
    <div className="space-y-4">
      <Card
        title="Running now"
        right={
          <a href="https://app.inngest.com/env/production/runs" target="_blank" className="text-xs text-[#C4B5FD] hover:text-white">
            Inngest runs ↗
          </a>
        }
      >
        {detail.busy.busy ? (
          <div className="space-y-2 text-sm">
            {detail.busy.running.map((r) => (
              <div key={r.id}>{r.label} <span className="text-slate-500">· started {when(r.createdAt)}</span></div>
            ))}
            {detail.busy.pendingSpreads.length > 0 && <div>Spreads still drawing: {detail.busy.pendingSpreads.join(", ")}</div>}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nothing is running for this book.</p>
        )}
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-400">{ACTIONS.stop.detail}</p>
          <button className={btnDanger} disabled={!!sending} onClick={() => ask("stop")}>
            {sending === "stop" ? "Stopping…" : ACTIONS.stop.label}
          </button>
        </div>
      </Card>

      <Card title="Snapshots">
        {detail.snapshots.length === 0 ? (
          <p className="text-sm text-slate-500">No snapshots yet. One is taken automatically before anything changes this book&apos;s pictures.</p>
        ) : (
          <ul className="space-y-2">
            {detail.snapshots.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 p-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="text-white">{s.reason}</div>
                  <div className="text-xs text-slate-500">
                    {when(s.createdAt)} · {s.spreadOnly ? "one spread" : `${s.drawn}/${s.pages} pages with pictures`}{s.hasCharacters ? " · character cards" : ""}{s.hasPlans ? " · scene plans" : ""}
                  </div>
                </div>
                <button
                  className={btnQuiet}
                  disabled={!!sending || locked("restore-snapshot")}
                  onClick={() => ask("restore-snapshot", { snapshotId: s.id }, { heading: `Restore the snapshot from ${when(s.createdAt)}` })}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Admin actions">
        {detail.actions.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <ul className="space-y-2">
            {detail.actions.map((a) => (
              <li key={a.id} className="text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white">{a.label}</span>
                  <Pill tone={ACTION_TONE[a.status] ?? "slate"}>{a.status}</Pill>
                  <span className="text-xs text-slate-500">{when(a.createdAt)}{a.finishedAt && a.status !== "sent" ? ` → ${when(a.finishedAt)}` : ""}</span>
                </div>
                {a.result && <div className="break-words text-xs text-slate-400">{a.result}</div>}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Confirm dialog                               */
/* -------------------------------------------------------------------------- */

function ConfirmDialog({
  dialog,
  sending,
  error,
  onCancel,
  onConfirm,
}: {
  dialog: Dialog;
  sending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (extra: Record<string, unknown>) => void;
}) {
  const info = ACTIONS[dialog.action];
  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [characterId, setCharacterId] = useState(dialog.characterOptions?.[0]?.id ?? "");
  const [status, setStatus] = useState(BOOK_STATUSES[1].value);
  const [withCards, setWithCards] = useState(true);
  const [withPlans, setWithPlans] = useState(true);

  const ready =
    (dialog.need !== "type-title" || titleMatches(typed, dialog.titleToType)) &&
    (dialog.fields !== "character" || !!characterId);

  const extra: Record<string, unknown> = { confirmed: true };
  if (dialog.need === "type-title") extra.confirmText = typed;
  if (dialog.fields === "note" && note.trim()) extra.feedback = note.trim();
  if (dialog.fields === "character") extra.characterId = characterId;
  if (dialog.fields === "status") extra.status = status;
  if (dialog.fields === "apply") {
    extra.characters = withCards;
    extra.plans = withPlans;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#11111d] p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-white">{dialog.heading}</h2>
        </div>
        <div className="mt-2"><KindBadge kind={dialog.kind} /></div>
        <p className="mt-3 text-sm text-slate-300">{info.detail}</p>
        {info.snapshot && <p className="mt-2 text-xs text-slate-400">A snapshot is taken first, so you can undo this from Activity.</p>}

        {dialog.fields === "note" && (
          <label className="mt-4 block text-xs text-slate-400">
            What should change? (optional; leave empty to draw it fresh)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 p-2 text-sm text-white"
              placeholder="e.g. Talia's curls should be longer; Dad is missing"
            />
          </label>
        )}
        {dialog.fields === "character" && (
          <label className="mt-4 block text-xs text-slate-400">
            Character
            <select value={characterId} onChange={(e) => setCharacterId(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 p-2 text-sm text-white">
              {(dialog.characterOptions ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        {dialog.fields === "status" && (
          <div className="mt-4 space-y-2">
            {BOOK_STATUSES.map((s) => (
              <label key={s.value} className="flex cursor-pointer gap-2 rounded-lg border border-white/10 p-2 text-sm">
                <input type="radio" name="status" checked={status === s.value} onChange={() => setStatus(s.value)} />
                <span>
                  <b className="text-white">{s.value}</b>
                  <span className="block text-xs text-slate-400">{s.meaning}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        {dialog.fields === "apply" && (
          <div className="mt-4 space-y-2 text-sm">
            <label className="flex gap-2">
              <input type="checkbox" checked={withCards} onChange={(e) => setWithCards(e.target.checked)} />
              <span>Also copy character cards <span className="block text-xs text-slate-400">Changes those characters everywhere in the customer&apos;s account.</span></span>
            </label>
            <label className="flex gap-2">
              <input type="checkbox" checked={withPlans} onChange={(e) => setWithPlans(e.target.checked)} />
              <span>Also copy scene plans <span className="block text-xs text-slate-400">Who is in each scene, outfits, art direction. Skipped if any name doesn&apos;t match.</span></span>
            </label>
          </div>
        )}
        {dialog.need === "type-title" && (
          <label className="mt-4 block text-xs text-slate-400">
            This is a customer&apos;s book. Type its title to confirm: <b className="text-white">{dialog.titleToType}</b>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/15 bg-black/30 p-2 text-sm text-white"
              autoFocus
            />
          </label>
        )}

        {error && !sending && (
          <p className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 p-2 text-sm text-rose-100">
            {error}
            {dialog.action === "test-print-order" && " Check Gelato before trying again, in case the order went through."}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button className={btnQuiet} onClick={onCancel} disabled={sending}>Cancel</button>
          <button className={info.safeguard === "type-title-snapshot" || dialog.action === "stop" ? btnDanger : btnPrimary} disabled={!ready || sending} onClick={() => onConfirm(extra)}>
            {sending ? "Working…" : info.label}
          </button>
        </div>
      </div>
    </div>
  );
}
