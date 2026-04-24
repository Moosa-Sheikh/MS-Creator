# Etsy Mockup Tool — Complete System Overview

This document explains how the entire app works — every piece, every flow, every AI model, and why things are built the way they are.

---

## The Big Picture

This app helps an Etsy seller create professional product mockup images without needing photography or Photoshop skills. Here's the journey in one sentence:

> You upload your product photos → AI asks you 5–7 smart questions about the scene you want → AI builds a detailed prompt → fal.io generates the mockup image(s) using your actual product photos.

The critical thing to understand: **fal.io is an image-EDIT model, not a text-to-image model.** You give it your real product photos AND a scene description. It places your actual product into that scene. The AI (LLM) never sees fal.io's job — it only builds the text instructions. fal.io never sees the LLM's job — it only takes the text and the photos and generates.

---

## The Three-Part Architecture

```
  USER'S BROWSER
  (React frontend)
       ↕
  API SERVER
  (Node.js backend — port 8080)
       ↕              ↕             ↕
  PostgreSQL       Object         External AI
  (Database)       Storage        (fal.io + LLM)
```

- **Frontend** — the visual interface. Sends requests to the backend. Never talks to fal.io or the LLM directly.
- **Backend** — the brain. Handles all logic, talks to the database, calls fal.io, calls the LLM.
- **Database** — stores everything permanently: products, sessions, templates, settings, API keys.
- **Object Storage** — stores the actual image files (product photos, generated mockups).
- **fal.io** — external service that generates the images.
- **LLM** (OpenRouter/Anthropic/OpenAI/Google) — external AI that conducts the Q&A and builds prompts.

---

## Option A vs Option B

Every session starts with a choice that determines the entire flow:

### Option A — "Product photos only"
You only upload your product photos. The AI invents the entire scene from scratch. You start with a blank slate.

