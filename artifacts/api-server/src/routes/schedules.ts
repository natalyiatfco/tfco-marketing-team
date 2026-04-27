import { Router, type IRouter } from "express";
import { eq, lte, and, sql } from "drizzle-orm";
import { db, schedulesTable, agentsTable, propertiesTable, tasksTable, fetchMemoryContext } from "@workspace/db";
import { CreateScheduleBody, UpdateScheduleBody, GetScheduleParams, ListSchedulesQueryParams } from "@workspace/api-zod";
import { openai, buildSystemPrompt } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import { fetchAnalyticsData, formatAnalyticsDataForPrompt } from "../lib/analytics-fetcher";
import type { Property, Agent } from "@workspace/db";
import { runManagerReview } from "../lib/manager-review";
import { buildBrandContext } from "../lib/brand-context";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function getTzOffsetMinutes(timezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  const h = parseInt(m.hour);
  const localAsUTC = Date.UTC(
    parseInt(m.year), parseInt(m.month) - 1, parseInt(m.day),
    h === 24 ? 0 : h, parseInt(m.minute), parseInt(m.second)
  );
  return (localAsUTC - date.getTime()) / 60000;
}

function makeLocalDate(year: number, month: number, day: number, hour: number, timezone: string): Date {
  const isoStr = `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:00:00`;
  const approx = new Date(`${isoStr}Z`);
  const offsetMin = getTzOffsetMinutes(timezone, approx);
  return new Date(approx.getTime() - offsetMin * 60000);
}

function getLocalDateParts(date: Date, timezone: string): { year: number; month: number; day: number; weekday: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", hour12: false, weekday: "short",
  }).formatToParts(date);
  const m: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") m[p.type] = p.value;
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(m.year),
    month: parseInt(m.month) - 1,
    day: parseInt(m.day),
    weekday: weekdays[m.weekday] ?? 0,
    hour: parseInt(m.hour),
  };
}

function clampDayOfMonth(year: number, month: number, targetDay: number): number {
  return Math.min(targetDay, new Date(year, month + 1, 0).getDate());
}

function computeNextRunAt(
  frequency: string,
  dayOfWeek: number | null,
  dayOfMonth: number | null,
  hour: number,
  timezone: string,
  after: Date = new Date()
): Date {
  const local = getLocalDateParts(after, timezone);

  if (frequency === "daily") {
    let candidate = makeLocalDate(local.year, local.month, local.day, hour, timezone);
    if (candidate.getTime() <= after.getTime()) {
      const tomorrow = new Date(after.getTime() + 86400000);
      const t = getLocalDateParts(tomorrow, timezone);
      candidate = makeLocalDate(t.year, t.month, t.day, hour, timezone);
    }
    return candidate;
  }

  if (frequency === "weekly") {
    const targetDay = dayOfWeek ?? 1;
    let daysOffset = (targetDay - local.weekday + 7) % 7;
    const todayCandidate = makeLocalDate(local.year, local.month, local.day, hour, timezone);
    if (daysOffset === 0 && todayCandidate.getTime() <= after.getTime()) daysOffset = 7;
    const futureDate = new Date(after.getTime() + daysOffset * 86400000);
    const f = getLocalDateParts(futureDate, timezone);
    return makeLocalDate(f.year, f.month, f.day, hour, timezone);
  }

  if (frequency === "monthly") {
    const targetDay = dayOfMonth ?? 1;
    const clampedDay = clampDayOfMonth(local.year, local.month, targetDay);
    let candidate = makeLocalDate(local.year, local.month, clampedDay, hour, timezone);
    if (candidate.getTime() <= after.getTime()) {
      let nextMonth = local.month + 1;
      let nextYear = local.year;
      if (nextMonth > 11) { nextMonth = 0; nextYear++; }
      const clampedNext = clampDayOfMonth(nextYear, nextMonth, targetDay);
      candidate = makeLocalDate(nextYear, nextMonth, clampedNext, hour, timezone);
    }
    return candidate;
  }

  return new Date(after.getTime() + 86400000);
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

  if (frequency !== undefined || dayOfWeek !== undefined || dayOfMonth !== undefined || hour !== undefined || timezone !== undefined) {
    updatePayload.frequency = newFrequency;
    updatePayload.dayOfWeek = newDayOfWeek ?? null;
    updatePayload.dayOfMonth = newDayOfMonth ?? null;
    updatePayload.hour = newHour;
    updatePayload.timezone = newTimezone;
    updatePayload.nextRunAt = computeNextRunAt(newFrequency, newDayOfWeek ?? null, newDayOfMonth ?? null, newHour, newTimezone);
  }

  if (status === "active" && existing.status === "paused" && !updatePayload.nextRunAt) {
    const isStale = !existing.nextRunAt || existing.nextRunAt <= new Date();
    if (isStale) {
      updatePayload.nextRunAt = computeNextRunAt(
        existing.frequency ?? "daily",
        existing.dayOfWeek ?? null,
        existing.dayOfMonth ?? null,
        existing.hour ?? 9,
        existing.timezone ?? "America/New_York",
      );
    }
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

async function dispatchScheduledTask(
  schedule: typeof schedulesTable.$inferSelect,
  agent: Agent,
  property: Property
): Promise<void> {
  const brandContext = buildBrandContext(property);

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
    scheduleId: schedule.id,
    title: `[Scheduled] ${schedule.taskType} — ${property.name}`,
    inputPrompt: promptWithContext,
    status: "running",
  }).returning();

  await db.update(schedulesTable).set({ lastTaskId: task.id, updatedAt: new Date() }).where(eq(schedulesTable.id, schedule.id));

  logger.info({ taskId: task.id, scheduleId: schedule.id, agent: agent.name }, "Dispatched scheduled task");

  setImmediate(async () => {
    try {
      let memoryContext = "";
      try {
        memoryContext = await fetchMemoryContext(property.id, agent.role);
      } catch (memErr) {
        logger.warn({ memErr, taskId: task.id }, "Memory context fetch failed for scheduled task — proceeding without it");
      }

      const systemPrompt = buildSystemPrompt(
        `${agent.systemPrompt}\n\n${brandContext}`,
        memoryContext,
        agent.role,
      );

      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: promptWithContext },
        ],
      });

      const output = response.choices[0]?.message?.content ?? "No output generated.";

      await db.update(tasksTable)
        .set({ output, status: "reviewing", updatedAt: new Date() })
        .where(eq(tasksTable.id, task.id));

      await runManagerReview(task.id, property.id, output, agent.name, agent.role, task.title);
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
