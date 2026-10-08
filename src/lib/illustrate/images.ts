// src/lib/illustrate/images.ts
//
// Image I/O and pixel operations for the check-and-fix pipeline:
// fetch, resize for the model, crop, and paste a fixed patch back with a
// feathered mask and colour matching so nothing outside the fixed person
// changes and no seam shows.

import sharp from "sharp";
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import { v4 as uuid } from "uuid";
import type { PxBox } from "./geometry";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export type InlinePart = { inlineData: { data: string; mimeType: string } };

/* -------------------------------------------------------------------------- */
/*                                    I/O                                     */
/* -------------------------------------------------------------------------- */

export async function fetchImage(url: string): Promise<Buffer> {
  if (!url || url.startsWith("data:")) throw new Error("fetchImage: not a fetchable URL");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchImage: ${res.status} for ${url.slice(0, 120)}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function imageSize(buf: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(buf).rotate().metadata();
  // .rotate() honours EXIF; metadata() reports pre-rotation dims, so swap for 90/270.
  const o = meta.orientation ?? 1;
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  return o >= 5 ? { width: h, height: w } : { width: w, height: h };
}

/** Normalise any input to an upright JPEG (EXIF applied). */
export async function toJpeg(buf: Buffer, quality = 94): Promise<Buffer> {
  return sharp(buf).rotate().jpeg({ quality, mozjpeg: true }).toBuffer();
}

/** Image -> Gemini inline part, shrunk to maxPx on the long side. */
export async function toPart(buf: Buffer, maxPx: number | null = 1536): Promise<InlinePart> {
  let img = sharp(buf).rotate();
  if (maxPx) img = img.resize({ width: maxPx, height: maxPx, fit: "inside", withoutEnlargement: true });
  const out = await img.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return { inlineData: { data: out.toString("base64"), mimeType: "image/jpeg" } };
}

export async function urlToPart(url: string, maxPx: number | null = 1536): Promise<InlinePart> {
  return toPart(await fetchImage(url), maxPx);
}

export async function upload(buf: Buffer, folder: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, filename_override: uuid(), resource_type: "image", format: "jpg", timeout: 120000 },
      (err, res) => {
        if (err) return reject(err);
        if (!res?.secure_url) return reject(new Error("Cloudinary returned no URL"));
        resolve(res.secure_url);
      }
    );
    Readable.from(buf).pipe(stream);
  });
}

/* -------------------------------------------------------------------------- */
/*                                  REGIONS                                   */
/* -------------------------------------------------------------------------- */

export async function extract(buf: Buffer, box: PxBox): Promise<Buffer> {
  return sharp(buf)
    .rotate()
    .extract({ left: box.left, top: box.top, width: box.width, height: box.height })
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
}

/** Upscale a (possibly tiny) crop so the model has enough pixels to work with. */
export async function enlarge(buf: Buffer, longSide = 1024): Promise<Buffer> {
  return sharp(buf)
    .resize({ width: longSide, height: longSide, fit: "inside", withoutEnlargement: false, kernel: "lanczos3" })
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
}

async function raw(buf: Buffer, w: number, h: number, channels: 1 | 3): Promise<Buffer> {
  let img = sharp(buf).rotate().resize({ width: w, height: h, fit: "cover", position: "centre" });
  img = channels === 1 ? img.greyscale() : img.removeAlpha().toColourspace("srgb");
  return img.raw().toBuffer();
}

/** Feathered rounded-rectangle mask (0-255), white over the subject. */
export async function featherMask(
  w: number,
  h: number,
  subject: PxBox,
  opts: { grow?: number; growPx?: number; feather?: number } = {}
): Promise<Buffer> {
  const growFrac = opts.grow ?? 0.12;
  const gx = Math.round(subject.width * growFrac) + (opts.growPx ?? 0);
  const gy = Math.round(subject.height * growFrac) + (opts.growPx ?? 0);
  // Clamp both edges independently so a box at the crop edge doesn't grow
  // further on the far side.
  const x = Math.max(0, subject.left - gx);
  const y = Math.max(0, subject.top - gy);
  const rw = Math.min(w, subject.left + subject.width + gx) - x;
  const rh = Math.min(h, subject.top + subject.height + gy) - y;
  const r = Math.round(Math.min(rw, rh) * 0.18);
  const sigma = Math.max(1.5, opts.feather ?? Math.min(subject.width, subject.height) * 0.06);
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
      `<rect width="100%" height="100%" fill="black"/>` +
      `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${r}" ry="${r}" fill="white"/>` +
      `</svg>`
  );
  return sharp(svg).blur(sigma).greyscale().extractChannel(0).raw().toBuffer();
}

