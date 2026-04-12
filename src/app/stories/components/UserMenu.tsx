// src/app/stories/components/UserMenu.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Library, LogOut, ChevronDown, User } from "lucide-react";

export default function UserMenu() {
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const userName = session?.user?.name || "You";
  const userEmail = session?.user?.email || "";
  const userImage = session?.user?.image;
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-xl px-1.5 py-1.5 transition-all hover:bg-[rgba(180,150,210,0.08)] active:scale-[0.97]"
        style={{
          background: open ? "rgba(180,150,210,0.08)" : "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        {userImage ? (
          <img
            src={userImage}
            alt={userName}
            className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
            style={{ border: "2px solid rgba(180,150,210,0.15)" }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #B05CE6, #D45DA0)",
            }}
          >
            <span className="text-[10px] font-extrabold text-white" style={{ lineHeight: 1 }}>
              {initials}
            </span>
          </div>
        )}
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{
            color: "#A897BD",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-56 rounded-[16px] overflow-hidden z-[60]"
            style={{
              background: "white",
              border: "1px solid rgba(180,150,210,0.12)",
              boxShadow:
                "0 4px 16px rgba(100,60,140,0.1), 0 12px 40px rgba(100,60,140,0.08)",
            }}
          >
            {/* User info */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: "rgba(180,150,210,0.08)" }}
            >
              <p
                className="text-[13px] font-bold truncate"
                style={{ color: "#2D2235" }}
              >
                {userName}
              </p>
              {userEmail && (
                <p
                  className="text-[11px] mt-0.5 truncate"
                  style={{ color: "#A897BD" }}
                >
                  {userEmail}
                </p>
              )}
            </div>

            {/* Menu items */}
            <div className="py-1.5">
              <MenuItem
                icon={Library}
                label="My Books"
                onClick={() => {
                  setOpen(false);
                  router.push("/projects");
                }}
              />
              <MenuItem
                icon={LogOut}
                label="Sign out"
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                danger
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Menu Item ── */

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-all hover:bg-[rgba(180,150,210,0.06)] active:bg-[rgba(180,150,210,0.1)]"
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <Icon
        className="w-4 h-4 flex-shrink-0"
        style={{ color: danger ? "#E07070" : "#8B7BA0" }}
      />
      <span
        className="text-[13px] font-semibold"
        style={{ color: danger ? "#D45050" : "#5A4D6B" }}
      >
        {label}
      </span>
    </button>
  );
}