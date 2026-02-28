// src/components/HeroButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PurchaseIntent = "digital" | "print" | "gift";

export default function HeroButton({
  session,
  hasProjects,
  intent,
  className,
  variant,
}: {
  session: any;
  hasProjects: boolean;
  intent?: PurchaseIntent;
  className?: string;
  variant?: "primary" | "outline";
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const base =
    "inline-flex items-center justify-center px-10 py-5 text-lg font-serif font-bold rounded-full transition-all duration-300 transform disabled:opacity-70 disabled:cursor-not-allowed";

  const styles =
    variant === "primary"
      ? "bg-[#8B5A83] text-white hover:bg-[#7A4E73] shadow-lg hover:shadow-xl"
      : variant === "outline"
        ? "bg-transparent text-[#8B5A83] border-2 border-[#8B5A83]/30 hover:border-[#8B5A83]/60"
        : "bg-[#8B5A83] text-white shadow-lg hover:bg-[#7A4E73] hover:scale-105 hover:shadow-xl";

  async function createProject() {
    setIsLoading(true);

    if (!session) {
      router.push("/api/auth/signin");
      return;
    }

    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        body: JSON.stringify({
          title: "New Project",
          intent,
        }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.id) {
        router.push(`/chat?project=${data.id}`);
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
      className={`${base} ${styles} ${className}`}
    >
      {isLoading
        ? "Creating..."
        : hasProjects
          ? "Create Another Story"
          : "Create Your First Story"}
    </button>
  );
}