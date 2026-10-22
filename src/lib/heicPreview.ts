// src/lib/heicPreview.ts
//
// Shared client-side HEIC preview utility.
// Uses `heic-to` (libheif 1.21.2 WASM) which is more reliable than heic2any
// for modern iPhone HEIC encodings.
//
// Usage:
//   import { createImagePreview } from '@/lib/heicPreview';
//   const previewUrl = await createImagePreview(file);
//   <img src={previewUrl} />
//
// The original file is preserved for server upload — Cloudinary/heic-convert
// handles the actual conversion. This is purely for browser preview.

let heicToModule: typeof import('heic-to') | null = null;

async function getHeicTo() {
  if (!heicToModule) {
    heicToModule = await import('heic-to');
  }
  return heicToModule;
}

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    /^image\/hei[cf](?:-sequence)?$/i.test(file.type) ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

/**
 * Creates a browser-displayable preview URL for any image file,
 * including HEIC/HEIF from iPhone camera rolls.
 *
 * Returns a blob URL that can be used as an <img src>.
 * Call URL.revokeObjectURL() when done to free memory.
 *
 * For non-HEIC files, returns a standard object URL (instant).
 * For HEIC files, converts to JPEG via WASM (~1-3s depending on size).
 */
export async function createImagePreview(file: File): Promise<string> {
  // Fast path: non-HEIC files work natively
  if (!isHeicFile(file)) {
    return URL.createObjectURL(file);
  }

  // HEIC path: convert to JPEG blob via heic-to (WASM)
  try {
    const { heicTo, isHeic } = await getHeicTo();

    // Double-check with heic-to's own detection (reads magic bytes)
    const confirmed = await isHeic(file);
    if (!confirmed) {
      // File extension says HEIC but magic bytes disagree — try native
      return URL.createObjectURL(file);
    }

    const jpegBlob = await heicTo({
      blob: file,
      type: 'image/jpeg',
      quality: 0.8,
    });

    return URL.createObjectURL(jpegBlob);
  } catch (err) {
    console.warn('[heicPreview] HEIC conversion failed, trying fallback:', err);

    // Fallback: try heic2any if available (your existing dependency)
    try {
      const heic2any = (await import('heic2any')).default;
      const result = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.8,
      });
      const blob = Array.isArray(result) ? result[0] : result;
      return URL.createObjectURL(blob);
    } catch (fallbackErr) {
      console.warn('[heicPreview] All HEIC conversions failed:', fallbackErr);
      // Return object URL anyway — will show broken image but file is still uploadable
      return URL.createObjectURL(file);
    }
  }
}

/**
 * Check if a file is HEIC/HEIF format.
 * Uses filename extension check (instant) — no async needed.
 */
export { isHeicFile };

/** PRODUCT REQUIREMENT: iPhone HEIC/HEIF photos must work for BOTH characters
 * and locations, on desktop and mobile. Do not replace this with heic2any-only
 * conversion: that older decoder fails on newer iPhone encodings. Keep explicit
 * extensions in file pickers too, because browsers may supply an empty MIME type.
 * Convert BEFORE Firebase upload so previews and image models receive real JPEG.
 */
export const REFERENCE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
export async function prepareReferencePhoto(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;
  let converted: Blob;
  try {
    const { heicTo } = await getHeicTo();
    converted = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
  } catch {
    try {
      const heic2any = (await import('heic2any')).default;
      const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      converted = Array.isArray(result) ? result[0] : result;
    } catch {
      throw new Error('We could not read this HEIC photo. Please try another photo or export it as a JPEG.');
    }
  }
  return new File([converted], file.name.replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' });
}
