# Phase 4 — Settings Panel (Model Configuration)

## Context
You are building an AI-powered Etsy mockup creation tool. Phases 1–3 are complete: login, PostgreSQL, sidebar layout, product management, and the upload/option wizard exist.

This phase builds the **Settings Panel** — where the user configures ALL the AI models the app will use. This must be done before Phase 5 (AI Q&A) and Phase 7 (image generation) because both need configured models.

The key design principle: **both fal.io (image generation) models and OpenRouter/LLM models are configured the same way — by pasting a curl command**. The app parses the curl, extracts all parameters, and renders a dynamic configuration form (similar to how n8n configures nodes). This gives maximum flexibility without hardcoding any model's options.

---

## Database
These tables already exist from Phase 1 schema:
```sql
fal_models (id, name, endpoint, curl_command, params_schema, default_values, created_at)
llm_configs (id, name, provider, model_id, endpoint, system_prompt, curl_command, params_schema, default_values, is_active, created_at)
settings (id, fal_api_key, openrouter_api_key, claude_api_key, claude_enabled, updated_at)
```

---

## Settings Page Route

Create `app/settings/page.tsx` — accessible from the sidebar "Settings" link.

**Page layout (tabs):**
```
Settings
├─ Tab: Global Keys
├─ Tab: Image Models (fal.io)
└─ Tab: Language Models (OpenRouter / Claude)
```

---

## Tab 1: Global Keys

Three API key inputs:

```
┌─────────────────────────────────────────────────────────┐
│  fal.io API Key                                         │
│  [●●●●●●●●●●●●●●●●●●●●●●] [Show] [Save]               │
│  Used for all image generation calls.                   │
├─────────────────────────────────────────────────────────┤
│  OpenRouter API Key                                     │
│  [●●●●●●●●●●●●●●●●●●●●●●] [Show] [Save]               │
│  Used for AI Q&A and prompt building.                   │
├─────────────────────────────────────────────────────────┤
│  Claude API Key                                         │
│  [●●●●●●●●●●●●●●●●●●●●●●] [Show] [Save]               │
│                                                         │
│  Use Claude directly:  [Toggle ON/OFF]                  │
│  When ON, Claude is used instead of OpenRouter.         │
│  OpenRouter config becomes inactive while this is ON.   │
└─────────────────────────────────────────────────────────┘
```

- "Show" button toggles password visibility
- "Save" saves that individual key to the `settings` table immediately
- Toggle saves `claude_enabled` boolean immediately
- All fields load current values from DB on page load

**API Routes:**
- `GET /api/settings` → returns settings row (with keys partially masked: show only last 4 chars)
- `PUT /api/settings` → updates any settings fields
  ```typescript
  // Request: { fal_api_key?, openrouter_api_key?, claude_api_key?, claude_enabled? }
  // Response: { success: true }
  ```

---

## Tab 2: Image Models (fal.io)

This is where the user adds fal.io image generation models by pasting curl commands.

### Model List

Shows all saved fal.io models in a list:
```
┌─────────────────────────────────────────────────────────┐
│  [+ Add fal.io Model]                                   │
├─────────────────────────────────────────────────────────┤
│  SeedEdit v4.5                                          │
│  fal-ai/bytedance/seedream/v4.5/edit                    │
│  [Edit Config]  [Delete]                                │
├─────────────────────────────────────────────────────────┤
│  FLUX Schnell                                           │
│  fal-ai/flux/schnell                                    │
│  [Edit Config]  [Delete]                                │
└─────────────────────────────────────────────────────────┘
```

### Add / Edit Model Flow

Clicking "Add fal.io Model" or "Edit Config" opens a **2-step modal**:

