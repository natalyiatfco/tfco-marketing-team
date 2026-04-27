const OUTPUT_FORMAT_REMINDERS: Record<string, string> = {
  paid_specialist: `Your output MUST use these exact section delimiters:
===GOOGLE ADS CAMPAIGN===
...
===END GOOGLE ADS===
===META ADS CAMPAIGN===
...
===END META ADS===`,
  social_media_specialist: `Your output MUST use these exact section delimiters:
===INSTAGRAM===...===END INSTAGRAM===
===FACEBOOK===...===END FACEBOOK===
===TWITTER/X===...===END TWITTER===
===LINKEDIN===...===END LINKEDIN===`,
};

export function buildSystemPrompt(
  basePrompt: string,
  memoryContext: string,
  agentRole?: string,
): string {
  const parts: string[] = [basePrompt];

  if (memoryContext.trim()) {
    parts.push(`## Memory & Context\n\n${memoryContext}`);
  }

  const formatReminder = agentRole ? OUTPUT_FORMAT_REMINDERS[agentRole] : undefined;
  if (formatReminder) {
    parts.push(`## Output Format Reminder\n\n${formatReminder}`);
  }

  return parts.join("\n\n");
}
