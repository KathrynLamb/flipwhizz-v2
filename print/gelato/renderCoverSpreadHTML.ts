// print/gelato/renderCoverSpreadHTML.ts

type CoverSpreadData = {
    coverSpreadUrl: string;
    widthMm: number;
    heightMm: number;
  };
  
  export function renderCoverSpreadHTML(data: CoverSpreadData): string {
    return `
  <!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
  
    @page {
      size: ${data.widthMm}mm ${data.heightMm}mm;
      margin: 0;
    }
  
    body {
      width: ${data.widthMm}mm;
      height: ${data.heightMm}mm;
    }
  
    .cover {
      width: 100%;
      height: 100%;
    }
  
    .cover img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  </style>
  </head>
  <body>
    <div class="cover">
      <img src="${data.coverSpreadUrl}" />
    </div>
  </body>
  </html>
  `.trim();
  }
  