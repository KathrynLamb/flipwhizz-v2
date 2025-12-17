import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

type ConvertInput = {
  inputPdfPath: string;
  outputPdfPath: string;
};

export async function convertToPrintPDF({
  inputPdfPath,
  outputPdfPath
}: ConvertInput) {
  const iccProfilePath = path.resolve(
    "print/icc/ISOcoated_v2_300_eci.icc"
  );

  const args = [
    "-dSAFER",
    "-dBATCH",
    "-dNOPAUSE",
    "-dNOCACHE",

    // PDF/X-4
    "-sDEVICE=pdfwrite",
    "-dPDFX",
    "-dPDFXVersion=PDF/X-4",

    // Colour management
    "-sColorConversionStrategy=CMYK",
    "-sProcessColorModel=DeviceCMYK",
    "-dOverrideICC",

    // ICC profile
    `-sOutputICCProfile=${iccProfilePath}`,

    // Preserve bleed & trim
    "-dUseBleedBox=true",
    "-dUseTrimBox=true",

    // Quality
    "-dDownsampleColorImages=false",
    "-dDownsampleGrayImages=false",
    "-dDownsampleMonoImages=false",

    // Output
    `-sOutputFile=${outputPdfPath}`,
    inputPdfPath
  ];

  await execFileAsync("gs", args);
}
