# wolfX

AI agent workspace powered by NVIDIA AI models. Supports multiple AI agents, conversations, and configurable model access via the NVIDIA NIM API.

## Architecture

This is a **pnpm monorepo** (`pnpm-workspace.yaml`) with two runnable artifacts and shared libraries:

| Path | Description |
|------|-------------|
| `artifacts/wolfx` | React + Vite frontend (shadcn/ui, Tailwind v4, wouter routing) |
| `artifacts/api-server` | Express 5 API server with Drizzle ORM |
| `lib/db` | PostgreSQL schema + Drizzle config (shared) |
| `lib/api-client-react` | Auto-generated React Query hooks from OpenAPI spec |
| `lib/api-zod` | Auto-generated Zod schemas from OpenAPI spec |
| `lib/api-spec` | OpenAPI spec + orval config for code generation |

## Running locally on Replit

Two workflows are configured:

- **API Server** — `cd artifacts/api-server && PORT=3000 pnpm run dev` (console, port 3000)
- **Start application** — `cd artifacts/wolfx && PORT=5000 pnpm run dev` (webview, port 5000)

The Vite dev server proxies `/api/*` → `http://localhost:3000`.

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Auto-provided by Replit PostgreSQL |
| `SESSION_SECRET` | Yes | Set as a Replit Secret |
| `BASE_PATH` | Yes | Set to `/` (shared env var) |
| `NVIDIA_API_KEY` | Optional | Fallback if not set in the database via Settings |

## Database

Uses Replit's built-in PostgreSQL. Schema managed with Drizzle ORM.

To push schema changes: `cd lib/db && pnpm run push`

Tables: `models`, `agents`, `conversations`, `messages`, `settings`

## Getting started

1. Open **Settings** in the app to add your NVIDIA API key.
2. Go to **Models** to verify available NVIDIA NIM models.
3. Create an **Agent** with a system prompt and model.
4. Start a **New Chat** to begin a conversation.

## User preferences

- Use pnpm for all package management (enforced by preinstall script).
