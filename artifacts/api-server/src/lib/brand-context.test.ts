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
    location: null,
    fullAddress: null,
    openedAt: null,
    propertyType: null,
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Property;
}

describe("buildBrandContext", () => {
  describe("property identity section", () => {
    it("includes the identity section header", () => {
      const result = buildBrandContext(makeProperty({ name: "Test Brand" }));
      expect(result).toContain("== Property Identity ==");
    });

    it("includes the property name in the identity line", () => {
      const result = buildBrandContext(makeProperty({ name: "Test Brand" }));
      expect(result).toContain("You are working on: Test Brand");
    });

    it("appends propertyType to the identity line when present", () => {
      const result = buildBrandContext(makeProperty({ name: "Grand Terrace", propertyType: "Restaurant" }));
      expect(result).toContain("You are working on: Grand Terrace — Restaurant");
    });

    it("omits the type separator when propertyType is null", () => {
      const result = buildBrandContext(makeProperty({ name: "Solo" }));
      expect(result).toContain("You are working on: Solo");
      expect(result).not.toContain("—");
    });

    it("includes fullAddress as 'Located at' when present", () => {
      const result = buildBrandContext(makeProperty({ fullAddress: "14833 York Rd, Sparks Glencoe, MD 21152" }));
      expect(result).toContain("Located at: 14833 York Rd, Sparks Glencoe, MD 21152");
    });

    it("falls back to location when fullAddress is null", () => {
      const result = buildBrandContext(makeProperty({ fullAddress: null, location: "Sparks, Baltimore County, MD" }));
      expect(result).toContain("Location: Sparks, Baltimore County, MD");
      expect(result).not.toContain("Located at:");
    });

    it("omits address lines when both fullAddress and location are null", () => {
      const result = buildBrandContext(makeProperty({ fullAddress: null, location: null }));
      expect(result).not.toContain("Located at:");
      expect(result).not.toContain("Location:");
    });

    it("prefers fullAddress over location when both are set", () => {
      const result = buildBrandContext(makeProperty({
        fullAddress: "14833 York Rd, Sparks Glencoe, MD 21152",
        location: "Sparks, Baltimore County, MD",
      }));
      expect(result).toContain("Located at: 14833 York Rd, Sparks Glencoe, MD 21152");
      expect(result).not.toContain("Location:");
    });

    it("includes a human-readable Opened date when openedAt is set", () => {
      const result = buildBrandContext(makeProperty({ openedAt: new Date("2021-07-15") }));
      expect(result).toContain("Opened:");
      expect(result).toContain("2021");
    });

    it("omits Opened line when openedAt is null", () => {
      const result = buildBrandContext(makeProperty({ openedAt: null }));
      expect(result).not.toContain("Opened:");
    });
  });

  describe("brand guidelines section", () => {
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
  });

  describe("overall structure", () => {
    it("identity section appears before brand guidelines", () => {
      const property = makeProperty({ name: "Ordered Brand", description: "Some desc" });
      const result = buildBrandContext(property);
      const identityIdx = result.indexOf("== Property Identity ==");
      const descIdx = result.indexOf("Description: Some desc");
      expect(identityIdx).toBeLessThan(descIdx);
    });

    it("identity and brand sections are separated by a blank line", () => {
      const property = makeProperty({ name: "Gap Brand", description: "Desc" });
      const result = buildBrandContext(property);
      expect(result).toContain("\n\n");
    });

    it("returns only the identity section when all brand fields are null", () => {
      const result = buildBrandContext(makeProperty({ name: "Solo Brand" }));
      expect(result.startsWith("== Property Identity ==")).toBe(true);
      expect(result).toContain("You are working on: Solo Brand");
      expect(result).not.toContain("Description:");
    });
  });
});
