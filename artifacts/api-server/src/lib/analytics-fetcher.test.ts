import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("./crypto", () => ({
  safeDecrypt: vi.fn((v: string) => v),
}));

import { safeDecrypt } from "./crypto";
import { fetchAnalyticsData, formatAnalyticsDataForPrompt } from "./analytics-fetcher";
import type { AnalyticsData } from "./analytics-fetcher";
import type { Property } from "@workspace/db";

const mockSafeDecrypt = safeDecrypt as ReturnType<typeof vi.fn>;

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 1,
    name: "Test Property",
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

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(""),
    status: 200,
  });
}

function mockFetchFail(status = 500, text = "error") {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(text),
    status,
  });
}

beforeEach(() => {
  mockSafeDecrypt.mockImplementation((v: string) => v);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchAnalyticsData", () => {
  describe("when no credentials are set on property", () => {
    it("returns googleAds as unavailable", async () => {
      const property = makeProperty();
      vi.stubGlobal("fetch", mockFetchOk({}));
      const result = await fetchAnalyticsData(property);
      expect(result.googleAds.available).toBe(false);
    });

    it("returns metaAds as unavailable", async () => {
      const property = makeProperty();
      vi.stubGlobal("fetch", mockFetchOk({}));
      const result = await fetchAnalyticsData(property);
      expect(result.metaAds.available).toBe(false);
    });

    it("returns hubspot as unavailable", async () => {
      const property = makeProperty();
      vi.stubGlobal("fetch", mockFetchOk({}));
      const result = await fetchAnalyticsData(property);
      expect(result.hubspot.available).toBe(false);
    });

    it("includes property id and name", async () => {
      const property = makeProperty({ id: 5, name: "My Brand" });
      vi.stubGlobal("fetch", mockFetchOk({}));
      const result = await fetchAnalyticsData(property);
      expect(result.property).toEqual({ id: 5, name: "My Brand" });
    });
  });

  describe("dateRange label", () => {
    beforeEach(() => {
      vi.stubGlobal("fetch", mockFetchOk({}));
    });

    it("defaults to Last 30 Days", async () => {
      const result = await fetchAnalyticsData(makeProperty());
      expect(result.dateRange.label).toBe("Last 30 Days");
    });

    it("returns Last 7 Days for '7days'", async () => {
      const result = await fetchAnalyticsData(makeProperty(), "7days");
      expect(result.dateRange.label).toBe("Last 7 Days");
    });

    it("returns Last 90 Days for '90days'", async () => {
      const result = await fetchAnalyticsData(makeProperty(), "90days");
      expect(result.dateRange.label).toBe("Last 90 Days");
    });

    it("sets from date earlier than to date", async () => {
      const result = await fetchAnalyticsData(makeProperty());
      expect(new Date(result.dateRange.from) < new Date(result.dateRange.to)).toBe(true);
    });
  });

  describe("Google Ads", () => {
    it("returns unavailable when env vars are not configured", async () => {
      const property = makeProperty({
        googleAdsCustomerId: "123-456-7890",
        googleAdsRefreshToken: "refresh_token",
      });
      delete process.env.GOOGLE_ADS_CLIENT_ID;
      delete process.env.GOOGLE_ADS_CLIENT_SECRET;
      delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

      vi.stubGlobal("fetch", mockFetchOk({}));

      const result = await fetchAnalyticsData(property);
      expect(result.googleAds.available).toBe(false);
    });

    it("returns error payload when token refresh fails", async () => {
      const property = makeProperty({
        googleAdsCustomerId: "123-456-7890",
        googleAdsRefreshToken: "refresh_token",
      });
      process.env.GOOGLE_ADS_CLIENT_ID = "client_id";
      process.env.GOOGLE_ADS_CLIENT_SECRET = "client_secret";
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev_token";

      vi.stubGlobal("fetch", mockFetchFail(401, "Unauthorized"));

      const result = await fetchAnalyticsData(property);
      expect(result.googleAds.available).toBe(true);
      expect(result.googleAds.error).toBeDefined();

      delete process.env.GOOGLE_ADS_CLIENT_ID;
      delete process.env.GOOGLE_ADS_CLIENT_SECRET;
      delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    });

    it("maps campaign rows from successful API response", async () => {
      const property = makeProperty({
        googleAdsCustomerId: "123-456-7890",
        googleAdsRefreshToken: "refresh_token",
      });
      process.env.GOOGLE_ADS_CLIENT_ID = "client_id";
      process.env.GOOGLE_ADS_CLIENT_SECRET = "client_secret";
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "dev_token";

      const tokenResponse = { ok: true, json: vi.fn().mockResolvedValue({ access_token: "tok" }), text: vi.fn(), status: 200 };
      const adsResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            results: [
              {
                campaign: { id: "c1", name: "Summer Sale" },
                metrics: { impressions: "1000", clicks: "50", cost_micros: "5000000" },
              },
            ],
          },
        ]),
        text: vi.fn(),
        status: 200,
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(tokenResponse).mockResolvedValueOnce(adsResponse));

      const result = await fetchAnalyticsData(property);
      expect(result.googleAds.available).toBe(true);
      expect(result.googleAds.campaigns).toHaveLength(1);
      expect(result.googleAds.campaigns![0]).toMatchObject({
        campaignId: "c1",
        campaignName: "Summer Sale",
        impressions: 1000,
        clicks: 50,
        spend: 5,
        ctr: 5,
      });
      expect(result.googleAds.totals).toMatchObject({ impressions: 1000, clicks: 50, spend: 5, ctr: 5 });

      delete process.env.GOOGLE_ADS_CLIENT_ID;
      delete process.env.GOOGLE_ADS_CLIENT_SECRET;
      delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    });
  });

  describe("Meta Ads", () => {
    it("returns error payload when API call fails", async () => {
      const property = makeProperty({
        metaAdsAccountId: "act_123",
        metaAdsAccessToken: "meta_token",
      });

      vi.stubGlobal("fetch", mockFetchFail(403, "Forbidden"));

      const result = await fetchAnalyticsData(property);
      expect(result.metaAds.available).toBe(true);
      expect(result.metaAds.error).toBeDefined();
    });

    it("maps campaign rows from successful Meta API response", async () => {
      const property = makeProperty({
        metaAdsAccountId: "act_123",
        metaAdsAccessToken: "meta_token",
      });

      const metaResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            { campaign_name: "Holiday Push", impressions: "2000", clicks: "100", spend: "50.00" },
          ],
        }),
        text: vi.fn(),
        status: 200,
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(metaResponse));

      const result = await fetchAnalyticsData(property);
      expect(result.metaAds.available).toBe(true);
      expect(result.metaAds.campaigns).toHaveLength(1);
      expect(result.metaAds.campaigns![0]).toMatchObject({
        campaignName: "Holiday Push",
        impressions: 2000,
        clicks: 100,
        spend: 50,
        ctr: 5,
      });
    });
  });

  describe("HubSpot", () => {
    it("returns error payload when contacts API fails", async () => {
      const property = makeProperty({ hubspotApiKey: "hb_key" });

      vi.stubGlobal("fetch", mockFetchFail(401, "Unauthorized"));

      const result = await fetchAnalyticsData(property);
      expect(result.hubspot.available).toBe(true);
      expect(result.hubspot.error).toBeDefined();
    });

    it("returns contacts and deals data on success", async () => {
      const property = makeProperty({ hubspotApiKey: "hb_key" });

      const contactsTotal = { ok: true, json: vi.fn().mockResolvedValue({ total: 500 }), text: vi.fn(), status: 200 };
      const contactsNew = { ok: true, json: vi.fn().mockResolvedValue({ total: 25 }), text: vi.fn(), status: 200 };
      const dealsPage = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          results: [
            { properties: { amount: "1000", dealstage: "closedwon" } },
            { properties: { amount: "500", dealstage: "proposal" } },
          ],
          total: 2,
          paging: null,
        }),
        text: vi.fn(),
        status: 200,
      };
      const emailsRes = { ok: false, json: vi.fn(), text: vi.fn(), status: 403 };

      vi.stubGlobal(
        "fetch",
        vi.fn()
          .mockResolvedValueOnce(contactsTotal)
          .mockResolvedValueOnce(contactsNew)
          .mockResolvedValueOnce(dealsPage)
          .mockResolvedValueOnce(emailsRes)
      );

      const result = await fetchAnalyticsData(property);
      expect(result.hubspot.available).toBe(true);
      expect(result.hubspot.contacts).toEqual({ total: 500, newInPeriod: 25 });
      expect(result.hubspot.deals?.total).toBe(2);
      expect(result.hubspot.deals?.totalValue).toBe(1500);
      expect(result.hubspot.deals?.byStage).toMatchObject({ closedwon: 1, proposal: 1 });
    });
  });
});

