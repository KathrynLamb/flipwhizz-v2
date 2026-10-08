// src/app/admin/tools/page.tsx
//
// Site-wide actions that aren't about one book, plus links to the outside
// dashboards.
import { requireAdminPage } from "@/lib/pageGuards";
import { adminTablesReady } from "@/lib/admin/data";
import { Card, MigrationBanner, PageHeader } from "../ui";
import ToolsClient from "./ToolsClient";

export const dynamic = "force-dynamic";

const LINKS = [
  { href: "https://app.inngest.com/env/production/runs", label: "Inngest runs", detail: "Every background job, with logs. Cancel from a book's Activity tab." },
  { href: "https://vercel.com/dashboard", label: "Vercel", detail: "Deploys and function logs." },
  { href: "https://console.neon.tech", label: "Neon", detail: "The database (for anything admin can't do yet)." },
  { href: "https://console.cloudinary.com", label: "Cloudinary", detail: "Every image ever drawn." },
  { href: "https://dashboard.gelato.com", label: "Gelato", detail: "Print orders and shipping." },
];

export default async function ToolsPage() {
  await requireAdminPage();
  const ready = await adminTablesReady();
  return (
    <>
      <PageHeader title="Tools" subtitle="Site-wide actions. Anything about one book lives on that book's page." />
      {!ready && <MigrationBanner />}
      <div className="space-y-4">
        <ToolsClient />
        <Card title="Dashboards">
          <ul className="space-y-2 text-sm">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" className="text-[#C4B5FD] hover:text-white">{l.label} ↗</a>
                <span className="text-slate-500"> · {l.detail}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