### Option B — "Product + reference mockup"
You upload your product photos AND a reference image (e.g., a competitor's listing, a mockup you like, a magazine photo). The AI either:
- **SAME mode**: closely copies the reference's style and composition, adapted to your product
- **IDEA mode**: uses the reference only as creative inspiration, creates something original

---

## M1 vs M2 Output Modes

**M1** = single image. One prompt, one generation, one result.

**M2** = multiple images (you choose 2–8). The AI creates a "base" final prompt describing the overall scene, then also creates **variation prompts** — each one describes the same scene from a different camera angle or composition (wide shot, close-up detail, flat lay overhead, 45-degree, etc.). Each image gets its own variation prompt sent to fal.io. You can also regenerate individual images without redoing the whole session.

---

## The 6 Flows (F1–F6)

These 6 flows are at the heart of the system. Each flow has its own AI personality, rules, and questioning strategy. The flow is automatically calculated from your 3 choices (Option A/B, SAME/IDEA, Template/No Template):

| Flow | Path | Personality |
|------|------|------------|
| **F1** | Option B → IDEA → No Template | Creative director. Reference is inspiration only. Pushes you toward something original that captures the same vibe. |
| **F2** | Option B → IDEA → With Template | Bridge builder. Reference brings fresh energy; your template provides proven structure. Blends both. |
| **F3** | Option B → SAME → No Template | Precision replicator. The reference is the specification. Asks only about adaptations needed for your specific product. |
| **F4** | Option B → SAME → With Template | Most structured flow. Reference is the visual blueprint, template is the formula. Resolves conflicts between the two. |
| **F5** | Option A → No Template | Free creative. No reference, no template. AI builds a concept from scratch based purely on what it sees in your product photos. |
| **F6** | Option A → With Template | Template evolver. No reference. Builds on and improves your saved template for this specific product. |

### How each flow's AI behaves differently

The key insight is that every flow has a different **system prompt** — a set of instructions the AI reads before it ever talks to you. These prompts are stored in the database (Settings → Flow Prompts) and can be customized.

For example:
- **F3/F4** (SAME flows): The AI is told "the reference IS the specification — do NOT ask about things the reference already specifies. Only ask about adaptations for this product."
- **F1/F2** (IDEA flows): The AI is told "the reference is inspiration only — push toward something completely different."
- **F5** (Pure AI): The AI is told "you have no reference. Use your expertise about what sells on Etsy for this product type."

---

## A Session's Journey — Step by Step

A "session" is one complete mockup creation run. Here's everything that happens:

### Phase 1: Setup Wizard (5 steps on screen)
1. Choose Option A or B
2. Choose M1 or M2 (and how many images if M2)
3. Upload your product photos (and reference image if Option B)
4. Choose SAME or IDEA + similarity level (Option B only)
5. Choose a template to build on — or start fresh

### Phase 2: AI Analysis (happens automatically, you just wait)
This is where the AI "sees" your images. Two things happen:

**For Option B — Reference Analysis:**
The AI (must be a vision-capable model) looks at your reference image and extracts:
- Background/setting description
- Lighting style and direction
- How the product is placed and composed
- Props and accessories visible
- Overall mood and aesthetic
- Photography style (flat lay, lifestyle, studio, etc.)

This extracted analysis is saved as a JSON object in the session record. The AI Q&A phase then reads this — it never re-analyzes the image during Q&A.

**Product Photo Analysis:**
The AI looks at all your product photos and extracts:
- What items are visible (count, type, what they are)
- Colors and color palette
- Materials and textures
- Product style/aesthetic category
- How the current photos are composed

This is also saved as JSON. The key purpose: the Q&A AI knows exactly what your products look like without you having to describe them. That's why it never asks "what does your product look like?" — it already knows.

### Phase 3: Q&A (5–7 questions)
This is the core interaction. For each question:
1. Backend loads the flow's system prompt (from DB)
2. Backend builds a "user prompt" containing: product analysis, reference analysis, template data (if any), all previous Q&A answers, and instructions for what question to ask next
3. This gets sent to the active LLM
4. LLM returns a JSON response with: the question text, 3–4 options, an AI suggestion (which option it recommends and why), and "done: false"
5. You select an option (or type your own)
6. Your answer is saved to the session
7. Repeat from step 1 with the new answer added to history

When the AI has gathered enough information (usually 5–7 questions), it returns `"done": true` with a `finalPrompt`.

### Phase 4: Prompt Review
The generated prompt always starts with "Using the provided product image(s)..." — this is critical because it tells fal.io to use your photos, not invent a product.

Three tools are available here:
- **Enhance**: AI scans the prompt for vague words ("beautiful", "cozy", "elegant") and suggests specific visual replacements. You review and apply each suggestion individually.
- **Revise**: You type a specific instruction (e.g., "change the background to marble instead of wood") and the AI rewrites just that part. Everything else stays the same.
- **Rewrite**: Full regeneration from scratch, using all the Q&A context. Use this if the prompt went in the wrong direction.

### Phase 5: Image Generation
1. You pick which fal.io model to use (configured in Settings)
2. Backend takes the prompt + your product photo storage paths
3. Converts storage paths to public URLs so fal.io can download them
4. Sends to fal.io as a queue job (the `image_urls` parameter + prompt)
5. Polls fal.io every 3 seconds to check if it's done
6. When complete, downloads and archives the generated images to your own object storage
7. Results displayed — you can download, save as template, or regenerate

---

## Templates

Templates are saved sessions that produced good results. When you save a session as a template, it stores:
- The name you give it
- The final image prompt that worked
- All the Q&A answers that led to that prompt
- Which option type, output type, and flow it used

Templates are scoped per product (a template saved for your "Crochet Hat" product won't appear when working on "Ceramic Mugs").

When a template is used in a flow (F2, F4, or F6), the AI sees the template's proven prompt AND all the Q&A answers that created it. It uses this as context to either evolve it (F6) or blend it with a reference (F2/F4).

---

## The LLM System

The app supports 4 AI providers — you can switch between them without changing any code:

| Provider | How to add | When to use |
|----------|-----------|------------|
| **OpenRouter** | OpenRouter API key | Best for access to many models (Claude, GPT-4, Gemini, etc.) through one key |
| **Anthropic** | Your own Anthropic API key | Direct Claude access |
| **OpenAI** | Your own OpenAI API key | Direct GPT-4 / GPT-4o access |
| **Google** | Your own Google AI API key | Gemini models |

Only ONE model is "active" at a time. The whole system routes through `callActiveLlm()` which reads the active config from the database and calls the right provider.

**Vision requirement**: The image analysis steps (analyzing reference + analyzing product photos) require a model with vision enabled. If your active model doesn't support vision, the analysis will fail with a clear error message. You toggle "Supports vision" per model in Settings.

**Thinking models**: The app specifically handles Claude's "extended thinking" mode (models with `:thinking` in their name). The `extractJson()` function strips out the `<thinking>...</thinking>` blocks before trying to parse the JSON response — otherwise the JSON extraction would fail.

---

## The Settings System

Everything in Settings is stored in the `settings` table in the database. One row, always. Contains:
- API keys (OpenRouter, fal.io, Anthropic, OpenAI, Google)
- The 6 flow system prompts (F1–F6) — you can customize each one
- fal.io polling timeout (how long to wait for image generation)

The `llm_configs` table stores each language model you've added — each has its own provider, model ID, optional per-model API key, vision flag, thinking flag, and default parameters.

The `fal_models` table stores each fal.io model you've added — endpoint URL, name, and any default parameters.

---

## Database Tables Reference

| Table | What it stores |
|-------|---------------|
| `products` | Your product catalog — name, description, Etsy URL |
| `sessions` | Every mockup attempt — all choices, analysis results, Q&A, prompts, generated images, status |
| `templates` | Saved successful sessions — for reuse across future runs |
| `llm_configs` | Language model configurations (one is active at a time) |
| `fal_models` | fal.io image model configurations |
| `settings` | Global app settings — API keys, flow prompts, timeout |

---

## Session Status Machine

A session moves through these states in order:

```
draft
  → analyzing          (wizard complete, starting analysis)
  → analyzing_image    (downloading reference image)
  → analyzing_vision   (LLM is reading the reference image)
  → analyzing_products (LLM is reading product photos)
  → qa                 (ready for Q&A)
  → prompt_ready       (AI has generated the final prompt)
  → generating         (fal.io is generating images)
  → completed          (images ready)
  → failed             (something went wrong at any step)
```

The frontend polls the session status and shows a different UI for each state.

---

## Key Files to Know for Development

| File | What it does | When you'd change it |
|------|-------------|---------------------|
| `artifacts/api-server/src/lib/flows.ts` | Defines F1–F6 metadata and all 6 default system prompts | When tuning how the AI behaves in Q&A |
| `artifacts/api-server/src/lib/llm.ts` | Routes LLM calls to the right provider (OpenRouter/Anthropic/OpenAI/Google) | When adding a new AI provider |
| `artifacts/api-server/src/routes/sessions.ts` | Reference analysis, product analysis, session CRUD | When changing analysis behavior |
| `artifacts/api-server/src/routes/ai.ts` | Q&A next-question, answer submission, prompt enhance/revise/rewrite | Core Q&A logic changes |
| `artifacts/api-server/src/routes/generation.ts` | fal.io image generation, queue polling, per-image regeneration | Changing image generation behavior |
| `artifacts/api-server/src/lib/objectStorage.ts` | File storage — upload URLs, serving, archiving generated images | **Replace this** when leaving Replit |
| `artifacts/mockup-tool/src/pages/session.tsx` | The entire session UI (2,183 lines) — wizard, Q&A, prompt editor, generation panel | Frontend changes to the core workflow |
| `artifacts/mockup-tool/src/pages/settings.tsx` | Settings UI — API keys, models, flow prompts | Adding new settings |
| `lib/db/src/schema/` | Database table definitions | Adding new data fields |

---

## Important Technical Details for Development

**JSON-only AI responses**: Every LLM call in this app expects JSON back. The system prompt tells the AI to return STRICT JSON ONLY. The `extractJson()` function then:
1. Strips `<thinking>` blocks (Claude thinking models)
2. Strips markdown code fences (some models wrap JSON in \`\`\`json...\`\`\`)
3. Extracts the first `{...}` object found in the response

If the LLM hallucinates and returns text instead of JSON, the session fails. This is by design — a malformed response is better caught immediately than silently causing incorrect behavior.

**Image passing to fal.io**: Product photos are passed to fal.io via the `image_urls` parameter as an array of URLs. The reference image is NOT passed to fal.io — it stays on the LLM side only (for style analysis). The only thing fal.io sees is: prompt text + product photo URLs.

**Two fal.io modes**: fal.io returns either immediately (sync response) or via a queue (returns a `request_id`). The app handles both — if there's a `request_id`, it polls the queue every 3 seconds until COMPLETED or FAILED or timeout.

**Image archiving**: Generated image URLs from fal.io are CDN URLs that expire. The app immediately downloads them and saves them to your object storage so they're permanently accessible. If this archiving fails, it falls back to the CDN URL with a warning.

**Product photos → fal.io URL conversion**: Your product photos are stored in object storage with paths like `/objects/abc123.jpg`. Before sending to fal.io, these are converted to full public URLs (using your domain). On Replit this uses `REPLIT_DEV_DOMAIN`. Outside Replit, you'll need a different domain variable.

---

*Last updated: April 2026*
