import { Router, type IRouter } from "express";
import { eq, sql, isNull } from "drizzle-orm";
import { db, reviewsTable, tasksTable, agentsTable, propertiesTable, consolidateMemoryFromReview } from "@workspace/db";
import { DecideReviewParams, DecideReviewBody, ListReviewsQueryParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/reviews", async (req, res): Promise<void> => {
  const queryParams = ListReviewsQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const reviews = await db
    .select({
      id: reviewsTable.id,
      taskId: reviewsTable.taskId,
      managerFeedback: reviewsTable.managerFeedback,
      managerScore: reviewsTable.managerScore,
      decision: reviewsTable.decision,
      humanNotes: reviewsTable.humanNotes,
      createdAt: reviewsTable.createdAt,
      updatedAt: reviewsTable.updatedAt,
      taskTitle: tasksTable.title,
      taskOutput: tasksTable.output,
      taskInputPrompt: tasksTable.inputPrompt,
      taskStatus: tasksTable.status,
      agentName: agentsTable.name,
      agentColor: agentsTable.color,
      agentIcon: agentsTable.icon,
      propertyName: propertiesTable.name,
    })
    .from(reviewsTable)
    .innerJoin(tasksTable, eq(reviewsTable.taskId, tasksTable.id))
    .innerJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .innerJoin(propertiesTable, eq(tasksTable.propertyId, propertiesTable.id))
    .orderBy(sql`${reviewsTable.createdAt} DESC`);

  const filtered = queryParams.data.decision === "pending"
    ? reviews.filter((r) => !r.decision)
    : queryParams.data.decision
    ? reviews.filter((r) => r.decision === queryParams.data.decision)
    : reviews;

  res.json(filtered);
});

router.post("/reviews/:id/decide", async (req, res): Promise<void> => {
  const params = DecideReviewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = DecideReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [review] = await db
    .update(reviewsTable)
    .set({
      decision: parsed.data.decision,
      humanNotes: parsed.data.humanNotes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(reviewsTable.id, params.data.id))
    .returning();

  if (!review) {
    res.status(404).json({ error: "Review not found" });
    return;
  }

  const taskStatus = parsed.data.decision === "approved"
    ? "approved"
    : parsed.data.decision === "rejected"
    ? "rejected"
    : "revision_requested";

  await db.update(tasksTable)
    .set({ status: taskStatus, updatedAt: new Date() })
    .where(eq(tasksTable.id, review.taskId));

  try {
    await consolidateMemoryFromReview(review.id);
  } catch (err) {
    logger.warn({ err, reviewId: review.id }, "Memory consolidation failed — non-fatal");
  }

  res.json(review);
});

export default router;
