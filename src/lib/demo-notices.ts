// UI notices are not part of the story conversation.
export function isDemoNotice(message: { role: string; content: string }): boolean {
  return message.role === "assistant" && [
    "You’ve used the free messages for this demo. Your story idea is saved here—continue below to sign in and keep creating your book.",
    "I hit a little bump there. Please try again, or continue when you're ready.",
  ].includes(message.content.trim());
}
