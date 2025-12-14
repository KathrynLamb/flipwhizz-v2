'use client'
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

export type StyleGuide = {
    id: string;
    storyId: string;
  
    summary: string | null;
    referenceImageUrl: string | null;
    sampleIllustrationUrl: string | null;
    userNotes: string | null;
    negativePrompt: string | null;
  
    createdAt: string;
    updatedAt: string;
  };
  


type IllustrationsBoxProps = {
  projectId: string;
  style: StyleGuide
};



function IllustrationsBox({ projectId, style }: IllustrationsBoxProps){

    console.log('style', style)
  return (
    <Link
    href={`/projects/${projectId}/images`}
    className="group rounded-3xl bg-white/5 p-5 ring-1 ring-white/10 hover:ring-white/20 transition sm:p-6"
  >
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
        <span className="text-xl">🎨</span>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Illustrations</h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-semibold text-white/70 ring-1 ring-white/10">
            Soon
          </span>
        </div>
        <p className="mt-1 text-sm text-white/70">
          Generate character-consistent art page by page.
        </p>
        <p className="mt-3 text-[11px] text-white/50">
          Tip: this will feel magical once pages are split.
        </p>
      </div>
    </div>
  </Link>
  )
}

export default IllustrationsBox
