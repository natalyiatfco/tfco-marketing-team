import { Router, type IRouter } from "express";
import { eq, lte, and, sql } from "drizzle-orm";
import { db, schedulesTable, agentsTable, propertiesTable, tasksTable, reviewsTable } from "@workspace/db";
import { CreateScheduleBody, UpdateScheduleBody, GetScheduleParams, ListSchedulesQueryParams } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import { fetchAnalyticsData, formatAnalyticsDataForPrompt } from "../lib/analytics-fetcher";
import type { Property, Agent } from "@workspace/db";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeNextRunAt(
  frequency: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  hour: number,
  _timezone: string,
  after: Date = new Date()
): Date {
  const next = new Date(after);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(0);
  next.setHours(hour);

  if (frequency === "daily") {
    if (next <= after) next.setDate(next.getDate() + 1);
    return next;
  }

  if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1;
    const currentDay = next.getDay();
    let daysUntil = (targetDay - currentDay + 7) % 7;
    if (daysUntil === 0 && next <= after) daysUntil = 7;
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  if (frequency === "monthly") {
    const targetDate = dayOfMonth ?? 1;
    next.setDate(targetDate);
    if (next <= after) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDate);
    }
    return next;
  }

  next.setDate(next.getDate() + 1);
  return next;
}

async function buildScheduleResponse(schedule: typeof schedulesTable.$inferSelect) {
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, schedule.agentId));
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, schedule.propertyId));
  return {
    ...schedule,
    agentName: agent?.name ?? "Unknown",
    agentIcon: agent?.icon ?? "🤖",
    agentColor: agent?.color ?? "#666",
    propertyName: property?.name ?? "Unknown",
  };
}

// ── Routes ───────────────────────────────────────────────────────────────────

router.get("/schedules", async (req, res): Promise<void> => {
  const queryParams = ListSchedulesQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const schedules = await db
    .select()
    .from(schedulesTable)
    .orderBy(sql`${schedulesTable.createdAt} DESC`);

  const filtered = schedules.filter((s) => {
    if (queryParams.data.propertyId && s.propertyId !== queryParams.data.propertyId) return false;
    if (queryParams.data.status && s.status !== queryParams.data.status) return false;
    return true;
  });

  const result = await Promise.all(filtered.map(buildScheduleResponse));
  res.json(result);
});

router.post("/schedules", async (req, res): Promise<void> => {
  const parsed = CreateScheduleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, agentId, propertyId, taskType, inputPrompt, frequency, dayOfWeek, dayOfMonth, hour, timezone } = parsed.data;

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, agentId));
  if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }

  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, propertyId));
  if (!property) { res.status(404).json({ error: "Property not found" }); return; }

  const nextRunAt = computeNextRunAt(frequency, dayOfWeek ?? null, dayOfMonth ?? null, hour ?? 9, timezone ?? "America/New_York");

  const [schedule] = await db.insert(schedulesTable).values({
    name,
    agentId,
    propertyId,
    taskType,
    inputPrompt: inputPrompt ?? null,
    frequency,
    dayOfWeek: dayOfWeek ?? null,
    dayOfMonth: dayOfMonth ?? null,
    hour: hour ?? 9,
    timezone: timezone ?? "America/New_York",
    status: "active",
    nextRunAt,
  }).returning();

  const result = await buildScheduleResponse(schedule);
  res.status(201).json(result);
});

router.get("/schedules/:id", async (req, res): Promise<void> => {
  const params = GetScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [schedule] = await db.select().from(schedulesTable).where(eq(schedulesTable.id, params.data.id));
  if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }

  const result = await buildScheduleResponse(schedule);
  res.json(result);
});

