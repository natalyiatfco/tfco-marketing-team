import { logger } from "./logger";
import { safeDecrypt } from "./crypto";
import type { Property } from "@workspace/db";

export interface AdsTotals {
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}

export interface AdsCampaignRow {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  ctr: number;
}

export interface GoogleAdsData {
  available: boolean;
  campaigns?: AdsCampaignRow[];
  totals?: AdsTotals;
  error?: string;
}

export interface MetaAdsData {
  available: boolean;
  campaigns?: AdsCampaignRow[];
  totals?: AdsTotals;
  error?: string;
}

export interface HubSpotEmailCampaign {
  id: string;
  name: string;
  subject: string;
  sentAt?: string;
  sent?: number;
  opens?: number;
  clicks?: number;
  openRate?: number;
  clickRate?: number;
}

export interface HubSpotData {
  available: boolean;
  contacts?: { total: number; newInPeriod: number };
  deals?: { total: number; totalValue: number; byStage: Record<string, number> };
  emailCampaigns?: { campaigns: HubSpotEmailCampaign[]; note?: string };
  error?: string;
}

export interface AnalyticsData {
  property: { id: number; name: string };
  dateRange: { from: string; to: string; label: string };
  googleAds: GoogleAdsData;
  metaAds: MetaAdsData;
  hubspot: HubSpotData;
}

function getDateRange(range: string): { from: Date; to: Date; label: string } {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case "7days":
      from.setDate(from.getDate() - 7);
      return { from, to, label: "Last 7 Days" };
    case "90days":
      from.setDate(from.getDate() - 90);
      return { from, to, label: "Last 90 Days" };
    default:
      from.setDate(from.getDate() - 30);
      return { from, to, label: "Last 30 Days" };
  }
}

