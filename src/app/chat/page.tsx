// src/app/chat/page.tsx
import { Suspense } from "react";
import ChatClient from "./ChatClient";

export const dynamic = "force-dynamic"; // optional but helps avoid prerender surprises

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/60">Loading chat…</div>}>
      <ChatClient />
    </Suspense>
  );
}
