import { GELATO_HARDCOVER_20x20_30P as spec } from "./coverSpec";

type CoverInput = {
  title: string;
  author?: string;
  backgroundImageUrl: string;
  spineText?: string;
};

export function renderCoverHTML(data: CoverInput): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {
      size: ${spec.pdf.widthMm}mm ${spec.pdf.heightMm}mm;
      margin: 0;
    }

    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: white;
    }

    /* === FULL PAGE (TRIM + BLEED) === */
    .cover {
      position: relative;
      width: ${spec.pdf.widthMm}mm;
      height: ${spec.pdf.heightMm}mm;
      overflow: hidden;
      font-family: "Georgia", serif;
    }

    /* === BLEED BACKGROUND === */
    .bg {
      position: absolute;
      top: -${spec.bleedMm}mm;
      left: -${spec.bleedMm}mm;
      width: calc(100% + ${spec.bleedMm * 2}mm);
      height: calc(100% + ${spec.bleedMm * 2}mm);
      object-fit: cover;
      z-index: 0;
    }

    /* === BACK COVER (TRIM ZONE) === */
    .back {
      position: absolute;
      left: ${spec.zones.back.trim.x}mm;
      top: ${spec.zones.back.trim.y}mm;
      width: ${spec.zones.back.trim.w}mm;
      height: ${spec.zones.back.trim.h}mm;
      padding: 10mm;
      z-index: 1;
    }

    /* === SPINE (TRIM ZONE) === */
    .spine {
      position: absolute;
      left: ${spec.zones.spine.trim.x}mm;
      top: ${spec.zones.spine.trim.y}mm;
      width: ${spec.zones.spine.trim.w}mm;
      height: ${spec.zones.spine.trim.h}mm;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }

    .spine-text {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-size: 6pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    /* === FRONT COVER (TRIM ZONE) === */
    .front {
      position: absolute;
      left: ${spec.zones.front.trim.x}mm;
      top: ${spec.zones.front.trim.y}mm;
      width: ${spec.zones.front.trim.w}mm;
      height: ${spec.zones.front.trim.h}mm;
      padding: 15mm 10mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      text-align: center;
      z-index: 1;
    }

    .title {
      font-size: 28pt;
      margin: 0;
    }

    .author {
      margin-top: 6mm;
      font-size: 14pt;
    }

    /* === OPTIONAL DEBUG (REMOVE FOR PROD) === */
    /*
    .back { outline: 2px solid red; }
    .spine { outline: 2px solid yellow; }
    .front { outline: 2px solid blue; }
    */
  </style>
</head>

<body>
  <div class="cover">
    <img class="bg" src="${data.backgroundImageUrl}" />

    <div class="back"></div>

    <div class="spine">
      ${data.spineText ? `<span class="spine-text">${data.spineText}</span>` : ""}
    </div>

    <div class="front">
      <h1 class="title">${data.title}</h1>
      ${data.author ? `<p class="author">${data.author}</p>` : ""}
    </div>
  </div>
</body>
</html>
`;
}
