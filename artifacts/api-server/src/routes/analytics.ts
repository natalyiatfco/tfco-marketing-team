import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import { GetPropertyParams } from "@workspace/api-zod";
import { fetchAnalyticsData } from "../lib/analytics-fetcher";

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

export default router;
