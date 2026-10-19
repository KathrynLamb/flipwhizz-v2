// src/content/homeBooks.ts
// Real FlipWhizz books shown on the homepage. Only add a book here once the
// family has agreed to it being shown publicly.

export type HomeBook = { src: string; title: string; alt: string; caption?: string };

export const BOOKS = {
  samDog: {
    src: "/LandingPage/books/sam-dog.webp",
    title: "Sam and the Big Digger Dog",
    alt: "a watercolour spread of a boy riding his big scruffy dog across his bedroom",
    caption: "Soft watercolour, for a boy and his big daft dog",
  },
  samDigger: {
    src: "/LandingPage/books/sam-digger.webp",
    title: "Sam and the Big Digger Dog",
    alt: "a boy in a sandpit full of toy diggers outside his school, his dog shaking off sand",
  },
  ella: {
    src: "/LandingPage/books/ella.webp",
    title: "Ella and the Big Sister Sparkle",
    alt: "a pastel spread of a little girl holding her bunny beside a glowing unicorn",
    caption: "Dreamy pastels, for a big sister who loves unicorns",
  },
  ski: {
    src: "/LandingPage/books/ski.webp",
    title: "Sophia's Spectacular Ski Trip",
    alt: "a bright cartoon spread of a girl cannonballing into a hot tub on a ski trip",
    caption: "Bold and bright, for a family ski trip",
  },
  tabitha: {
    src: "/LandingPage/books/tabitha.webp",
    title: "Tabitha's Tiny Moon",
    alt: "a soft watercolour spread of an older woman and a grey cat under a crescent moon",
    caption: "Gentle and grown-up, for a story about missing someone",
  },
  colouring: {
    src: "/LandingPage/books/colouring.webp",
    title: "Sophia, Who You Gonna Call?",
    alt: "a black and white line-art spread of a child and a friendly ghost, ready to colour in",
    caption: "A colouring edition, ready for their pencils",
  },
} satisfies Record<string, HomeBook>;

export const HERO_BOOKS: HomeBook[] = [BOOKS.samDog, BOOKS.ella, BOOKS.ski, BOOKS.tabitha];

export const SHELF_BOOKS: HomeBook[] = [BOOKS.samDog, BOOKS.ella, BOOKS.ski, BOOKS.tabitha, BOOKS.colouring];
