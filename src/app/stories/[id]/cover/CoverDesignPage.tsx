"use client";

import CoverDesignChat from "./CoverDesignChat";

type Character = {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  appearance: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type Location = {
  id: string;
  userId: string | null;
  name: string;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type StyleGuide = {
  id: string;
  storyId: string;
  summary: string | null;
  negativePrompt: string | null;
  artStyle: string | null;
  visualThemes: string | null;
  colorPalette: any | null;
  createdAt: Date | null;
  updatedAt: Date | null;
};

type Story = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  tone: string | null;
  length: number | null;
  fullDraft: string | null;

  status: string | null;
  storyConfirmed: boolean;
  paymentStatus: string | null;
  paymentId: string | null;

  // ✅ NEW SINGLE COVER MODEL
  coverSpreadUrl: string | null;

  pdfUrl: string | null;

  createdAt: Date | null;
  updatedAt: Date | null;
};



type CoverDesignPageProps = {
  story: Story;
  characters: Character[];
  locations: Location[];
  styleGuide: StyleGuide | null;
};

export default function CoverDesignPage({
  story,
  characters,
  locations,
  styleGuide,
}: CoverDesignPageProps) {
  console.log("🎨 CoverDesignPage rendering:", {
    storyId: story.id,
    projectId: story.projectId,
    title: story.title,
    hasPrompts: !!story.coverSpreadUrl,

    hasCovers: !!(story.coverSpreadUrl),
  });

  return (
    <CoverDesignChat
      storyId={story.id}
      projectId={story.projectId}
      story={story}
      onComplete={(data) => {
        console.log("✅ Cover design complete:", data);
      }}
    />
  );
}