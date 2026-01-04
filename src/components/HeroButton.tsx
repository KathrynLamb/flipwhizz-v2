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
    ? "bg-[#261C15] text-white hover:opacity-90"
    : "bg-[#FDF8F0] text-[#261C15] hover:scale-105";


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
        body: JSON.stringify({ 
          title: "New Project",
          intent, 
        }),
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.id) {
        // ✅ CHANGED: Redirect to chat with the project ID as a query parameter
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