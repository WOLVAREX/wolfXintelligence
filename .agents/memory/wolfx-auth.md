---
name: wolfX auth system
description: JWT auth, admin/user roles, how admin is seeded, and where NVIDIA key is read from
---

# wolfX Auth System

## Auth approach
- JWT stored in browser localStorage (`wolfx_token`)
- `setAuthTokenGetter` from `@workspace/api-client-react` wires the token into all API calls
- Server-side: `requireAuth` middleware checks Bearer token; `requireAdmin` checks `role === "admin"`

## Admin user seeding
- On every API server startup, `src/index.ts` calls `seedAdminUser()`
- Creates user `admin` with password `WolfX@2024!` if it doesn't exist
- Role: `admin`
- **Why hardcoded:** this is a private single-tenant tool; the user requested admin credentials

## NVIDIA key lookup order
`getApiKey()` in `src/lib/nvidia.ts`:
1. `fromDb` (stored in `settings.nvidia_api_key`)
2. `NVIDIA_API_KEY` env var
3. `NVIDIA_KEY` env var (Replit secret added by user)

## Route protection
- All routes except `/api/auth/login` and `/api/auth/me` require `requireAuth`
- Write routes protected by `requireAdmin`: agents (POST/PATCH/DELETE), settings (PATCH), admin/* routes
- `/api/conversations/direct` — any authenticated user can call (creates system agent for model)

## System agents
- Direct chat creates `__system_model_<modelId>` agents transparently
- Users never see or manage these agents
