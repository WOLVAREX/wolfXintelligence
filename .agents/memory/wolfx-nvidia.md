---
name: wolfX NVIDIA API integration
description: How NVIDIA API key and model calls are handled in wolfXintelligence
---

## NVIDIA API Key Handling

- Stored in `settings` table column `nvidia_api_key` (nullable text)
- API never returns the key itself — only `hasApiKey: boolean` is exposed
- `GET /settings` → `{ hasApiKey: true/false, ... }`
- `PATCH /settings` with `{ nvidiaApiKey: "nvapi-..." }` to set/update

## NVIDIA Chat Calls

- All calls go through `artifacts/api-server/src/lib/nvidia.ts` → `callNvidiaChat()`
- Base URL: `https://integrate.api.nvidia.com/v1`
- Endpoint: `POST /chat/completions` (OpenAI-compatible format)
- Auth header: `Authorization: Bearer <key>`
- Returns `{ content: string, tokensUsed: number }`

**Why:** NVIDIA NIM uses the OpenAI chat completions API format, making it easy to swap models by just changing the `model` field.

**How to apply:** When adding new NVIDIA models, just add them to the `models` table — no code changes needed. The model's `modelId` field maps directly to the NVIDIA API model string.

## Models Seeding

- 15 NVIDIA models seeded at init, organized by category: code, chat, reasoning, vision
- Add new models via SQL INSERT into `models` table — no restart needed
- Model categories: `code`, `chat`, `reasoning`, `vision`
