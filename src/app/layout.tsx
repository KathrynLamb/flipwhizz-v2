// src/app/layout.tsx

import type { Metadata } from "next";
import { NextAuthProvider } from "@/components/next-auth-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "FlipWhizz",
  description: "AI-powered story builder",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}
