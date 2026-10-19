// src/app/fonts.ts
// Shared brand fonts. Bricolage Grotesque for everything on screen, Fraunces
// only for words that are meant to read like they're printed in a book.
import { Bricolage_Grotesque, Fraunces } from "next/font/google";

export const brico = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-brico", display: "swap" });
export const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-book", weight: ["400", "600"], display: "swap" });

/** Put on a page's <main> to switch it to the brand type. */
export const brandFontClass = `${brico.variable} ${fraunces.variable}`;
export const brandFontStyle = { fontFamily: "var(--font-brico), system-ui, sans-serif" } as const;
