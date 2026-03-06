import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);

/**
 * Post-process a PDF buffer through Ghostscript to produce
 * a clean, print-ready PDF that Gelato can parse correctly.
 * 
 * Chromium/Puppeteer PDFs use Skia which produces valid but
 * non-standard PDF structures that some print APIs reject.
 * Running through Ghostscript normalises the output.
 */
export async function postProcessPdf(inputBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const inputPath = path.join(tmpDir, `flipwhizz-input-${Date.now()}.pdf`);
  const outputPath = path.join(tmpDir, `flipwhizz-output-${Date.now()}.pdf`);

  try {
    // Write input PDF to temp file
    fs.writeFileSync(inputPath, inputBuffer);

    // Run Ghostscript to re-process the PDF
    await execFileAsync("gs", [
      "-dBATCH",
      "-dNOPAUSE",
      "-dQUIET",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-dAutoRotatePages=/None",    // Preserve page orientation
      "-dColorConversionStrategy=/LeaveColorUnchanged", // Don't mess with colours
      "-dDownsampleColorImages=false",  // Don't reduce image quality
      "-dDownsampleGrayImages=false",
      "-dDownsampleMonoImages=false",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ]);

    // Read the processed PDF
    const outputBuffer = fs.readFileSync(outputPath);
    
    console.log(
      `🔧 PDF post-processed: ${inputBuffer.length} → ${outputBuffer.length} bytes`
    );

    return Buffer.from(outputBuffer);
  } finally {
    // Clean up temp files
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}