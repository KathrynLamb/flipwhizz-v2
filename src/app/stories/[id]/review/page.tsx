'use client'
import { useState, useRef, useCallback } from "react";

/* ════════════════════════════════════════════════
   REVIEW PAGE — "Your Book's Final Chapter"
   
   A 5-step delightful review flow:
   1. Rate — emoji-based star rating
   2. Tell — guided prompts for rich written content
   3. Show — photo/video upload
   4. Permission — clear consent toggles
   5. Reward — promo code reveal with celebration
   ════════════════════════════════════════════════ */

// ─── Emoji Rating Options ───
const RATINGS = [
  { value: 1, emoji: "😕", label: "Not great", color: "#ef4444" },
  { value: 2, emoji: "🙂", label: "It was okay", color: "#f59e0b" },
  { value: 3, emoji: "😊", label: "Loved it", color: "#22c55e" },
  { value: 4, emoji: "🥰", label: "Amazing!", color: "#8b5cf6" },
  { value: 5, emoji: "🤩", label: "Magical!", color: "#ec4899" },
];

const GUIDED_PROMPTS = [
  {
    id: "bestMoment",
    question: "What was the best moment?",
    placeholder:
      "When they turned the page and saw themselves as the hero…",
    icon: "✨",
  },
  {
    id: "reaction",
    question: "What did they say or do when they saw it?",
    placeholder:
      "Their face lit up and they shouted 'That's ME!'…",
    icon: "💬",
  },
  {
    id: "recommend",
    question: "Who would you recommend this to?",
    placeholder:
      "Any parent who wants to see their child fall in love with reading…",
    icon: "💝",
  },
];

// ─── Types ───
interface MediaFile {
  id: string;
  file: File;
  preview: string;
  type: "photo" | "video";
  // Upload state — populated as soon as file is added
  uploadStatus: "uploading" | "done" | "error";
  uploadedUrl?: string;
  cloudinaryPublicId?: string;
}

