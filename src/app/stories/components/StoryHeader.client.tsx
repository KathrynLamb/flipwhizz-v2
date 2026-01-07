// src/app/stories/components/StoryHeader.client.tsx
"use client";

import dynamic from "next/dynamic";

const StoryHeader = dynamic(() => import("./StoryHeader"), {
  ssr: false,
});

export default StoryHeader;
