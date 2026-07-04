import { logger } from "./logger";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export function getApiKey(fromDb?: string | null): string | null {
  return fromDb || process.env.NVIDIA_API_KEY || process.env.NVIDIA_KEY || null;
}

export interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface NvidiaCompletionResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export async function callNvidiaChat(params: {
  apiKey: string;
  modelId: string;
  messages: NvidiaMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<{ content: string; tokensUsed: number }> {
  const { apiKey, modelId, messages, temperature = 0.7, maxTokens = 2048 } = params;

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelId, messages, temperature, max_tokens: maxTokens, stream: false }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, body: errorText }, "NVIDIA API error");
    throw new Error(`NVIDIA API error: ${response.status} — ${errorText}`);
  }

  const data = (await response.json()) as NvidiaCompletionResponse;
  const content = data.choices[0]?.message?.content ?? "";
  const tokensUsed = data.usage?.total_tokens ?? 0;
  return { content, tokensUsed };
}

/**
 * Stream tokens from NVIDIA as an async generator.
 * Yields each text delta as it arrives.
 */
export async function* streamNvidiaChat(params: {
  apiKey: string;
  modelId: string;
  messages: NvidiaMessage[];
  temperature?: number;
  maxTokens?: number;
}): AsyncGenerator<string, { tokensUsed: number }, unknown> {
  const { apiKey, modelId, messages, temperature = 0.7, maxTokens = 2048 } = params;

  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modelId, messages, temperature, max_tokens: maxTokens, stream: true }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, body: errorText }, "NVIDIA streaming error");
    throw new Error(`NVIDIA API error: ${response.status} — ${errorText}`);
  }

  if (!response.body) throw new Error("No response body for streaming");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let totalTokens = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const payload = trimmed.slice(6);
      if (payload === "[DONE]") break;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>;
          usage?: { total_tokens?: number };
        };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) yield delta;
        if (parsed.usage?.total_tokens) totalTokens = parsed.usage.total_tokens;
      } catch { /* ignore malformed lines */ }
    }
  }

  return { tokensUsed: totalTokens };
}
