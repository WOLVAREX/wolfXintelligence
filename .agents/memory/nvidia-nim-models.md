---
name: NVIDIA NIM available models
description: Which NVIDIA NIM models actually work vs return 404 for free-tier accounts
---

## Confirmed working (HTTP 200)
- `meta/llama-3.1-8b-instruct` — fast chat
- `meta/llama-3.3-70b-instruct` — powerful chat/code
- `mistralai/mixtral-8x7b-instruct-v0.1` — mixture of experts
- `microsoft/phi-4-mini-instruct` — lightweight reasoning
- `meta/llama-3.2-11b-vision-instruct` — vision
- `meta/llama-3.2-90b-vision-instruct` — large vision

## Confirmed NOT accessible (HTTP 404) on free tier
- `meta/codellama-70b` / `meta/codellama-70b-instruct`
- `mistralai/mistral-large` / `mistralai/mistral-large-2-instruct`
- `nvidia/llama-3.1-nemotron-70b-instruct`
- `mistralai/mistral-7b-instruct-v0.3`
- `bigcode/starcoder2-15b`
- `google/gemma-2-9b-it`, `google/gemma-2-27b-it`, `google/gemma-3-12b-it`
- `microsoft/phi-3-medium-128k-instruct`, `microsoft/phi-3-mini-128k-instruct`
- `nvidia/nemotron-4-340b-instruct`

**Why:** Free/starter NVIDIA NIM accounts have restricted model access. "Not found for account" in the 404 body confirms this is account-level access restriction, not a bad model ID.

**How to apply:** When adding new models to the wolfX platform, test them first with a direct curl against the NVIDIA API before adding to the DB `models` table. Use `is_enabled=false` for unverified models.

## DB Columns
The `models` table has `is_enabled` boolean — set to false to hide from UI without deleting.
Only enabled models appear in the model selector and agents form.
