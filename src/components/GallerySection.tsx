// src/components/GallerySection.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import HeroButton from "@/components/HeroButton";
import StoryPeekModal from "@/components/StoryPeekModal";
import CreateStoryButton from "@/app/projects/components/CreateStoryButton";

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
      <section
        id="gallery"
        className="relative py-24 lg:py-32 px-6 lg:px-12 overflow-hidden"
        style={{ background: "#FEFCFA" }}
      >
        {/* ── Decorative background texture ── */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              #2D2235 10px,
              #2D2235 11px
            )`,
          }}
        />

        {/* ── Floating accent blobs ── */}
        <div
          className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.07] pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, #D94590, #7C3AED)" }}
        />
        <div
          className="absolute -bottom-60 -left-40 w-[600px] h-[600px] rounded-full opacity-[0.05] pointer-events-none blur-3xl"
          style={{ background: "radial-gradient(circle, #7C3AED, #5EEAD4)" }}
        />

        <div className="relative mx-auto max-w-6xl">
          {/* ── Section header ── */}
          <div className="text-center max-w-3xl mx-auto mb-6">
            <p
              className="text-sm font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: "#D94590" }}
            >
              ✦ Made by real parents ✦
            </p>
            <h2
              className="font-serif text-4xl lg:text-5xl font-bold leading-tight"
              style={{ color: "#2D2235" }}
            >
              Every Book, One of a Kind
            </h2>
            <p
              className="mt-5 text-lg leading-relaxed max-w-2xl mx-auto"
              style={{ color: "#6B5D52" }}
            >
              No templates. No clip-art. Each story is written and illustrated
              from scratch — because your child isn&apos;t generic, and their
              book shouldn&apos;t be either.
            </p>
          </div>

          {storiesWithCovers.length === 0 ? (
            <div
              className="mx-auto max-w-xl text-center border rounded-[22px] p-10 mt-16"
              style={{
                background: "white",
                borderColor: "#E8DDCF",
                boxShadow: "0 4px 24px rgba(45,34,53,0.06)",
              }}
            >
              <p
                className="font-serif text-2xl font-bold"
                style={{ color: "#2D2235" }}
              >
                First stories arriving soon
              </p>
              <p className="mt-3 text-sm" style={{ color: "#6B5D52" }}>
                We&apos;re putting the finishing touches on something special.
              </p>
            </div>
          ) : (
            <>
              {/* ── Hero story ── */}
              {heroStory && (
                <div className="mt-16 mb-14">
                  <div
                    className="group relative rounded-[22px] overflow-hidden cursor-pointer flex flex-col lg:flex-row transition-all duration-500"
                    style={{
                      background: "#2D2235",
                      boxShadow:
                        "0 25px 60px rgba(45,34,53,0.25), 0 0 0 1px rgba(217,69,144,0.1)",
                    }}
                    onClick={() => openPeek(heroStory)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow =
                        "0 30px 70px rgba(217,69,144,0.2), 0 0 0 1px rgba(217,69,144,0.25)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow =
                        "0 25px 60px rgba(45,34,53,0.25), 0 0 0 1px rgba(217,69,144,0.1)";
                    }}
                  >
                    {/* ── Cover image ── */}
                    <div className="relative w-full lg:w-[45%] aspect-square lg:aspect-auto lg:min-h-[420px] flex-shrink-0 overflow-hidden">
                      <Image
                        src={
                          coverByStoryId.get(heroStory.id) ||
                          heroStory.coverSpreadUrl!
                        }
                        alt={heroStory.title}
                        fill
                        className="object-cover object-[100%_center] transition-transform duration-700 group-hover:scale-105"
                      />
                      {/* Book spine edge */}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-[3px] lg:block hidden"
                        style={{
                          background:
                            "linear-gradient(to right, rgba(0,0,0,0.2), transparent)",
                        }}
                      />
                    </div>

                    {/* ── Text side ── */}
                    <div className="relative flex flex-col justify-center p-8 lg:p-12">
                      {/* Subtle pattern on text side */}
                      <div
                        className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{
                          backgroundImage:
                            "radial-gradient(circle at 2px 2px, #D94590 1px, transparent 0)",
                          backgroundSize: "24px 24px",
                        }}
                      />
                      <div className="relative">
                        <span
                          className="inline-block text-xs font-semibold tracking-[0.15em] uppercase mb-3 px-3 py-1 rounded-full"
                          style={{
                            color: "#D94590",
                            background: "rgba(217,69,144,0.12)",
                          }}
                        >
                          Featured story
                        </span>
                        <h3 className="font-serif text-3xl lg:text-4xl text-white font-bold leading-tight">
                          {heroStory.title}
                        </h3>
                        {heroStory.description && (
                          <p className="mt-3 text-white/55 text-base leading-relaxed line-clamp-3 max-w-lg">
                            {heroStory.description}
                          </p>
                        )}
                        <span
                          className="inline-flex items-center gap-2.5 mt-7 font-semibold px-6 py-3 rounded-full transition-all duration-300 text-sm w-fit group-hover:scale-[1.03]"
                          style={{
                            background: "#D94590",
                            color: "white",
                            boxShadow: "0 4px 20px rgba(217,69,144,0.3)",
                          }}
                        >
                          <svg
                            className="w-4 h-4"
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
                          Peek inside
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Grid stories ── */}
              {gridStories.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-7">
                  {gridStories.map((story, i) => {
                    const img =
                      coverByStoryId.get(story.id) || story.coverSpreadUrl!;

                    return (
                      <button
                        key={story.id}
                        onClick={() => openPeek(story)}
                        className="group block w-full text-left"
                        style={{
                          animationDelay: `${i * 80}ms`,
                        }}
                      >
                        <div
                          className="relative aspect-[3/4] rounded-[18px] overflow-hidden transition-all duration-500 group-hover:-translate-y-2"
                          style={{
                            boxShadow:
                              "0 8px 30px rgba(45,34,53,0.12), 0 0 0 1px rgba(45,34,53,0.04)",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow =
                              "0 20px 50px rgba(217,69,144,0.15), 0 0 0 1px rgba(217,69,144,0.15)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow =
                              "0 8px 30px rgba(45,34,53,0.12), 0 0 0 1px rgba(45,34,53,0.04)";
                          }}
                        >
                          {/* Book spine */}
                          <div
                            className="absolute left-0 top-0 bottom-0 w-[5px] z-10"
                            style={{
                              background:
                                "linear-gradient(to right, rgba(0,0,0,0.15), rgba(0,0,0,0.05), transparent)",
                            }}
                          />

                          <Image
                            src={img}
                            alt={story.title}
                            fill
                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                          />

                          {/* Gradient overlay */}
                          <div
                            className="absolute inset-0"
                            style={{
                              background:
                                "linear-gradient(to top, rgba(45,34,53,0.85) 0%, rgba(45,34,53,0.3) 40%, transparent 65%)",
                            }}
                          />

                          {/* Peek badge on hover */}
                          <div
                            className="absolute top-3 right-3 text-white text-xs font-semibold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center gap-1.5 group-hover:translate-y-0 translate-y-1"
                            style={{
                              background: "rgba(217,69,144,0.85)",
                              backdropFilter: "blur(8px)",
                            }}
                          >
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
                            <h4
                              className="text-white font-serif font-bold text-base lg:text-lg leading-tight line-clamp-2"
                              style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}
                            >
                              {story.title}
                            </h4>
                            {story.description && (
                              <p className="text-white/50 text-xs mt-1.5 line-clamp-2 leading-relaxed">
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
                <div
                  className="relative inline-flex flex-col items-center gap-4 rounded-[22px] px-10 py-10 lg:px-16 overflow-hidden"
                  style={{
                    background: "white",
                    border: "1px solid #E8DDCF",
                    boxShadow: "0 8px 40px rgba(45,34,53,0.06)",
                  }}
                >
                  {/* Decorative corner flourishes */}
                  <div
                    className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 rounded-tl-lg opacity-20 pointer-events-none"
                    style={{ borderColor: "#D94590" }}
                  />
                  <div
                    className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 rounded-br-lg opacity-20 pointer-events-none"
                    style={{ borderColor: "#D94590" }}
                  />

                  <p
                    className="font-serif text-2xl lg:text-3xl font-bold"
                    style={{ color: "#2D2235" }}
                  >
                    Their story is waiting to be told
                  </p>
                  <p
                    className="text-sm max-w-md"
                    style={{ color: "#6B5D52" }}
                  >
                    Every child deserves a book that&apos;s truly theirs. Start
                    with a free illustrated spread — it takes about 5 minutes.
                  </p>
                  <div className="mt-2">
                    <CreateStoryButton />
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