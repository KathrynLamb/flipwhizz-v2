import { exportInteriorPDF } from "../print/gelato/exportInteriorPDF";

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

const pages: PrintPage[] = spreads.flatMap((url, i) => [
  { pageNumber: i * 2 + 1, spreadImageUrl: url, side: "left" },
  { pageNumber: i * 2 + 2, spreadImageUrl: url, side: "right" },
]);

async function run() {
  await exportInteriorPDF(pages, "thirsty-dinosaur-interior.pdf");
  console.log("✅ The Thirsty Dinosaur PDF generated");
}

run().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
