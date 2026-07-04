import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, conversationsTable, agentsTable, modelsTable, messagesTable } from "@workspace/db";
import {
  CreateConversationBody,
  GetConversationParams,
  GetConversationResponse,
  ListConversationsResponse,
  ListConversationsQueryParams,
  DeleteConversationParams,
} from "@workspace/api-zod";
import { requireAdmin } from "../middlewares/auth.js";

const router: IRouter = Router();

async function buildConversationResponse(conv: typeof conversationsTable.$inferSelect) {
  const [agentRow] = await db
    .select({ agentName: agentsTable.name, modelId: agentsTable.modelId })
    .from(agentsTable)
    .where(eq(agentsTable.id, conv.agentId));

  const modelName = agentRow?.modelId
    ? await db.select({ name: modelsTable.name }).from(modelsTable).where(eq(modelsTable.id, agentRow.modelId)).then(r => r[0]?.name ?? null)
    : null;

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id));

  const [lastMsg] = await db
    .select({ content: messagesTable.content })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conv.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(1);

  return {
    id: conv.id,
    title: conv.title,
    agentId: conv.agentId,
    agentName: agentRow?.agentName ?? "Unknown",
    modelName: modelName ?? null,
    messageCount: countRow?.count ?? 0,
    lastMessage: lastMsg?.content ? lastMsg.content.slice(0, 120) : null,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
  };
}

router.get("/conversations", async (req, res): Promise<void> => {
  const query = ListConversationsQueryParams.safeParse(req.query);
  const agentId = query.success ? query.data.agentId : undefined;

  let convs;
  if (agentId != null) {
    convs = await db.select().from(conversationsTable).where(eq(conversationsTable.agentId, agentId)).orderBy(desc(conversationsTable.updatedAt));
  } else {
    convs = await db.select().from(conversationsTable).orderBy(desc(conversationsTable.updatedAt));
  }

  const result = await Promise.all(convs.map(buildConversationResponse));
  res.json(ListConversationsResponse.parse(result));
});

// Direct chat — find or create a system agent for the given model, then create a conversation.
// Used by the user-facing chat flow (no agent selection required).
router.post("/conversations/direct", async (req, res): Promise<void> => {
  const body = req.body as { modelId?: unknown; title?: unknown };
  const modelId = typeof body.modelId === "number" ? body.modelId : parseInt(String(body.modelId), 10);
  const title = typeof body.title === "string" ? body.title : undefined;

  if (!modelId || isNaN(modelId) || modelId <= 0) {
    res.status(400).json({ error: "modelId (number) is required" });
    return;
  }

  const [model] = await db.select().from(modelsTable).where(eq(modelsTable.id, modelId));
  if (!model) {
    res.status(404).json({ error: "Model not found" });
    return;
  }

  // Find or create a system agent for this model
  const systemAgentName = `__system_model_${modelId}`;
  let [agent] = await db.select().from(agentsTable).where(eq(agentsTable.name, systemAgentName));

  if (!agent) {
    [agent] = await db.insert(agentsTable).values({
      name: systemAgentName,
      description: `System agent for ${model.name}`,
      modelId,
      systemPrompt: "You are a helpful AI assistant. Be concise, accurate, and friendly.",
      temperature: 0.7,
      maxTokens: 2048,
    }).returning();
  }

  const conversationTitle = title ?? `Chat with ${model.name}`;

  const [conv] = await db.insert(conversationsTable).values({
    agentId: agent.id,
    title: conversationTitle,
  }).returning();

  res.status(201).json(GetConversationResponse.parse(await buildConversationResponse(conv)));
});

// Admin-only: create conversation with explicit agent
router.post("/conversations", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, parsed.data.agentId));
  if (!agent) {
    res.status(400).json({ error: "Agent not found" });
    return;
  }

  const title = parsed.data.title ?? "New Conversation";
  const [conv] = await db.insert(conversationsTable).values({
    agentId: parsed.data.agentId,
    title,
  }).returning();

  res.status(201).json(GetConversationResponse.parse(await buildConversationResponse(conv)));
});

router.get("/conversations/:id", async (req, res): Promise<void> => {
  const params = GetConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.json(GetConversationResponse.parse(await buildConversationResponse(conv)));
});

router.delete("/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [deleted] = await db.delete(conversationsTable).where(eq(conversationsTable.id, id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
