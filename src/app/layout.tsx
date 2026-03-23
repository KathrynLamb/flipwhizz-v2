// src/app/layout.tsx

import type { Metadata } from "next";
import { NextAuthProvider } from "@/components/next-auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://flipwhizz.com"),
  title: {
    default: "FlipWhizz | Personalised Storybooks for Kids",
    template: "%s | FlipWhizz",
  },
  description:
    "Create personalised storybooks for kids with FlipWhizz. Turn your child's interests, imagination, and real-life moments into magical bedtime stories, adventures, and keepsake books.",
  applicationName: "FlipWhizz",
  keywords: [
    "personalised storybooks for kids",
    "personalised bedtime stories",
    "custom children's story generator",
    "create a story for my child",
    "kids story creator",
    "bedtime story generator",
    "personalised children's books",
    "custom storybook creator",
    "AI story generator for kids",
    "children's adventure stories",
  ],
  authors: [{ name: "FlipWhizz" }],
  creator: "FlipWhizz",
  publisher: "FlipWhizz",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "https://flipwhizz.com",
    siteName: "FlipWhizz",
    title: "FlipWhizz | Personalised Storybooks for Kids",
    description:
      "Create personalised storybooks for kids. Build magical bedtime stories, adventures, and keepsake books inspired by your child.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FlipWhizz personalised storybooks for kids",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FlipWhizz | Personalised Storybooks for Kids",
    description:
      "Create personalised storybooks for kids with FlipWhizz.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "children's books",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body>
        <NextAuthProvider>{children}</NextAuthProvider>
      </body>
    </html>
  );
}