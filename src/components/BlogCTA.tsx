"use client";

import { useSession } from "next-auth/react";
import HeroButton from "@/components/HeroButton";

export default function BlogCTA() {
  const { data: session } = useSession();

  return (
    <div className="mt-16 rounded-[22px] bg-gradient-to-br from-purple-600 to-pink-500 p-8 text-center text-white shadow-lg">
      <h3
        className="text-2xl font-bold"
        style={{ fontFamily: "Bricolage Grotesque, sans-serif" }}
      >
        Ready to create their story?
      </h3>
      <p className="mt-2 text-purple-100">
        Put your child at the heart of a book made just for them.
      </p>
      <div className="mt-6">
        <HeroButton
          session={session}
          hasProjects={false}
          intent="digital"
          variant="primary"
        />
      </div>
    </div>
  );
}