
// print/gelato/renderCoverSpreadHTML.ts (Helper)
type CoverSpreadData = {
frontCoverUrl: string;
backCoverUrl: string;
title: string;
};

export function renderCoverSpreadHTML(data: CoverSpreadData): string {
return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
* {
margin: 0;
padding: 0;
box-sizing: border-box;
}

@page {
size: 426mm 206mm; /* Landscape spread */
margin: 0;
}

body {
width: 426mm;
height: 206mm;
margin: 0;
padding: 0;
display: flex;
}

.back-cover {
width: 206mm;
height: 206mm;
background-size: cover;
background-position: center;
background-image: url('${data.backCoverUrl}');
}

.spine {
width: 14mm;
height: 206mm;
background: white;
display: flex;
align-items: center;
justify-content: center;
}

.front-cover {
width: 206mm;
height: 206mm;
background-size: cover;
background-position: center;
background-image: url('${data.frontCoverUrl}');
}
</style>
</head>
<body>
<div class="back-cover"></div>
<div class="spine"></div>
<div class="front-cover"></div>
</body>
</html>
`.trim();
}