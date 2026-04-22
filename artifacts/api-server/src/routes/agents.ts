import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, agentsTable } from "@workspace/db";
import { GetAgentParams, UpdateAgentBody, UpdateAgentParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/agents", async (req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.id);
  res.json(agents);
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const params = GetAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, params.data.id));
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(agent);
});

router.patch("/agents/:id", async (req, res): Promise<void> => {
  const params = UpdateAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = UpdateAgentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updates: Record<string, string> = {};
  if (body.data.systemPrompt !== undefined) updates.systemPrompt = body.data.systemPrompt;
  if (body.data.description !== undefined) updates.description = body.data.description;

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(agentsTable)
    .set(updates)
    .where(eq(agentsTable.id, params.data.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(updated);
});

export default router;
