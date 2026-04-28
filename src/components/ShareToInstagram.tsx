"use client";

import { useState } from "react";
import { Instagram, Download, Copy, Check, X, Mail, Sparkles } from "lucide-react";

interface ShareToInstagramProps {
  imageUrl: string;
  childName: string;
  storyTitle?: string;
  userEmail: string; // pass in from session
}

type Step = "share" | "confirm" | "sending" | "done" | "error";

export function ShareToInstagram({ imageUrl, childName, storyTitle, userEmail }: ShareToInstagramProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("share");
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const caption = `✨ Just made ${childName} their very own personalised storybook! They're the star of their own adventure 📖🌈${storyTitle ? ` — "${storyTitle}"` : ""} Made with @flipwhizz — link in bio to create yours! #PersonalisedBooks #KidsBooks #FlipWhizz #GiftIdeas #KidLit`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      if (navigator.canShare) {
        const res = await fetch(imageUrl);
        const blob = await res.blob();
        const file = new File([blob], `${childName.toLowerCase()}-flipwhizz-story.jpg`, { type: "image/jpeg" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: caption });
          setDownloading(false);
          setStep("confirm");
          return;
        }
      }
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${childName.toLowerCase()}-flipwhizz-story.jpg`;
      a.click();
      setStep("confirm");
    } catch {
      window.open(imageUrl, "_blank");
      setStep("confirm");
    }
    setDownloading(false);
  };

  const handleSharedConfirm = async () => {
    setStep("sending");
    try {
      const res = await fetch("/api/share-reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail, childName }),
      });
      if (!res.ok) throw new Error();
      setStep("done");
    } catch {
      setStep("error");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => setStep("share"), 400);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[#D94590] text-white rounded-[22px] px-5 py-3 font-semibold text-sm transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-pink-500/25"
      >
        <Instagram size={18} />
        Share to Instagram
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#2D2235]/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="bg-[#FEFCFA] rounded-t-[28px] w-full max-w-lg p-6 pb-10 animate-in slide-in-from-bottom-4 duration-300">

            <div className="flex justify-end mb-4">
              <button onClick={handleClose} className="text-[#8a7a96] hover:text-[#2D2235]">
                <X size={20} />
              </button>
            </div>

            {/* ── STEP 1: Share ── */}
            {step === "share" && (
              <>
                <h2 className="text-xl font-bold text-[#2D2235] mb-1">
                  Share {childName}'s story 🌟
                </h2>
                <p className="text-sm text-[#8a7a96] mb-5">
                  Share it and get <span className="font-bold text-[#D94590]">40% off</span> your next book 🎉
                </p>

                <div className="relative w-full aspect-square rounded-[16px] overflow-hidden bg-pink-50 mb-5">
                  <img src={imageUrl} alt="Book page" className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 right-2 bg-white text-[#D94590] text-[11px] font-bold rounded-[8px] px-2 py-1 shadow">
                    flipwhizz.com
                  </div>
                </div>

                <div className="relative bg-[#f7f0fb] rounded-[16px] p-4 mb-5">
                  <p className="text-sm text-[#4a3a58] leading-relaxed pr-9">{caption}</p>
                  <button
                    onClick={handleCopy}
                    className={`absolute top-3 right-3 w-8 h-8 rounded-[8px] flex items-center justify-center shadow transition-colors ${copied ? "bg-[#D94590]" : "bg-white"}`}
                  >
                    {copied ? <Check size={14} className="text-white" /> : <Copy size={14} className="text-[#2D2235]" />}
                  </button>
                </div>

                <ol className="flex flex-col gap-3 mb-5">
                  {[
                    "Download your image below",
                    "Copy the caption above",
                    "Post to Instagram",
                    "Come back and confirm — we'll email you 40% off!",
                  ].map((s, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-[#2D2235] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-[#4a3a58]">{s}</span>
                    </li>
                  ))}
                </ol>

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center justify-center gap-2 w-full bg-[#2D2235] text-white rounded-[16px] py-4 font-semibold text-sm hover:opacity-85 disabled:opacity-60 transition-opacity"
                >
                  <Download size={18} />
                  {downloading ? "Saving..." : "Save Image to Camera Roll"}
                </button>

                <button onClick={handleClose} className="w-full text-center mt-3 text-sm text-[#8a7a96] py-2">
                  Maybe later
                </button>
              </>
            )}

            {/* ── STEP 2: Confirm ── */}
            {step === "confirm" && (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">📸</div>
                <h2 className="text-xl font-bold text-[#2D2235] mb-2">Did you share it?</h2>
                <p className="text-sm text-[#8a7a96] mb-8 max-w-xs mx-auto">
                  Once you've posted to Instagram, tap below and we'll email your 40% off code to{" "}
                  <span className="font-semibold text-[#2D2235]">{userEmail}</span>
                </p>
                <button
                  onClick={handleSharedConfirm}
                  className="flex items-center justify-center gap-2 w-full bg-[#D94590] text-white rounded-[16px] py-4 font-semibold text-sm hover:opacity-90 transition-opacity mb-3"
                >
                  <Sparkles size={18} />
                  Yes! Send my 40% off code
                </button>
                <button onClick={() => setStep("share")} className="w-full text-center text-sm text-[#8a7a96] py-2">
                  ← Not yet, go back
                </button>
              </div>
            )}

            {/* ── STEP 3: Sending ── */}
            {step === "sending" && (
              <div className="text-center py-8">
                <div className="text-5xl mb-4 animate-bounce">✉️</div>
                <h2 className="text-xl font-bold text-[#2D2235] mb-2">Sending your reward…</h2>
                <p className="text-sm text-[#8a7a96]">Just a second!</p>
              </div>
            )}

            {/* ── STEP 4: Done ── */}
            {step === "done" && (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold text-[#2D2235] mb-2">You're amazing!</h2>
                <p className="text-sm text-[#8a7a96] mb-2 max-w-xs mx-auto">
                  Your <span className="font-bold text-[#D94590]">40% off code</span> is on its way to
                </p>
                <p className="font-semibold text-[#2D2235] mb-6 text-sm">{userEmail}</p>
                <div className="bg-[#f7f0fb] rounded-[16px] p-4 mb-6 flex items-start gap-3 text-left">
                  <Mail size={18} className="text-[#D94590] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-[#4a3a58]">
                    Check your inbox — the code is valid for <strong>30 days</strong> and works on any FlipWhizz book.
                  </p>
                </div>
                <button
                  onClick={handleClose}
                  className="w-full bg-[#2D2235] text-white rounded-[16px] py-4 font-semibold text-sm hover:opacity-85 transition-opacity"
                >
                  Back to my book
                </button>
              </div>
            )}

            {/* ── STEP 5: Error ── */}
            {step === "error" && (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">😬</div>
                <h2 className="text-xl font-bold text-[#2D2235] mb-2">Something went wrong</h2>
                <p className="text-sm text-[#8a7a96] mb-6">
                  We couldn't send your code right now. Please try again or contact us.
                </p>
                <button
                  onClick={() => setStep("confirm")}
                  className="w-full bg-[#D94590] text-white rounded-[16px] py-4 font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Try again
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}