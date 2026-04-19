# General Overview Prompt — Read This First Before Building Anything

---

## What We Are Building

We are building an **AI-powered product mockup creation tool for Etsy sellers**. The app helps a seller take photos of their handmade products (e.g., a crochet cap, a tote bag, a candle) and turn them into professional, scroll-stopping Etsy listing mockup images using AI image generation.

This is a **personal web tool** — password-protected, used only by 1-2 people. It is NOT a SaaS product. There is no signup, no multi-tenancy, no billing. Just a secure login and a powerful internal tool.

The code will live on **GitHub** and be deployed as a **web app**. It is being built on **Replit** first, then moved to production.

---

## The Problem It Solves

Etsy sellers need high-quality mockup photos for their listings. Creating good mockups manually takes hours of editing. Using generic mockup templates looks fake. This tool uses AI to generate real, custom, lifestyle-style mockup images tailored to their exact product — and it guides them through the entire creative process with smart AI questions so they don't need to know anything about prompt engineering.

---

## Tech Stack (Non-Negotiable)

| Layer | Technology |
|---|---|
| Framework | **Next.js 14** (App Router, TypeScript) |
| Styling | **Tailwind CSS** + **shadcn/ui** |
| Database | **PostgreSQL** (Replit built-in; later hosted) |
| Image Generation AI | **fal.io** API |
| Language Model (LLM) | **OpenRouter** API (or Claude API directly, user can toggle) |
| Auth | Cookie-based session with `iron-session` (single password) |
| File Storage | **Replit Object Storage** (for uploaded product photos) |
| Hosting | Replit → GitHub → Vercel or Render |

---

## The Full System — How It Works End to End

Here is the complete user journey from start to finish. Every feature below will be built across 8 phases. Read this fully to understand how all the pieces connect.

### 1. Login
The app is gated by a single password stored as an environment variable (`APP_PASSWORD`). No username, no account creation. Just a password input. Session stored in an HTTP-only cookie via `iron-session`. All routes except `/login` are protected by middleware.

---

### 2. Products
The app is organized around **Products**. A product is the Etsy item the seller is making mockups for (e.g., "Linen Tote Bag", "Crochet Cap"). The user creates products with a name and short description. Every mockup session, template, and history is scoped to a product. A user might have 5-10 products over time, each with their own mockup history and saved templates.

---

### 3. The Mockup Creation Wizard (Input Collection)

When the user starts a new mockup session, they go through a **step-by-step wizard** that collects all the inputs before the AI starts working.

**Step 1 — Option A or B:**

The user has two input modes:

- **Option A**: They upload only their own product photo(s). The AI creates a mockup from scratch, building a full lifestyle scene around the product.

- **Option B**: They upload their own product photo(s) PLUS a "reference" mockup image — this is usually a competitor's successful Etsy listing photo, or an expert sample they admire. The AI either replicates the reference setup for their product, or uses it as creative inspiration.

**Step 2 — M1 or M2:**

- **M1**: Generate a single final mockup image.
- **M2**: Generate multiple mockup images (user picks 2–8). All images are built from the same AI-crafted prompt but with variety.

**Step 3 — Photo Upload:**
- Option A: upload 1 or multiple product photos
- Option B: upload 1 or multiple product photos PLUS 1 reference mockup image
- Files stored in Replit Object Storage; URLs saved to DB

**Step 4 — Option B Only: SAME or IDEA mode:**
- **SAME**: AI replaces the product in the reference image with the user's product. The composition, lighting, background, props all stay as close as possible to the reference. User controls a "similarity level" slider (1–100%).
- **IDEA**: AI takes creative inspiration from the reference's aesthetic, mood, and style, but creates an entirely fresh mockup suited to the user's product.

**Step 5 — Template Inspiration:**
- User can pick a saved template from a previous successful session to give the AI context
- Or start completely from scratch

---

### 4. AI Reference Analysis (Option B Only)

