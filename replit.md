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
- Phase 2 complete: ActiveProductContext, product CRUD, ActiveProductBanner
- Phase 3 complete: 5-step WizardModal, UploadZone (presigned GCS), session creation
- Phase 4 complete: Settings panel (3-tab), per-key API key save, 2-step curl add modal, DynamicParamForm, /api/parse-curl endpoint
- Phase 5 complete: AI Q&A phase rebuilt, analyze-reference bug fixed, 2-panel QA layout, prompt builder
- Phase 6 complete: PromptEnhancer rebuilt (2-panel), Regenerate Q&A, Rewrite All confirm dialogs, inline Generate, suggestions panel with Accept/Skip/Accept All
- Phase 7 complete: GeneratingPanel (pulsing progress, prompt preview, per-image dots), ResultsGallery rebuilt (M1 large/M2 grid, ImageCard with View Full + Download, lightbox, Edit Prompt + Generate Again actions), generation.ts updated (queue polling for async fal models, 3-format image URL extraction, per-image error handling)
- Phase 8 complete: Template browser page (/templates/:productId) — grid with M1/M2 filter, card thumbnails, "Use" (opens wizard pre-loaded) + delete w/ confirm, template detail modal (image gallery, prompt copy, Q&A summary); ActiveProductBanner navigates to templates and shows real count (fetches own data); TemplatePicker fixed to handle external fal.io image URLs; WizardModal accepts initialTemplateId prop; AI Q&A enhanced with full template context (name, prompt, Q&A history)

## Phase 5: AI Q&A + Prompt Builder

- **Session flow**: draft → analyzing → qa → prompt_ready → generating → completed/failed
- **analyze-reference bug fix**: route now sets `status: "qa"` after completion; downloads image as base64 for LLM vision
- **QAPhase rebuilt** as 2-panel layout:
  - **Left panel**: product name/description, mode badges (Option A/B, M1/M2), reference image thumbnail, product photo thumbnails, progress bar ("N of ~8"), answered questions list with click-to-edit
  - **Right panel**: analysis result card (Option B first time) → question cards → done state
  - Auto-fetches first question on mount (no "Start Q&A" button)
  - Click-to-edit: truncates answers in DB and re-fetches that question
  - AI suggestion shown as italic boxed text with bot icon
  - Option descriptions shown below each option label
  - Always-visible free text field (selecting option clears text, typing clears selection)
  - "Question N of ~8" progress counter
- **PromptEnhancer**: enhance (find vague words) / revise (specific instruction) / rewrite (full new prompt)
- **GenerationPanel**: select fal.io model + dynamic params → trigger generation
- **ResultsGallery**: image grid with download + fullscreen + save-as-template

## Key Files (Phase 5)

- `artifacts/mockup-tool/src/pages/session.tsx` — QAPhase (2-panel), PromptEnhancer, GenerationPanel, ResultsGallery, WizardStep, SessionPage
- `artifacts/api-server/src/routes/sessions.ts` — session CRUD + analyze-reference (now sets status="qa", base64 vision)
- `artifacts/api-server/src/routes/ai.ts` — next-question, submit-answer, enhance, revise, rewrite routes
- `artifacts/api-server/src/lib/llm.ts` — callActiveLlm (active LLM config from DB)
- `artifacts/mockup-tool/src/pages/settings.tsx` — main settings page (tabs + inline tab components)
- `artifacts/mockup-tool/src/components/settings/AddModelModal.tsx` — 2-step add/edit modal
- `artifacts/mockup-tool/src/components/settings/DynamicParamForm.tsx` — dynamic param form renderer
- `artifacts/api-server/src/lib/curlParser.ts` — parseCurlCommand, parseLlmCurlCommand, parseCurlForPreview
- `artifacts/api-server/src/routes/settings.ts` — all settings/fal-models/llm-configs/parse-curl routes
