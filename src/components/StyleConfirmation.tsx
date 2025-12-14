"use client";

import { useRouter } from "next/navigation";

interface StyleConfirmationProps {
  imageUrl: string;
  onRefine: () => void;
  storyId: string;
}

export function StyleConfirmation({ imageUrl, onRefine, storyId }: StyleConfirmationProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center py-10 animate-in fade-in duration-700">
      
      {/* 1. Header Text */}
      <div className="text-center mb-8 max-w-2xl">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400 mb-4">
          Style Defined Successfully!
        </h2>
        <p className="text-white/60 text-lg">
          We have locked in your visual style. This "Master Scene" will serve as the blueprint for every page in your book to ensure consistency.
        </p>
      </div>

      {/* 2. The Master Image */}
      <div className="relative group mb-10">
        <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
        <img 
          src={imageUrl} 
          alt="Master Style Illustration" 
          className="relative w-full max-w-3xl rounded-xl shadow-2xl border border-white/10"
        />
      </div>

      {/* 3. Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-xl">
        
        {/* Option A: Refine */}
        <button
          onClick={onRefine}
          className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
        >
          <span className="text-sm font-bold text-white mb-1 group-hover:text-purple-300">
            ← Keep Refining
          </span>
          <span className="text-xs text-center text-white/40">
            Go back to edit characters, locations, or generate a new sample.
          </span>
        </button>

        {/* Option B: Purchase / Next */}
        <button
          onClick={() => router.push(`/checkout?storyId=${storyId}`)} // specific route for payment
          className="flex flex-col items-center justify-center p-6 rounded-2xl bg-white text-black hover:bg-purple-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)]"
        >
          <span className="text-sm font-bold mb-1">
            Perfect! Order Book →
          </span>
          <span className="text-xs text-center text-black/60">
            Proceed to payment to generate the full story.
          </span>
        </button>

      </div>
    </div>
  );
}