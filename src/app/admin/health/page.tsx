// src/app/admin/health/page.tsx
//
// Health checks now live on Today (/admin). Old links land there.
import { redirect } from "next/navigation";

export default function AdminHealthPage() {
  redirect("/admin");
}
