/**
 * open-pdfs.mjs
 *
 * Fetches all spread images for each story and opens them
 * as an HTML preview in your browser so you can check them
 * before the user returns to the cover step.
 *
 * Run from project root:
 *   node scripts/open-pdfs.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { execSync } from "child_process";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const sql = postgres(process.env.DATABASE_URL);

const STORIES = [
  { id: "c677bc66-8c11-43c2-b665-0efe69d2b9ed", title: "The Thirsty Dinosaur" },
];

const POLL_INTERVAL_MS = 15_000;
const POLL_TIMEOUT_MS  = 30 * 60 * 1000;

const OUTPUT_DIR = join(process.cwd(), "tmp", "previews");
mkdirSync(OUTPUT_DIR, { recursive: true });

async function getPages(storyId) {
  return sql`
    SELECT page_number, image_url, text
    FROM story_pages
    WHERE story_id = ${storyId}
    ORDER BY page_number ASC
  `;
}

async function waitForIllustrations(storyId, title) {
  console.log(`\n⏳ Waiting for all spreads: "${title}"`);
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const pages = await getPages(storyId);
    const total = pages.length;
    const illustrated = pages.filter(p => p.image_url).length;
    const pct = total > 0 ? Math.round((illustrated / total) * 100) : 0;
    console.log(`   ${illustrated}/${total} pages illustrated (${pct}%)`);
    if (total > 0 && illustrated === total) { console.log(`   ✅ All pages ready`); return pages; }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.error(`   ❌ Timed out`);
  return null;
}

function buildHtml(stories) {
  const storyBlocks = stories.map(({ title, pages, hasCover }) => {
    const spreads = [];
    for (let i = 0; i < pages.length; i += 2) {
      spreads.push({ left: pages[i], right: pages[i + 1], imageUrl: pages[i].image_url });
    }

    const spreadHtml = spreads.map(({ left, right, imageUrl }) => {
      const label = right ? `Pages ${left.page_number}–${right.page_number}` : `Page ${left.page_number}`;
      return imageUrl
        ? `<div class="spread">
            <div class="spread-label">${label}</div>
            <img src="${imageUrl}" alt="${label}" loading="lazy" />
            <div class="page-texts">
              <div class="page-text"><strong>L:</strong> ${left.text ?? ""}</div>
              ${right ? `<div class="page-text"><strong>R:</strong> ${right.text ?? ""}</div>` : ""}
            </div>
          </div>`
        : `<div class="spread missing"><div class="spread-label">${label}</div><div class="missing-label">⚠️ Not yet illustrated</div></div>`;
    }).join("\n");

    const coverBadge = hasCover
      ? `<span class="badge ok">✅ Cover ready</span>`
      : `<span class="badge warn">⚠️ No cover yet — user needs to return to cover step</span>`;

    return `<section><h2>${title} ${coverBadge}</h2><div class="spreads">${spreadHtml}</div></section>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FlipWhizz Spread Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #1a1a2e; color: #eee; padding: 24px; }
    h1 { font-size: 1.6rem; margin-bottom: 8px; color: #D94590; }
    .generated-at { font-size: 0.72rem; color: #666; margin-bottom: 32px; }
    h2 { font-size: 1.1rem; margin: 40px 0 12px; color: #fff; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .badge { font-size: 0.72rem; padding: 3px 10px; border-radius: 12px; font-weight: 600; }
    .badge.ok   { background: rgba(67,184,156,0.15); color: #43B89C; border: 1px solid rgba(67,184,156,0.3); }
    .badge.warn { background: rgba(217,119,6,0.15); color: #FBBF24; border: 1px solid rgba(217,119,6,0.3); }
    .spreads { display: flex; flex-direction: column; gap: 16px; }
    .spread { background: #2d2235; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); }
    .spread-label { padding: 7px 14px; font-size: 0.72rem; font-weight: 700; color: #A897BD; background: rgba(0,0,0,0.25); }
    .spread img { width: 100%; display: block; }
    .page-texts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: rgba(255,255,255,0.04); }
    .page-text { padding: 10px 14px; font-size: 0.78rem; line-height: 1.5; color: #bbb; }
    .missing { padding: 40px; text-align: center; }
    .missing-label { color: #FBBF24; }
    section { margin-bottom: 60px; }
  </style>
</head>
<body>
  <h1>📖 FlipWhizz Spread Preview</h1>
  <p class="generated-at">Generated ${new Date().toLocaleString()}</p>
  ${storyBlocks}
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────────────

console.log(`\n🔍 Checking ${STORIES.length} stories…\n`);

const storyData = [];

for (const story of STORIES) {
  console.log(`${"─".repeat(50)}`);
  console.log(`📖 ${story.title}`);

  try {
    let pages = await getPages(story.id);
    const total = pages.length;
    const illustrated = pages.filter(p => p.image_url).length;
    console.log(`   ${illustrated}/${total} pages illustrated`);

    if (total === 0) { console.warn(`   ⚠️  No pages found — skipping`); continue; }

    if (illustrated < total) {
      console.log(`   ⏭️  Still generating — skipping`);
      pages = pages.filter(p => p.image_url);
      if (!pages.length) continue;
    }
    const hasCover = await sql`
      SELECT cover_spread_url IS NOT NULL AS has_cover FROM stories WHERE id = ${story.id}
    `.then(r => r[0]?.has_cover ?? false);

    console.log(`   Cover: ${hasCover ? "✅ ready" : "⚠️  not yet generated"}`);
    storyData.push({ title: story.title, pages, hasCover });

  } catch (err) {
    console.error(`   ❌ Failed:`, err.message);
  }
}

if (storyData.length === 0) {
  console.log("\n❌ No stories ready to preview");
  await sql.end();
  process.exit(1);
}

const html = buildHtml(storyData);
const outPath = join(OUTPUT_DIR, "spread-preview.html");
writeFileSync(outPath, html);

console.log(`\n✅ Preview saved: ${outPath}`);
execSync(`open "${outPath}"`);
console.log(`🖥️  Opened in browser`);

await sql.end();
