import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, modelsTable } from "@workspace/db";
import {
  GetModelParams,
  GetModelResponse,
  ListModelsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/models", async (_req, res): Promise<void> => {
  const models = await db.select().from(modelsTable).orderBy(modelsTable.category, modelsTable.name);
  res.json(ListModelsResponse.parse(models.map(m => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }))));
});

router.get("/models/:id", async (req, res): Promise<void> => {
  const params = GetModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [model] = await db.select().from(modelsTable).where(eq(modelsTable.id, id));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  res.json(GetModelResponse.parse({ ...model, createdAt: model.createdAt.toISOString() }));
});

export default router;