router.patch("/schedules/:id", async (req, res): Promise<void> => {
  const params = GetScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const parsed = UpdateScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [existing] = await db.select().from(schedulesTable).where(eq(schedulesTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Schedule not found" }); return; }

  const { name, taskType, inputPrompt, frequency, dayOfWeek, dayOfMonth, hour, timezone, status } = parsed.data;

  const updatePayload: Partial<typeof schedulesTable.$inferInsert> = {};
  if (name !== undefined) updatePayload.name = name;
  if (taskType !== undefined) updatePayload.taskType = taskType;
  if (inputPrompt !== undefined) updatePayload.inputPrompt = inputPrompt;
  if (status !== undefined) updatePayload.status = status;

  const newFrequency = frequency ?? existing.frequency;
  const newDayOfWeek = dayOfWeek !== undefined ? dayOfWeek : existing.dayOfWeek;
  const newDayOfMonth = dayOfMonth !== undefined ? dayOfMonth : existing.dayOfMonth;
  const newHour = hour !== undefined ? hour : existing.hour;
  const newTimezone = timezone ?? existing.timezone;

  if (frequency !== undefined || dayOfWeek !== undefined || dayOfMonth !== undefined || hour !== undefined) {
    updatePayload.frequency = newFrequency;
    updatePayload.dayOfWeek = newDayOfWeek ?? null;
    updatePayload.dayOfMonth = newDayOfMonth ?? null;
    updatePayload.hour = newHour;
    updatePayload.timezone = newTimezone;
    updatePayload.nextRunAt = computeNextRunAt(newFrequency, newDayOfWeek ?? null, newDayOfMonth ?? null, newHour, newTimezone);
  }

  if (Object.keys(updatePayload).length === 0) {
    const result = await buildScheduleResponse(existing);
    res.json(result);
    return;
  }

  updatePayload.updatedAt = new Date();

  const [updated] = await db
    .update(schedulesTable)
    .set(updatePayload)
    .where(eq(schedulesTable.id, params.data.id))
    .returning();

  const result = await buildScheduleResponse(updated);
  res.json(result);
});

router.delete("/schedules/:id", async (req, res): Promise<void> => {
  const params = GetScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const [existing] = await db.select().from(schedulesTable).where(eq(schedulesTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Schedule not found" }); return; }

  await db.delete(schedulesTable).where(eq(schedulesTable.id, params.data.id));
  res.status(204).send();
});

export default router;

// ── Scheduler (cron runner) ───────────────────────────────────────────────────

async function runManagerReview(
  taskId: number,
  agentOutput: string,
  agentName: string,
  agentRole: string,
  taskTitle: string
): Promise<void> {
  const [managerAgent] = await db.select().from(agentsTable).where(eq(agentsTable.role, "manager")).limit(1);
  if (!managerAgent) {
    await db.update(tasksTable).set({ status: "failed", updatedAt: new Date() }).where(eq(tasksTable.id, taskId));
    return;
  }

  const reviewPrompt = `You are the Digital Marketing Manager reviewing work produced by the ${agentName} (${agentRole}).

Task: ${taskTitle}

Output to review:
${agentOutput}

Provide a structured review with:
1. Quality score (1-10)
2. Key strengths
3. Areas for improvement  
4. Overall recommendation (approve/reject/revision_requested)

Be concise and actionable. Format as plain text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: managerAgent.systemPrompt },
        { role: "user", content: reviewPrompt },
      ],
    });

    const feedback = response.choices[0]?.message?.content ?? "";
    const scoreMatch = feedback.match(/(?:score|rating)[:\s]+(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

    await db.insert(reviewsTable).values({
      taskId,
      managerFeedback: feedback,
      managerScore: score && score >= 1 && score <= 10 ? score : null,
    });

    await db.update(tasksTable).set({ status: "completed", updatedAt: new Date() }).where(eq(tasksTable.id, taskId));
  } catch (err) {
    logger.error({ err, taskId }, "Manager review failed in scheduled task");
    await db.update(tasksTable).set({ status: "failed", updatedAt: new Date() }).where(eq(tasksTable.id, taskId));
  }
}

async function dispatchScheduledTask(
  schedule: typeof schedulesTable.$inferSelect,
  agent: Agent,
  property: Property
): Promise<void> {
  const brandContext = [
    `Brand/Property: ${property.name}`,
    property.description ? `Description: ${property.description}` : null,
    property.brandVoice ? `Brand Voice: ${property.brandVoice}` : null,
    property.tone ? `Tone: ${property.tone}` : null,
    property.targetAudience ? `Target Audience: ${property.targetAudience}` : null,
    property.primaryKeywords ? `Primary Keywords: ${property.primaryKeywords}` : null,
  ].filter(Boolean).join("\n");

  const basePrompt = schedule.inputPrompt || schedule.taskType;
  let promptWithContext = basePrompt;

  if (agent.role === "digital_marketing_analyst") {
    try {
      const analyticsData = await fetchAnalyticsData(property, "30days");
      const analyticsText = formatAnalyticsDataForPrompt(analyticsData);
      promptWithContext = `${analyticsText}\n\n${basePrompt}`;
    } catch (err) {
      logger.warn({ err, scheduleId: schedule.id }, "Analytics data fetch failed for scheduled task");
    }
  }

  const [task] = await db.insert(tasksTable).values({
    agentId: schedule.agentId,
    propertyId: schedule.propertyId,
    title: `[Scheduled] ${schedule.taskType} — ${property.name}`,
    inputPrompt: promptWithContext,
    status: "running",
  }).returning();

  logger.info({ taskId: task.id, scheduleId: schedule.id, agent: agent.name }, "Dispatched scheduled task");

  setImmediate(async () => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: `${agent.systemPrompt}\n\n${brandContext}` },
          { role: "user", content: promptWithContext },
        ],
      });

      const output = response.choices[0]?.message?.content ?? "No output generated.";

      await db.update(tasksTable)
        .set({ output, status: "reviewing", updatedAt: new Date() })
        .where(eq(tasksTable.id, task.id));

      await runManagerReview(task.id, output, agent.name, agent.role, task.title);
    } catch (err) {
      logger.error({ err, taskId: task.id }, "Scheduled task execution failed");
      await db.update(tasksTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(tasksTable.id, task.id));
    }
  });

}

export function startScheduler(): void {
  logger.info("Task scheduler started — polling every 60 seconds");

  const tick = async () => {
    try {
      const now = new Date();
      const dueSchedules = await db
        .select()
        .from(schedulesTable)
        .where(and(eq(schedulesTable.status, "active"), lte(schedulesTable.nextRunAt, now)));

      if (dueSchedules.length === 0) return;

      logger.info({ count: dueSchedules.length }, "Processing due schedules");

      for (const schedule of dueSchedules) {
        try {
          const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, schedule.agentId));
          const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, schedule.propertyId));

          if (!agent || !property) {
            logger.warn({ scheduleId: schedule.id }, "Agent or property not found for schedule — skipping");
            continue;
          }

          const nextRunAt = computeNextRunAt(
            schedule.frequency,
            schedule.dayOfWeek ?? null,
            schedule.dayOfMonth ?? null,
            schedule.hour,
            schedule.timezone,
            now
          );

          await db.update(schedulesTable).set({
            lastRunAt: now,
            nextRunAt,
            updatedAt: now,
          }).where(eq(schedulesTable.id, schedule.id));

          await dispatchScheduledTask(schedule, agent, property);
        } catch (err) {
          logger.error({ err, scheduleId: schedule.id }, "Error dispatching scheduled task");
        }
      }
    } catch (err) {
      logger.error({ err }, "Scheduler tick error");
    }
  };

  tick();
  setInterval(tick, 60_000);
}
