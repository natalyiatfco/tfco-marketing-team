import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, propertiesTable, agentsTable, reviewsTable } from "@workspace/db";
import { PushTaskToAdsParams, PushTaskToAdsBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { decryptCredential, isEncrypted } from "../lib/crypto";

const router: IRouter = Router();

const ADS_PUSHABLE_ROLES = ["paid_specialist"] as const;

function safeDecrypt(value: string): string {
  if (!value) return value;
  return isEncrypted(value) ? decryptCredential(value) : value;
}

// ── Campaign output parser ──────────────────────────────────────────────────

interface ParsedGoogleAdsCampaign {
  campaignName: string;
  campaignType: string;
  dailyBudgetMicros: number;
  adGroups: Array<{
    name: string;
    keywords: string[];
    headlines: string[];
    descriptions: string[];
    finalUrl: string;
  }>;
}

interface ParsedMetaAdsCampaign {
  campaignName: string;
  objective: string;
  dailyBudgetCents: number;
  audienceAgeMin: number;
  audienceAgeMax: number;
  interests: string[];
  locations: string[];
  adHeadline: string;
  adBody: string;
  callToAction: string;
}

function extractSection(text: string, startMarker: string, endMarker: string): string | null {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start + startMarker.length, end).trim();
}

function parseField(section: string, key: string): string {
  const regex = new RegExp(`^${key}:\\s*(.+)$`, "im");
  const match = section.match(regex);
  return match ? match[1].trim() : "";
}

function parseGoogleAdsCampaign(output: string): ParsedGoogleAdsCampaign | null {
  const section = extractSection(output, "===GOOGLE ADS CAMPAIGN===", "===END GOOGLE ADS===");
  if (!section) return null;

  const campaignName = parseField(section, "Campaign-Name") || "New Google Ads Campaign";
  const campaignType = parseField(section, "Campaign-Type") || "SEARCH";
  const budgetStr = parseField(section, "Daily-Budget-USD");
  const dailyBudget = parseFloat(budgetStr) || 50;
  const dailyBudgetMicros = Math.round(dailyBudget * 1_000_000);

  const adGroups: ParsedGoogleAdsCampaign["adGroups"] = [];
  const adGroupPattern = /---AD GROUP:\s*([^-\n]+)---([\s\S]*?)---END AD GROUP---/gi;
  let agMatch: RegExpExecArray | null;

  while ((agMatch = adGroupPattern.exec(section)) !== null) {
    const agName = agMatch[1].trim();
    const agBody = agMatch[2];

    const keywordsStr = parseField(agBody, "Keywords");
    const keywords = keywordsStr ? keywordsStr.split(",").map(k => k.trim()).filter(Boolean) : [];

    const headlines = [
      parseField(agBody, "Headline-1"),
      parseField(agBody, "Headline-2"),
      parseField(agBody, "Headline-3"),
    ].filter(Boolean);

    const descriptions = [
      parseField(agBody, "Description-1"),
      parseField(agBody, "Description-2"),
    ].filter(Boolean);

    const finalUrl = parseField(agBody, "Final-URL") || "";

    adGroups.push({ name: agName, keywords, headlines, descriptions, finalUrl });
  }

  if (adGroups.length === 0) {
    adGroups.push({
      name: "Main Ad Group",
      keywords: [],
      headlines: ["Learn More", "Contact Us", "Get Started"],
      descriptions: ["Discover our hospitality offerings.", "Book today."],
      finalUrl: "",
    });
  }

  return { campaignName, campaignType, dailyBudgetMicros, adGroups };
}

