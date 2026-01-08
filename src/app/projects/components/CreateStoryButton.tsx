'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';

function CreateStoryButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function createProject() {
    setIsLoading(true);

    try {
      const res = await fetch("/api/projects/create", {
        method: "POST",
        body: JSON.stringify({ title: "New Project" }),
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
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
      className="
        inline-flex items-center gap-2
        rounded-full
        px-6 py-3
        text-sm font-black
        text-white
        bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500
        shadow-[0_10px_30px_-10px_rgba(168,85,247,0.6)]
        transition
        hover:scale-[1.04]
        hover:shadow-[0_15px_40px_-12px_rgba(168,85,247,0.75)]
        disabled:opacity-60
        disabled:cursor-not-allowed
        disabled:hover:scale-100
      "
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Creating…
        </>
      ) : (
        <>
          <Plus className="w-4 h-4" />
          New Project
        </>
      )}
    </button>
  );
}

export default CreateStoryButton;
