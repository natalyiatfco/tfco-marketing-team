import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, propertiesTable } from "@workspace/db";
import type { Property } from "@workspace/db";
import { CreatePropertyBody, GetPropertyParams, UpdatePropertyParams, UpdatePropertyBody, DeletePropertyParams } from "@workspace/api-zod";

const router: IRouter = Router();

const CREDENTIAL_FIELDS = [
  "wordpressUrl",
  "wordpressUsername",
  "wordpressAppPassword",
  "squarespaceApiKey",
  "squarespaceCollectionId",
] as const;

function toSafeProperty(property: Property) {
  const {
    wordpressUrl,
    wordpressUsername,
    wordpressAppPassword,
    squarespaceApiKey,
    squarespaceCollectionId,
    ...safe
  } = property;
  return {
    ...safe,
    wordpressConfigured: !!(wordpressUrl && wordpressUsername && wordpressAppPassword),
    squarespaceConfigured: !!(squarespaceApiKey && squarespaceCollectionId),
  };
}

router.get("/properties", async (req, res): Promise<void> => {
  const properties = await db.select().from(propertiesTable).orderBy(propertiesTable.createdAt);
  res.json(properties.map(toSafeProperty));
});

router.post("/properties", async (req, res): Promise<void> => {
  const parsed = CreatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [property] = await db.insert(propertiesTable).values(parsed.data).returning();
  res.status(201).json(toSafeProperty(property));
});

router.get("/properties/:id", async (req, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [property] = await db.select().from(propertiesTable).where(eq(propertiesTable.id, params.data.id));
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json(toSafeProperty(property));
});

router.patch("/properties/:id", async (req, res): Promise<void> => {
  const params = UpdatePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdatePropertyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData = Object.fromEntries(
    Object.entries(parsed.data).filter(([k, v]) => {
      if ((CREDENTIAL_FIELDS as readonly string[]).includes(k) && (v === "" || v === null || v === undefined)) {
        return false;
      }
      return true;
    })
  );

  const [property] = await db
    .update(propertiesTable)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(propertiesTable.id, params.data.id))
    .returning();
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.json(toSafeProperty(property));
});

router.delete("/properties/:id", async (req, res): Promise<void> => {
  const params = DeletePropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [property] = await db.delete(propertiesTable).where(eq(propertiesTable.id, params.data.id)).returning();
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
