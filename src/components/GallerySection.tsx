// src/components/GallerySection.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import HeroButton from "@/components/HeroButton";
import StoryPeekModal from "@/components/StoryPeekModal";

interface GalleryStory {
  id: string;
  title: string;
  description: string | null;
  coverSpreadUrl: string | null;
  updatedAt: Date | null;
}

interface GallerySectionProps {
  stories: GalleryStory[];
  coverByStoryId: Map<string, string | null>;
  session: any;
  hasProjects: boolean;
}

export default function GallerySection({
  stories,
  coverByStoryId,
  session,
  hasProjects,
}: GallerySectionProps) {
  const [peekStory, setPeekStory] = useState<{
    id: string;
    title: string;
    coverImage: string;
  } | null>(null);

  // Only show stories that have a cover image
  const storiesWithCovers = stories.filter((s) => {
    const img = coverByStoryId.get(s.id) || s.coverSpreadUrl;
    return !!img;
  });

  const heroStory = storiesWithCovers[0] || null;
  const gridStories = storiesWithCovers.slice(1);

  const openPeek = (story: GalleryStory) => {
    const img = coverByStoryId.get(story.id) || story.coverSpreadUrl;
    if (!img) return;
    setPeekStory({ id: story.id, title: story.title, coverImage: img });
  };

  return (
    <>
      <section id="gallery" className="py-24 md:py-32 px-6 md:px-12 bg-white">
        <div className="mx-auto max-w-6xl">
          {/* ── Section header ── */}
          <div className="text-center max-w-3xl mx-auto mb-6">
            <p className="text-sm font-semibold tracking-widest uppercase text-purple-500 mb-3">
              Made by real parents
            </p>
            <h2 className="font-serif text-4xl md:text-5xl text-[#261C15] font-bold leading-tight">
              Every Book, One of a Kind
            </h2>
            <p className="mt-5 text-lg text-[#6B5D52] leading-relaxed max-w-2xl mx-auto">
              No templates. No clip-art. Each story is written and illustrated
              from scratch — because your child isn&apos;t generic, and their
              book shouldn&apos;t be either.
            </p>
          </div>

          {storiesWithCovers.length === 0 ? (
            <div className="mx-auto max-w-xl text-center bg-[#FDF8F0]/60 border border-[#E8DDCF] rounded-2xl p-10 mt-16">
              <p className="font-serif text-2xl text-[#261C15] font-bold">
                First stories arriving soon
              </p>
              <p className="mt-3 text-sm text-[#6B5D52]">
                We&apos;re putting the finishing touches on something special.
              </p>
            </div>
          ) : (
            <>
              {/* ── Hero story ── */}
   {/* ── Hero story ── */}
{heroStory && (
  <div className="mt-16 mb-12">
    <div
      className="group relative rounded-2xl overflow-hidden shadow-2xl hover:shadow-[0_25px_60px_rgba(100,41,82,0.2)] transition-all duration-500 cursor-pointer bg-[#1a1a1a] flex flex-col md:flex-row"
      onClick={() => openPeek(heroStory)}
    >
      {/* Cover image */}
      <div className="relative w-full md:w-[45%] aspect-square md:aspect-auto md:min-h-[400px] flex-shrink-0">
        <Image
          src={coverByStoryId.get(heroStory.id) || heroStory.coverSpreadUrl!}
          alt={heroStory.title}
          fill
          className="object-cover object-[100%_center] transition-transform duration-700 group-hover:scale-105"        />
      </div>

      {/* Text side */}
      <div className="flex flex-col justify-center p-8 md:p-12">
        <span className="inline-block text-xs font-semibold tracking-widest uppercase text-purple-400 mb-3">
          Featured story
        </span>
        <h3 className="font-serif text-3xl md:text-4xl text-white font-bold leading-tight">
          {heroStory.title}
        </h3>
        {heroStory.description && (
          <p className="mt-3 text-white/60 text-base leading-relaxed line-clamp-3 max-w-lg">
            {heroStory.description}
          </p>
        )}
        <span className="inline-flex items-center gap-2.5 mt-6 bg-white/15 group-hover:bg-white/25 backdrop-blur-sm text-white font-semibold px-6 py-3 rounded-full transition-all duration-200 border border-white/20 group-hover:border-white/40 text-sm w-fit">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Peek inside
        </span>
      </div>
    </div>
  </div>
)}

              {/* ── Grid stories ── */}
              {gridStories.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 md:gap-6">
                  {gridStories.map((story) => {
                    const img =
                      coverByStoryId.get(story.id) || story.coverSpreadUrl!;

                    return (
                      <button
                        key={story.id}
                        onClick={() => openPeek(story)}
                        className="group block w-full text-left"
                      >
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-400 group-hover:-translate-y-1">
                          {/* Book spine */}
                          <div className="absolute left-0 top-0 bottom-0 w-[6px] bg-gradient-to-r from-black/20 to-transparent z-10" />

                          <Image
                            src={img}
                            alt={story.title}
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />

                          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

                          {/* Peek badge on hover */}
                          <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white/90 text-xs font-medium px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5">
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                              />
                            </svg>
                            Peek
                          </div>

                          <div className="absolute bottom-0 p-4 w-full">
                            <h4 className="text-white font-serif font-bold text-base md:text-lg leading-tight line-clamp-2">
                              {story.title}
                            </h4>
                            {story.description && (
                              <p className="text-white/60 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                                {story.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── Bottom CTA ── */}
              <div className="mt-20 text-center">
                <div className="inline-flex flex-col items-center gap-4 bg-[#FDF8F0] border border-[#E8DDCF] rounded-2xl px-10 py-10 md:px-16">
                  <p className="font-serif text-2xl md:text-3xl text-[#261C15] font-bold">
                    Their story is waiting to be told
                  </p>
                  <p className="text-sm text-[#6B5D52] max-w-md">
                    Every child deserves a book that&apos;s truly theirs. Start
                    with a free illustrated spread — it takes about 5 minutes.
                  </p>
                  <div className="mt-2">
                    <HeroButton
                      session={session}
                      hasProjects={hasProjects}
                      variant="primary"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── Peek modal ── */}
      {peekStory && (
        <StoryPeekModal
          storyId={peekStory.id}
          storyTitle={peekStory.title}
          coverImage={peekStory.coverImage}
          onClose={() => setPeekStory(null)}
        />
      )}
    </>
  );
}