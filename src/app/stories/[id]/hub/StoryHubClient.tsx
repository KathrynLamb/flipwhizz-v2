'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  CheckCircle, 
  Sparkles, 
  Users, 
  MapPin, 
  Film,
  Palette,
  Lock,
  Zap
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type StoryHubClientProps = {
  story: {
    id: string;
    title: string;
    updatedAt: Date;
  };

  hub: {
    progressPercent: number;
    steps: {
      write: { complete: boolean; pageCount: number };
      extract: {
        characters: number;
        locations: number;
        scenes: number;
      };
      design: {
        charactersConfirmed: number;
        charactersTotal: number;
      };
    };
  };

  mode: "live" | "edit";
};

/* ------------------------------------------------------------------ */
/* COMPONENT                                                           */
/* ------------------------------------------------------------------ */

export default function StoryHubClient({ story, hub }: StoryHubClientProps) {
  const router = useRouter();

  const writeComplete = hub.steps.write.complete;
  const extractComplete = hub.steps.extract.characters > 0;
  const designProgress = hub.steps.design.charactersTotal > 0 
    ? (hub.steps.design.charactersConfirmed / hub.steps.design.charactersTotal) * 100 
    : 0;
  const designComplete = designProgress === 100;

  return (
    <div className="min-h-screen bg-white">
      
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/projects")}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Library</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-sm font-bold text-purple-900">
                {hub.progressPercent}% Complete
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          
          {/* Hero Section */}
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 mb-6">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                />
              ))}
            </div>
            
            <h1 className="text-7xl font-black mb-4 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              {story.title}
            </h1>
            
            <p className="text-xl text-gray-600 font-medium">
              Your story is coming to life! ✨
            </p>
          </div>

          {/* Progress Steps */}
          <div className="space-y-6">
            
            {/* Step 1: Write */}
            <div className={`
              relative border-4 rounded-3xl p-8 transition-all
              ${writeComplete 
                ? 'border-emerald-500 bg-emerald-50' 
                : 'border-gray-200 bg-white'
              }
            `}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl
                    ${writeComplete 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                    }
                  `}>
                    {writeComplete ? <CheckCircle className="w-8 h-8" /> : '1'}
                  </div>
                  
                  <div>
                    <h2 className="text-3xl font-black text-black mb-1">
                      Write Your Story
                    </h2>
                    <p className="text-gray-600 font-medium">
                      The foundation of your book
                    </p>
                  </div>
                </div>

                {writeComplete && (
                  <div className="text-emerald-600 font-black text-lg">
                    ✓ Complete
                  </div>
                )}
              </div>

              <div className="ml-[72px]">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-gray-200">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="font-bold text-black">
                    {hub.steps.write.pageCount} pages written
                  </span>
                </div>
              </div>
            </div>

            {/* Step 2: Extract */}
            <div className={`
              relative border-4 rounded-3xl p-8 transition-all
              ${extractComplete 
                ? 'border-emerald-500 bg-emerald-50' 
                : 'border-gray-200 bg-white'
              }
            `}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl
                    ${extractComplete 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-gray-200 text-gray-500'
                    }
                  `}>
                    {extractComplete ? <CheckCircle className="w-8 h-8" /> : '2'}
                  </div>
                  
                  <div>
                    <h2 className="text-3xl font-black text-black mb-1">
                      Review What We Found
                    </h2>
                    <p className="text-gray-600 font-medium">
                      Meet your cast and world
                    </p>
                  </div>
                </div>

                {extractComplete && (
                  <div className="text-emerald-600 font-black text-lg">
                    ✓ Complete
                  </div>
                )}
              </div>

              <div className="ml-[72px] grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  icon={<Users className="w-6 h-6" />}
                  value={hub.steps.extract.characters}
                  label="Characters"
                  color="from-pink-400 to-rose-500"
                  onClick={() => router.push(`/stories/${story.id}/characters`)}
                />
                <StatCard
                  icon={<MapPin className="w-6 h-6" />}
                  value={hub.steps.extract.locations}
                  label="Locations"
                  color="from-blue-400 to-indigo-500"
                  onClick={() => router.push(`/stories/${story.id}/locations`)}
                />
                {/* <StatCard
                  icon={<Film className="w-6 h-6" />}
                  value={hub.steps.extract.scenes}
                  label="Scenes"
                  color="from-purple-400 to-pink-500"
                  onClick={() => router.push(`/stories/${story.id}/scenes`)}
                /> */}
              </div>
            </div>

            {/* Step 3: Design */}
            <div className={`
              relative border-4 rounded-3xl p-8 transition-all
              ${designComplete 
                ? 'border-emerald-500 bg-emerald-50' 
                : 'border-purple-500 bg-purple-50'
              }
            `}>
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl
                    ${designComplete 
                      ? 'bg-emerald-500 text-white' 
                      : 'bg-gradient-to-br from-purple-400 to-pink-500 text-white'
                    }
                  `}>
                    {designComplete ? <CheckCircle className="w-8 h-8" /> : <Palette className="w-8 h-8" />}
                  </div>
                  
                  <div>
                    <h2 className="text-3xl font-black text-black mb-1">
                      Design Your Book
                    </h2>
                    <p className="text-gray-600 font-medium">
                      Lock in the visual style
                    </p>
                  </div>
                </div>

                {!designComplete && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border-2 border-purple-300">
                    <Zap className="w-4 h-4 text-purple-500" />
                    <span className="font-bold text-purple-900">In Progress</span>
                  </div>
                )}
              </div>

              <div className="ml-[72px] space-y-4">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-sm font-bold mb-2">
                    <span className="text-gray-700">Characters confirmed</span>
                    <span className="text-black">
                      {hub.steps.design.charactersConfirmed} of {hub.steps.design.charactersTotal}
                    </span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                      style={{ width: `${designProgress}%` }}
                    />
                  </div>
                </div>

                {!designComplete && (
                  <button
                    onClick={() => router.push(`/stories/${story.id}/characters`)}
                    className="
                      bg-black text-white
                      text-lg font-black
                      px-8 py-4 rounded-2xl
                      hover:scale-105 transition-transform
                      active:scale-95
                      shadow-xl
                      flex items-center gap-2
                    "
                  >
                    Continue Designing
                    <Sparkles className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Step 4: Locked */}
            <div className="relative border-4 border-gray-200 bg-gray-50 rounded-3xl p-8 opacity-60">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gray-300 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-gray-500" />
                  </div>
                  
                  <div>
                    <h2 className="text-3xl font-black text-gray-700 mb-1">
                      Art Studio
                    </h2>
                    <p className="text-gray-500 font-medium">
                      Generate beautiful illustrations
                    </p>
                  </div>
                </div>
              </div>

              <div className="ml-[72px] mt-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-100 rounded-full border-2 border-yellow-300">
                  <Lock className="w-4 h-4 text-yellow-700" />
                  <span className="font-bold text-yellow-900">
                    Finish character design first
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* COMPONENTS                                                          */
/* ------------------------------------------------------------------ */

function StatCard({ icon, value, label, color, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="
        group
        bg-white border-4 border-black rounded-2xl p-6
        hover:scale-105 transition-transform
        hover:shadow-xl
        text-left
      "
    >
      <div className={`
        w-12 h-12 rounded-xl bg-gradient-to-br ${color}
        flex items-center justify-center text-white mb-4
      `}>
        {icon}
      </div>
      
      <div className="text-4xl font-black text-black mb-1">
        {value}
      </div>
      
      <div className="text-sm font-bold text-gray-600">
        {label}
      </div>

      <div className="mt-3 text-xs font-bold text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity">
        View all →
      </div>
    </button>
  );
}