**Step 1 — Paste Curl Command:**
```
┌─────────────────────────────────────────────────────────┐
│  Add fal.io Model — Step 1 of 2                        │
│                                                         │
│  Paste the curl command for this model:                 │
│  (Get it from fal.io model docs / API playground)       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ curl -X POST                                    │   │
│  │ "https://fal.run/fal-ai/bytedance/..."          │   │
│  │ -H "Authorization: Key $FAL_KEY"                │   │
│  │ -H "Content-Type: application/json"             │   │
│  │ -d '{                                           │   │
│  │   "prompt": "a photo of...",                    │   │
│  │   "image_url": "https://...",                   │   │
│  │   "num_images": 1,                              │   │
│  │   "seed": 42,                                   │   │
│  │   "guidance_scale": 7.5                         │   │
│  │ }'                                              │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Cancel]                          [Parse & Continue →] │
└─────────────────────────────────────────────────────────┘
```

**Curl Parsing Logic (`lib/curl-parser.ts`):**

Write a `parseCurlCommand(curlString: string)` function that extracts:
1. **HTTP method** (default POST)
2. **Endpoint URL** (the URL in quotes after curl or -X POST)
3. **Headers** (from `-H` flags)
4. **JSON body** (from `-d` flag): parse the JSON body string
5. **Parameters schema**: for each key in the JSON body, infer:
   - `type`: string | number | boolean | array
   - `value`: the value from curl (becomes the default)
   - `key`: the parameter name
   - Ignore `$FAL_KEY` placeholder in auth header

Return:
```typescript
{
  endpoint: string,
  method: string,
  params: Array<{
    key: string,
    type: 'string' | 'number' | 'boolean' | 'array',
    defaultValue: unknown,
    required: boolean, // true if the param was in the curl body
  }>
}
```

Handle edge cases:
- Multi-line curl (with backslash line continuation)
- Single-quoted or double-quoted body
- Body passed with `--data-raw` or `--data`
- URL encoded params (but likely not for fal.io)

**Step 2 — Configure Parameters:**

After parsing, show the dynamic configuration form:
```
┌─────────────────────────────────────────────────────────┐
│  Add fal.io Model — Step 2 of 2                        │
│                                                         │
│  Model Name (for your reference):                       │
│  [SeedEdit v4.5                    ]                    │
│  Endpoint: fal.run/fal-ai/bytedance/seedream/v4.5/edit  │
│                                                         │
│  ── Parameters ──────────────────────────────────────── │
│                                                         │
│  prompt          [string]   [default: "a photo of..."]  │
│  ⚙ This will be filled automatically from the          │
│    generated prompt — do not set a static value.        │
│                                                         │
│  image_url       [string]   [default: "https://..."]    │
│  ⚙ For Option B SAME mode: reference image will        │
│    be inserted here automatically.                      │
│                                                         │
│  num_images      [number]   [default: 1              ]  │
│                                                         │
│  seed            [number]   [default: 42             ]  │
│  [Enable seed]   ☐ (toggle — when off, no seed sent)   │
│                                                         │
│  guidance_scale  [number]   [default: 7.5            ]  │
│                                                         │
│  [Cancel]    [← Back]             [Save Model]          │
└─────────────────────────────────────────────────────────┘
```

**Dynamic parameter form rules:**
- String params → text input
- Number params → number input
- Boolean params → toggle switch
- Array params → comma-separated text input (split on comma to array)
- Parameters named `prompt` or `image_url` are **auto-filled** at generation time — show a subtle gray note under them: "Auto-filled from generated prompt" / "Auto-filled from uploaded reference image"
- Every parameter has an enable/disable toggle (off = parameter not sent in API call)
- User sets the default values here; at generation time they can adjust before generating

**Saving:**
- Stored in `fal_models` table as:
  ```json
  {
    "name": "SeedEdit v4.5",
    "endpoint": "https://fal.run/fal-ai/bytedance/seedream/v4.5/edit",
    "curl_command": "<original curl string>",
    "params_schema": [
      { "key": "prompt", "type": "string", "auto": true },
      { "key": "image_url", "type": "string", "auto": true },
      { "key": "num_images", "type": "number", "enabled": true },
      { "key": "seed", "type": "number", "enabled": false },
      { "key": "guidance_scale", "type": "number", "enabled": true }
    ],
    "default_values": {
      "num_images": 1,
      "guidance_scale": 7.5
    }
  }
  ```

