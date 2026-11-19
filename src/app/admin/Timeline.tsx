// src/app/admin/Timeline.tsx
//
// A list of book events (src/lib/events/bookEvents.ts): what the customer
// did and where they got stuck, with the AI cost at each step. No hooks, so
// it works in the book page (client) and the customer and Today pages (server).
import Link from "next/link";
import type { BookEventRow } from "@/lib/events/bookEvents";
import { eventLabel, eventTone } from "@/lib/events/bookEventsCore";
import { gbp } from "@/lib/admin/costFormat";
import { Empty, Pill, when } from "./ui";

export function Timeline({
  events,
  usdToGbp,
  showBook = false,
  showCustomer = false,
  empty = "Nothing recorded yet. Events are saved from 19 Nov 2026.",
}: {
  events: BookEventRow[];
  usdToGbp: number;
  /** Show which book each event belongs to (customer and Today pages). */
  showBook?: boolean;
  /** Show the customer's email (Today page). */
  showCustomer?: boolean;
  empty?: string;
}) {
  if (events.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ol className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="rounded-lg border border-white/10 p-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={eventTone(e.kind)}>{eventLabel(e.kind)}</Pill>
            <span className="text-xs text-slate-500">{when(e.createdAt)}</span>
            {e.costMicroUsd != null && <span className="text-xs text-slate-500">· {gbp(e.costMicroUsd, usdToGbp)} so far</span>}
            {showCustomer && (
              e.userId
                ? <Link href={`/admin/customers/${e.userId}`} className="text-xs text-[#C4B5FD] hover:text-white">{e.ownerEmail ?? "customer"}</Link>
                : <span className="text-xs text-slate-500">not signed in</span>
            )}
            {showBook && e.storyId && (
              <Link href={`/admin/books/${e.storyId}?tab=activity`} className="truncate text-xs text-[#C4B5FD] hover:text-white">{e.storyTitle ?? "book"}</Link>
            )}
          </div>
          <div className="mt-1 break-words text-slate-200">{e.summary}</div>
        </li>
      ))}
    </ol>
  );
}
