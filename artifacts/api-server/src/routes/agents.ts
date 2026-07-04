import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, agentsTable, modelsTable, conversationsTable } from "@workspace/db";
import {
  CreateAgentBody,
  GetAgentParams,
  GetAgentResponse,
  ListAgentsResponse,
  UpdateAgentParams,
  UpdateAgentBody,
  UpdateAgentResponse,
  DeleteAgentParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth.js";

const router: IRouter = Router();

async function buildAgentResponse(agent: typeof agentsTable.$inferSelect) {
  const [modelRow] = await db.select({ name: modelsTable.name }).from(modelsTable).where(eq(modelsTable.id, agent.modelId));
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversationsTable)
    .where(eq(conversationsTable.agentId, agent.id));

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description ?? null,
    modelId: agent.modelId,
    modelName: modelRow?.name ?? null,
    systemPrompt: agent.systemPrompt,
    temperature: agent.temperature ?? null,
    maxTokens: agent.maxTokens ?? null,
    conversationCount: countRow?.count ?? 0,
    createdAt: agent.createdAt.toISOString(),
  };
}

router.get("/agents", async (_req, res): Promise<void> => {
  const agents = await db.select().from(agentsTable).orderBy(agentsTable.createdAt);
  const result = await Promise.all(agents.map(buildAgentResponse));
  res.json(ListAgentsResponse.parse(result));
});

router.post("/agents", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db.insert(agentsTable).values(parsed.data).returning();
  res.status(201).json(GetAgentResponse.parse(await buildAgentResponse(agent)));
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const params = GetAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id));
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(GetAgentResponse.parse(await buildAgentResponse(agent)));
});

router.patch("/agents/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const parsed = UpdateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db.update(agentsTable).set(parsed.data).where(eq(agentsTable.id, id)).returning();
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(UpdateAgentResponse.parse(await buildAgentResponse(agent)));
});

router.delete("/agents/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deleted] = await db.delete(agentsTable).where(eq(agentsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
