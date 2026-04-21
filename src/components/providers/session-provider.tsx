"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import posthog from "posthog-js";

function PostHogIdentifier() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      posthog.identify(session.user.id, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      });
    }
    if (status === "unauthenticated") {
      // Reset on sign-out so the next user gets a fresh anonymous ID
      posthog.reset();
    }
  }, [status, session?.user?.id]);

  return null;
}

export function AppSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <PostHogIdentifier />
      {children}
    </SessionProvider>
  );
}