import puppeteer from "puppeteer";
import { renderInteriorHTML } from "../print/gelato/renderInteriorHTML";
import * as fs from "fs";
import * as path from "path";
import * as https from "https";

type PrintPage = {
  pageNumber: number;
  spreadImageUrl: string;
  side: "left" | "right";
};

const spreads = [
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585526/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/fw89e6voqg4gagqjg0po.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585572/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/lrk0fml8la0u3xpzdkps.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778589675/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/nsyvkiq2tqgmj6qvzyps.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585564/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/dugqgwzbzekdj7d5ceen.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585565/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/fkbszntef8dxgdwcnthe.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585526/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/bgrgpiv8pvzadmvgatgq.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585532/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/y1nwqupualavellwwmjm.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778589682/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/gx1st6rdkyvtunjapwl8.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585659/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/otjcrqivn4ost6plbode.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585657/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/exlwyykm9gxwzxwqocxy.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585533/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/gfevebpo0nbhzwcrq1xp.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585610/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/elgkojbljcvkygt41xcm.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585607/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/mysgebwzsjggpqk8xpph.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778585624/flipwhizz/stories/c677bc66-8c11-43c2-b665-0efe69d2b9ed/spreads/pxkeevbtldrsnfwr9fr1.jpg",
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
  const tmpDir = path.join(process.cwd(), "tmp-thirsty-dinosaur");
  fs.mkdirSync(tmpDir, { recursive: true });

  console.log("⬇️  Downloading spreads...");
  const localPaths: string[] = [];
  for (let i = 0; i < spreads.length; i++) {
    const dest = path.join(tmpDir, `spread-${i + 1}.jpg`);
    console.log(`  ${i + 1}/14 ${spreads[i].split("/").pop()}`);
    await downloadFile(spreads[i], dest);
    localPaths.push(dest);
  }

  console.log("📄 Building pages...");
  const pages: PrintPage[] = localPaths.flatMap((localPath, i) => {
    const data = fs.readFileSync(localPath);
    const base64 = `data:image/jpeg;base64,${data.toString("base64")}`;
    return [
      { pageNumber: i * 2 + 1, spreadImageUrl: base64, side: "left" },
      { pageNumber: i * 2 + 2, spreadImageUrl: base64, side: "right" },
    ];
  });

  console.log("🖨️  Generating PDF...");
  const browser = await puppeteer.launch({ headless: true });
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

  const outPath = path.join(process.cwd(), "thirsty-dinosaur-interior.pdf");
  await page.pdf({
    path: outPath,
    printBackground: true,
    width: "11in",
    height: "11in",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log(`✅ PDF saved to ${outPath}`);

  fs.rmSync(tmpDir, { recursive: true });
  console.log("🧹 Temp files cleaned up");
}

run().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
