type PrintPage = {
  pageNumber: number;
  spreadImageUrl: string;
  side: "left" | "right";
};

export function renderInteriorHTML(pages: PrintPage[]) {
  console.log("🎨 Rendering HTML for pages:", pages.map(p => ({
    pageNumber: p.pageNumber,
    side: p.side,
    imageUrl: p.spreadImageUrl.substring(0, 60) + '...'
  })));

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    @page {
      size: 11in 11in;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
    }

    .page {
      width: 11in;
      height: 11in;
      page-break-after: always;
      position: relative;
      overflow: hidden;
      border: 2px solid red; /* DEBUG: See page boundaries */
    }

    .page img {
      position: absolute;
      width: 22in;  /* Double width for spread */
      height: 11in;
      object-fit: cover;
    }

    .page.left img {
      left: 0;
      object-position: left center;
    }

    .page.right img {
      right: 0;
      object-position: right center;
    }

    /* DEBUG: Show which side */
    .page::before {
      content: attr(data-side);
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255,0,0,0.8);
      color: white;
      padding: 5px 10px;
      z-index: 999;
      font-size: 20px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  ${pages
    .map(
      (p) => `
    <div class="page ${p.side}" data-side="${p.side.toUpperCase()} - Page ${p.pageNumber}">
      <img src="${p.spreadImageUrl}" alt="Page ${p.pageNumber}" />
    </div>
  `
    )
    .join("")}
</body>
</html>
`;
}