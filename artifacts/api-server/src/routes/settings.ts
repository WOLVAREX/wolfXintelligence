import { Router, type IRouter } from "express";
import { db, settingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth.js";

const router: IRouter = Router();

function toSettingsResponse(s: typeof settingsTable.$inferSelect) {
  return {
    id: s.id,
    hasApiKey: !!s.nvidiaApiKey,
    defaultModelId: s.defaultModelId ?? null,
    updatedAt: s.updatedAt.toISOString(),
  };
}

async function ensureSettings() {
  const existing = await db.select().from(settingsTable).limit(1);
  if (existing.length > 0) return existing[0];
  const [created] = await db.insert(settingsTable).values({}).returning();
  return created;
}

router.get("/settings", async (_req, res): Promise<void> => {
  const s = await ensureSettings();
  res.json(GetSettingsResponse.parse(toSettingsResponse(s)));
});

router.patch("/settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const current = await ensureSettings();
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (parsed.data.nvidiaApiKey !== undefined) {
    updateData.nvidiaApiKey = parsed.data.nvidiaApiKey;
  }
  if (parsed.data.defaultModelId !== undefined) {
    updateData.defaultModelId = parsed.data.defaultModelId;
  }

  const [updated] = await db.update(settingsTable)
    .set(updateData)
    .returning();

  res.json(UpdateSettingsResponse.parse(toSettingsResponse(updated ?? current)));
});

export default router;
