import Link from "next/link";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Personalised Colouring Storybooks | FlipWhizz",
  description: "Make your child the hero of a story they can read and colour. Create a personal adventure with outline illustrations to make their own.",
};
export default function ColouringBooksPage() {
  return <main className="min-h-screen bg-purple-50 px-6 py-20 text-slate-900">
    <div className="mx-auto max-w-2xl">
      <Link href="/" className="font-semibold text-purple-700">FlipWhizz</Link>
      <p className="mt-16 text-sm font-semibold uppercase tracking-widest text-purple-700">Their story. Their colours.</p>
      <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">An adventure they can read and colour.</h1>
      <p className="mt-6 text-lg leading-relaxed text-slate-600">Turn your child’s favourite things, family jokes and big ideas into a personal story. We create the words and outline pictures. They bring the colours.</p>
      <p className="mt-4 text-slate-600">A full-colour cover and colouring pages inside. Start with a free story conversation.</p>
      <Link href="/projects/create?bookType=colouring_storybook" className="mt-8 inline-block rounded-2xl bg-[#7960AF] px-6 py-4 font-semibold text-white">Create a colouring storybook</Link>
    </div>
  </main>;
}
