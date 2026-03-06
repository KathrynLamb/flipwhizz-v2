const http = require("http");
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const os = require("os");

const execFileAsync = promisify(execFile);

const API_SECRET = process.env.API_SECRET || "change-me";
const PORT = process.env.PORT || 8080;
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

async function processWithGhostscript(inputBuffer) {
  const tmpDir = os.tmpdir();
  const id = Date.now() + "-" + Math.random().toString(36).slice(2);
  const inputPath = path.join(tmpDir, `input-${id}.pdf`);
  const outputPath = path.join(tmpDir, `output-${id}.pdf`);

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

    return fs.readFileSync(outputPath);
  } finally {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}
  }
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Secret");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  if (req.method !== "POST" || req.url !== "/process") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not found" }));
  }

  // Auth
  const secret = req.headers["x-api-secret"];
  if (secret !== API_SECRET) {
    res.writeHead(401, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Unauthorized" }));
  }

  // Collect body
  const chunks = [];
  let size = 0;

  req.on("data", (chunk) => {
    size += chunk.length;
    if (size > MAX_SIZE) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File too large" }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on("end", async () => {
    try {
      const inputBuffer = Buffer.concat(chunks);

      if (inputBuffer.length === 0) {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Empty body" }));
      }

      console.log(`Processing PDF: ${inputBuffer.length} bytes`);
      const start = Date.now();

      const outputBuffer = await processWithGhostscript(inputBuffer);

      const elapsed = Date.now() - start;
      console.log(
        `Done: ${inputBuffer.length} -> ${outputBuffer.length} bytes (${elapsed}ms)`
      );

      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Length": outputBuffer.length,
      });
      res.end(outputBuffer);
    } catch (err) {
      console.error("Processing failed:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Processing failed", message: err.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`PDF processor listening on port ${PORT}`);
});