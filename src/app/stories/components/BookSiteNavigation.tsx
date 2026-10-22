'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { BookOpen, ChevronDown, Home } from 'lucide-react';

/** Site navigation must remain available throughout book creation, including
 * full-screen editors. Keep this in the shared story layout, not individual steps.
 * --book-navigation-height reserves space for it in fixed editor headers. */
export default function BookSiteNavigation() {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !menu.current?.contains(event.target)) {
        menu.current?.removeAttribute('open');
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  const linkClass = 'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-700 sm:px-3 sm:text-sm';
  return (
    <nav aria-label="FlipWhizz site navigation" className="fixed inset-x-0 top-0 z-[60] h-12 border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between gap-2 px-3 sm:px-6">
        <Link href="/" aria-label="FlipWhizz home" className="rounded text-base font-bold tracking-tight text-[#54326F] focus-visible:outline-2 focus-visible:outline-purple-700">FlipWhizz</Link>
        <div className="flex items-center gap-1">
          <Link href="/" className={`${linkClass} hidden sm:inline-flex`}><Home size={15} aria-hidden="true" />Home</Link>
          <Link href="/projects" className={linkClass}><BookOpen size={15} aria-hidden="true" />My books</Link>
          <details ref={menu} className="relative" onKeyDown={event => {
            if (event.key === 'Escape') {
              menu.current?.removeAttribute('open');
              menu.current?.querySelector('summary')?.focus();
            }
          }}>
            <summary className={`${linkClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>Site menu<ChevronDown size={14} aria-hidden="true" /></summary>
            <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-2 shadow-lg" onClick={event => {
              if ((event.target as Element).closest('a')) menu.current?.removeAttribute('open');
            }}>
              {[
                ['/', 'Home'], ['/projects', 'My books'], ['/#gallery', 'Example books'],
                ['/#pricing', 'Pricing'], ['/faq', 'Help & FAQs'], ['/contact', 'Contact'],
              ].map(([href, label]) => <Link key={label} href={href} className="block rounded-lg px-3 py-3 text-sm text-slate-700 hover:bg-purple-50 focus-visible:outline-2 focus-visible:outline-purple-700">{label}</Link>)}
            </div>
          </details>
        </div>
      </div>
    </nav>
  );
}
