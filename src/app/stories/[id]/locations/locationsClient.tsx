'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ArrowLeft, Sparkles, Heart, Zap } from "lucide-react";
import { LocationCard } from "@/app/stories/[id]/locations/components/LocationCard";


/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

type UILocation = {
  id: string;
  name: string;
  description: string | null;
  referenceImageUrl: string | null;
  portraitImageUrl: string | null;
  locked: boolean;
};


/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function LocationsClient({
  storyId,
  storyConfirmed,
  locations,
}: {
  storyId: string;
  storyConfirmed: boolean;
  locations: UILocation[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // IMPORTANT: render a stable placeholder
    return (
      <div className="min-h-screen bg-white" />
    );
  }


  return (
    <div className="min-h-screen bg-white">
      
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push(`/stories/${storyId}/hub`)}
            className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          
          {storyConfirmed && (
            <div className="flex items-center gap-2 text-emerald-600 font-bold">
              <CheckCircle className="w-5 h-5" />
              <span>Story Locked!</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          
          {/* Header */}
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 mb-6">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
            
            <h1 className="text-7xl font-black mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
              Your Story Locations
            </h1>
            
            <p className="text-xl text-gray-600 max-w-xl mx-auto font-medium">
              {locations.length} characters ready to star in your story ✨
            </p>
          </div>

          {/* Character Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {locations.map((location, idx) => (
              <LocationCard
                key={location.id}
                storyId={storyId}
                location={location}
                locked={location.locked}
                index={idx}
              />
            ))}
          </div>

          {/* Confirmation Section */}
          {!storyConfirmed ? (
            <div className="relative">
              <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-3xl p-1">
                <div className="bg-white rounded-3xl p-10 text-center">
                  <div className="flex justify-center gap-3 mb-6">
                    <Sparkles className="w-10 h-10 text-pink-500" />
                    <Heart className="w-10 h-10 text-purple-500" />
                    <Zap className="w-10 h-10 text-blue-500" />
                  </div>
                  
                  <h2 className="text-4xl font-black mb-4 text-black">
                    Ready to lock in your cast?
                  </h2>
                  
                  <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto font-medium">
                    Once you confirm, these characters will stay consistent in every illustration. Your story text can still be edited anytime!
                  </p>
                  
                  <button
                    disabled={confirming}
                    onClick={async () => {
                      setConfirming(true);
                      await fetch(
                        `/api/stories/${storyId}/confirm-characters`,
                        { method: "POST" }
                      );
                      router.refresh();
                    }}
                    className="
                      bg-black text-white
                      text-xl font-black
                      px-12 py-5 rounded-2xl
                      hover:scale-110 transition-transform
                      active:scale-95
                      shadow-xl hover:shadow-2xl
                      disabled:opacity-60 disabled:hover:scale-100
                    "
                  >
                    {confirming ? 'Locking...' : 'Lock Characters! 🔒'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-emerald-400 to-green-500 rounded-3xl p-10 text-center">
              <div className="text-7xl mb-6 animate-bounce">🎉</div>
              
              <h2 className="text-5xl font-black mb-4 text-white">
                Characters Locked!
              </h2>
              
              <p className="text-xl text-white/90 mb-8 font-bold">
                Your illustrations will be perfectly consistent now!
              </p>
              
              <button
                onClick={() => router.push(`/stories/${storyId}/hub`)}
                className="
                  bg-white text-black
                  text-xl font-black
                  px-12 py-5 rounded-2xl
                  hover:scale-110 transition-transform
                  active:scale-95
                  shadow-xl
                "
              >
                Continue to Story Hub →
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}