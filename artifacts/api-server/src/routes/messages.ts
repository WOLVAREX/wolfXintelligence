import { Router, type IRouter } from "express";
import { eq, asc, inArray } from "drizzle-orm";
import { db, messagesTable, conversationsTable, agentsTable, modelsTable, settingsTable } from "@workspace/db";
import {
  ListMessagesParams,
  ListMessagesResponse,
  SendMessageParams,
  SendMessageBody,
} from "@workspace/api-zod";
import { callNvidiaChat, streamNvidiaChat, getApiKey, type NvidiaMessage } from "../lib/nvidia.js";

const router: IRouter = Router();

function toMessageResponse(msg: typeof messagesTable.$inferSelect) {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    role: msg.role,
    content: msg.content,
    tokensUsed: msg.tokensUsed ?? null,
    createdAt: msg.createdAt.toISOString(),
  };
}

async function resolveApiKey() {
  const [settings] = await db.select().from(settingsTable).limit(1);
  return getApiKey(settings?.nvidiaApiKey);
}

async function resolveConversationContext(conversationId: number) {
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
  if (!conv) return null;
  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, conv.agentId));
  if (!agent) return null;
  const [model] = await db.select().from(modelsTable).where(eq(modelsTable.id, agent.modelId));
  if (!model) return null;
  return { conv, agent, model };
}

// ── List messages ──────────────────────────────────────────────────────────
router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));
  res.json(ListMessagesResponse.parse(msgs.map(toMessageResponse)));
});

// ── Send message (non-streaming, kept for compatibility) ──────────────────
router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const conversationId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const ctx = await resolveConversationContext(conversationId);
  if (!ctx) { res.status(404).json({ error: "Conversation, agent, or model not found" }); return; }
  const { agent, model } = ctx;

  const apiKey = await resolveApiKey();
  if (!apiKey) { res.status(400).json({ error: "NVIDIA API key not configured. Add your key in Settings." }); return; }

  const [userMessage] = await db.insert(messagesTable).values({
    conversationId,
    role: "user",
    content: parsed.data.content,
  }).returning();

  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt));

  const nvidiaMessages: NvidiaMessage[] = [
    { role: "system", content: agent.systemPrompt },
    ...history.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: parsed.data.content },
  ];

  const { content: aiContent, tokensUsed } = await callNvidiaChat({
    apiKey,
    modelId: model.modelId,
    messages: nvidiaMessages,
    temperature: agent.temperature ?? 0.7,
    maxTokens: agent.maxTokens ?? 2048,
  });

  const [assistantMessage] = await db.insert(messagesTable).values({
    conversationId, role: "assistant", content: aiContent, tokensUsed,
  }).returning();

  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));
  res.status(201).json({ userMessage: toMessageResponse(userMessage), assistantMessage: toMessageResponse(assistantMessage) });
});

// ── Streaming endpoint ────────────────────────────────────────────────────
router.post("/conversations/:id/stream", async (req, res): Promise<void> => {
  const conversationId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(conversationId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }

  const body = req.body as { content?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) { res.status(400).json({ error: "content is required" }); return; }

  const ctx = await resolveConversationContext(conversationId);
  if (!ctx) { res.status(404).json({ error: "Conversation, agent, or model not found" }); return; }
  const { agent, model } = ctx;

  const apiKey = await resolveApiKey();
  if (!apiKey) {
    res.status(400).json({ error: "NVIDIA API key not configured. Add your key in Settings." });
    return;
  }

  // Save user message first
  const [userMessage] = await db.insert(messagesTable).values({
    conversationId, role: "user", content,
  }).returning();

  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt));

  const nvidiaMessages: NvidiaMessage[] = [
    { role: "system", content: agent.systemPrompt },
    ...history.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content },
  ];

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send user message event first
  res.write(`data: ${JSON.stringify({ type: "user_message", message: toMessageResponse(userMessage) })}\n\n`);

  let fullContent = "";
  let tokensUsed = 0;

  try {
    const gen = streamNvidiaChat({
      apiKey,
      modelId: model.modelId,
      messages: nvidiaMessages,
      temperature: agent.temperature ?? 0.7,
      maxTokens: agent.maxTokens ?? 2048,
    });

    while (true) {
      const { done, value } = await gen.next();
      if (done) {
        tokensUsed = (value as { tokensUsed: number } | undefined)?.tokensUsed ?? 0;
        break;
      }
      fullContent += value;
      res.write(`data: ${JSON.stringify({ type: "delta", content: value })}\n\n`);
    }

    // Save assistant message
    const [assistantMessage] = await db.insert(messagesTable).values({
      conversationId, role: "assistant", content: fullContent, tokensUsed,
    }).returning();

    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));

    res.write(`data: ${JSON.stringify({ type: "done", message: toMessageResponse(assistantMessage) })}\n\n`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ type: "error", error: msg })}\n\n`);
  } finally {
    res.end();
  }
});

// ── Multi-model chat ──────────────────────────────────────────────────────
router.post("/conversations/:id/multi-chat", async (req, res): Promise<void> => {
  const conversationId = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  if (isNaN(conversationId)) { res.status(400).json({ error: "Invalid conversation id" }); return; }

  const body = req.body as { content?: unknown; modelIds?: unknown };
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const modelIds = Array.isArray(body.modelIds)
    ? body.modelIds.filter((x): x is number => typeof x === "number" && x > 0)
    : [];

  if (!content) { res.status(400).json({ error: "content is required" }); return; }
  if (!modelIds.length || modelIds.length > 4) { res.status(400).json({ error: "modelIds must have 1–4 valid model IDs" }); return; }

  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
  if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

  const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, conv.agentId));
  if (!agent) { res.status(400).json({ error: "Agent not found" }); return; }

  const requestedModels = await db.select().from(modelsTable).where(inArray(modelsTable.id, modelIds));
  if (!requestedModels.length) { res.status(400).json({ error: "No valid models found" }); return; }

  const apiKey = await resolveApiKey();
  if (!apiKey) { res.status(400).json({ error: "NVIDIA API key not configured." }); return; }

  const [userMessage] = await db.insert(messagesTable).values({
    conversationId, role: "user", content,
  }).returning();

  const history = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(asc(messagesTable.createdAt));

  const nvidiaMessages: NvidiaMessage[] = [
    { role: "system", content: agent.systemPrompt },
    ...history.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content },
  ];

  const results = await Promise.allSettled(
    requestedModels.map(async (model) => {
      const { content: aiContent, tokensUsed } = await callNvidiaChat({
        apiKey, modelId: model.modelId, messages: nvidiaMessages,
        temperature: agent.temperature ?? 0.7, maxTokens: agent.maxTokens ?? 2048,
      });
      return { modelId: model.id, modelName: model.name, modelDisplayId: model.modelId, content: aiContent, tokensUsed };
    })
  );

  const responses = results
    .filter((r): r is PromiseFulfilledResult<{ modelId: number; modelName: string; modelDisplayId: string; content: string; tokensUsed: number }> => r.status === "fulfilled")
    .map((r) => r.value);

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => String(r.reason));

  let assistantMessage = null;
  const primary = responses[0];
  if (primary) {
    const [msg] = await db.insert(messagesTable).values({
      conversationId, role: "assistant", content: primary.content, tokensUsed: primary.tokensUsed,
    }).returning();
    assistantMessage = toMessageResponse(msg);
  }

  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));
  res.status(201).json({ userMessage: toMessageResponse(userMessage), assistantMessage, responses, errors });
});

export default router;
