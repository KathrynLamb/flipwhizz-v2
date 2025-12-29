"use client";

import CoverDesignChat, { type Story } from "./CoverDesignClient";

type Props = {
  storyId: string;
  projectId: string;
  story: Story; // ✅ not unknown anymore
};

export default function CoverDesignWrapper({
  storyId,
  projectId,
  story,
}: Props) {
  function handleComplete(data: unknown) {
    console.log("Covers generated:", data);
  }

  return (
    <CoverDesignChat
      onComplete={handleComplete}
      projectId={projectId}
      storyId={storyId}
      story={story}
    />
  );
}
