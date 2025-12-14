"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function AuthButton() {
  const { data: session } = useSession();

  if (!session) {
    return (
      <button
        onClick={() => signIn("google")}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <img src={session.user?.image || ""} className="w-8 h-8 rounded-full" />
      <span>{session.user?.name}</span>
      <button
        onClick={() => signOut()}
        className="px-4 py-2 bg-gray-700 text-white rounded"
      >
        Sign out
      </button>
    </div>
  );
}
