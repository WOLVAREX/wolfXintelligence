import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, conversationsTable, messagesTable, agentsTable, modelsTable } from "@workspace/db";
import { GetDashboardStatsResponse, GetModelUsageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/stats", async (_req, res): Promise<void> => {
  const [convCount] = await db.select({ count: sql<number>`count(*)::int` }).from(conversationsTable);
  const [msgCount] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable);
  const [agentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(agentsTable);
  const [modelCount] = await db.select({ count: sql<number>`count(*)::int` }).from(modelsTable).where(eq(modelsTable.isEnabled, true));
  const [tokensRow] = await db.select({ total: sql<number>`coalesce(sum(tokens_used), 0)::int` }).from(messagesTable);

  const recentConvs = await db.select().from(conversationsTable).orderBy(desc(conversationsTable.updatedAt)).limit(5);

  const recentWithMeta = await Promise.all(recentConvs.map(async (conv) => {
    const [agentRow] = await db.select({ agentName: agentsTable.name, modelId: agentsTable.modelId }).from(agentsTable).where(eq(agentsTable.id, conv.agentId));
    const modelName = agentRow?.modelId
      ? await db.select({ name: modelsTable.name }).from(modelsTable).where(eq(modelsTable.id, agentRow.modelId)).then(r => r[0]?.name ?? null)
      : null;
    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(messagesTable).where(eq(messagesTable.conversationId, conv.id));
    const [lastMsg] = await db.select({ content: messagesTable.content }).from(messagesTable).where(eq(messagesTable.conversationId, conv.id)).orderBy(desc(messagesTable.createdAt)).limit(1);
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
  }));

  res.json(GetDashboardStatsResponse.parse({
    totalConversations: convCount?.count ?? 0,
    totalMessages: msgCount?.count ?? 0,
    totalAgents: agentCount?.count ?? 0,
    activeModels: modelCount?.count ?? 0,
    tokensUsed: tokensRow?.total ?? 0,
    recentConversations: recentWithMeta,
  }));
});

router.get("/stats/model-usage", async (_req, res): Promise<void> => {
  const usage = await db
    .select({
      modelName: modelsTable.name,
      modelId: modelsTable.modelId,
      messageCount: sql<number>`count(${messagesTable.id})::int`,
      tokensUsed: sql<number>`coalesce(sum(${messagesTable.tokensUsed}), 0)::int`,
    })
    .from(modelsTable)
    .leftJoin(agentsTable, eq(agentsTable.modelId, modelsTable.id))
    .leftJoin(conversationsTable, eq(conversationsTable.agentId, agentsTable.id))
    .leftJoin(messagesTable, eq(messagesTable.conversationId, conversationsTable.id))
    .groupBy(modelsTable.id, modelsTable.name, modelsTable.modelId)
    .orderBy(desc(sql`count(${messagesTable.id})`));

  res.json(GetModelUsageResponse.parse(usage.map(u => ({
    modelName: u.modelName,
    modelId: u.modelId,
    messageCount: u.messageCount ?? 0,
    tokensUsed: u.tokensUsed ?? 0,
  }))));
});

export default router;