async function fetchGoogleAdsData(
  property: Property,
  from: Date,
  to: Date
): Promise<GoogleAdsData> {
  if (!property.googleAdsCustomerId || !property.googleAdsRefreshToken) {
    return { available: false };
  }

  try {
    const refreshToken = safeDecrypt(property.googleAdsRefreshToken);
    const customerId = property.googleAdsCustomerId.replace(/-/g, "");

    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;

    if (!clientId || !clientSecret || !developerToken) {
      logger.warn("Google Ads env vars not configured — returning unavailable");
      return { available: false, error: "Google Ads API credentials not configured on server." };
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text().catch(() => "unknown");
      logger.warn({ err }, "Google Ads token refresh failed");
      return { available: true, error: "Could not refresh Google Ads access token.", campaigns: [], totals: { impressions: 0, clicks: 0, spend: 0, ctr: 0 } };
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    const query = `SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, metrics.cost_micros FROM campaign WHERE segments.date BETWEEN '${fromStr}' AND '${toStr}' AND campaign.status = 'ENABLED' ORDER BY metrics.impressions DESC LIMIT 20`;

    const gaRes = await fetch(
      `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access_token}`,
          "developer-token": developerToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!gaRes.ok) {
      const err = await gaRes.text().catch(() => "unknown");
      logger.warn({ err, customerId }, "Google Ads API query failed");
      return { available: true, campaigns: [], totals: { impressions: 0, clicks: 0, spend: 0, ctr: 0 }, error: "Google Ads API query failed." };
    }

    const rows = (await gaRes.json()) as Array<{ results?: Array<{ campaign: { id: string; name: string }; metrics: { impressions: string; clicks: string; cost_micros: string } }> }>;
    const campaigns: AdsCampaignRow[] = [];

    for (const batch of rows) {
      for (const r of batch.results ?? []) {
        const impressions = parseInt(r.metrics.impressions, 10) || 0;
        const clicks = parseInt(r.metrics.clicks, 10) || 0;
        const spend = (parseInt(r.metrics.cost_micros, 10) || 0) / 1_000_000;
        campaigns.push({
          campaignId: r.campaign.id,
          campaignName: r.campaign.name,
          impressions,
          clicks,
          spend: parseFloat(spend.toFixed(2)),
          ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
        });
      }
    }

    const totals = campaigns.reduce<AdsTotals>(
      (acc, c) => {
        acc.impressions += c.impressions;
        acc.clicks += c.clicks;
        acc.spend += c.spend;
        return acc;
      },
      { impressions: 0, clicks: 0, spend: 0, ctr: 0 }
    );
    totals.spend = parseFloat(totals.spend.toFixed(2));
    totals.ctr = totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;

    return { available: true, campaigns, totals };
  } catch (err) {
    logger.warn({ err }, "Google Ads fetch threw exception");
    return { available: true, campaigns: [], totals: { impressions: 0, clicks: 0, spend: 0, ctr: 0 }, error: "Error fetching Google Ads data." };
  }
}

async function fetchMetaAdsData(
  property: Property,
  from: Date,
  to: Date
): Promise<MetaAdsData> {
  if (!property.metaAdsAccountId || !property.metaAdsAccessToken) {
    return { available: false };
  }

  try {
    const accessToken = safeDecrypt(property.metaAdsAccessToken);
    const accountId = property.metaAdsAccountId;
    const fromStr = from.toISOString().split("T")[0];
    const toStr = to.toISOString().split("T")[0];

    const params = new URLSearchParams({
      fields: "campaign_name,impressions,clicks,spend",
      time_range: JSON.stringify({ since: fromStr, until: toStr }),
      level: "campaign",
      limit: "20",
      access_token: accessToken,
    });

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/act_${accountId}/insights?${params}`
    );

    if (!metaRes.ok) {
      const err = await metaRes.text().catch(() => "unknown");
      logger.warn({ err, accountId }, "Meta Ads insights API failed");
      return { available: true, campaigns: [], totals: { impressions: 0, clicks: 0, spend: 0, ctr: 0 }, error: "Meta Ads API query failed." };
    }

    const data = (await metaRes.json()) as { data: Array<{ campaign_name: string; impressions: string; clicks: string; spend: string }> };
    const campaigns: AdsCampaignRow[] = (data.data ?? []).map((r, i) => {
      const impressions = parseInt(r.impressions, 10) || 0;
      const clicks = parseInt(r.clicks, 10) || 0;
      const spend = parseFloat(r.spend) || 0;
      return {
        campaignId: String(i),
        campaignName: r.campaign_name,
        impressions,
        clicks,
        spend: parseFloat(spend.toFixed(2)),
        ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
      };
    });

    const totals = campaigns.reduce<AdsTotals>(
      (acc, c) => { acc.impressions += c.impressions; acc.clicks += c.clicks; acc.spend += c.spend; return acc; },
      { impressions: 0, clicks: 0, spend: 0, ctr: 0 }
    );
    totals.spend = parseFloat(totals.spend.toFixed(2));
    totals.ctr = totals.impressions > 0 ? parseFloat(((totals.clicks / totals.impressions) * 100).toFixed(2)) : 0;

    return { available: true, campaigns, totals };
  } catch (err) {
    logger.warn({ err }, "Meta Ads fetch threw exception");
    return { available: true, campaigns: [], totals: { impressions: 0, clicks: 0, spend: 0, ctr: 0 }, error: "Error fetching Meta Ads data." };
  }
}

async function fetchHubSpotData(
  property: Property,
  from: Date,
  _to: Date
): Promise<HubSpotData> {
  if (!property.hubspotApiKey) {
    return { available: false };
  }

  try {
    const apiKey = safeDecrypt(property.hubspotApiKey);
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

    const fromMs = from.getTime();

    const [totalContactsRes, newContactsRes] = await Promise.all([
      fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          filterGroups: [],
          properties: [],
          limit: 1,
        }),
      }),
      fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
        method: "POST",
        headers,
        body: JSON.stringify({
          filterGroups: [{
            filters: [{ propertyName: "createdate", operator: "GTE", value: String(fromMs) }],
          }],
          properties: ["createdate"],
          limit: 1,
        }),
      }),
    ]);

    if (!totalContactsRes.ok) {
      const err = await totalContactsRes.text().catch(() => "unknown");
      logger.warn({ err }, "HubSpot contacts API failed");
      return { available: true, contacts: { total: 0, newInPeriod: 0 }, deals: { total: 0, totalValue: 0, byStage: {} }, error: "HubSpot API query failed — check API key and scopes." };
    }

    const totalContactsData = (await totalContactsRes.json()) as { total: number };
    const totalContacts = totalContactsData.total ?? 0;
    const newContactsData = newContactsRes.ok ? ((await newContactsRes.json()) as { total: number }) : { total: 0 };

    const dealsRes = await fetch(
      "https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=amount,dealstage,pipeline",
      { headers }
    );

    let totalDeals = 0;
    let totalValue = 0;
    const byStage: Record<string, number> = {};

    if (dealsRes.ok) {
      const dealsData = (await dealsRes.json()) as { results: Array<{ properties: { amount: string; dealstage: string } }>; total?: number };
      totalDeals = dealsData.total ?? dealsData.results?.length ?? 0;
      for (const deal of dealsData.results ?? []) {
        const amount = parseFloat(deal.properties.amount) || 0;
        const stage = deal.properties.dealstage || "unknown";
        totalValue += amount;
        byStage[stage] = (byStage[stage] ?? 0) + 1;
      }
    }

    let emailCampaigns: HubSpotData["emailCampaigns"] = undefined;
    try {
      const emailsRes = await fetch(
        "https://api.hubapi.com/marketing/v3/emails?limit=10&orderBy=-updatedAt",
        { headers }
      );
      if (emailsRes.ok) {
        const emailsData = (await emailsRes.json()) as {
          results: Array<{
            id: string;
            name: string;
            subject: string;
            publishDate?: string;
            stats?: { sent?: number; open?: number; click?: number; openRate?: number; clickRate?: number };
          }>;
        };
        emailCampaigns = {
          campaigns: (emailsData.results ?? []).map((e) => ({
            id: e.id,
            name: e.name,
            subject: e.subject ?? "",
            sentAt: e.publishDate,
            sent: e.stats?.sent,
            opens: e.stats?.open,
            clicks: e.stats?.click,
            openRate: e.stats?.openRate ? parseFloat((e.stats.openRate * 100).toFixed(1)) : undefined,
            clickRate: e.stats?.clickRate ? parseFloat((e.stats.clickRate * 100).toFixed(1)) : undefined,
          })),
        };
      } else if (emailsRes.status === 403) {
        emailCampaigns = { campaigns: [], note: "Email marketing stats require 'content' scope on the HubSpot private app." };
      }
    } catch {
      emailCampaigns = { campaigns: [], note: "Email campaign data unavailable." };
    }

    return {
      available: true,
      contacts: { total: totalContacts, newInPeriod: newContactsData.total ?? 0 },
      deals: { total: totalDeals, totalValue: parseFloat(totalValue.toFixed(2)), byStage },
      emailCampaigns,
    };
  } catch (err) {
    logger.warn({ err }, "HubSpot fetch threw exception");
    return { available: true, contacts: { total: 0, newInPeriod: 0 }, deals: { total: 0, totalValue: 0, byStage: {} }, error: "Error fetching HubSpot data." };
  }
}

export async function fetchAnalyticsData(
  property: Property,
  dateRange = "30days"
): Promise<AnalyticsData> {
  const { from, to, label } = getDateRange(dateRange);

  const [googleAds, metaAds, hubspot] = await Promise.all([
    fetchGoogleAdsData(property, from, to),
    fetchMetaAdsData(property, from, to),
    fetchHubSpotData(property, from, to),
  ]);

  return {
    property: { id: property.id, name: property.name },
    dateRange: {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
      label,
    },
    googleAds,
    metaAds,
    hubspot,
  };
}

export function formatAnalyticsDataForPrompt(data: AnalyticsData): string {
  const lines: string[] = [
    `=== ANALYTICS DATA: ${data.property.name} (${data.dateRange.label}) ===`,
    "",
  ];

  if (data.googleAds.available && data.googleAds.totals) {
    lines.push("--- Google Ads Performance ---");
    lines.push(`Impressions: ${data.googleAds.totals.impressions.toLocaleString()}`);
    lines.push(`Clicks: ${data.googleAds.totals.clicks.toLocaleString()}`);
    lines.push(`Spend: $${data.googleAds.totals.spend.toLocaleString()}`);
    lines.push(`CTR: ${data.googleAds.totals.ctr}%`);
    if (data.googleAds.campaigns && data.googleAds.campaigns.length > 0) {
      lines.push("Top Campaigns:");
      data.googleAds.campaigns.slice(0, 5).forEach((c) => {
        lines.push(`  - ${c.campaignName}: ${c.impressions.toLocaleString()} impr, ${c.clicks} clicks, $${c.spend}`);
      });
    }
    if (data.googleAds.error) lines.push(`Note: ${data.googleAds.error}`);
  } else if (data.googleAds.available) {
    lines.push("--- Google Ads: Connected but no data returned ---");
  } else {
    lines.push("--- Google Ads: Not connected ---");
  }

  lines.push("");

  if (data.metaAds.available && data.metaAds.totals) {
    lines.push("--- Meta Ads Performance ---");
    lines.push(`Impressions: ${data.metaAds.totals.impressions.toLocaleString()}`);
    lines.push(`Clicks: ${data.metaAds.totals.clicks.toLocaleString()}`);
    lines.push(`Spend: $${data.metaAds.totals.spend.toLocaleString()}`);
    lines.push(`CTR: ${data.metaAds.totals.ctr}%`);
    if (data.metaAds.campaigns && data.metaAds.campaigns.length > 0) {
      lines.push("Top Campaigns:");
      data.metaAds.campaigns.slice(0, 5).forEach((c) => {
        lines.push(`  - ${c.campaignName}: ${c.impressions.toLocaleString()} impr, ${c.clicks} clicks, $${c.spend}`);
      });
    }
    if (data.metaAds.error) lines.push(`Note: ${data.metaAds.error}`);
  } else if (data.metaAds.available) {
    lines.push("--- Meta Ads: Connected but no data returned ---");
  } else {
    lines.push("--- Meta Ads: Not connected ---");
  }

  lines.push("");

  if (data.hubspot.available && data.hubspot.contacts && data.hubspot.deals) {
    lines.push("--- HubSpot CRM ---");
    lines.push(`Total Contacts: ${data.hubspot.contacts.total.toLocaleString()}`);
    lines.push(`New Contacts (period): ${data.hubspot.contacts.newInPeriod.toLocaleString()}`);
    lines.push(`Total Deals: ${data.hubspot.deals.total}`);
    lines.push(`Total Deal Value: $${data.hubspot.deals.totalValue.toLocaleString()}`);
    if (Object.keys(data.hubspot.deals.byStage).length > 0) {
      lines.push("Deals by Stage:");
      Object.entries(data.hubspot.deals.byStage).forEach(([stage, count]) => {
        lines.push(`  - ${stage}: ${count}`);
      });
    }
    if (data.hubspot.emailCampaigns && data.hubspot.emailCampaigns.campaigns.length > 0) {
      lines.push("Email Campaign Attribution (recent):");
      data.hubspot.emailCampaigns.campaigns.slice(0, 5).forEach((e) => {
        const sent = e.sent ? `${e.sent.toLocaleString()} sent` : "";
        const openRate = e.openRate !== undefined ? `, ${e.openRate}% open rate` : "";
        const clickRate = e.clickRate !== undefined ? `, ${e.clickRate}% CTR` : "";
        lines.push(`  - "${e.subject}" (${e.name}): ${sent}${openRate}${clickRate}`);
      });
    } else if (data.hubspot.emailCampaigns?.note) {
      lines.push(`Email Campaigns: ${data.hubspot.emailCampaigns.note}`);
    }
    if (data.hubspot.error) lines.push(`Note: ${data.hubspot.error}`);
  } else if (data.hubspot.available) {
    lines.push("--- HubSpot: Connected but no data returned ---");
  } else {
    lines.push("--- HubSpot: Not connected ---");
  }

  lines.push("");
  lines.push("=== END ANALYTICS DATA ===");

  return lines.join("\n");
}