/**
 * Match the patch's colours to the original using the pixels OUTSIDE the
 * subject (background both versions should share). Per-channel mean/std.
 */
export function colourMatch(patch: Buffer, orig: Buffer, mask: Buffer, minPixels = 400): Buffer {
  const n = mask.length;
  const sumP = [0, 0, 0], sumO = [0, 0, 0], sqP = [0, 0, 0], sqO = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (mask[i] > 20) continue; // only background ring
    // ...and only pixels the model didn't really change (a redrawn person
    // can spill into the ring; their colours must not skew the match).
    if (
      Math.abs(patch[i * 3] - orig[i * 3]) > 42 ||
      Math.abs(patch[i * 3 + 1] - orig[i * 3 + 1]) > 42 ||
      Math.abs(patch[i * 3 + 2] - orig[i * 3 + 2]) > 42
    )
      continue;
    count++;
    for (let c = 0; c < 3; c++) {
      const p = patch[i * 3 + c];
      const o = orig[i * 3 + c];
      sumP[c] += p; sqP[c] += p * p;
      sumO[c] += o; sqO[c] += o * o;
    }
  }
  if (count < minPixels) return patch;
  const out = Buffer.alloc(patch.length);
  const gain = [0, 0, 0], mP = [0, 0, 0], mO = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    mP[c] = sumP[c] / count;
    mO[c] = sumO[c] / count;
    const sP = Math.sqrt(Math.max(1, sqP[c] / count - mP[c] * mP[c]));
    const sO = Math.sqrt(Math.max(1, sqO[c] / count - mO[c] * mO[c]));
    // On flat backgrounds (sky, white) the spread is tiny and noisy, and a
    // gain would wildly shift colours far from the background (faces). Only
    // scale contrast when both sides have real texture; otherwise just shift.
    gain[c] = sP > 12 && sO > 12 ? Math.max(0.85, Math.min(1.18, sO / sP)) : 1;
  }
  for (let i = 0; i < patch.length; i++) {
    const c = i % 3;
    const v = (patch[i] - mP[c]) * gain[c] + mO[c];
    out[i] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  }
  return out;
}

/** Hard (unfeathered) rectangle mask: subject grown by frac, 0/255. */
function rectMask(w: number, h: number, subject: PxBox, frac: number): Buffer {
  const gx = Math.round(subject.width * frac);
  const gy = Math.round(subject.height * frac);
  const x0 = Math.max(0, subject.left - gx);
  const y0 = Math.max(0, subject.top - gy);
  const x1 = Math.min(w, subject.left + subject.width + gx);
  const y1 = Math.min(h, subject.top + subject.height + gy);
  const m = Buffer.alloc(w * h);
  for (let y = y0; y < y1; y++) m.fill(255, y * w + x0, y * w + x1);
  return m;
}

