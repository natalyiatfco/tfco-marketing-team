import type { Property } from "@workspace/db";

function formatOpenedAt(openedAt: Date | string | null | undefined): string | null {
  if (!openedAt) return null;
  const date = new Date(openedAt);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function buildIdentitySection(property: Property): string {
  const lines: string[] = [
    `You are working on: ${property.name}${property.propertyType ? ` — ${property.propertyType}` : ""}`,
  ];

  if (property.fullAddress) {
    lines.push(`Located at: ${property.fullAddress}`);
  } else if (property.location) {
    lines.push(`Location: ${property.location}`);
  }

  const opened = formatOpenedAt(property.openedAt);
  if (opened) lines.push(`Opened: ${opened}`);

  return `== Property Identity ==\n${lines.join("\n")}`;
}

export function buildBrandContext(property: Property, options: { includeWebsiteUrl?: boolean } = {}): string {
  const identitySection = buildIdentitySection(property);

  const brandLines = [
    property.description ? `Description: ${property.description}` : null,
    property.brandVoice ? `Brand Voice: ${property.brandVoice}` : null,
    property.tone ? `Tone: ${property.tone}` : null,
    property.targetAudience ? `Target Audience: ${property.targetAudience}` : null,
    property.primaryKeywords ? `Primary Keywords: ${property.primaryKeywords}` : null,
    options.includeWebsiteUrl && property.websiteUrl ? `Website: ${property.websiteUrl}` : null,
  ].filter(Boolean).join("\n");

  return [identitySection, brandLines].filter(Boolean).join("\n\n");
}