function parseMetaAdsCampaign(output: string): ParsedMetaAdsCampaign | null {
  const section = extractSection(output, "===META ADS CAMPAIGN===", "===END META ADS===");
  if (!section) return null;

  const campaignName = parseField(section, "Campaign-Name") || "New Meta Ads Campaign";
  const objective = parseField(section, "Campaign-Objective") || "OUTCOME_TRAFFIC";
  const budgetStr = parseField(section, "Daily-Budget-USD");
  const dailyBudget = parseFloat(budgetStr) || 50;
  const dailyBudgetCents = Math.round(dailyBudget * 100);

  const ageMinStr = parseField(section, "Audience-Age-Min");
  const ageMaxStr = parseField(section, "Audience-Age-Max");
  const audienceAgeMin = parseInt(ageMinStr) || 25;
  const audienceAgeMax = parseInt(ageMaxStr) || 55;

  const interestsStr = parseField(section, "Audience-Interests");
  const interests = interestsStr ? interestsStr.split(",").map(i => i.trim()).filter(Boolean) : [];

  const locationsStr = parseField(section, "Audience-Locations");
  const locations = locationsStr ? locationsStr.replace(/[\[\]]/g, "").split(",").map(l => l.trim()).filter(Boolean) : [];

  const adHeadline = parseField(section, "Ad-Headline") || campaignName;
  const adBody = parseField(section, "Ad-Body") || "";
  const callToAction = parseField(section, "Ad-CTA") || "LEARN_MORE";

  return { campaignName, objective, dailyBudgetCents, audienceAgeMin, audienceAgeMax, interests, locations, adHeadline, adBody, callToAction };
}

// ── Google Ads API ──────────────────────────────────────────────────────────

async function getGoogleAdsAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET environment variables are required.");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google OAuth2 token exchange failed: ${text.slice(0, 200)}`);
  }

  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}

async function pushToGoogleAds(
  customerId: string,
  accessToken: string,
  campaign: ParsedGoogleAdsCampaign,
  overrideName?: string
): Promise<{ campaignId: string; campaignName: string }> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!developerToken) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN environment variable is required.");
  }

  const cleanCustomerId = customerId.replace(/-/g, "");
  const campaignName = overrideName || campaign.campaignName;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
  };

  // Step 1: Create campaign budget
  const budgetResponse = await fetch(
    `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/campaignBudgets:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        operations: [{
          create: {
            name: `${campaignName} Budget`,
            amountMicros: campaign.dailyBudgetMicros.toString(),
            deliveryMethod: "STANDARD",
          }
        }]
      }),
    }
  );

  if (!budgetResponse.ok) {
    const text = await budgetResponse.text();
    throw new Error(`Google Ads budget creation failed (${budgetResponse.status}): ${text.slice(0, 300)}`);
  }

  const budgetData = (await budgetResponse.json()) as { results: Array<{ resourceName: string }> };
  const budgetResourceName = budgetData.results[0]?.resourceName;

  if (!budgetResourceName) {
    throw new Error("Google Ads did not return a budget resource name.");
  }

  // Step 2: Create campaign
  const channelType = campaign.campaignType === "DISPLAY" ? "DISPLAY"
    : campaign.campaignType === "PERFORMANCE_MAX" ? "PERFORMANCE_MAX"
    : "SEARCH";

  const campaignBody: Record<string, unknown> = {
    name: campaignName,
    status: "PAUSED",
    advertisingChannelType: channelType,
    campaignBudget: budgetResourceName,
    startDate: new Date(Date.now() + 86400000).toISOString().split("T")[0].replace(/-/g, ""),
  };

  if (channelType === "SEARCH") {
    campaignBody.manualCpc = { enhancedCpcEnabled: false };
  }

  const campaignResponse = await fetch(
    `https://googleads.googleapis.com/v18/customers/${cleanCustomerId}/campaigns:mutate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ operations: [{ create: campaignBody }] }),
    }
  );

  if (!campaignResponse.ok) {
    const text = await campaignResponse.text();
    throw new Error(`Google Ads campaign creation failed (${campaignResponse.status}): ${text.slice(0, 300)}`);
  }

  const campaignData = (await campaignResponse.json()) as { results: Array<{ resourceName: string }> };
  const campaignResourceName = campaignData.results[0]?.resourceName ?? "";
  const campaignId = campaignResourceName.split("/").pop() ?? campaignResourceName;

  return { campaignId, campaignName };
}

// ── Meta Ads API ────────────────────────────────────────────────────────────

