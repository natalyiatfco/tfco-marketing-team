import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
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

router.get("/properties/:id/analytics-data.pdf", async (req, res): Promise<void> => {
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
  const filename = `${property.name.replace(/[^a-z0-9]/gi, "_")}_analytics_${dateRange}_${new Date().toISOString().split("T")[0]}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 50, size: "A4" });
  doc.pipe(res);
  buildAnalyticsPdf(doc, data);
  doc.end();
});

function buildAnalyticsPdf(doc: PDFKit.PDFDocument, data: AnalyticsData): void {
  const primary = "#1a1a2e";
  const accent = "#4f46e5";
  const gray = "#6b7280";
  const lightGray = "#f3f4f6";

  const sectionHeader = (title: string) => {
    doc.moveDown(0.5);
    doc.rect(50, doc.y, 495, 24).fill(accent);
    doc.fillColor("#ffffff").fontSize(11).font("Helvetica-Bold")
      .text(title, 58, doc.y - 20, { lineBreak: false });
    doc.fillColor(primary).font("Helvetica").fontSize(10);
    doc.moveDown(1.2);
  };

  const row = (label: string, value: string, shade = false) => {
    const y = doc.y;
    if (shade) doc.rect(50, y, 495, 18).fill(lightGray);
    doc.fillColor(gray).text(label, 58, y + 4, { width: 240, lineBreak: false });
    doc.fillColor(primary).text(value, 310, y + 4, { width: 235, lineBreak: false });
    doc.moveDown(0.6);
  };

  const tableHeader = (cols: string[], widths: number[]) => {
    const y = doc.y;
    doc.rect(50, y, 495, 20).fill("#e0e7ff");
    let x = 58;
    doc.fillColor(accent).font("Helvetica-Bold").fontSize(9);
    cols.forEach((col, i) => {
      doc.text(col, x, y + 5, { width: widths[i], lineBreak: false });
      x += widths[i];
    });
    doc.fillColor(primary).font("Helvetica").fontSize(9);
    doc.moveDown(1);
  };

  const tableRow = (cols: string[], widths: number[], shade: boolean) => {
    const y = doc.y;
    if (shade) doc.rect(50, y, 495, 16).fill(lightGray);
    let x = 58;
    doc.fillColor(primary);
    cols.forEach((col, i) => {
      doc.text(col, x, y + 3, { width: widths[i], lineBreak: false });
      x += widths[i];
    });
    doc.moveDown(0.55);
  };

  doc.fillColor(accent).fontSize(20).font("Helvetica-Bold").text("Analytics Report", { align: "center" });
  doc.moveDown(0.3);
  doc.fillColor(primary).fontSize(14).font("Helvetica").text(data.property.name, { align: "center" });
  doc.moveDown(0.2);
  doc.fillColor(gray).fontSize(10).text(`${data.dateRange.label}  ·  ${data.dateRange.from} – ${data.dateRange.to}`, { align: "center" });
  doc.moveDown(0.2);
  doc.fillColor(gray).text(`Generated ${new Date().toLocaleString()}`, { align: "center" });
  doc.moveDown(1);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#e5e7eb").stroke();
  doc.moveDown(0.8);

  if (data.googleAds.available && data.googleAds.campaigns && data.googleAds.campaigns.length > 0) {
    sectionHeader("Google Ads Performance");
    const cols = ["Campaign", "Impressions", "Clicks", "CTR %", "Spend $"];
    const widths = [195, 75, 60, 60, 75];
    tableHeader(cols, widths);
    data.googleAds.campaigns.forEach((c, i) => {
      tableRow([c.campaignName, String(c.impressions), String(c.clicks), `${c.ctr}%`, `$${c.spend}`], widths, i % 2 === 0);
    });
    if (data.googleAds.totals) {
      const t = data.googleAds.totals;
      doc.font("Helvetica-Bold");
      tableRow(["TOTAL", String(t.impressions), String(t.clicks), `${t.ctr}%`, `$${t.spend}`], widths, false);
      doc.font("Helvetica");
    }
    doc.moveDown(0.5);
  } else if (data.googleAds.available === false) {
    sectionHeader("Google Ads Performance");
    doc.fillColor(gray).fontSize(9).text("Google Ads credentials not configured for this property.", 58);
    doc.moveDown(0.5);
  }

  if (data.metaAds.available && data.metaAds.campaigns && data.metaAds.campaigns.length > 0) {
    sectionHeader("Meta Ads Performance");
    const cols = ["Campaign", "Impressions", "Clicks", "CTR %", "Spend $"];
    const widths = [195, 75, 60, 60, 75];
    tableHeader(cols, widths);
    data.metaAds.campaigns.forEach((c, i) => {
      tableRow([c.campaignName, String(c.impressions), String(c.clicks), `${c.ctr}%`, `$${c.spend}`], widths, i % 2 === 0);
    });
    if (data.metaAds.totals) {
      const t = data.metaAds.totals;
      doc.font("Helvetica-Bold");
      tableRow(["TOTAL", String(t.impressions), String(t.clicks), `${t.ctr}%`, `$${t.spend}`], widths, false);
      doc.font("Helvetica");
    }
    doc.moveDown(0.5);
  } else if (data.metaAds.available === false) {
    sectionHeader("Meta Ads Performance");
    doc.fillColor(gray).fontSize(9).text("Meta Ads credentials not configured for this property.", 58);
    doc.moveDown(0.5);
  }

  if (data.hubspot.available) {
    sectionHeader("HubSpot CRM Summary");
    let shade = false;
    if (data.hubspot.contacts) {
      row("Total Contacts", String(data.hubspot.contacts.total), shade); shade = !shade;
      row(`New Contacts (${data.dateRange.label})`, String(data.hubspot.contacts.newInPeriod), shade); shade = !shade;
    }
    if (data.hubspot.deals) {
      row("Total Deals", String(data.hubspot.deals.total), shade); shade = !shade;
      row("Total Deal Value", `$${data.hubspot.deals.totalValue.toLocaleString()}`, shade); shade = !shade;
      for (const [stage, count] of Object.entries(data.hubspot.deals.byStage)) {
        row(`Deals – "${stage}"`, String(count), shade); shade = !shade;
      }
    }
    doc.moveDown(0.5);

    if (data.hubspot.emailCampaigns && data.hubspot.emailCampaigns.campaigns.length > 0) {
      sectionHeader("Email Campaign Attribution");
      const cols = ["Campaign", "Sent", "Opens", "Clicks", "Open %", "Click %"];
      const widths = [175, 55, 55, 55, 60, 65];
      tableHeader(cols, widths);
      data.hubspot.emailCampaigns.campaigns.forEach((e, i) => {
        tableRow([
          e.name.substring(0, 30),
          String(e.sent ?? "–"), String(e.opens ?? "–"), String(e.clicks ?? "–"),
          e.openRate != null ? `${e.openRate}%` : "–",
          e.clickRate != null ? `${e.clickRate}%` : "–",
        ], widths, i % 2 === 0);
      });
      doc.moveDown(0.5);
    }
  } else {
    sectionHeader("HubSpot CRM Summary");
    doc.fillColor(gray).fontSize(9).text("HubSpot credentials not configured for this property.", 58);
    doc.moveDown(0.5);
  }
}

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
