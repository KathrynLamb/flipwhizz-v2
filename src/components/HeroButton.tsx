// src/components/HeroButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HeroButton({ session }: { session: any }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function createProject() {
    setIsLoading(true);

    // 1. If not logged in, go to sign in
    if (!session) {
      router.push("/api/auth/signin");
      return;
    }

    // 2. If logged in, create project
    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        body: JSON.stringify({ title: "New Project" }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.id) {
        router.push(`/projects/${data.id}`);
      }
    } catch (error) {
      console.error("Failed to create project", error);
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={createProject}
      disabled={isLoading}
      className="inline-flex items-center justify-center px-10 py-5 text-lg font-serif font-bold text-[#261C15] bg-[#FDF8F0] rounded-full shadow-[0_0_40px_-10px_rgba(253,248,240,0.6)] hover:scale-105 hover:shadow-[0_0_60px_-10px_rgba(253,248,240,0.8)] transition-all duration-300 transform disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {isLoading ? "Creating..." : "Create Your First Story"}
    </button>
  );
}