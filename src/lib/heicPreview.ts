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
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
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