// scripts/export-showcase-spreads.mjs
/**
 * export-showcase-spreads.mjs
 *
 * Pulls finished spread images for stories into a local folder so we can pick
 * real books to feature on the homepage. Nothing is uploaded anywhere; it only
 * reads from the database and downloads from Cloudinary to your computer.
 *
 * Run from the project root:
 *   node scripts/export-showcase-spreads.mjs
 *
 * Options:
 *   --min-spreads=6           only stories with at least this many illustrated spreads (default 6)
 *   --limit=40                at most this many stories, newest first (default 40)
 *   --exclude-email=a@b.com   skip a user's stories; repeat or comma-separate for several
 *   --only=<storyId>,<id>     export just these stories
 *   --out=showcase            output folder (default ./showcase)
 *
 * Output:
 *   showcase/index.csv                            one row per story
 *   showcase/<title>__<id8>/contact-sheet.jpg     every spread on one image
 *   showcase/<title>__<id8>/spread-01.jpg ...     each spread, 1600px wide
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import sharp from "sharp";

// ── Options ──────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.join("=") || "true"];
  })
);
const repeated = (flag) =>
  process.argv
    .slice(2)
    .filter((a) => a.startsWith(`--${flag}=`))
    .flatMap((a) => a.split("=").slice(1).join("=").split(","))
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const MIN_SPREADS = Number(args["min-spreads"] ?? 6);
const LIMIT = Number(args.limit ?? 40);
const EXCLUDE_EMAILS = repeated("exclude-email");
const ONLY = repeated("only");
const OUT = path.resolve(args.out ?? "showcase");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Run this from the project root with .env.local present.");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2 });

// ── Helpers ──────────────────────────────────────────────────────────
const slug = (s) =>
  (s || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "untitled";

// Ask Cloudinary for a web-sized copy instead of the full print file.
const webSized = (url) =>
  url.includes("res.cloudinary.com") && url.includes("/upload/")
    ? url.replace("/upload/", "/upload/w_1600,q_auto:good,f_jpg/")
    : url;

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function contactSheet(files, dest) {
  const cols = 4;
  const tileW = 480;
  const tileH = Math.round(tileW * (1536 / 2752));
  const gap = 12;
  const rows = Math.ceil(files.length / cols);
  const composites = [];
  for (let i = 0; i < files.length; i++) {
    const input = await sharp(files[i]).resize(tileW, tileH, { fit: "cover" }).toBuffer();
    composites.push({
      input,
      left: gap + (i % cols) * (tileW + gap),
      top: gap + Math.floor(i / cols) * (tileH + gap),
    });
  }
  await sharp({
    create: {
      width: gap + cols * (tileW + gap),
      height: gap + rows * (tileH + gap),
      channels: 3,
      background: "#ffffff",
    },
  })
    .composite(composites)
    .jpeg({ quality: 80 })
    .toFile(dest);
}

// ── Main ─────────────────────────────────────────────────────────────
async function run() {
  // Each spread's image lives on its left page (story_pages.image_url).
  // qa.finalUrl is the lettered final when the check-and-fix pass ran.
  const rows = await sql`
    select
      s.id              as story_id,
      s.title,
      s.book_type,
      s.public,
      s.payment_status,
      s.created_at,
      u.email,
      sp.spread_index,
      coalesce(sp.qa->>'finalUrl', lp.image_url) as image_url
    from stories s
    join projects p        on p.id = s.project_id
    left join users u      on u.id = p.user_id
    join story_spreads sp  on sp.story_id = s.id
    left join story_pages lp on lp.id = sp.left_page_id
    where coalesce(sp.qa->>'finalUrl', lp.image_url) is not null
      and coalesce(sp.qa->>'finalUrl', lp.image_url) not like 'data:%'
    order by s.created_at desc, sp.spread_index asc
  `;

  // Group into stories.
  const byStory = new Map();
  for (const r of rows) {
    if (!byStory.has(r.story_id)) {
      byStory.set(r.story_id, {
        id: r.story_id,
        title: r.title,
        bookType: r.book_type,
        public: r.public,
        paymentStatus: r.payment_status,
        createdAt: r.created_at,
        email: r.email ?? "",
        spreads: [],
      });
    }
    byStory.get(r.story_id).spreads.push({ index: r.spread_index, url: r.image_url });
  }

  let stories = [...byStory.values()];
  if (ONLY.length) stories = stories.filter((s) => ONLY.includes(s.id.toLowerCase()));
  stories = stories
    .filter((s) => !EXCLUDE_EMAILS.includes((s.email || "").toLowerCase()))
    .filter((s) => s.spreads.length >= MIN_SPREADS)
    .slice(0, ONLY.length ? undefined : LIMIT);

  if (stories.length === 0) {
    console.log("No stories matched. Try a lower --min-spreads.");
    await sql.end();
    return;
  }

  await fs.mkdir(OUT, { recursive: true });
  const index = [["folder", "story_id", "title", "book_type", "spreads", "public", "payment_status", "created_at", "owner_email"]];

  for (const story of stories) {
    const folder = `${slug(story.title)}__${story.id.slice(0, 8)}`;
    const dir = path.join(OUT, folder);
    await fs.mkdir(dir, { recursive: true });
    console.log(`\n${story.title} (${story.spreads.length} spreads) -> ${folder}`);

    const saved = [];
    for (const spread of story.spreads) {
      const file = path.join(dir, `spread-${String(spread.index).padStart(2, "0")}.jpg`);
      try {
        const buf = await download(webSized(spread.url));
        await fs.writeFile(file, buf);
        saved.push(file);
        process.stdout.write(".");
      } catch (err) {
        process.stdout.write("x");
        console.error(`\n  could not download spread ${spread.index}: ${err.message}`);
      }
    }

    if (saved.length) await contactSheet(saved, path.join(dir, "contact-sheet.jpg"));

    index.push([
      folder,
      story.id,
      story.title,
      story.bookType,
      saved.length,
      story.public,
      story.paymentStatus,
      story.createdAt?.toISOString?.() ?? story.createdAt,
      story.email,
    ]);
  }

  await fs.writeFile(path.join(OUT, "index.csv"), index.map((r) => r.map(csvCell).join(",")).join("\n"));
  console.log(`\n\nDone. ${stories.length} stories in ${OUT}`);
  await sql.end();
}

run().catch(async (err) => {
  console.error("Export failed:", err);
  await sql.end({ timeout: 1 }).catch(() => {});
  process.exit(1);
});
