import { NextAuthProvider } from "@/components/next-auth-provider";
import "./globals.css";
// import { NextAuthProvider } from "@/components/next-auth-provider";

export const metadata = {
  title: "FlipWhizz v2",
  description: "AI-powered story builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NextAuthProvider>{children}</NextAuthProvider>
      </body>
    </html>
  );
}
