"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateProjectPage() {
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);

    const res = await fetch("/api/projects/create", {
      method: "POST",
      body: JSON.stringify({ title }),
      headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    setLoading(false);

    if (data.id) {
      router.push(`/projects/${data.id}`);
    }
  }

  return (
    <main className="p-10 max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Create a New Project</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full border rounded p-2"
          placeholder="Project title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Project"}
        </button>
      </form>
    </main>
  );
}
