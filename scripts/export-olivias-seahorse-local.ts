import puppeteer from "puppeteer";
import { renderInteriorHTML } from "../print/gelato/renderInteriorHTML";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";
import * as http from "http";

type PrintPage = {
  pageNumber: number;
  spreadImageUrl: string;
  side: "left" | "right";
};

const spreads = [
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188768/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/dhnkktnkdvt7uqwgvyeo.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188844/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/c4s8qlziafido13qdvav.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188797/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/pocqnjzegbd1lm31md2q.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188722/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/mxfs02bzmfkrqhyih2ru.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188753/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/julvqhjf1pwcgnufpnf3.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188774/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/jydoylwiuiu7hqch6t4x.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188812/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/uyl2xhcefcbemi7lvanh.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188809/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/wdb1wgg6zarxdehatqzf.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188727/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/n2crgxybjrtbb8tfrqsx.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188745/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/b8ewgexoi8plqvu4zocv.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1779894897/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/hjihi6yhqln6hal8mm8u.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188811/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/dihlqf1skf0u3q4ntezj.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188731/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/daskmofwyc74ra9snk9q.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188776/flipwhizz/stories/0f9ab06c-37e7-4288-b724-b02005d8acc9/spreads/edzgriadxnq1znqqbhpr.jpg",
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
  const tmpDir = path.join(process.cwd(), "tmp-olivias-seahorse");
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

  const outPath = path.join(process.cwd(), "olivias-tiny-seahorse-interior.pdf");
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