// src/lib/typeset/steps.ts
//
// Typesetting as Inngest steps (each memoised and retried on its own):
//   emphasis -> layout (where the text goes) -> render (bake + text layer)
// Used by the spread worker after the picture is checked, and by "re-letter".

import { fetchImage, toPart, upload, uploadSvg } from "@/lib/illustrate/images";
import { generateJson } from "@/lib/illustrate/gemini";
import type { TypefaceKey } from "./fonts";
import { plainRuns, type Run } from "./runs";
import { ensureEmphasis } from "./settings";
import { keptBoxes, layoutSpread, layoutWarnings, renderLayout, textBlocks, type TypesetLayout } from "./typeset";

type Step = { run: <T>(id: string, fn: () => Promise<T>) => Promise<any> };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export type TypesetInfo = { v: 1; typeface: TypefaceKey; svgUrl: string | null; layout: TypesetLayout };

export type TypesetResult = {
  finalUrl: string;
  text: { ok: boolean; left: number; right: number; problems: string[]; warnings: string[]; attempts: number; method: "typeset" };
  blocks: { box_2d: [number, number, number, number]; text: string }[];
  typeset: TypesetInfo;
};

export async function typesetStep(
  step: Step,
  o: {
    prefix: string;
    storyId: string;
    artUrl: string;
    leftPageId: string;
    rightPageId: string | null;
    leftText: string;
    rightText: string;
    typeface: TypefaceKey;
    folder: string;
    /** A previous layout of this same picture: keep its text places (re-lettering). */
    keepFrom?: unknown;
  }
): Promise<TypesetResult | { error: string }> {
  const runs: { left: Run[]; right: Run[] } = await step.run(`${o.prefix}-emphasis`, async () => {
    const pick = (plan: Record<string, { text: string; runs: Run[] }>, id: string | null, text: string) => {
      const p = id ? plan[id] : undefined;
      return p && p.text === text ? p.runs : plainRuns(text);
    };
    try {
      const plan = await ensureEmphasis(o.storyId, { pageIds: [o.leftPageId, ...(o.rightPageId ? [o.rightPageId] : [])] });
      return { left: pick(plan, o.leftPageId, o.leftText), right: pick(plan, o.rightPageId, o.rightText) };
    } catch (e) {
      console.warn(`⚠️ ${o.prefix}: emphasis unavailable (${msg(e)}); setting plain`);
      return { left: plainRuns(o.leftText), right: plainRuns(o.rightText) };
    }
  });

  const laid: { layout?: TypesetLayout; error?: string } = await step.run(`${o.prefix}-layout`, async () => {
    try {
      const art = await fetchImage(o.artUrl);
      const layout = await layoutSpread(
        art,
        [
          { side: "left", text: o.leftText ?? "", runs: runs.left },
          { side: "right", text: o.rightText ?? "", runs: runs.right },
        ],
        o.typeface,
        {
          boxes: keptBoxes(o.keepFrom),
          askVision: async (prompt, img) => generateJson([await toPart(img, 1536), { text: prompt }], "place-text"),
        }
      );
      return { layout };
    } catch (e) {
      return { error: msg(e) };
    }
  });
  if (!laid.layout) return { error: `layout: ${laid.error}` };
  const layout = laid.layout;

  const drawn: { finalUrl?: string; svgUrl?: string | null; error?: string } = await step.run(`${o.prefix}-render`, async () => {
    try {
      const { image, svg } = await renderLayout(await fetchImage(o.artUrl), layout);
      const finalUrl = await upload(image, o.folder);
      // The vector text layer is for crisp print; the page works without it.
      const svgUrl = await uploadSvg(svg, `${o.folder}/text`).catch((e) => {
        console.warn(`⚠️ ${o.prefix}: text layer upload failed (${msg(e)}); print will use the page picture`);
        return null;
      });
      return { finalUrl, svgUrl };
    } catch (e) {
      return { error: msg(e) };
    }
  });
  if (!drawn.finalUrl) return { error: `render: ${drawn.error}` };

  const warnings = layoutWarnings(layout);
  const problems = warnings.filter((w) => /taller than the page's safe area/.test(w));
  return {
    finalUrl: drawn.finalUrl,
    text: { ok: problems.length === 0, left: 1, right: 1, problems, warnings, attempts: 1, method: "typeset" },
    blocks: textBlocks(layout),
    typeset: { v: 1, typeface: o.typeface, svgUrl: drawn.svgUrl ?? null, layout },
  };
}

/** Draw a stored layout onto a changed picture (after a character fix). */
export async function rerenderTypeset(artUrl: string, info: TypesetInfo, folder: string): Promise<string> {
  const { image } = await renderLayout(await fetchImage(artUrl), info.layout);
  return upload(image, folder);
}