Before asking questions, the app automatically sends the reference image to the LLM (with vision capability) to extract: background setting, lighting style, product placement, props, mood, photography style. This analysis feeds into the Q&A questions.

---

### 5. AI Q&A Prompt Builder

This is the core of the app. The AI asks the user a series of questions (6–10), one at a time, to gather all the creative details needed to write a great image generation prompt. The user doesn't write any prompt themselves — the AI builds it from the answers.

Each question has:
- 3–4 multiple choice options (with brief descriptions)
- An AI suggestion explaining what it recommends and why (based on context)
- A free-text "other" input so the user is never stuck

Topics covered: background/setting, lighting, mood, photography style, color palette, composition, props, and for M2 — how the images should vary from each other.

The LLM generates questions dynamically based on the session context (product type, option mode, M1/M2, reference analysis, and all previous answers). After enough answers, the LLM constructs the final prompt and signals it's done.

---

### 6. Prompt Enhancer & Refinement

After the Q&A, the user sees the AI-generated final prompt in an editable text area. They have 4 tools:

1. **Enhance**: AI scans the prompt for vague, non-visual words (e.g., "beautiful", "cozy", "stylish") and suggests specific, detailed replacements. The user accepts or skips each suggestion inline.

2. **Revise**: User types a comment like "make the background more minimalist" and the AI rewrites only the relevant part of the prompt.

3. **Regenerate Q&A**: Discards the current prompt and restarts the question flow from the beginning.

4. **Complete Rewrite**: AI writes a completely fresh prompt from scratch using all the session context and Q&A answers.

The user can also directly edit the prompt text manually.

---

### 7. Image Generation via fal.io

The user selects one of their configured fal.io models from a dropdown (configured in Settings), adjusts any model parameters, and clicks Generate.

- **M1**: One API call to fal.io → one image
- **M2**: Sequential API calls (one per image, same prompt) → multiple images, each appears as it completes

For **Option B SAME mode**: the reference image is passed as the `image_url` parameter to fal.io so the model can use it for image-to-image or inpainting generation.

Results are shown in a gallery with download and full-view options.

---

### 8. Template System

After generating mockups the user likes, they can save the session as a **template**. A template stores:
- The final prompt
- The generated image(s) as visual reference
- All Q&A answers and session config

Templates are scoped per product and per type (M1 or M2). When starting a new session, the user can pick a template for inspiration — the AI receives the template's context and builds on it rather than starting blind.

---

### 9. Settings Panel

The Settings page has three sections:

**Global API Keys:**
- fal.io API key
- OpenRouter API key
- Claude API key + toggle (when Claude is on, OpenRouter is deactivated)

**fal.io Image Model Configuration:**
This is the most important settings feature. The user configures image models by **pasting a curl command** (copied from the fal.io model docs/playground). The app parses the curl command, extracts the API endpoint and all parameters, and renders a **dynamic configuration form** — like how n8n renders node configurations. Each parameter gets a type-appropriate input (text, number, toggle) with enable/disable control. The user saves the model with a custom name. Multiple models can be saved.

Example curl:
```
curl -X POST "https://fal.run/fal-ai/bytedance/seedream/v4.5/edit" \
  -H "Authorization: Key $FAL_KEY" \
  -d '{"prompt": "...", "image_url": "...", "num_images": 1, "guidance_scale": 7.5}'
```

**OpenRouter / LLM Configuration:**
Same curl-paste pattern as fal.io. The user pastes an OpenRouter API curl, the app parses it into a named LLM config with a dynamic parameter form. Each LLM config also has a **System Prompt** field for extra instructions. One LLM config is marked as "active" at a time.

---

## Database Structure Overview

There are 6 tables. Understand their relationships:

```
products (id, name, description)
    │
    ├── sessions (id, product_id, option_type, output_type, photo_count,
    │            reference_style, similarity_level, product_image_urls,
    │            reference_image_url, qa_answers, final_prompt,
    │            enhanced_prompt, fal_model_id, fal_params,
    │            generated_image_urls, status, template_inspiration_id)
    │
    └── templates (id, product_id, name, type[M1/M2], option_type,
                   prompt, image_urls, session_config)

fal_models (id, name, endpoint, curl_command, params_schema, default_values)

llm_configs (id, name, provider, model_id, endpoint, system_prompt,
             curl_command, params_schema, default_values, is_active)

settings (id=1, fal_api_key, openrouter_api_key, claude_api_key, claude_enabled)
```

---

## Build Phases Overview

The app will be built in **8 phases**. Each phase has its own detailed prompt file. Here is what each phase delivers:

| Phase | Name | Delivers |
|---|---|---|
| 1 | Foundation & Auth | Next.js setup, PostgreSQL + full schema, login system, sidebar layout |
| 2 | Product Management | Create/select/delete products, product grid UI |
| 3 | Upload & Wizard | 5-step input wizard, photo uploads, option/mode selection |
| 4 | Settings Panel | Curl parser, dynamic model config forms, API key management |
| 5 | AI Q&A Builder | Reference image analysis, dynamic question flow, prompt construction |
| 6 | Prompt Enhancer | Vague word highlighter, revision tools, rewrite tools |
| 7 | Image Generation | fal.io integration, M1/M2 generation, results gallery |
| 8 | Template System | Save/browse/use templates, complete app verification |

---

## Important Architecture Principles

Follow these throughout all phases:

1. **Session = the core unit.** Every mockup creation is a "session" stored in the DB. A session tracks every step from wizard input to final image. Never lose state — always persist to DB.

2. **The session page is one URL, many states.** `/dashboard/session/[sessionId]` is a single route that shows different UI depending on `session.status`: `draft` → wizard done, `prompt_ready` → enhancer, `generating` → generation panel, `completed` → results gallery. Use client-side state transitions — no separate page routes per step.

3. **Dynamic forms, not hardcoded model configs.** The fal.io and LLM models are user-configured via curl. Never hardcode any model name, endpoint, or parameter. Everything goes through the dynamic param system.

4. **LLM calls always use the active LLM config.** Every AI call (reference analysis, question generation, enhance, revise, rewrite) reads from the `llm_configs` table to find the active config, builds the API call from that config's stored curl/params, and routes through either OpenRouter or Claude based on the `claude_enabled` setting.

5. **M1 vs M2 is a first-class concept.** The distinction between M1 (1 image) and M2 (multiple images) affects the Q&A questions, the prompt structure, and the generation logic. Never treat it as a minor detail.

6. **Option A vs B is a first-class concept.** Option B adds reference image analysis before Q&A and optionally passes the reference image to fal.io at generation time. Always check `session.option_type` before building API calls.

7. **Fail gracefully.** If a fal.io generation fails for one image in M2, show an error for that specific image with a retry button. Don't abort the whole session.

---

## Environment Variables Needed

```
APP_PASSWORD=          # single login password
DATABASE_URL=          # PostgreSQL connection string
SESSION_SECRET=        # 32+ char random string for iron-session
```

All fal.io and LLM API keys are stored in the **database** (settings table), NOT as env vars — they are entered via the Settings UI.

---

## What NOT to Build Yet

Do not add these. They are future roadmap items, not part of this build:
- Multi-user accounts or team features
- Shop connection (Etsy API integration)
- Other sidebar features beyond "Picture Analysis"
- Payment or subscription features
- Mobile app

Keep the sidebar clean: only "Picture Analysis" as the main feature, and "Settings" at the bottom.

---

## Starting Point

When you receive Phase 1's detailed prompt, start by:
1. Creating a new Next.js 14 project with TypeScript and Tailwind
2. Installing all specified packages
3. Setting up the full PostgreSQL schema (all 6 tables — do this once in Phase 1, never repeat)
4. Building the login and sidebar shell

You now have the full picture. Proceed to Phase 1.
