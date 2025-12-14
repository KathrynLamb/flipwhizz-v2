"use client";

import { useState, useEffect } from "react";
import { loadScript } from "@paypal/paypal-js";
import { Loader } from "lucide-react";
import { SampleImageCharacterCard } from "@/components/SampleImageCharacterCard";
import { SampleImageLocationCard } from "@/components/SampleImageLocationCard";
import type { PayPalScriptOptions } from "@paypal/paypal-js";
/* ===================== Types ===================== */

export type Entity = {
  id: string;
  name: string;
  referenceImageUrl?: string | null;
  description?: string | null;
};

export type RefImage = {
  id: string;
  url: string;
  label: string | null;
  notes?: string;
  locked?: boolean;
};

export type StyleGuide = {
  id: string;
  storyId: string;
  summary: string | null;
  negativePrompt: string | null;
  sampleIllustrationUrl: string | null;
  referenceImages?: RefImage[];
};

/* ===================== Component ===================== */

export default function InitialStyleEditor({
  style,
  pages,
  leftText,
  rightText,
  characters = [],
  locations = [],
}: {
  style: StyleGuide;
  pages: string[];
  characters: Entity[];
  locations: Entity[];
  leftText: string;
  rightText: string;
}) {
  const storyId = style.storyId;

  /* ---------- Local state ---------- */

  const [localCharacters, setLocalCharacters] = useState<Entity[]>(characters);
  const [localLocations, setLocalLocations] = useState<Entity[]>(locations);

  const [pageCharIds, setPageCharIds] = useState<Set<string>>(new Set());
  const [pageLocIds, setPageLocIds] = useState<Set<string>>(new Set());

  const [localDesc, setLocalDesc] = useState(style.summary ?? "");
  const [localImages, setLocalImages] = useState<RefImage[]>(
    (style.referenceImages ?? []).map((i) => ({ ...i, locked: true }))
  );

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(
    style.sampleIllustrationUrl ?? null
  );

  const [paypalLoaded, setPaypalLoaded] = useState(false);

  /* ===================== Page presence ===================== */

  useEffect(() => {
    async function loadPresence() {
      const res = await fetch(
        `/api/stories/${storyId}/page-presence?pages=1,2`
      );
      const data = await res.json();

      setPageCharIds(new Set(data.characterIds ?? []));
      setPageLocIds(new Set(data.locationIds ?? []));
    }

    loadPresence();
  }, [storyId]);

  const charactersOnPages = localCharacters.filter((c) =>
    pageCharIds.has(c.id)
  );

  const locationsOnPages = localLocations.filter((l) =>
    pageLocIds.has(l.id)
  );

  /* ===================== PayPal ===================== */




  
  useEffect(() => {
    if (!generatedImage) return;
  
    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
    if (!clientId) {
      console.error("Missing NEXT_PUBLIC_PAYPAL_CLIENT_ID");
      return;
    }
  
    const options = {
      "client-id": clientId, // ✅ PayPal expects this key at runtime
      currency: "GBP",
    } as unknown as PayPalScriptOptions; // ✅ satisfy TS
  
    loadScript(options)
      .then(() => setPaypalLoaded(true))
      .catch((err) => console.error("PayPal SDK failed to load", err));
  }, [generatedImage]);
  

  useEffect(() => {
    if (!paypalLoaded) return;
  
    const paypal = window.paypal;
    if (!paypal?.Buttons) return;
  
    paypal
      .Buttons({
        createOrder: async () => {
          const res = await fetch("/api/paypal/order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storyId,
              product: "FlipWhizz Book Preview",
              price: "0.01",
            }),
          });
  
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Failed to create order");
          return data.orderID;
        },
        onApprove: async (data: any) => {
          await fetch("/api/paypal/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderID: data.orderID }),
          });
          alert("Payment successful!");
        },
        onError: (err: any) => {
          console.error(err);
          alert("Something went wrong with PayPal.");
        },
      })
      .render("#paypal-container");
  }, [paypalLoaded, storyId]);
  

  /* ===================== Helpers ===================== */

  function updateCharacter(id: string, updates: Partial<Entity>) {
    setLocalCharacters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  }

  function updateLocation(id: string, updates: Partial<Entity>) {
    setLocalLocations((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  }

  async function saveDescription() {
    await fetch("/api/style-guide/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storyId,
        summary: localDesc,
      }),
    });
  }

  /* ===================== Generate ===================== */

  async function handleGenerate() {
    setGenerating(true);
    setGeneratedImage(null);
    await saveDescription();

    try {
      const references = [
        ...localImages.map((img) => ({
          url: img.url,
          type: "style",
          label: img.label,
          notes: img.notes ?? "",
        })),
        ...charactersOnPages
          .filter((c) => c.referenceImageUrl)
          .map((c) => ({
            url: c.referenceImageUrl!,
            type: "character",
            label: c.name,
            notes: c.description ?? "",
          })),
        ...locationsOnPages
          .filter((l) => l.referenceImageUrl)
          .map((l) => ({
            url: l.referenceImageUrl!,
            type: "location",
            label: l.name,
            notes: l.description ?? "",
          })),
      ];

      const res = await fetch("/api/style/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          references,
          description: localDesc,
          leftText,
          rightText,
          storyId,
        }),
      });

      const data = await res.json();
      setGeneratedImage(`data:${data.image.mimeType};base64,${data.image.data}`);
    } finally {
      setGenerating(false);
    }
  }

  /* ===================== Render ===================== */

  return (
    <div className="mt-8 bg-white/5 border border-white/10 p-6 rounded-3xl">
      {!generatedImage && (
        <>
          <div className="font-semibold text-sm mb-4">Illustration Style</div>

          <textarea
            className="w-full bg-black/20 border border-white/10 rounded-xl p-3 mb-6 text-sm"
            placeholder="Describe illustration style…"
            value={localDesc}
            onChange={(e) => setLocalDesc(e.target.value)}
          />

          {charactersOnPages.length > 0 && (
            <section className="mb-8">
              <h3 className="text-sm font-bold mb-4">
                Characters on pages 1–2
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {charactersOnPages.map((c) => (
             <SampleImageCharacterCard
             key={c.id}
             character={{
               ...c,
               description: c.description ?? null,
               referenceImageUrl: c.referenceImageUrl ?? null,
             }}
             onUpdated={(u) => updateCharacter(c.id, u)}
           />
           
                ))}
              </div>
            </section>
          )}

          {locationsOnPages.length > 0 && (
            <section className="mb-8">
              <h3 className="text-sm font-bold mb-4">
                Locations on pages 1–2
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {locationsOnPages.map((l) => (
                  <SampleImageLocationCard
                    key={l.id}
                    location={l}
                    onUpdated={(u) => updateLocation(l.id, u)}
                  />
                ))}
              </div>
            </section>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3 rounded-xl font-bold disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate Sample Illustration"}
          </button>
        </>
      )}

      {generatedImage && (
        <div className="mt-6">
          <img
            src={generatedImage}
            className="w-full rounded-xl border border-white/10"
          />
          {paypalLoaded ? (
            <div id="paypal-container" className="mt-6" />
          ) : (
            <p className="text-xs text-white/40 mt-4">Loading PayPal…</p>
          )}
        </div>
      )}
    </div>
  );
}
