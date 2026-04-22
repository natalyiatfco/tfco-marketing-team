import { eq } from "drizzle-orm";
import { db, agentsTable, tasksTable, reviewsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "./logger";

export async function runManagerReview(
  taskId: number,
  agentOutput: string,
  agentName: string,
  agentRole: string,
  taskTitle: string
): Promise<void> {
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
