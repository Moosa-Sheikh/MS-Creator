# Etsy Mockup Tool

## Overview

AI-powered Etsy product mockup creation tool. Single-password login, products → session wizard → AI Q&A → prompt enhancer → fal.io image generation → template save.

pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo**: pnpm workspaces
- **Frontend**: React + Vite (artifacts/mockup-tool) at `/`
- **Backend**: Express 5 API server (artifacts/api-server) at `/api`
- **Database**: PostgreSQL + Drizzle ORM (UUID primary keys)
- **Auth**: iron-session (cookie-based, single APP_PASSWORD)
- **API codegen**: Orval (OpenAPI spec → React Query hooks + Zod schemas)
- **Object storage**: Replit Object Storage (image uploads)
- **AI**: OpenRouter or Claude (LLM), fal.io (image generation)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec (auto-fixes api-zod/src/index.ts)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Important Notes

- `lib/api-zod/src/index.ts` must stay as single-line `export * from "./generated/api";` — codegen script now auto-fixes this
- DB uses UUID primary keys for all main tables (products, sessions, templates, fal_models, llm_configs)
- Settings table uses integer PK (single row, id always = 1)
- Image upload: call `useRequestUploadUrl` → PUT to presigned URL → store objectPath
- Image serving: `/api/storage${objectPath}` (objectPath starts with /objects/)

## Project Structure

```
artifacts/
  api-server/      Express API server
  mockup-tool/     React+Vite frontend
lib/
  api-spec/        OpenAPI spec + orval codegen config
  api-client-react/ Generated React Query hooks
  api-zod/         Generated Zod validation schemas
  db/              Drizzle ORM schema + DB client
  object-storage-web/ Object storage client helpers
```

## DB Schema Tables

- `products` — Etsy products (uuid id)
- `sessions` — Mockup generation sessions (uuid id, uuid product_id)
- `templates` — Saved successful sessions (uuid id, uuid product_id)
- `fal_models` — fal.io model configs (uuid id)
- `llm_configs` — OpenRouter/Claude LLM configs (uuid id)
- `app_settings` — Single-row global settings (integer id = 1)

## Build Status

- Phase 1 complete: login, sidebar layout, products dashboard
- Phase 2+: session wizard, Q&A, prompt enhancer, generation, templates, settings
