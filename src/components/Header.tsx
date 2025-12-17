"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Header({ session }: { session: any }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="relative z-50 w-full px-6 py-6 md:px-12 flex justify-between items-center">
      {/* LOGO */}
      <div className="flex items-center gap-2 text-[#FDF8F0] relative z-50">
        <span className="text-2xl">📖</span>
        <span className="font-serif text-2xl font-bold tracking-wide">FlipWhizz</span>
      </div>

      {/* DESKTOP NAV */}
      <nav className="hidden md:flex items-center gap-8 text-[#FDF8F0]/90 text-sm font-medium tracking-wide">
        <Link href="#how-it-works" className="hover:text-amber-200 transition">How It Works</Link>
        <Link href="#gallery" className="hover:text-red-300 transition">Gallery</Link>
        <Link href="#pricing" className="hover:text-amber-200 transition">Pricing</Link>

        {!session ? (
          <Link href="/api/auth/signin" className="px-6 py-2 rounded-full border border-[#FDF8F0]/30 hover:bg-[#FDF8F0] hover:text-[#0F2236] transition duration-300">
            Sign In
          </Link>
        ) : (
          <Link href="/projects" className="px-6 py-2 rounded-full bg-[#F4A261] text-[#0F2236] font-bold hover:bg-[#E76F51] transition shadow-lg">
            My Library
          </Link>
        )}
      </nav>

      {/* MOBILE MENU BUTTON */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="md:hidden relative z-50 text-[#FDF8F0] p-2"
      >
        {isOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
      </button>

      {/* MOBILE NAV OVERLAY */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 bg-[#0F2236] z-40 flex flex-col items-center justify-center space-y-8 text-[#FDF8F0]"
          >
            <Link onClick={() => setIsOpen(false)} href="#how-it-works" className="text-2xl font-serif hover:text-amber-200">How It Works</Link>
            <Link onClick={() => setIsOpen(false)} href="#gallery" className="text-2xl font-serif hover:text-amber-200">Gallery</Link>
            <Link onClick={() => setIsOpen(false)} href="#pricing" className="text-2xl font-serif hover:text-amber-200">Pricing</Link>
            
            <div className="pt-8">
                {!session ? (
                <Link onClick={() => setIsOpen(false)} href="/api/auth/signin" className="px-8 py-3 rounded-full border border-[#FDF8F0]/30 text-xl">
                    Sign In
                </Link>
                ) : (
                <Link onClick={() => setIsOpen(false)} href="/projects" className="px-8 py-3 rounded-full bg-[#F4A261] text-[#0F2236] font-bold text-xl shadow-lg">
                    My Library
                </Link>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}