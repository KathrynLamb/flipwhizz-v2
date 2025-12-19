import { exportInteriorPDF } from "../print/gelato/exportInteriorPDF";

async function run() {
  const pages = [
    {
      pageNumber: 1,
      imageUrl: "https://res.cloudinary.com/dz3sfyapj/image/upload/v1765980398/flipwhizz/style-samples/89cc41ea-184b-48ba-a0ea-5c82c842eb42/bwrxog0tl5fcuotif0op.jpg",
    },
    {
      pageNumber: 2,
      imageUrl: "https://res.cloudinary.com/dz3sfyapj/image/upload/v1765980398/flipwhizz/style-samples/89cc41ea-184b-48ba-a0ea-5c82c842eb42/bwrxog0tl5fcuotif0op.jpg",
    },
    {
      pageNumber: 3,
      imageUrl: "https://res.cloudinary.com/dz3sfyapj/image/upload/v1765980427/flipwhizz/style-samples/89cc41ea-184b-48ba-a0ea-5c82c842eb42/sfdsrm0ka0urttf7k5tw.jpg",
    },
    {
      pageNumber: 4,
      imageUrl: "https://res.cloudinary.com/dz3sfyapj/image/upload/v1765980427/flipwhizz/style-samples/89cc41ea-184b-48ba-a0ea-5c82c842eb42/sfdsrm0ka0urttf7k5tw.jpg",
    },
    // keep going until 30 pages
  ];

  await exportInteriorPDF(pages, "interior-test.pdf");

  console.log("✅ Interior PDF generated");
}

run().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
