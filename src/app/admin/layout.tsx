// src/app/admin/layout.tsx
//
// One admin shell for every admin page: a sidebar on desktop, a bottom bar
// on a phone. Each page still checks admin itself (requireAdminPage), since
// a layout's redirect doesn't stop its page loading data in parallel.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/authz";
import AdminShell from "./AdminShell";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();
  if (!user?.isAdmin) redirect("/");
  return <AdminShell email={user.email}>{children}</AdminShell>;
}
