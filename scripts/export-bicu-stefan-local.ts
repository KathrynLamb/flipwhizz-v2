import puppeteer from "puppeteer";
// import { renderInteriorHTML } from "../print/gelato/renderInteriorHTML";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";
import { renderInteriorHTML } from "print/gelato/renderInteriorHTML";

type PrintPage = {
  pageNumber: number;
  spreadImageUrl: string;
  side: "left" | "right";
};

const spreads = [
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913480/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/hceachmlcg6x2ebos0ei.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913552/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/tduhc1umhrjm7xbtudnw.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913516/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/jv1chnnqd3upurx1ystm.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913561/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/tzw3le07hrjwrjutvnhh.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913570/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/rkx34nhfqq8rsul2ewfa.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913603/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/jzbtdvy8w3uv5i7gidls.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913481/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/za5tibhq4e8wplzzysqo.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913478/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/pzssvjbr4ml4xqjmdpkw.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913523/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/rduc9ryjlfviawc4bkzz.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913514/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/feiohr9xbm06w0ndkmon.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913564/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/rcmcm7uisyke6nhqd6tp.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913564/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/rcmcm7uisyke6nhqd6tp.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913601/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/yhmvqazs4gp2bgtwxf14.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779913528/flipwhizz/stories/b1029f6d-8ebd-46fc-862d-3bf9ac613093/spreads/ve7sixj8fjr1chv32nhf.jpg",
];

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  ⏭  Already exists: ${path.basename(dest)}`);
      return resolve();
    }
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
    }).on("error", (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function run() {
  const tmpDir = path.join(process.cwd(), "tmp-bicu-stefan");
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log("⬇️  Downloading spreads...");
  const localPaths: string[] = [];
  for (let i = 0; i < spreads.length; i++) {
    const dest = path.join(tmpDir, `spread-${i + 1}.jpg`);
    console.log(`  ${i + 1}/14 ${spreads[i].split("/").pop()}`);
    await downloadFile(spreads[i], dest);
    localPaths.push(dest);
  }

  console.log("🌐 Starting local image server...");
  const server = http.createServer((req, res) => {
    const filePath = path.join(tmpDir, req.url!.slice(1));
    try {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port;
  console.log(`  Server running on port ${port}`);

  console.log("📄 Building pages...");
  const pages: PrintPage[] = localPaths.flatMap((localPath, i) => {
    const filename = path.basename(localPath);
    const url = `http://127.0.0.1:${port}/${filename}`;
    return [
      { pageNumber: i * 2 + 1, spreadImageUrl: url, side: "left" },
      { pageNumber: i * 2 + 2, spreadImageUrl: url, side: "right" },
    ];
  });

  console.log("🖨️  Generating PDF...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--js-flags=--max-old-space-size=4096"],
  });
  const page = await browser.newPage();
  const html = renderInteriorHTML(pages);

  await page.setContent(html, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });

  await page.waitForFunction(
    () => Array.from(document.images).every((img) => img.complete),
    { timeout: 120000 }
  );

  const outPath = path.join(process.cwd(), "bicu-stefan-interior.pdf");
  await page.pdf({
    path: outPath,
    printBackground: true,
    width: "11in",
    height: "11in",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });

  await browser.close();
  server.close();
  console.log(`✅ PDF saved to ${outPath}`);

  fs.rmSync(tmpDir, { recursive: true });
  console.log("🧹 Temp files cleaned up");
}

run().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
