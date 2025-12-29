'use client';

import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ShoppingCart,
  Sparkles,
  Users,
  MapPin,
  CheckCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

type Story = {
  id: string;
  title: string;
  pdfUrl: string | null;
  frontCoverUrl: string | null;
  backCoverUrl: string | null;
  paymentStatus: string | null;
  status: string;
};

type Page = {
  id: string;
  pageNumber: number;
  imageUrl: string | null;
  text: string;
};

export default function StoryViewer({
  story,
  pages,
  userId,
}: {
  story: Story;
  pages: Page[];
  userId: string;
}) {
  const router = useRouter();

  // Build spreads (2 pages each)
  const spreads = [];
  for (let i = 0; i < pages.length; i += 2) {
    spreads.push({
      left: pages[i],
      right: pages[i + 1] || null,
    });
  }

  const [index, setIndex] = useState(0);
  const total = spreads.length;
  const current = spreads[index];

  const hasImages = Boolean(current.left?.imageUrl);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-violet-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-6">

        {/* HEADER */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-purple-700 font-semibold"
          >
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>

          <div className="flex items-center gap-2 text-sm font-bold text-purple-700 bg-white px-4 py-2 rounded-full shadow">
            <CheckCircle className="w-4 h-4" />
            Draft
          </div>
        </div>

        {/* TITLE */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-purple-900">
            {story.title}
          </h1>
          <p className="text-purple-600 mt-1">
            Spread {index + 1} of {total}
          </p>
        </div>

        {/* ACTION BAR */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <button
            onClick={() => router.push(`/stories/${story.id}/characters`)}
            className="px-4 py-2 rounded-xl bg-white text-purple-700 font-semibold shadow flex items-center gap-2 hover:bg-purple-50"
          >
            <Users className="w-4 h-4" />
            Characters
          </button>

          <button
            onClick={() => router.push(`/stories/${story.id}/locations`)}
            className="px-4 py-2 rounded-xl bg-white text-purple-700 font-semibold shadow flex items-center gap-2 hover:bg-purple-50"
          >
            <MapPin className="w-4 h-4" />
            Locations
          </button>

          {story.pdfUrl && (
            <a
              href={`/api/stories/${story.id}/export-complete/download`}
              target="_blank"
              className="px-4 py-2 rounded-xl bg-white text-purple-700 font-semibold shadow flex items-center gap-2 hover:bg-purple-50"
            >
              <Download className="w-4 h-4" />
              PDF
            </a>
          )}

          {story.frontCoverUrl && story.backCoverUrl && (
            <button
              onClick={() => router.push(`/stories/${story.id}/checkout`)}
              className="px-4 py-2 rounded-xl bg-purple-600 text-white font-bold shadow flex items-center gap-2 hover:bg-purple-700"
            >
              <ShoppingCart className="w-4 h-4" />
              Order Print
            </button>
          )}
        </div>

        {/* SPREAD VIEW */}
        <div className="relative bg-white rounded-3xl shadow-xl p-6 mb-6">

          {/* Nav buttons */}
          <button
            onClick={() => setIndex(Math.max(0, index - 1))}
            disabled={index === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-purple-100 text-purple-700 p-3 rounded-full shadow disabled:opacity-30"
          >
            <ChevronLeft />
          </button>

          <button
            onClick={() => setIndex(Math.min(total - 1, index + 1))}
            disabled={index === total - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-purple-100 text-purple-700 p-3 rounded-full shadow disabled:opacity-30"
          >
            <ChevronRight />
          </button>

          {/* IMAGE OR TEXT */}
          {hasImages ? (
            <div className="relative aspect-[2/1] w-full bg-purple-50 rounded-xl overflow-hidden mb-6">
              <Image
                src={current.left.imageUrl!}
                alt="Story spread"
                fill
                className="object-contain"
              />
            </div>
          ) : (
            <div className="mb-6 bg-purple-50 rounded-xl p-6 text-center">
              <Sparkles className="w-10 h-10 mx-auto text-purple-400 mb-2" />
              <p className="font-semibold text-purple-700">
                Art coming soon! You can still review the text below.
              </p>
            </div>
          )}

          {/* TEXT */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-purple-50 rounded-xl p-4">
              <p className="text-xs font-bold text-purple-500 mb-1">
                Page {current.left.pageNumber}
              </p>
              <p className="text-purple-900 leading-relaxed">
                {current.left.text}
              </p>
            </div>

            {current.right && (
              <div className="bg-purple-50 rounded-xl p-4">
                <p className="text-xs font-bold text-purple-500 mb-1">
                  Page {current.right.pageNumber}
                </p>
                <p className="text-purple-900 leading-relaxed">
                  {current.right.text}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CONFIRM CTA */}
        <div className="text-center mt-10">
          <button
            onClick={() =>
              router.push(`/stories/${story.id}/extract`)
            }
            className="inline-flex items-center gap-3 px-10 py-5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-full text-lg font-extrabold shadow-xl hover:scale-105 transition"
          >
            <Sparkles className="w-6 h-6" />
            Approve Story & Create Art
          </button>
          <p className="text-sm text-purple-500 mt-3">
            This will extract characters & locations and start illustration.
          </p>
        </div>
      </div>
    </div>
  );
}