describe("formatAnalyticsDataForPrompt", () => {
  function makeAnalyticsData(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
    return {
      property: { id: 1, name: "Test Brand" },
      dateRange: { from: "2025-03-01", to: "2025-03-31", label: "Last 30 Days" },
      googleAds: { available: false },
      metaAds: { available: false },
      hubspot: { available: false },
      ...overrides,
    };
  }

  it("includes the property name and date range label in the header", () => {
    const result = formatAnalyticsDataForPrompt(makeAnalyticsData());
    expect(result).toContain("Test Brand");
    expect(result).toContain("Last 30 Days");
  });

  it("shows 'Not connected' for unavailable platforms", () => {
    const result = formatAnalyticsDataForPrompt(makeAnalyticsData());
    expect(result).toContain("Google Ads: Not connected");
    expect(result).toContain("Meta Ads: Not connected");
    expect(result).toContain("HubSpot: Not connected");
  });

  it("shows 'Connected but no data returned' when available but no totals", () => {
    const result = formatAnalyticsDataForPrompt(
      makeAnalyticsData({
        googleAds: { available: true },
        metaAds: { available: true },
        hubspot: { available: true },
      })
    );
    expect(result).toContain("Google Ads: Connected but no data returned");
    expect(result).toContain("Meta Ads: Connected but no data returned");
    expect(result).toContain("HubSpot: Connected but no data returned");
  });

  it("shows Google Ads metrics when available with totals", () => {
    const result = formatAnalyticsDataForPrompt(
      makeAnalyticsData({
        googleAds: {
          available: true,
          totals: { impressions: 10000, clicks: 500, spend: 250, ctr: 5 },
          campaigns: [],
        },
      })
    );
    expect(result).toContain("Impressions: 10,000");
    expect(result).toContain("Clicks: 500");
    expect(result).toContain("Spend: $250");
    expect(result).toContain("CTR: 5%");
  });

  it("shows Meta Ads metrics when available with totals", () => {
    const result = formatAnalyticsDataForPrompt(
      makeAnalyticsData({
        metaAds: {
          available: true,
          totals: { impressions: 5000, clicks: 200, spend: 100, ctr: 4 },
          campaigns: [],
        },
      })
    );
    expect(result).toContain("Impressions: 5,000");
    expect(result).toContain("Clicks: 200");
    expect(result).toContain("Spend: $100");
    expect(result).toContain("CTR: 4%");
  });

  it("shows top campaigns for Google Ads (max 5)", () => {
    const campaigns = Array.from({ length: 7 }, (_, i) => ({
      campaignId: String(i),
      campaignName: `Campaign ${i}`,
      impressions: 1000 - i * 100,
      clicks: 50,
      spend: 25,
      ctr: 5,
    }));
    const result = formatAnalyticsDataForPrompt(
      makeAnalyticsData({
        googleAds: {
          available: true,
          totals: { impressions: 7000, clicks: 350, spend: 175, ctr: 5 },
          campaigns,
        },
      })
    );
    expect(result).toContain("Campaign 0");
    expect(result).toContain("Campaign 4");
    expect(result).not.toContain("Campaign 5");
  });

  it("shows HubSpot CRM data when available", () => {
    const result = formatAnalyticsDataForPrompt(
      makeAnalyticsData({
        hubspot: {
          available: true,
          contacts: { total: 1000, newInPeriod: 50 },
          deals: { total: 30, totalValue: 75000, byStage: { closedwon: 10, proposal: 20 } },
          emailCampaigns: { campaigns: [] },
        },
      })
    );
    expect(result).toContain("Total Contacts: 1,000");
    expect(result).toContain("New Contacts (period): 50");
    expect(result).toContain("Total Deals: 30");
    expect(result).toContain("Total Deal Value: $75,000");
    expect(result).toContain("closedwon: 10");
    expect(result).toContain("proposal: 20");
  });

  it("shows email campaign stats when present", () => {
    const result = formatAnalyticsDataForPrompt(
      makeAnalyticsData({
        hubspot: {
          available: true,
          contacts: { total: 100, newInPeriod: 5 },
          deals: { total: 0, totalValue: 0, byStage: {} },
          emailCampaigns: {
            campaigns: [
              {
                id: "e1",
                name: "March Newsletter",
                subject: "Spring is here",
                sent: 1000,
                openRate: 30,
                clickRate: 5,
              },
            ],
          },
        },
      })
    );
    expect(result).toContain('"Spring is here"');
    expect(result).toContain("1,000 sent");
    expect(result).toContain("30% open rate");
    expect(result).toContain("5% CTR");
  });

  it("shows email campaigns note when scope is missing", () => {
    const result = formatAnalyticsDataForPrompt(
      makeAnalyticsData({
        hubspot: {
          available: true,
          contacts: { total: 10, newInPeriod: 1 },
          deals: { total: 0, totalValue: 0, byStage: {} },
          emailCampaigns: { campaigns: [], note: "Email marketing stats require 'content' scope on the HubSpot private app." },
        },
      })
    );
    expect(result).toContain("content");
  });

  it("includes error note for Google Ads when present", () => {
    const result = formatAnalyticsDataForPrompt(
      makeAnalyticsData({
        googleAds: {
          available: true,
          totals: { impressions: 0, clicks: 0, spend: 0, ctr: 0 },
          campaigns: [],
          error: "Google Ads API query failed.",
        },
      })
    );
    expect(result).toContain("Note: Google Ads API query failed.");
  });

  it("starts and ends with the expected delimiters", () => {
    const result = formatAnalyticsDataForPrompt(makeAnalyticsData());
    expect(result.startsWith("=== ANALYTICS DATA:")).toBe(true);
    expect(result.trimEnd().endsWith("=== END ANALYTICS DATA ===")).toBe(true);
  });
});
