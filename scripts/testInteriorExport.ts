import { exportInteriorPDF } from "../print/gelato/exportInteriorPDF";

type PrintPage = {
  pageNumber: number;
  spreadImageUrl: string;
  side: "left" | "right";
};

async function run() {
  const pages: PrintPage[] = [
    {
      pageNumber: 1,
      spreadImageUrl:
        "https://res.cloudinary.com/.../spread1.jpg",
      side: "left",
    },
    {
      pageNumber: 2,
      spreadImageUrl:
        "https://res.cloudinary.com/.../spread1.jpg",
      side: "right",
    },
    {
      pageNumber: 3,
      spreadImageUrl:
        "https://res.cloudinary.com/.../spread2.jpg",
      side: "left",
    },
    {
      pageNumber: 4,
      spreadImageUrl:
        "https://res.cloudinary.com/.../spread2.jpg",
      side: "right",
    },
  ];

  await exportInteriorPDF(pages, "interior-test.pdf");

  console.log("✅ Interior PDF generated");
}

run().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
