import { Suspense } from "react";
import CoverDesignClient from "./CoverDesignClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Loading cover designer…</div>}>
      <CoverDesignClient />
    </Suspense>
  );
}
