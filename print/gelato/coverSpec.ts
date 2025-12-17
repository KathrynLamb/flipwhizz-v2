// Canonical print spec for:
// Gelato Hardcover Photo Book
// Size: 20x20 cm
// Pages: 30
// Bleed: 3mm

export const GELATO_HARDCOVER_20x20_30P = {
    product: "gelato-hardcover-20x20",
    pages: 30,
  
    pdf: {
      widthMm: 413,
      heightMm: 206
    },
  
    bleedMm: 3,
  
    trim: {
      widthMm: 200,
      heightMm: 200
    },
  
    spine: {
      widthMm: 7
    },
  
    zones: {
      back: {
        trim: { x: 3, y: 3, w: 200, h: 200 },
        safe: { x: 13, y: 13, w: 175, h: 180 }
      },
  
      spine: {
        trim: { x: 203, y: 3, w: 7, h: 200 },
        safe: { x: 204, y: 23, w: 5, h: 160 }
      },
  
      front: {
        trim: { x: 210, y: 3, w: 200, h: 200 },
        safe: { x: 225, y: 13, w: 175, h: 180 }
      }
    }
  } as const;
  