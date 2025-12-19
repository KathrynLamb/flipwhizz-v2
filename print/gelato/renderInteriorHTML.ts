type InteriorPage = {
    pageNumber: number
    imageUrl: string
  }
  
  export function renderInteriorHTML(pages: InteriorPage[]) {
    let html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page {
        size: 206mm 206mm;
        margin: 0;
      }
  
      body {
        margin: 0;
        padding: 0;
        background: white;
      }
  
      .page {
        position: relative;
        width: 206mm;
        height: 206mm;
        overflow: hidden;
        page-break-after: always;
      }
  
      .page img {
        position: absolute;
        top: 0;
        left: 0;
        width: 200%;
        height: 100%;
        object-fit: cover;
      }
  
      .left img {
        transform: translateX(0);
      }
  
      .right img {
        transform: translateX(-50%);
      }
    </style>
  </head>
  <body>
  `;
  
    for (let i = 0; i < pages.length; i += 2) {
      const left = pages[i];
      const right = pages[i + 1];
  
      if (!left) continue;
  
      html += `
  <div class="page left">
    <img src="${left.imageUrl}" />
  </div>
  `;
  
      if (right) {
        html += `
  <div class="page right">
    <img src="${right.imageUrl}" />
  </div>
  `;
      }
    }
  
    html += `
  </body>
  </html>
  `;
  
    return html;
  }
  