// /src/app/chat/page.tsx

import type { Metadata } from "next";
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Header from "@/components/Header";
import ChatClient from "@/app/chat/ChatClient";

// This route serves two things: the public demo at /chat, and the real
// project workspace at /chat?project=<uuid>. The project variant is a
// signed-in surface with a query param, so it should not be indexed, and
// the canonical points at the bare /chat rather than /projects/create.
export const metadata: Metadata = {
  title: "Shape Your Story | FlipWhizz",
  description:
    "Chat to shape a personalised children's story, then turn it into a real illustrated book.",
  alternates: {
    canonical: "https://flipwhizz.com/chat",
  },
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: "Shape Your Story | FlipWhizz",
    description:
      "Chat to shape a personalised children's story, then turn it into a real illustrated book.",
    url: "https://flipwhizz.com/chat",
    siteName: "FlipWhizz",
    type: "website",
    locale: "en_GB",
  },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { project } = await searchParams;
  const isProjectMode = Boolean(project);

  return (
    <main className="relative flex h-screen flex-col overflow-hidden bg-white text-slate-900">
      {/* Real shared header, stripped for the conversion flow, title in-bar.
          In project mode the demo pitch is wrong: the visitor has already
          signed in and created the book, so the subtitle would be selling
          them something they've bought. */}
      <Header
        session={session}
        minimal
        title={
          isProjectMode
            ? "Your story"
            : "Make a story only your family could tell"
        }
        subtitle={
          isProjectMode
            ? "Keep chatting to shape it."
            : "Personalised, illustrated, and entirely yours."
        }
      />

      {/* Full-height app surface: h-screen on main (not min-h-screen) so this
          flex-1 region has a real, fixed height for ChatClient's h-full to
          resolve against. No card, no footer, the chat is the page. */}
      <div className="relative flex-1 overflow-hidden">
        <Suspense fallback={null}>
          <ChatClient />
        </Suspense>
      </div>
    </main>
  );
}