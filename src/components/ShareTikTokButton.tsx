"use client";

import { useState } from "react";
import { SiTiktok } from "react-icons/si";

interface Props {
  storyId: string;
  imageUrls: string[];
  storyTitle: string;
}

export function ShareTikTokButton({ storyId, imageUrls, storyTitle }: Props) {
    const [state, setState] = useState
    <"idle" | "connecting" | "posting" | "done" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleShare() {
    setState("posting");
    setErrorMsg("");

    try {
      const res = await fetch(`/api/stories/${storyId}/share-tiktok`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrls }),
      });

      const data = await res.json();

      if (data.error === "tiktok_not_connected") {
        // Redirect to OAuth — will come back with ?tiktok=connected
        setState("connecting");
        sessionStorage.setItem("tiktok_share_pending", storyId);
        window.location.href = "/api/auth/tiktok";
        return;
      }

      if (!res.ok) {
        throw new Error(data.detail?.message ?? "Posting failed");
      }

      setState("done");
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message ?? "Something went wrong");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleShare}
        disabled={state === "posting" || state === "connecting" || state === "done"}
        className="flex items-center gap-2.5 px-5 py-3 rounded-[14px] font-semibold text-sm transition-all disabled:opacity-60"
        style={{
          background: state === "done" ? "#22c55e" : "#2D2235",
          color: "white",
        }}
      >
        <SiTiktok className="w-4 h-4" />
        {state === "idle" && "Share to TikTok"}
        {state === "connecting" && "Connecting TikTok…"}
        {state === "posting" && "Posting…"}
        {state === "done" && "Posted to TikTok ✓"}
        {state === "error" && "Try again"}
      </button>

      {state === "error" && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}

      {state === "done" && (
        <p className="text-xs" style={{ color: "#A897BD" }}>
          Your story is posting to TikTok — it may take a moment to appear.
        </p>
      )}
    </div>
  );
}