async function pushToMetaAds(
  accountId: string,
  accessToken: string,
  campaign: ParsedMetaAdsCampaign,
  overrideName?: string
): Promise<{ campaignId: string; campaignName: string }> {
  const campaignName = overrideName || campaign.campaignName;

  const normalizedObjective = campaign.objective.startsWith("OUTCOME_")
    ? campaign.objective
    : `OUTCOME_${campaign.objective}`;

  const params = new URLSearchParams({
    name: campaignName,
    objective: normalizedObjective,
    status: "PAUSED",
    special_ad_categories: "[]",
    access_token: accessToken,
  });

  const response = await fetch(
    `https://graph.facebook.com/v21.0/act_${accountId}/campaigns`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta Ads campaign creation failed (${response.status}): ${text.slice(0, 300)}`);
  }

  const data = (await response.json()) as { id: string };
  return { campaignId: data.id, campaignName };
}

// ── Route ───────────────────────────────────────────────────────────────────

router.post("/tasks/:id/push-ads", async (req, res): Promise<void> => {
  const params = PushTaskToAdsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = PushTaskToAdsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { platform, overrideCampaignName } = body.data;

  const [task] = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      output: tasksTable.output,
      status: tasksTable.status,
      propertyId: tasksTable.propertyId,
      agentRole: agentsTable.role,
    })
    .from(tasksTable)
    .innerJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .where(eq(tasksTable.id, params.data.id));

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (!(ADS_PUSHABLE_ROLES as readonly string[]).includes(task.agentRole)) {
    res.status(409).json({
      error: `Only paid_specialist tasks can be pushed to ad platforms. This task belongs to a ${task.agentRole}.`,
    });
    return;
  }

  if (!task.output) {
    res.status(409).json({ error: "Task has no output to push" });
    return;
  }

  const [review] = await db
    .select({ decision: reviewsTable.decision })
    .from(reviewsTable)
    .where(eq(reviewsTable.taskId, task.id));

  if (!review || review.decision !== "approved") {
    res.status(409).json({ error: "Task must be approved before pushing to ad platforms" });
    return;
  }

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, task.propertyId));

  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const now = new Date();

  try {
    let campaignId: string | null = null;
    let campaignName: string | null = null;

    if (platform === "google_ads") {
      if (!property.googleAdsCustomerId || !property.googleAdsRefreshToken) {
        res.status(422).json({ error: "Google Ads credentials are not fully configured for this property" });
        return;
      }

      const parsed = parseGoogleAdsCampaign(task.output);
      if (!parsed) {
        res.status(422).json({
          error: "Could not parse Google Ads campaign structure from task output. Ensure the output contains ===GOOGLE ADS CAMPAIGN=== sections.",
        });
        return;
      }

      const refreshToken = safeDecrypt(property.googleAdsRefreshToken);
      const accessToken = await getGoogleAdsAccessToken(refreshToken);
      const result = await pushToGoogleAds(
        property.googleAdsCustomerId,
        accessToken,
        parsed,
        overrideCampaignName
      );
      campaignId = result.campaignId;
      campaignName = result.campaignName;

    } else {
      if (!property.metaAdsAccountId || !property.metaAdsAccessToken) {
        res.status(422).json({ error: "Meta Ads credentials are not fully configured for this property" });
        return;
      }

      const parsed = parseMetaAdsCampaign(task.output);
      if (!parsed) {
        res.status(422).json({
          error: "Could not parse Meta Ads campaign structure from task output. Ensure the output contains ===META ADS CAMPAIGN=== sections.",
        });
        return;
      }

      const accessToken = safeDecrypt(property.metaAdsAccessToken);
      const result = await pushToMetaAds(
        property.metaAdsAccountId,
        accessToken,
        parsed,
        overrideCampaignName
      );
      campaignId = result.campaignId;
      campaignName = result.campaignName;
    }

    await db
      .update(tasksTable)
      .set({ adPushStatus: "pushed", adCampaignId: campaignId, adPlatform: platform, adPushedAt: now, updatedAt: now })
      .where(eq(tasksTable.id, task.id));

    logger.info({ taskId: task.id, platform, campaignId }, "Task pushed to ad platform");

    res.json({
      taskId: task.id,
      platform,
      campaignId,
      campaignName,
      pushedAt: now.toISOString(),
      message: `Campaign "${campaignName}" created as PAUSED draft on ${platform === "google_ads" ? "Google Ads" : "Meta Ads"}`,
    });
  } catch (err) {
    logger.error({ taskId: task.id, platform }, "Ad platform push failed");

    await db
      .update(tasksTable)
      .set({ adPushStatus: "failed", adPlatform: platform, updatedAt: now })
      .where(eq(tasksTable.id, task.id));

    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Failed to push to ${platform}: ${message}` });
  }
});

export default router;
