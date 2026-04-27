export function buildSystemPrompt(basePrompt: string, memoryContext: string): string {
  if (!memoryContext.trim()) return basePrompt;
  return `${basePrompt}\n\n## Memory & Context\n\n${memoryContext}`;
}
