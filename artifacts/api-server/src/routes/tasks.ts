import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, tasksTable, agentsTable, propertiesTable, reviewsTable } from "@workspace/db";
import { CreateTaskBody, GetTaskParams, ListTasksQueryParams } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";

const router: IRouter = Router();

async function runManagerReview(taskId: number, agentOutput: string, agentName: string, agentRole: string, taskTitle: string): Promise<void> {
  const [managerAgent] = await db.select().from(agentsTable).where(eq(agentsTable.role, "manager")).limit(1);
  if (!managerAgent) {
    logger.warn({ taskId }, "No manager agent found; skipping review");
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
    logger.error({ err, taskId }, "Manager review LLM call failed — marking task failed to preserve workflow integrity");
    await db.update(tasksTable).set({ status: "failed", updatedAt: new Date() }).where(eq(tasksTable.id, taskId));
  }
}

router.get("/tasks", async (req, res): Promise<void> => {
  const queryParams = ListTasksQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  let query = db
    .select({
      id: tasksTable.id,
      agentId: tasksTable.agentId,
      agentName: agentsTable.name,
      agentRole: agentsTable.role,
      agentColor: agentsTable.color,
      agentIcon: agentsTable.icon,
      propertyId: tasksTable.propertyId,
      propertyName: propertiesTable.name,
      title: tasksTable.title,
      inputPrompt: tasksTable.inputPrompt,
      output: tasksTable.output,
      status: tasksTable.status,
      publishStatus: tasksTable.publishStatus,
      publishUrl: tasksTable.publishUrl,
      publishPlatform: tasksTable.publishPlatform,
      publishedAt: tasksTable.publishedAt,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
    })
    .from(tasksTable)
    .innerJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .innerJoin(propertiesTable, eq(tasksTable.propertyId, propertiesTable.id));

  const tasks = await query.orderBy(sql`${tasksTable.createdAt} DESC`);

  const filtered = tasks.filter((t) => {
    if (queryParams.data.status && t.status !== queryParams.data.status) return false;
    if (queryParams.data.propertyId && t.propertyId !== queryParams.data.propertyId) return false;
    if (queryParams.data.agentId && t.agentId !== queryParams.data.agentId) return false;
    return true;
  });

  res.json(filtered);
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, parsed.data.agentId));
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, parsed.data.propertyId));
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }

  const [task] = await db.insert(tasksTable).values({
    agentId: parsed.data.agentId,
    propertyId: parsed.data.propertyId,
    title: parsed.data.title,
    inputPrompt: parsed.data.inputPrompt,
    status: "running",
  }).returning();

  const brandContext = [
    `Brand/Property: ${property.name}`,
    property.description ? `Description: ${property.description}` : null,
    property.brandVoice ? `Brand Voice: ${property.brandVoice}` : null,
    property.tone ? `Tone: ${property.tone}` : null,
    property.targetAudience ? `Target Audience: ${property.targetAudience}` : null,
    property.primaryKeywords ? `Primary Keywords: ${property.primaryKeywords}` : null,
    property.websiteUrl ? `Website: ${property.websiteUrl}` : null,
  ].filter(Boolean).join("\n");

  res.status(201).json({
    ...task,
    agentName: agent.name,
    agentRole: agent.role,
    agentColor: agent.color,
    agentIcon: agent.icon,
    propertyName: property.name,
    review: null,
  });

  setImmediate(async () => {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5.1",
        max_completion_tokens: 4096,
        messages: [
          { role: "system", content: `${agent.systemPrompt}\n\n${brandContext}` },
          { role: "user", content: parsed.data.inputPrompt },
        ],
      });

      const output = response.choices[0]?.message?.content ?? "No output generated.";

      await db.update(tasksTable)
        .set({ output, status: "reviewing", updatedAt: new Date() })
        .where(eq(tasksTable.id, task.id));

      await runManagerReview(task.id, output, agent.name, agent.role, task.title);
    } catch (err) {
      logger.error({ err, taskId: task.id }, "Task execution failed");
      await db.update(tasksTable)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(tasksTable.id, task.id));
    }
  });
});

router.get("/tasks/:id", async (req, res): Promise<void> => {
  const params = GetTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [task] = await db
    .select({
      id: tasksTable.id,
      agentId: tasksTable.agentId,
      agentName: agentsTable.name,
      agentRole: agentsTable.role,
      agentColor: agentsTable.color,
      agentIcon: agentsTable.icon,
      propertyId: tasksTable.propertyId,
      propertyName: propertiesTable.name,
      title: tasksTable.title,
      inputPrompt: tasksTable.inputPrompt,
      output: tasksTable.output,
      status: tasksTable.status,
      publishStatus: tasksTable.publishStatus,
      publishUrl: tasksTable.publishUrl,
      publishPlatform: tasksTable.publishPlatform,
      publishedAt: tasksTable.publishedAt,
      wordpressConfigured: propertiesTable.wordpressUrl,
      squarespaceConfigured: propertiesTable.squarespaceApiKey,
      createdAt: tasksTable.createdAt,
      updatedAt: tasksTable.updatedAt,
    })
    .from(tasksTable)
    .innerJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .innerJoin(propertiesTable, eq(tasksTable.propertyId, propertiesTable.id))
    .where(eq(tasksTable.id, params.data.id));

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const [review] = await db.select().from(reviewsTable).where(eq(reviewsTable.taskId, params.data.id));

  const { wordpressConfigured, squarespaceConfigured, ...taskData } = task;

  res.json({
    ...taskData,
    wordpressConfigured: !!wordpressConfigured,
    squarespaceConfigured: !!squarespaceConfigured,
    review: review ?? null,
  });
});

export default router;
