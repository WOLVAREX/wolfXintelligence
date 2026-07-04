import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, modelsTable, settingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth.js";
import { requireAdmin } from "../middlewares/auth.js";
import { getApiKey, callNvidiaChat } from "../lib/nvidia.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.use(requireAuth, requireAdmin);

const CANDIDATE_MODELS = [
  { name: "Llama 3.1 8B", modelId: "meta/llama-3.1-8b-instruct", category: "chat", description: "Fast and efficient Llama model by Meta", contextLength: 131072 },
  { name: "Llama 3.1 70B", modelId: "meta/llama-3.1-70b-instruct", category: "chat", description: "Powerful large Llama model by Meta", contextLength: 131072 },
  { name: "Llama 3.3 70B", modelId: "meta/llama-3.3-70b-instruct", category: "chat", description: "Latest Llama 3.3 with improved performance", contextLength: 131072 },
  { name: "Llama 3.1 405B", modelId: "meta/llama-3.1-405b-instruct", category: "chat", description: "Largest Llama model, highest quality", contextLength: 131072 },
  { name: "Nemotron 70B", modelId: "nvidia/llama-3.1-nemotron-70b-instruct", category: "reasoning", description: "NVIDIA reasoning-optimized model", contextLength: 131072 },
  { name: "Nemotron-Mini 4B", modelId: "nvidia/nemotron-mini-4b-instruct", category: "chat", description: "Compact NVIDIA model for fast responses", contextLength: 4096 },
  { name: "Mistral 7B", modelId: "mistralai/mistral-7b-instruct-v0.3", category: "chat", description: "Fast and capable open-source model", contextLength: 32768 },
  { name: "Mistral Nemo 12B", modelId: "nv-mistralai/mistral-nemo-12b-instruct", category: "chat", description: "Balanced performance and speed", contextLength: 131072 },
  { name: "Mistral Large", modelId: "mistralai/mistral-large-2-instruct", category: "chat", description: "Mistral's flagship model", contextLength: 131072 },
  { name: "Mixtral 8x7B", modelId: "mistralai/mixtral-8x7b-instruct-v0.1", category: "chat", description: "Mixture of experts for diverse tasks", contextLength: 65536 },
  { name: "Mixtral 8x22B", modelId: "mistralai/mixtral-8x22b-instruct-v0.1", category: "chat", description: "Large mixture of experts model", contextLength: 65536 },
  { name: "DeepSeek R1", modelId: "deepseek-ai/deepseek-r1", category: "reasoning", description: "State-of-the-art reasoning model", contextLength: 131072 },
  { name: "Qwen 2.5 72B", modelId: "qwen/qwen2.5-72b-instruct", category: "chat", description: "Alibaba's latest chat model", contextLength: 131072 },
  { name: "Qwen 2.5 Coder 32B", modelId: "qwen/qwen2.5-coder-32b-instruct", category: "code", description: "Specialized high-performance coding model", contextLength: 32768 },
  { name: "Gemma 2 9B", modelId: "google/gemma-2-9b-it", category: "chat", description: "Google's efficient open model", contextLength: 8192 },
  { name: "Gemma 2 27B", modelId: "google/gemma-2-27b-it", category: "chat", description: "Google's larger open model", contextLength: 8192 },
  { name: "Phi-3 Mini", modelId: "microsoft/phi-3-mini-4k-instruct", category: "chat", description: "Microsoft's compact and capable model", contextLength: 4096 },
  { name: "Phi-3 Medium", modelId: "microsoft/phi-3-medium-128k-instruct", category: "chat", description: "Microsoft's balanced model", contextLength: 131072 },
  { name: "Phi-3.5 Mini", modelId: "microsoft/phi-3.5-mini-instruct", category: "chat", description: "Microsoft's latest compact model", contextLength: 131072 },
  { name: "Granite 3.0 8B", modelId: "ibm/granite-3.0-8b-instruct", category: "chat", description: "IBM's enterprise-grade model", contextLength: 8192 },
  { name: "Granite 3.0 3B", modelId: "ibm/granite-3.0-3b-a800m-instruct", category: "chat", description: "IBM's small enterprise model", contextLength: 8192 },
];

// POST /api/admin/sync-models — test all candidate models and store working ones
router.post("/admin/sync-models", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(settingsTable).limit(1);
  const apiKey = getApiKey(settings?.nvidiaApiKey);

  if (!apiKey) {
    res.status(400).json({ error: "No NVIDIA API key configured. Add it in Settings first." });
    return;
  }

  logger.info("Starting NVIDIA model sync...");

  const results = await Promise.allSettled(
    CANDIDATE_MODELS.map(async (candidate) => {
      try {
        await callNvidiaChat({
          apiKey,
          modelId: candidate.modelId,
          messages: [{ role: "user", content: "Hi" }],
          maxTokens: 5,
          temperature: 0.1,
        });

        // Model works — upsert into DB
        const [existing] = await db.select().from(modelsTable).where(eq(modelsTable.modelId, candidate.modelId));
        if (!existing) {
          await db.insert(modelsTable).values({ ...candidate, isEnabled: true });
          logger.info({ modelId: candidate.modelId }, "Model added to DB");
        }

        return { name: candidate.name, modelId: candidate.modelId, status: "available" as const };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.debug({ modelId: candidate.modelId, error: msg }, "Model unavailable");
        return { name: candidate.name, modelId: candidate.modelId, status: "unavailable" as const, error: msg };
      }
    })
  );

  const all = results.map((r) => (r.status === "fulfilled" ? r.value : { status: "error" as const }));
  const available = all.filter((r) => r.status === "available");

  logger.info({ available: available.length, total: CANDIDATE_MODELS.length }, "Model sync complete");

  res.json({
    results: all,
    available: available.length,
    total: CANDIDATE_MODELS.length,
  });
});

// GET /api/admin/models/candidates — list all candidate model IDs
router.get("/admin/models/candidates", (_req, res): void => {
  res.json(CANDIDATE_MODELS);
});

export default router;