---

## Tab 3: Language Models (OpenRouter / Claude)

**Identical pattern to Tab 2** — user adds LLM models by pasting curl commands.

Example curl from OpenRouter:
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "anthropic/claude-3.5-sonnet",
    "messages": [{"role": "user", "content": "Hello"}],
    "temperature": 0.7,
    "max_tokens": 2000
  }'
```

**Additional field for LLM configs (not in fal.io):**
- **System Prompt** text area (displayed in Step 2 of the modal, before parameters):
  - Label: "System Prompt (optional)"
  - Placeholder: "Additional instructions that will be prepended to every AI call using this model. Leave empty to use only the built-in prompt."
  - 5 rows, resizable

**Auto-identification:**
- If the endpoint contains `openrouter.ai` → set provider to `openrouter`
- If the endpoint contains `api.anthropic.com` → set provider to `claude`
- Extract `model` field from body → save as `model_id`

**Active Model indicator:**
- Only ONE LLM config can be active at a time
- Each model in the list has an "Activate" button
- Active model shows a green "Active" badge
- When Claude toggle is ON in Tab 1, all OpenRouter models are shown as "Inactive (Claude mode on)"

**Saved as `llm_configs` table row.**

---

## API Routes

```
GET    /api/settings              → global settings (masked keys)
PUT    /api/settings              → update global settings fields

GET    /api/fal-models            → list all fal models
POST   /api/fal-models            → create new fal model
PUT    /api/fal-models/[id]       → update fal model
DELETE /api/fal-models/[id]       → delete fal model

GET    /api/llm-configs           → list all LLM configs
POST   /api/llm-configs           → create new LLM config
PUT    /api/llm-configs/[id]      → update LLM config (includes activate: boolean)
DELETE /api/llm-configs/[id]      → delete LLM config

POST   /api/parse-curl            → accepts { curl: string }, returns parsed model config
```

The `/api/parse-curl` route uses the `parseCurlCommand` utility and returns the structured config for the frontend to render the dynamic form.

---

## Files to Create
```
app/
  settings/
    page.tsx                        — settings page with tabs
  api/
    settings/route.ts
    fal-models/route.ts
    fal-models/[id]/route.ts
    llm-configs/route.ts
    llm-configs/[id]/route.ts
    parse-curl/route.ts
lib/
  curl-parser.ts                    — parseCurlCommand utility
components/
  settings/
    GlobalKeysTab.tsx
    FalModelsTab.tsx
    LlmConfigsTab.tsx
    AddModelModal.tsx               — reused for both fal and LLM models
    DynamicParamForm.tsx            — renders the dynamic parameter form
```

---

## Verification Checklist
- [ ] Settings page loads at `/settings` with 3 tabs
- [ ] Tab 1: Can save all 3 API keys; Show button toggles visibility
- [ ] Tab 1: Claude toggle saves `claude_enabled` and shows explanation text
- [ ] Tab 2: "Add fal.io Model" button opens 2-step modal
- [ ] Pasting a valid fal.io curl command and clicking "Parse" renders the dynamic form
- [ ] Each parameter shows correct type (string/number/boolean)
- [ ] `prompt` and `image_url` params show "Auto-filled" note
- [ ] Saving a model adds it to the list with name and endpoint shown
- [ ] Edit Config reopens Step 2 pre-filled with saved values
- [ ] Delete removes the model (with confirmation)
- [ ] Tab 3: Same curl-paste flow works for OpenRouter curl commands
- [ ] LLM model shows System Prompt field; Activate sets it as active (green badge)
- [ ] Only one LLM can be active at a time
- [ ] When Claude toggle is ON, OpenRouter models show "Inactive" state
- [ ] `/api/parse-curl` correctly parses a multi-line curl with JSON body
