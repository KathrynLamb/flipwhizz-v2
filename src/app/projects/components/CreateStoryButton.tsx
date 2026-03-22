'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';

export default function CreateStoryButton() {
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
        if (res.status === 401) { router.push('/api/auth/signin'); return; }
        throw new Error('Failed to create project');
      }
      const data = await res.json();
      if (data.id) router.push(`/chat?project=${data.id}`);
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
      className="inline-flex items-center justify-center gap-2 rounded-full font-bold text-white h-10 px-5 text-sm sm:h-11 sm:px-6 sm:text-sm transition-all duration-300 hover:scale-105 hover:shadow-lg active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
      style={{ background: "#D94590", boxShadow: "0 4px 16px rgba(217,69,144,0.25)" }}
    >
      {isLoading ? (
        <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Creating…</span></>
      ) : (
        <><Plus className="h-4 w-4" strokeWidth={2.5} /><span className="sm:hidden">New</span><span className="hidden sm:inline">New Story</span></>
      )}
    </button>
  );
}