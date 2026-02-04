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
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Project' }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/api/auth/signin');
          return;
        }
        throw new Error('Failed to create project');
      }

      const data = await res.json();
      if (data.id) {
        router.push(`/chat?project=${data.id}`);
      }
    } catch (error) {
      console.error('Failed to create project', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={createProject}
      disabled={isLoading}
      aria-label="Create new story project"
      className="
        inline-flex items-center justify-center gap-2
        rounded-full font-black text-white
        bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500

        /* Mobile first */
        h-9 px-4 text-sm
        shadow-[0_8px_24px_-10px_rgba(168,85,247,0.6)]

        /* Desktop enhancement */
        sm:h-10 sm:px-5 sm:text-base
        sm:hover:scale-[1.04]
        sm:hover:shadow-[0_14px_36px_-12px_rgba(168,85,247,0.75)]

        transition
        disabled:opacity-60
        disabled:cursor-not-allowed
        disabled:scale-100
      "
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">Creating…</span>
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" />

          {/* Mobile */}
          <span className="sm:hidden">New</span>

          {/* Desktop */}
          <span className="hidden sm:inline">New Project</span>
        </>
      )}
    </button>
  );
}

export default CreateStoryButton;
