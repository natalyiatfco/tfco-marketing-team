import { describe, it, expect } from "vitest";
import { buildBrandContext } from "./brand-context";
import type { Property } from "@workspace/db";

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 1,
    name: "Acme Corp",
    description: null,
    brandVoice: null,
    tone: null,
    targetAudience: null,
    primaryKeywords: null,
    websiteUrl: null,
    googleAdsCustomerId: null,
    googleAdsRefreshToken: null,
    metaAdsAccountId: null,
    metaAdsAccessToken: null,
    hubspotApiKey: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Property;
}

describe("buildBrandContext", () => {
  it("includes the property name on the first line", () => {
    const result = buildBrandContext(makeProperty({ name: "Test Brand" }));
    expect(result).toContain("Brand/Property: Test Brand");
  });

  it("includes all optional fields when present", () => {
    const property = makeProperty({
      name: "Full Brand",
      description: "A full-featured brand",
      brandVoice: "Professional",
      tone: "Friendly",
      targetAudience: "Small business owners",
      primaryKeywords: "marketing, growth",
    });
    const result = buildBrandContext(property);

    expect(result).toContain("Description: A full-featured brand");
    expect(result).toContain("Brand Voice: Professional");
    expect(result).toContain("Tone: Friendly");
    expect(result).toContain("Target Audience: Small business owners");
    expect(result).toContain("Primary Keywords: marketing, growth");
  });

  it("omits null optional fields", () => {
    const result = buildBrandContext(makeProperty({ name: "Minimal Brand" }));

    expect(result).not.toContain("Description:");
    expect(result).not.toContain("Brand Voice:");
    expect(result).not.toContain("Tone:");
    expect(result).not.toContain("Target Audience:");
    expect(result).not.toContain("Primary Keywords:");
    expect(result).not.toContain("Website:");
  });

  it("does not include website URL by default", () => {
    const property = makeProperty({ websiteUrl: "https://acme.com" });
    const result = buildBrandContext(property);
    expect(result).not.toContain("Website:");
  });

  it("includes website URL when includeWebsiteUrl is true", () => {
    const property = makeProperty({ websiteUrl: "https://acme.com" });
    const result = buildBrandContext(property, { includeWebsiteUrl: true });
    expect(result).toContain("Website: https://acme.com");
  });

  it("does not include Website line when includeWebsiteUrl is true but websiteUrl is null", () => {
    const property = makeProperty({ websiteUrl: null });
    const result = buildBrandContext(property, { includeWebsiteUrl: true });
    expect(result).not.toContain("Website:");
  });

  it("joins fields with newlines", () => {
    const property = makeProperty({
      name: "Brand",
      description: "Desc",
    });
    const result = buildBrandContext(property);
    const lines = result.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe("Brand/Property: Brand");
    expect(lines[1]).toBe("Description: Desc");
  });

  it("returns only the brand/property line when all optional fields are null", () => {
    const result = buildBrandContext(makeProperty({ name: "Solo Brand" }));
    expect(result).toBe("Brand/Property: Solo Brand");
  });
});
