import { Router, type IRouter } from "express";
import { eq, sql, count, gte, isNull } from "drizzle-orm";
import { db, tasksTable, agentsTable, propertiesTable, reviewsTable, schedulesTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [totalTasksResult] = await db.select({ count: count() }).from(tasksTable);
  const [totalPropertiesResult] = await db.select({ count: count() }).from(propertiesTable);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const [tasksThisWeekResult] = await db
    .select({ count: count() })
    .from(tasksTable)
    .where(gte(tasksTable.createdAt, oneWeekAgo));

  const pendingApprovalReviews = await db
    .select({ count: count() })
    .from(reviewsTable)
    .where(isNull(reviewsTable.decision));

  const approvedReviews = await db
    .select({ count: count() })
    .from(reviewsTable)
    .where(eq(reviewsTable.decision, "approved"));

  const rejectedReviews = await db
    .select({ count: count() })
    .from(reviewsTable)
    .where(eq(reviewsTable.decision, "rejected"));

  const tasksByAgentRaw = await db
    .select({
      agentId: agentsTable.id,
      agentName: agentsTable.name,
      agentColor: agentsTable.color,
      agentIcon: agentsTable.icon,
      count: count(tasksTable.id),
    })
    .from(agentsTable)
    .leftJoin(tasksTable, eq(agentsTable.id, tasksTable.agentId))
    .groupBy(agentsTable.id, agentsTable.name, agentsTable.color, agentsTable.icon)
    .orderBy(sql`count(${tasksTable.id}) DESC`);

  const upcomingSchedulesRaw = await db
    .select({
      id: schedulesTable.id,
      name: schedulesTable.name,
      agentName: agentsTable.name,
      agentIcon: agentsTable.icon,
      agentColor: agentsTable.color,
      propertyName: propertiesTable.name,
      frequency: schedulesTable.frequency,
      nextRunAt: schedulesTable.nextRunAt,
    })
    .from(schedulesTable)
    .innerJoin(agentsTable, eq(schedulesTable.agentId, agentsTable.id))
    .innerJoin(propertiesTable, eq(schedulesTable.propertyId, propertiesTable.id))
    .where(eq(schedulesTable.status, "active"))
    .orderBy(schedulesTable.nextRunAt)
    .limit(5);

  const tasksByPropertyRaw = await db
    .select({
      propertyId: propertiesTable.id,
      propertyName: propertiesTable.name,
      count: count(tasksTable.id),
    })
    .from(propertiesTable)
    .leftJoin(tasksTable, eq(propertiesTable.id, tasksTable.propertyId))
    .groupBy(propertiesTable.id, propertiesTable.name)
    .orderBy(sql`count(${tasksTable.id}) DESC`);

  const approvedByPropertyRaw = await db
    .select({ propertyId: tasksTable.propertyId, count: count() })
    .from(reviewsTable)
    .innerJoin(tasksTable, eq(reviewsTable.taskId, tasksTable.id))
    .where(eq(reviewsTable.decision, "approved"))
    .groupBy(tasksTable.propertyId);

  const pendingByPropertyRaw = await db
    .select({ propertyId: tasksTable.propertyId, count: count() })
    .from(reviewsTable)
    .innerJoin(tasksTable, eq(reviewsTable.taskId, tasksTable.id))
    .where(isNull(reviewsTable.decision))
    .groupBy(tasksTable.propertyId);

  const approvedMap = new Map(approvedByPropertyRaw.map((r) => [r.propertyId, r.count]));
  const pendingMap = new Map(pendingByPropertyRaw.map((r) => [r.propertyId, r.count]));

  const summary = {
    totalTasks: totalTasksResult?.count ?? 0,
    pendingApproval: pendingApprovalReviews[0]?.count ?? 0,
    approved: approvedReviews[0]?.count ?? 0,
    rejected: rejectedReviews[0]?.count ?? 0,
    totalProperties: totalPropertiesResult?.count ?? 0,
    tasksThisWeek: tasksThisWeekResult?.count ?? 0,
    tasksByAgent: tasksByAgentRaw.map((a) => ({
      agentId: a.agentId,
      agentName: a.agentName,
      agentColor: a.agentColor,
      agentIcon: a.agentIcon,
      count: a.count,
    })),
    upcomingSchedules: upcomingSchedulesRaw.map((s) => ({
      id: s.id,
      name: s.name,
      agentName: s.agentName,
      agentIcon: s.agentIcon,
      agentColor: s.agentColor,
      propertyName: s.propertyName,
      frequency: s.frequency,
      nextRunAt: s.nextRunAt?.toISOString() ?? null,
    })),
    tasksByProperty: tasksByPropertyRaw.map((p) => ({
      propertyId: p.propertyId,
      propertyName: p.propertyName,
      count: p.count,
      approved: approvedMap.get(p.propertyId) ?? 0,
      pending: pendingMap.get(p.propertyId) ?? 0,
    })),
  };

  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/dashboard/activity", async (req, res): Promise<void> => {
  const queryParams = GetRecentActivityQueryParams.safeParse(req.query);
  if (!queryParams.success) {
    res.status(400).json({ error: queryParams.error.message });
    return;
  }

  const limit = queryParams.data.limit ?? 20;

  const activity = await db
    .select({
      taskId: tasksTable.id,
      taskTitle: tasksTable.title,
      agentName: agentsTable.name,
      agentColor: agentsTable.color,
      agentIcon: agentsTable.icon,
      propertyName: propertiesTable.name,
      status: tasksTable.status,
      createdAt: tasksTable.createdAt,
    })
    .from(tasksTable)
    .innerJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .innerJoin(propertiesTable, eq(tasksTable.propertyId, propertiesTable.id))
    .orderBy(sql`${tasksTable.createdAt} DESC`)
    .limit(limit);

  res.json(GetRecentActivityResponse.parse(activity));
});

export default router;
