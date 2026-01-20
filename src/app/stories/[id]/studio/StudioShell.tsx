"use client";

import { useEffect, useState } from "react";
import MobileReader from "./MobileReader";
import DesktopStudio from "./DesktopStudio";

type Page = {
  id: string;
  pageNumber: number;
  text: string;
  imageUrl: string | null;
};

export default function StudioShell({
  story,
  pages,
  styleGuide,
  mode,
}: {
  story: any;
  pages: Page[];
  styleGuide: any;
  mode: "live" | "edit";
}) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  if (isMobile) {
    return (
      <MobileReader
        story={story}
        pages={pages}
      />
    );
  }

  return (
    <DesktopStudio
      story={story}
      pages={pages}
      styleGuide={styleGuide}
      mode={mode}
    />
  );
}
