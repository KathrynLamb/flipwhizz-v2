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
 * In development: uses local Ghostscript installation.
 * In production: calls the Fly.io Ghostscript microservice.
 */
export async function postProcessPdf(inputBuffer: Buffer): Promise<Buffer> {
  const serviceUrl = process.env.PDF_PROCESSOR_URL;

  if (serviceUrl) {
    return postProcessRemote(inputBuffer, serviceUrl);
  }

  return postProcessLocal(inputBuffer);
}

/* -------------------------------------------------------------------------- */
/*  Remote: Fly.io Ghostscript service                                         */
/* -------------------------------------------------------------------------- */

async function postProcessRemote(
  inputBuffer: Buffer,
  serviceUrl: string
): Promise<Buffer> {
  const apiSecret = process.env.PDF_PROCESSOR_SECRET;

  if (!apiSecret) {
    throw new Error("Missing PDF_PROCESSOR_SECRET env var");
  }

  console.log(`🔧 Post-processing PDF via ${serviceUrl} (${inputBuffer.length} bytes)`);

  const response = await fetch(`${serviceUrl}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/pdf",
      "X-API-Secret": apiSecret,
    },
    body: inputBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`PDF processor failed: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const outputBuffer = Buffer.from(arrayBuffer);

  console.log(
    `🔧 PDF post-processed: ${inputBuffer.length} → ${outputBuffer.length} bytes`
  );

  return outputBuffer;
}

/* -------------------------------------------------------------------------- */
/*  Local: Ghostscript on dev machine                                          */
/* -------------------------------------------------------------------------- */

async function postProcessLocal(inputBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = Date.now() + "-" + Math.random().toString(36).slice(2);
  const inputPath = path.join(tmpDir, `flipwhizz-input-${id}.pdf`);
  const outputPath = path.join(tmpDir, `flipwhizz-output-${id}.pdf`);

  try {
    fs.writeFileSync(inputPath, inputBuffer);

    await execFileAsync("gs", [
      "-dBATCH",
      "-dNOPAUSE",
      "-dQUIET",
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      "-dAutoRotatePages=/None",
      "-dColorConversionStrategy=/LeaveColorUnchanged",
      "-dDownsampleColorImages=false",
      "-dDownsampleGrayImages=false",
      "-dDownsampleMonoImages=false",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ]);

    const outputBuffer = fs.readFileSync(outputPath);

    console.log(
      `🔧 PDF post-processed locally: ${inputBuffer.length} → ${outputBuffer.length} bytes`
    );

    return Buffer.from(outputBuffer);
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}