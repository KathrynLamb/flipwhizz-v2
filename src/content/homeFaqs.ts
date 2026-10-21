// src/content/homeFaqs.ts
// Homepage FAQ. The visible FAQ and the FAQPage JSON-LD both read from this,
// so they always match word for word.

export type Faq = { question: string; answer: string };

export const HOME_FAQS: Faq[] = [
  { question: "How much can I rewrite?", answer: "You can ask for small changes or a rewrite across the whole story: change the tone, language, ending, characters or plot. Discuss what you want in the editing chat, then apply the changes. Review your text before final illustrations and printing; changing the words later can mean updating the pictures too." },
  { question: "Can I make a series with the same characters?", answer: "Yes. Start another book from a saved world in your library. FlipWhizz brings recurring characters, locations and previous story context into the next adventure. Each book is a separate project with its own edition purchase." },
  { question: "What can I personalise beyond the story?", answer: "Character appearances and outfits, locations and the illustration style. Start from descriptions or upload reference photos, then review the looks. You can also upload a style reference and refine the visual direction before the book is illustrated." },
  { question: "Can I make a colouring storybook?", answer: "Yes. Choose the colouring format for an original story with outline illustrations to colour in and a full-colour cover. A digital edition can be printed at home; available printed formats and prices are shown on this page." },
  { question: "Does the story have to be about my child?", answer: "No. Your story can be about your grandparents, two snails in the garden, an imaginary world, or anything else you want to explore. You choose the subject, characters and who you are writing for." },
  {
    question: "What ages is it for?",
    answer:
      "Children from about 2 to 10. Tell us their age and the story, words and pictures are pitched to suit them, from gentle rhymes for toddlers to proper adventures for older children.",
  },
  {
    question: "How long does printing and delivery take?",
    answer:
      "Printed books are made to order by our print partner and posted to your door. You'll see the delivery estimate when you order and can follow your book's progress in your library. If you need it by a date, order early or choose the digital book, which is ready to download straight away.",
  },
  {
    question: "Can I use photos, and what happens to them?",
    answer:
      "Yes. Upload a photo and we'll use it to draw your characters so they look like your family, pets included. Your photos are only used to make your book.",
  },
  {
    question: "Do I need to be good at writing?",
    answer:
      "Not at all. You just chat: tell us who it's for, a memory, a joke, something they love. We help you shape it into a story and you can change any word you like before it's finished.",
  },
  {
    question: "Can I give it as a gift if I'm not the parent?",
    answer:
      "Yes, it makes a lovely gift from a grandparent, aunt, uncle or godparent. You don't need to know every detail, a name, an age and a couple of things they love is enough. The hardcover gift edition adds a personal dedication page.",
  },
  {
    question: "Is it made by AI?",
    answer:
      "AI helps with the illustrations and with polishing the words, but you are the author. The people, memories and ideas come from you, and you see and approve every page before anything is printed. AI never talks to your child. It helps the adult who loves them.",
  },
  {
    question: "Who owns the story?",
    answer:
      "Your names, ideas and photos stay yours. The finished book is yours to keep, read, share with family and give as a gift forever. The only thing you can't do is sell it.",
  },
];
