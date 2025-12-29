"use client"

import { useRouter } from 'next/navigation';
import { useState } from 'react'

function CreateStoryButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<boolean>(false)

  async function createProject() {
    setIsLoading(true);

    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        body: JSON.stringify({ title: "New Project" }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        // Handle auth errors - your API should return 401 if not authenticated
        if (res.status === 401) {
          router.push("/api/auth/signin");
          return;
        }
        throw new Error("Failed to create project");
      }

      const data = await res.json();

      if (data.id) {
        router.push(`/chat?project=${data.id}`);
      }
    } catch (error) {
      console.error("Failed to create project", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={createProject}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-full bg-[#F4A261] px-5 py-2.5 text-sm font-bold text-[#0F2236] hover:bg-[#E76F51] transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span className="text-base">{isLoading ? "⏳" : "➕"}</span> 
      {isLoading ? "Creating..." : "New Project"}
    </button>
  )
}

export default CreateStoryButton