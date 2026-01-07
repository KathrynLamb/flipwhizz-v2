function buildAuthorLetterMessage({
    title,
    pages,
    chatHistory,
  }: {
    title: string;
    pages: Array<{ page: number; text: string }>;
    chatHistory: Array<{ role: string; content: string }>;
  }) {
    const conversation = chatHistory
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");
  
    const storyText = pages
      .map((p) => `Page ${p.page}: ${p.text}`)
      .join("\n\n");
  
    return `
  Here is the full background conversation that led to this story:
  
  ${conversation}
  
  Here is the first draft of the story:
  
  Title: ${title}
  
  ${storyText}
  
  Please write your author’s letter now.
  `;
  }
  