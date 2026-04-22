import type { Property } from "@workspace/db";

export function buildBrandContext(property: Property, options: { includeWebsiteUrl?: boolean } = {}): string {
  return [
    `Brand/Property: ${property.name}`,
    property.description ? `Description: ${property.description}` : null,
    property.brandVoice ? `Brand Voice: ${property.brandVoice}` : null,
    property.tone ? `Tone: ${property.tone}` : null,
    property.targetAudience ? `Target Audience: ${property.targetAudience}` : null,
    property.primaryKeywords ? `Primary Keywords: ${property.primaryKeywords}` : null,
    options.includeWebsiteUrl && property.websiteUrl ? `Website: ${property.websiteUrl}` : null,
  ].filter(Boolean).join("\n");
}
