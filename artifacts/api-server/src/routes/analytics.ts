import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import { GetPropertyParams } from "@workspace/api-zod";
import { fetchAnalyticsData, type AnalyticsData } from "../lib/analytics-fetcher";

const router: IRouter = Router();

router.get("/properties/:id/analytics-data", async (req, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const dateRange = typeof req.query.dateRange === "string" ? req.query.dateRange : "30days";

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, params.data.id));

  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const data = await fetchAnalyticsData(property, dateRange);
  res.json(data);
});

router.get("/properties/:id/analytics-data.csv", async (req, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const dateRange = typeof req.query.dateRange === "string" ? req.query.dateRange : "30days";

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, params.data.id));

  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const data = await fetchAnalyticsData(property, dateRange);
  const csv = buildAnalyticsCsv(data);

  const filename = `${property.name.replace(/[^a-z0-9]/gi, "_")}_analytics_${dateRange}_${new Date().toISOString().split("T")[0]}.csv`;
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});

function buildAnalyticsCsv(data: AnalyticsData): string {
  const rows: string[][] = [];

  rows.push(["# Analytics Report"]);
  rows.push(["Property", data.property.name]);
  rows.push(["Date Range", data.dateRange.label]);
  rows.push(["From", data.dateRange.from]);
  rows.push(["To", data.dateRange.to]);
  rows.push([]);

  if (data.googleAds.available && data.googleAds.campaigns) {
    rows.push(["## Google Ads Campaigns"]);
    rows.push(["Campaign Name", "Impressions", "Clicks", "CTR (%)", "Spend ($)"]);
    for (const c of data.googleAds.campaigns) {
      rows.push([c.campaignName, String(c.impressions), String(c.clicks), String(c.ctr), String(c.spend)]);
    }
    if (data.googleAds.totals) {
      const t = data.googleAds.totals;
      rows.push(["TOTAL", String(t.impressions), String(t.clicks), String(t.ctr), String(t.spend)]);
    }
    rows.push([]);
  }

  if (data.metaAds.available && data.metaAds.campaigns) {
    rows.push(["## Meta Ads Campaigns"]);
    rows.push(["Campaign Name", "Impressions", "Clicks", "CTR (%)", "Spend ($)"]);
    for (const c of data.metaAds.campaigns) {
      rows.push([c.campaignName, String(c.impressions), String(c.clicks), String(c.ctr), String(c.spend)]);
    }
    if (data.metaAds.totals) {
      const t = data.metaAds.totals;
      rows.push(["TOTAL", String(t.impressions), String(t.clicks), String(t.ctr), String(t.spend)]);
    }
    rows.push([]);
  }

  if (data.hubspot.available) {
    rows.push(["## HubSpot CRM"]);
    rows.push(["Metric", "Value"]);
    if (data.hubspot.contacts) {
      rows.push(["Total Contacts", String(data.hubspot.contacts.total)]);
      rows.push([`New Contacts (${data.dateRange.label})`, String(data.hubspot.contacts.newInPeriod)]);
    }
    if (data.hubspot.deals) {
      rows.push(["Total Deals", String(data.hubspot.deals.total)]);
      rows.push(["Total Deal Value ($)", String(data.hubspot.deals.totalValue)]);
      for (const [stage, count] of Object.entries(data.hubspot.deals.byStage)) {
        rows.push([`Deals in "${stage}"`, String(count)]);
      }
    }
    rows.push([]);

    if (data.hubspot.emailCampaigns && data.hubspot.emailCampaigns.campaigns.length > 0) {
      rows.push(["## HubSpot Email Campaign Attribution"]);
      rows.push(["Campaign Name", "Subject", "Sent Date", "Sent", "Opens", "Clicks", "Open Rate (%)", "Click Rate (%)"]);
      for (const e of data.hubspot.emailCampaigns.campaigns) {
        rows.push([
          e.name, e.subject, e.sentAt ?? "",
          String(e.sent ?? ""), String(e.opens ?? ""), String(e.clicks ?? ""),
          String(e.openRate ?? ""), String(e.clickRate ?? ""),
        ]);
      }
      rows.push([]);
    }
  }

  return rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

export default router;
