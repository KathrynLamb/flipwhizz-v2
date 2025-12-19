import { exportCoverPDF } from "../print/gelato/exportCoverPDF";

async function run() {
  await exportCoverPDF({
    title: "The Brave Little Fox",
    author: "Made with FlipWhizz",
    backgroundImageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    spineText: "The Brave Little Fox",
    outputPath: "cover-test-rgb.pdf"
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