async function blurThreshold(m: Buffer, w: number, h: number, sigma: number, cut: number): Promise<Buffer> {
  // extractChannel(0): sharp otherwise returns 3 channels for a 1-channel raw input.
  const b = await sharp(m, { raw: { width: w, height: h, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
  const out = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) out[i] = b[i] >= cut ? 255 : 0;
  return out;
}

/**
 * Mask that follows what the model ACTUALLY changed. The redrawn person is
 * often a little bigger, taller or shifted compared with the old outline;
 * a mask built only from the old box leaves part of them half-transparent
 * (a "ghost"). So: take every pixel that changed noticeably, near the
 * subject, close the gaps, join it to the subject box, and only then
 * feather the outside edge. Inside, the new person is fully opaque.
 */
async function adaptiveMask(
  patch: Buffer,
  orig: Buffer,
  w: number,
  h: number,
  subject: PxBox,
  grow: number,
  feather: number
): Promise<Buffer> {
  const n = w * h;
  const limit = rectMask(w, h, subject, Math.max(0.5, grow + 0.3));
  const changed = Buffer.alloc(n);
  for (let i = 0; i < n; i++) {
    if (!limit[i]) continue;
    const d = Math.max(
      Math.abs(patch[i * 3] - orig[i * 3]),
      Math.abs(patch[i * 3 + 1] - orig[i * 3 + 1]),
      Math.abs(patch[i * 3 + 2] - orig[i * 3 + 2])
    );
    if (d > 42) changed[i] = 255;
  }
  const minSide = Math.min(subject.width, subject.height);
  // close: grow the changed area, then fill holes inside the figure
  const closed = await blurThreshold(changed, w, h, Math.max(2, minSide * 0.04), 40);
  const filled = await blurThreshold(closed, w, h, Math.max(2, minSide * 0.08), 90);
  const core = rectMask(w, h, subject, grow);
  const union = Buffer.alloc(n);
  for (let i = 0; i < n; i++) union[i] = (filled[i] && limit[i]) || core[i] ? 255 : 0;
  // feather OUTWARD only: grow by ~2 sigma first so the edge falloff sits outside the figure
  const sigma = Math.max(1.5, feather);
  const pad = await blurThreshold(union, w, h, sigma, 20);
  return sharp(pad, { raw: { width: w, height: h, channels: 1 } }).blur(sigma).extractChannel(0).raw().toBuffer();
}

/**
 * Paste a model-edited patch back into the base image.
 * - patch is resized (cover) to exactly the crop size
 * - colours matched to the original background ring
 * - blended through a feathered mask around the subject, so pixels outside
 *   the subject (plus a soft margin) are left exactly as they were.
 */
export async function pastePatch(
  base: Buffer,
  patch: Buffer,
  crop: PxBox,
  subject: PxBox,
  opts: {
    grow?: number;
    growPx?: number;
    feather?: number;
    matchColours?: boolean;
    /** Follow the model's actual changes (people fixes). Off for text. */
    adaptive?: boolean;
  } = {}
): Promise<Buffer> {
  const { width: W, height: H } = await imageSize(base);
  const c = {
    left: Math.max(0, Math.min(W - 1, crop.left)),
    top: Math.max(0, Math.min(H - 1, crop.top)),
    width: Math.min(crop.width, W - Math.max(0, crop.left)),
    height: Math.min(crop.height, H - Math.max(0, crop.top)),
  };
  const w = c.width;
  const h = c.height;

  // Raw pixels straight from the base: no JPEG round-trip, so pixels outside
  // the mask are written back exactly as they were.
  const orig = await sharp(base).rotate().extract(c).removeAlpha().toColourspace("srgb").raw().toBuffer();
  let p = await raw(patch, w, h, 3);
  let mask = await featherMask(w, h, subject, opts);
  if (opts.matchColours !== false) p = colourMatch(p, orig, mask);
  if (opts.adaptive) {
    mask = await adaptiveMask(
      p,
      orig,
      w,
      h,
      subject,
      opts.grow ?? 0.12,
      opts.feather ?? Math.max(1.5, Math.min(subject.width, subject.height) * 0.03)
    );
  }

  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const a = mask[i] / 255;
    for (let k = 0; k < 3; k++) {
      out[i * 3 + k] = Math.round(p[i * 3 + k] * a + orig[i * 3 + k] * (1 - a));
    }
  }
  const blended = await sharp(out, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
  return sharp(base)
    .rotate()
    .composite([{ input: blended, left: c.left, top: c.top }])
    .jpeg({ quality: 94, mozjpeg: true })
    .toBuffer();
}

/** Resize b to exactly a's dimensions (for comparing / compositing). */
export async function matchSize(b: Buffer, width: number, height: number): Promise<Buffer> {
  return sharp(b).rotate().resize({ width, height, fit: "fill" }).jpeg({ quality: 94, mozjpeg: true }).toBuffer();
}
