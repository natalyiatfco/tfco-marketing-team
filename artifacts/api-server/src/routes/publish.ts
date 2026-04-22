import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tasksTable, propertiesTable, agentsTable, reviewsTable } from "@workspace/db";
import { PublishTaskParams, PublishTaskBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";
import { decryptCredential } from "../lib/crypto";

const router: IRouter = Router();

async function publishToWordPress(
  siteUrl: string,
  username: string,
  appPassword: string,
  title: string,
  content: string,
  status: "draft" | "publish"
): Promise<{ url: string | null }> {
  const credentials = Buffer.from(`${username}:${appPassword}`).toString("base64");
  const endpoint = `${siteUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      title,
      content,
      status,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WordPress API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { link?: string };
  return { url: data.link ?? null };
}

async function publishToSquarespace(
  apiKey: string,
  collectionId: string,
  title: string,
  content: string,
  isDraft: boolean
): Promise<{ url: string | null }> {
  const endpoint = `https://api.squarespace.com/1.0/collections/${collectionId}/items`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      type: "text",
      title,
      body: content,
      isDraft,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Squarespace API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { item?: { fullUrl?: string } };
  return { url: data.item?.fullUrl ?? null };
}

router.post("/tasks/:id/publish", async (req, res): Promise<void> => {
  const params = PublishTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = PublishTaskBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const { platform, publishStatus, postTitle } = body.data;

  if (platform !== "wordpress" && platform !== "squarespace") {
    res.status(400).json({ error: "Platform must be 'wordpress' or 'squarespace'" });
    return;
  }

  const [task] = await db
    .select({
      id: tasksTable.id,
      title: tasksTable.title,
      output: tasksTable.output,
      status: tasksTable.status,
      propertyId: tasksTable.propertyId,
      agentId: tasksTable.agentId,
    })
    .from(tasksTable)
    .where(eq(tasksTable.id, params.data.id));

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (!task.output) {
    res.status(409).json({ error: "Task has no output to publish" });
    return;
  }

  const [review] = await db
    .select({ decision: reviewsTable.decision })
    .from(reviewsTable)
    .where(eq(reviewsTable.taskId, task.id));

  if (!review || review.decision !== "approved") {
    res.status(409).json({ error: "Task must be approved before publishing" });
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

  const title = postTitle || task.title;
  const now = new Date();

  try {
    let publishUrl: string | null = null;

    if (platform === "wordpress") {
      if (!property.wordpressUrl || !property.wordpressUsername || !property.wordpressAppPassword) {
        res.status(422).json({ error: "WordPress credentials are not configured for this property" });
        return;
      }

      const wpStatus = publishStatus === "publish" ? "publish" : "draft";
      const result = await publishToWordPress(
        decryptCredential(property.wordpressUrl),
        decryptCredential(property.wordpressUsername),
        decryptCredential(property.wordpressAppPassword),
        title,
        task.output,
        wpStatus
      );
      publishUrl = result.url;
    } else {
      if (!property.squarespaceApiKey || !property.squarespaceCollectionId) {
        res.status(422).json({ error: "Squarespace credentials are not configured for this property" });
        return;
      }

      const isDraft = publishStatus !== "publish";
      const result = await publishToSquarespace(
        decryptCredential(property.squarespaceApiKey),
        decryptCredential(property.squarespaceCollectionId),
        title,
        task.output,
        isDraft
      );
      publishUrl = result.url;
    }

    await db
      .update(tasksTable)
      .set({
        publishStatus,
        publishUrl,
        publishPlatform: platform,
        publishedAt: now,
        updatedAt: now,
      })
      .where(eq(tasksTable.id, task.id));

    logger.info({ taskId: task.id, platform, publishStatus, publishUrl }, "Task published to CMS");

    res.json({
      taskId: task.id,
      platform,
      publishStatus,
      publishUrl,
      publishedAt: now.toISOString(),
      message: `Successfully published to ${platform} as ${publishStatus}`,
    });
  } catch (err) {
    logger.error({ err, taskId: task.id, platform }, "CMS publish failed");

    await db
      .update(tasksTable)
      .set({ publishStatus: "failed", publishPlatform: platform, updatedAt: now })
      .where(eq(tasksTable.id, task.id));

    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(502).json({ error: `Failed to publish: ${message}` });
  }
});

export default router;
