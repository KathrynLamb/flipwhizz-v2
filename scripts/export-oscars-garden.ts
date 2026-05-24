import { exportInteriorPDF } from "../print/gelato/exportInteriorPDF";

type PrintPage = {
  pageNumber: number;
  spreadImageUrl: string;
  side: "left" | "right";
};

const spreads = [
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188618/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/a5gyytsjeoremkoyqj6w.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188584/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/serec3tauvmvqsc2iydr.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188622/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/yaa3szjzltyca56yzsmd.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188649/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/o642gflurxfxlusqalwh.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188683/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/ejyliglvnfhkamudz8jz.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188621/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/q8nyiwkvrvey8vef5srp.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188614/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/qwu2oxamsbomr9gyfpeg.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188646/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/dotd3rar2pdprodv88s8.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188583/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/zu1bd46yje4pyrc3bpvo.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188658/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/uzarvgrpkj0xmwfx0wrt.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188576/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/c4op3j2hye4zsljirol6.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188585/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/gqlel82idn6z85qfes0p.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188693/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/z2onjtdhkq0royurgs2d.jpg",
  "https://res.cloudinary.com/dz3sfyapj/image/upload/v1778188673/flipwhizz/stories/f326e97b-6401-4ed3-8fdd-280087691332/spreads/r3mlxya5sumz7vhguav2.jpg",
];

const pages: PrintPage[] = spreads.flatMap((url, i) => [
  { pageNumber: i * 2 + 1, spreadImageUrl: url, side: "left" },
  { pageNumber: i * 2 + 2, spreadImageUrl: url, side: "right" },
]);

async function run() {
  await exportInteriorPDF(pages, "oscars-color-mixing-garden-interior.pdf");
  console.log("✅ Oscar's Color-Mixing Garden PDF generated");
}

run().catch((err) => {
  console.error("❌ Export failed:", err);
  process.exit(1);
});