// ─── Step indicator ───
function StepDots({
  current,
  total,
}: {
  current: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="transition-all duration-500 rounded-full"
          style={{
            width: i === current ? 28 : 8,
            height: 8,
            background:
              i === current
                ? "linear-gradient(135deg, #10b981, #059669)"
                : i < current
                ? "#10b981"
                : "#e5e7eb",
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated page transition wrapper ───
function StepWrapper({
  children,
  stepKey,
}: {
  children: React.ReactNode;
  stepKey: string;
}) {
  return (
    <div
      key={stepKey}
      className="animate-in fade-in slide-in-from-right-8 duration-500"
    >
      {children}
    </div>
  );
}

// ─── Media Upload Card ───
function MediaUploadCard({
  type,
  icon,
  title,
  description,
  onFiles,
}: {
  type: "photo" | "video";
  icon: string;
  title: string;
  description: string;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = type === "photo" ? "image/*" : "video/*";

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) =>
        type === "photo"
          ? f.type.startsWith("image/")
          : f.type.startsWith("video/")
      );
      if (files.length) onFiles(files);
    },
    [type, onFiles]
  );

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center gap-3 p-8 rounded-2xl
        border-2 border-dashed cursor-pointer transition-all duration-200
        ${
          dragOver
            ? "border-green-400 bg-green-50 scale-[1.02]"
            : "border-gray-200 bg-white hover:border-green-300 hover:bg-green-50/30"
        }
      `}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      <span className="text-4xl">{icon}</span>
      <div className="text-center">
        <p className="text-[15px] font-semibold text-gray-800">{title}</p>
        <p className="text-[13px] text-gray-400 mt-1">{description}</p>
      </div>
    </div>
  );
}

// ─── Media Preview Thumbnail ───
function MediaThumb({
  media,
  onRemove,
}: {
  media: MediaFile;
  onRemove: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const isHeic =
    media.file.name.toLowerCase().endsWith(".heic") ||
    media.file.name.toLowerCase().endsWith(".heif");

  return (
    <div className="relative group rounded-xl overflow-hidden w-24 h-24 shrink-0">
      {media.type === "photo" ? (
        imgError || (isHeic && !media.preview.startsWith("blob:")) ? (
          <div className="w-full h-full bg-gray-100 flex flex-col items-center justify-center gap-1">
            <span className="text-2xl">📷</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase">
              {media.file.name.split(".").pop()}
            </span>
          </div>
        ) : (
          <img
            src={media.preview}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        )
      ) : (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <span className="text-white text-2xl">▶</span>
        </div>
      )}
      {/* Upload status overlay */}
      {media.uploadStatus === "uploading" && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      )}
      {media.uploadStatus === "error" && (
        <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
          <span className="text-white text-sm font-bold">!</span>
        </div>
      )}
      {media.uploadStatus === "done" && (
        <div className="absolute top-1 left-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
      >
        ✕
      </button>
      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-black/50 text-white uppercase">
        {media.type}
      </div>
    </div>
  );
}

// ─── Permission Toggle ───
function PermissionToggle({
  label,
  description,
  checked,
  onChange,
  required,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`
        w-full flex items-start gap-4 p-5 rounded-xl border-[1.5px] text-left
        transition-all duration-200
        ${
          checked
            ? "border-green-400 bg-green-50/50"
            : "border-gray-200 bg-white hover:border-gray-300"
        }
      `}
    >
      <div
        className={`
          mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0
          transition-all duration-200
          ${
            checked
              ? "bg-green-500 border-green-500"
              : "bg-white border-gray-300"
          }
        `}
      >
        {checked && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div>
        <p className="text-[14px] font-semibold text-gray-800">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </p>
        <p className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
    </button>
  );
}

// ─── Confetti burst for reward step ───
function ConfettiBurst() {
  const particles = Array.from({ length: 40 }).map((_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1,
    size: 4 + Math.random() * 6,
    color: ["#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#3b82f6"][
      Math.floor(Math.random() * 5)
    ],
    rotation: Math.random() * 360,
  }));

  return (
    <>
      <style>{`
        @keyframes confettiDrop {
          0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: 0,
              width: p.size,
              height: p.size * 0.6,
              borderRadius: 2,
              background: p.color,
              animation: `confettiDrop ${p.duration}s ease-in ${p.delay}s both`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════

export default function ReviewPage() {
  // In real implementation, these come from props/server
  const storyTitle =
    "The Tooth, The Whole Tooth, and Nothing Bunny the Tooth";
  const childName = "Sophia";
  const storyId = typeof window !== "undefined"
    ? window.location.pathname.split("/stories/")[1]?.split("/")[0] ?? ""
    : "";

  const [step, setStep] = useState(0);
  const [rating, setRating] = useState<number | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [permissions, setPermissions] = useState({
    publishWebsite: false,
    publishSocial: false,
    rightToShare: false,
  });
  const [promoCode, setPromoCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const TOTAL_STEPS = 5;

  // ─── Media handlers — upload immediately on add ───
  const addFiles = async (files: File[], type: "photo" | "video") => {
    for (const f of files) {
      const id = crypto.randomUUID();

      // Create preview URL (handles HEIC via shared utility)
      let previewUrl: string;
      if (type === "photo") {
        try {
          const { createImagePreview } = await import("@/lib/heicPreview");
          previewUrl = await createImagePreview(f);
        } catch {
          previewUrl = URL.createObjectURL(f);
        }
      } else {
        previewUrl = URL.createObjectURL(f);
      }

      // Add to state immediately with "uploading" status
      const newMedia: MediaFile = {
        id,
        file: f,
        preview: previewUrl,
        type,
        uploadStatus: "uploading",
      };
      setMedia((prev) => [...prev, newMedia]);

      // Upload in background
      const formData = new FormData();
      formData.append("file", f);

      fetch(`/api/stories/${storyId}/review/upload`, {
        method: "POST",
        body: formData,
      })
        .then(async (res) => {
          if (!res.ok) throw new Error("Upload failed");
          const data = await res.json();
          setMedia((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    uploadStatus: "done" as const,
                    uploadedUrl: data.url,
                    cloudinaryPublicId: data.publicId,
                  }
                : m
            )
          );
        })
        .catch(() => {
          setMedia((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, uploadStatus: "error" as const } : m
            )
          );
        });
    }
  };

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const item = prev.find((m) => m.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((m) => m.id !== id);
    });
  };

  // ─── Navigation ───
  const canAdvance = () => {
    switch (step) {
      case 0:
        return rating !== null;
      case 1:
        return Object.values(responses).some((v) => v.trim().length > 0);
      case 2:
        return true; // media is optional
      case 3:
        return permissions.rightToShare;
      default:
        return true;
    }
  };

  const handleNext = async () => {
    if (step === 3) {
      // Check all media is uploaded
      const pendingUploads = media.filter((m) => m.uploadStatus === "uploading");
      if (pendingUploads.length > 0) {
        setSubmitError("Photos are still uploading — hang on a sec!");
        return;
      }

      const failedUploads = media.filter((m) => m.uploadStatus === "error");
      if (failedUploads.length > 0) {
        setSubmitError(`${failedUploads.length} file(s) failed to upload. Remove them or try again.`);
        return;
      }

      setIsSubmitting(true);
      setSubmitError(null);

      try {
        // Send JSON with pre-uploaded media URLs (no file transfer on submit)
        const res = await fetch(`/api/stories/${storyId}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rating,
            responses,
            permissions,
            mediaUrls: media
              .filter((m) => m.uploadStatus === "done" && m.uploadedUrl)
              .map((m) => ({
                url: m.uploadedUrl,
                type: m.type,
                cloudinaryPublicId: m.cloudinaryPublicId,
              })),
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409 && data.promoCode) {
            setPromoCode(data.promoCode);
            setStep(4);
            return;
          }
          throw new Error(data.error || "Failed to submit review");
        }

        setPromoCode(data.promoCode);
      } catch (err) {
        setSubmitError(
          err instanceof Error ? err.message : "Something went wrong"
        );
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(false);
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap');
      `}</style>

      <div
        className="min-h-screen relative"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          background:
            "linear-gradient(180deg, #f0fdf4 0%, #fafafa 30%, #fafafa 100%)",
        }}
      >
        {/* ─── Header ─── */}
        <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-6 py-4">
          <div className="max-w-[640px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-[11px] font-bold">
                FW
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900">
                  Your Book&apos;s Final Chapter
                </p>
                <p className="text-[11px] text-gray-400">
                  Tell us about &quot;{storyTitle.length > 35 ? storyTitle.slice(0, 35) + "…" : storyTitle}&quot;
                </p>
              </div>
            </div>
            {step < TOTAL_STEPS - 1 && (
              <button
                onClick={() => window.history.back()}
                className="text-[13px] text-gray-400 hover:text-gray-600 transition"
              >
                Skip
              </button>
            )}
          </div>
        </div>

        {/* ─── Content ─── */}
        <div className="max-w-[640px] mx-auto px-6 pt-10 pb-32">
          <StepDots current={step} total={TOTAL_STEPS} />

          {/* ═══ STEP 1: RATE ═══ */}
          {step === 0 && (
            <StepWrapper stepKey="rate">
              <div className="text-center mb-10">
                <h1
                  className="text-2xl font-bold text-gray-900 mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  How was the magic?
                </h1>
                <p className="text-[15px] text-gray-500">
                  Rate your FlipWhizz experience
                </p>
              </div>

              <div className="flex justify-center gap-3 mb-8">
                {RATINGS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setRating(r.value)}
                    className={`
                      flex flex-col items-center gap-2 p-4 rounded-2xl
                      border-2 transition-all duration-300 min-w-[72px]
                      ${
                        rating === r.value
                          ? "border-current scale-110 shadow-lg -translate-y-1"
                          : "border-transparent hover:border-gray-200 hover:-translate-y-0.5"
                      }
                    `}
                    style={{
                      color: rating === r.value ? r.color : undefined,
                      background:
                        rating === r.value ? `${r.color}10` : "transparent",
                    }}
                  >
                    <span
                      className={`text-4xl transition-transform duration-300 ${
                        rating === r.value ? "scale-125" : ""
                      }`}
                    >
                      {r.emoji}
                    </span>
                    <span
                      className={`text-[11px] font-semibold transition-colors ${
                        rating === r.value ? "" : "text-gray-400"
                      }`}
                    >
                      {r.label}
                    </span>
                  </button>
                ))}
              </div>

              {rating && (
                <div className="text-center animate-in fade-in zoom-in-95 duration-300">
                  <p className="text-[15px] text-gray-600">
                    {rating >= 4
                      ? `So glad ${childName} loved it! Tell us more…`
                      : rating >= 3
                      ? "Great to hear! We'd love your thoughts."
                      : "Thanks for your honesty — your feedback helps us improve."}
                  </p>
                </div>
              )}
            </StepWrapper>
          )}

          {/* ═══ STEP 2: TELL ═══ */}
          {step === 1 && (
            <StepWrapper stepKey="tell">
              <div className="text-center mb-10">
                <h1
                  className="text-2xl font-bold text-gray-900 mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Tell us the story
                </h1>
                <p className="text-[15px] text-gray-500">
                  Answer any that speak to you — no pressure to fill them all
                </p>
              </div>

              <div className="space-y-5">
                {GUIDED_PROMPTS.map((prompt) => (
                  <div key={prompt.id}>
                    <label className="flex items-center gap-2 text-[14px] font-semibold text-gray-800 mb-2">
                      <span>{prompt.icon}</span>
                      {prompt.question}
                    </label>
                    <textarea
                      value={responses[prompt.id] || ""}
                      onChange={(e) =>
                        setResponses((prev) => ({
                          ...prev,
                          [prompt.id]: e.target.value,
                        }))
                      }
                      placeholder={prompt.placeholder}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-[1.5px] border-gray-200 bg-white
                        text-[14px] text-gray-800 placeholder:text-gray-300
                        focus:outline-none focus:border-green-400 focus:ring-2 focus:ring-green-100
                        transition-all duration-200 resize-none"
                    />
                  </div>
                ))}
              </div>
            </StepWrapper>
          )}

          {/* ═══ STEP 3: SHOW ═══ */}
          {step === 2 && (
            <StepWrapper stepKey="show">
              <div className="text-center mb-10">
                <h1
                  className="text-2xl font-bold text-gray-900 mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Show us the magic
                </h1>
                <p className="text-[15px] text-gray-500">
                  A photo or video is worth a thousand words (but totally
                  optional)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <MediaUploadCard
                  type="photo"
                  icon="📸"
                  title="Add Photos"
                  description="Snap of your child with their book"
                  onFiles={(f) => addFiles(f, "photo")}
                />
                <MediaUploadCard
                  type="video"
                  icon="🎬"
                  title="Add Video"
                  description="Capture their reaction!"
                  onFiles={(f) => addFiles(f, "video")}
                />
              </div>

              {media.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                  <p className="text-[13px] font-semibold text-gray-600 mb-3">
                    {media.length} file{media.length !== 1 ? "s" : ""} added
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-2">
                    {media.map((m) => (
                      <MediaThumb
                        key={m.id}
                        media={m}
                        onRemove={() => removeMedia(m.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 p-4 rounded-xl bg-amber-50/60 border border-amber-200/60">
                <p className="text-[12px] text-amber-700 leading-relaxed">
                  <span className="font-semibold">Tip:</span> The best reviews
                  include a photo of your child holding or reading their book.
                  These real moments help other parents see what FlipWhizz is all about.
                </p>
              </div>
            </StepWrapper>
          )}

          {/* ═══ STEP 4: PERMISSIONS ═══ */}
          {step === 3 && (
            <StepWrapper stepKey="permissions">
              <div className="text-center mb-10">
                <h1
                  className="text-2xl font-bold text-gray-900 mb-2"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  One last thing
                </h1>
                <p className="text-[15px] text-gray-500">
                  Let us know how we can share your review
                </p>
              </div>

              <div className="space-y-3">
                <PermissionToggle
                  label="I confirm I have the right to share these images"
                  description="You're the parent or legal guardian of any children shown, and you consent to these images being used as described below."
                  checked={permissions.rightToShare}
                  onChange={(v) =>
                    setPermissions((p) => ({ ...p, rightToShare: v }))
                  }
                  required
                />

                <PermissionToggle
                  label="Feature on the FlipWhizz website"
                  description="Your review and any photos/videos may appear on our website to help other parents discover FlipWhizz."
                  checked={permissions.publishWebsite}
                  onChange={(v) =>
                    setPermissions((p) => ({ ...p, publishWebsite: v }))
                  }
                />

                <PermissionToggle
                  label="Share on FlipWhizz social media"
                  description="We may share your review and media on our Instagram, Facebook, or other social channels, always crediting you."
                  checked={permissions.publishSocial}
                  onChange={(v) =>
                    setPermissions((p) => ({ ...p, publishSocial: v }))
                  }
                />
              </div>

              <div className="mt-6 p-4 rounded-xl bg-gray-50 border border-gray-200/60">
                <p className="text-[12px] text-gray-500 leading-relaxed">
                  You can change your mind at any time by emailing{" "}
                  <a
                    href="mailto:katy@flipwhizz.com"
                    className="text-green-600 font-medium"
                  >
                    katy@flipwhizz.com
                  </a>
                  . We will never share your content without the permissions
                  selected above.
                </p>
              </div>
            </StepWrapper>
          )}

          {/* ═══ STEP 5: REWARD ═══ */}
          {step === 4 && (
            <StepWrapper stepKey="reward">
              <div className="relative text-center">
                <ConfettiBurst />

                <div className="mb-6 animate-in fade-in zoom-in-75 duration-700">
                  <span className="text-6xl">🎉</span>
                </div>

                <h1
                  className="text-2xl font-bold text-gray-900 mb-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Thank you!
                </h1>
                <p className="text-[15px] text-gray-500 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                  Your review means the world to us (and to other parents too).
                </p>

                {/* Promo code card */}
                <div className="animate-in fade-in zoom-in-95 duration-700 delay-500">
                  <div
                    className="relative p-8 rounded-2xl overflow-hidden"
                    style={{
                      background:
                        "linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
                    }}
                  >
                    {/* Decorative circles */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white/5" />

                    <p className="text-white/70 text-[13px] font-medium mb-2 uppercase tracking-wider">
                      Your reward
                    </p>
                    <p className="text-white text-lg font-bold mb-6">
                      15% off your next book
                    </p>

                    <div className="bg-white/20 backdrop-blur-sm rounded-xl p-5 mb-4">
                      <p
                        className="text-white text-3xl font-bold tracking-[0.15em]"
                        style={{
                          fontFamily: "'DM Sans', monospace",
                        }}
                      >
                        {promoCode || "..."}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        if (promoCode) {
                          navigator.clipboard?.writeText(promoCode);
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 2000);
                        }
                      }}
                      className="text-white/80 text-[13px] font-medium hover:text-white transition"
                    >
                      {codeCopied ? "✓ Copied!" : "Tap to copy code"}
                    </button>
                  </div>
                </div>

                {/* Disclosure */}
                <p className="text-[11px] text-gray-400 mt-4 italic">
                  This discount was provided in exchange for an honest review.
                </p>

                {/* CTA */}
                <div className="mt-10 space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-700">
                  <button
                    onClick={() =>
                      console.log("Navigate to /stories/new")
                    }
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold text-[15px] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    Start Your Next Adventure
                  </button>
                  <button
                    onClick={() => window.history.back()}
                    className="w-full py-3 text-[14px] text-gray-400 hover:text-gray-600 transition"
                  >
                    Back to my book
                  </button>
                </div>
              </div>
            </StepWrapper>
          )}
        </div>

        {/* ─── Bottom nav (not on reward step) ─── */}
        {step < TOTAL_STEPS - 1 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-md border-t border-gray-200/60 px-6 py-4 z-10">
            <div className="max-w-[640px] mx-auto flex items-center justify-between">
              {step > 0 ? (
                <button
                  onClick={() => setStep((s) => Math.max(s - 1, 0))}
                  className="text-[14px] font-medium text-gray-500 hover:text-gray-700 transition"
                >
                  ← Back
                </button>
              ) : (
                <div />
              )}

              <button
                onClick={handleNext}
                disabled={!canAdvance() || isSubmitting}
                className={`
                  px-8 py-3 rounded-xl font-semibold text-[14px]
                  transition-all duration-200
                  ${
                    canAdvance() && !isSubmitting
                      ? "bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg hover:-translate-y-0.5"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }
                `}
              >
                {isSubmitting
                  ? "Submitting…"
                  : step === 3
                  ? "Submit Review"
                  : step === 2
                  ? media.length > 0
                    ? "Next"
                    : "Skip"
                  : "Next"}
              </button>
              {submitError && (
                <p className="absolute -top-8 right-0 text-[12px] text-red-500 font-medium">
                  {submitError}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}