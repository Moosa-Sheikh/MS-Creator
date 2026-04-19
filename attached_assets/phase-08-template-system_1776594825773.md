# Phase 8 — Template System

## Context
You are building an AI-powered Etsy mockup creation tool. Phases 1–7 are complete: login, product management, the upload wizard, settings, AI Q&A, Prompt Enhancer, and image generation.

This final phase adds the **Template System** — the ability to save successful sessions as reusable templates, and to browse/select saved templates when starting a new session (this connects back to Phase 3's "Use a saved template" step).

After this phase, the app is fully complete for Phase 1 of the product roadmap.

---

## What a Template Is

A template is a snapshot of a successful mockup session that can be used as a starting point for future sessions. It contains:
- The final prompt (or enhanced prompt) that worked well
- The generated image(s) to use as a visual reference card
- The session configuration (option type, mode, Q&A answers)
- A user-given name
- Scoped to a specific product + M1/M2 type

When a user starts a new session and picks a template for inspiration, the AI Q&A receives the template's context — it knows what worked before and can either replicate or build on it.

---

## Database
The `templates` table already exists from Phase 1:
```sql
templates (
  id UUID PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('M1', 'M2')),
  option_type VARCHAR(10) NOT NULL CHECK (option_type IN ('A', 'B')),
  prompt TEXT NOT NULL,
  image_urls JSONB DEFAULT '[]',
  session_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

The `session_config` JSONB field stores:
```json
{
  "photoCount": "single",
  "referenceStyle": "IDEA",
  "similarityLevel": null,
  "qaAnswers": [...],
  "m2Count": 4
}
```

---

## Feature 1: Save as Template

**Trigger:** User clicks "💾 Save as Template" in the Results Gallery (end of Phase 7)

Opens a modal:
```
┌─────────────────────────────────────────────────────────┐
│  💾 Save as Template                                    │
│                                                         │
│  Template Name:                                         │
│  [Cozy Indoor — Window Light                         ]  │
│  (Give it a memorable name for future reference)        │
│                                                         │
│  Type: M2 template  (auto-set, can't change)           │
│  Product: Crochet Cap  (auto-set, can't change)        │
│                                                         │
│  Preview: [first generated image as thumbnail]         │
│                                                         │
│  This template will save:                               │
│  ✓ Your final prompt                                    │
│  ✓ The generated image(s) as reference                  │
│  ✓ Your Q&A answers for context                         │
│                                                         │
│  [Cancel]                    [Save Template]            │
└─────────────────────────────────────────────────────────┘
```

**On "Save Template":**
1. Call `POST /api/templates` with:
   ```typescript
   {
     sessionId: string,        // pulls all data from the session
     name: string,
   }
   ```
2. API:
   - Loads the full session
   - Creates a template record with:
     - `product_id` from session
     - `type`: session's `output_type` (M1/M2)
     - `option_type`: session's `option_type` (A/B)
     - `prompt`: `session.enhanced_prompt || session.final_prompt`
     - `image_urls`: `session.generated_image_urls`
     - `session_config`: `{ photoCount, referenceStyle, similarityLevel, qaAnswers, m2Count }`
   - Returns `{ template: { id, name, ... } }`
3. Show success toast: "Template saved! ✓"
4. The "Save as Template" button becomes "✓ Saved" (disabled, so they can't double-save)

---

## Feature 2: Template Browser (per product)

**Access point 1:** "📁 View Templates" button on the Active Product Banner (from Phase 2)
**Access point 2:** "Browse Templates" in the wizard Step 5 (from Phase 3)

### Template Browser Page

Create `app/dashboard/templates/[productId]/page.tsx`:

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back    Templates for: Crochet Cap                           │
├──────────────────────────────────────────────────────────────────┤
│  Filter: [All ▼]  [M1 ▼]  [M2 ▼]  [Option A ▼]  [Option B ▼]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ [Image]      │  │ [Image]      │  │ [Image]      │          │
│  │              │  │              │  │              │          │
│  │ Cozy Indoor  │  │ Studio White │  │ Autumn Park  │          │
│  │ M2 · Option B│  │ M1 · Option A│  │ M2 · Option A│          │
│  │ 3 days ago   │  │ 1 week ago   │  │ 2 weeks ago  │          │
│  │              │  │              │  │              │          │
│  │ [Use] [🗑]   │  │ [Use] [🗑]   │  │ [Use] [🗑]   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Each template card shows:**
- First image from `image_urls` as thumbnail (aspect ratio: 3:4 or square)
- Template name (bold)
- Type badge (M1/M2) + Option badge (A/B)
- Time since created ("3 days ago")
- "Use" button → starts a new session with this template as inspiration
- 🗑 Delete button → confirmation dialog, then deletes

**Empty state:**
```
No templates saved yet for Crochet Cap.
Complete a mockup session and save it as a template to see it here.
[+ Create New Mockup]
```

**Filter behavior:**
- Filter buttons filter the grid in-place (no page reload)
- Default: show All, sorted by newest first

---

## Feature 3: Template Detail View

Clicking the image thumbnail (not the "Use" button) opens a **detail modal**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Cozy Indoor — Window Light                     [✕ Close]       │
├───────────────────────┬─────────────────────────────────────────┤
│                       │  Type: M2 · Option B · 4 images         │
│  [Image gallery:      │  Created: April 15, 2026                │
│   if M2, show         │                                         │
│   all images in       │  ── Prompt ───────────────────────────  │
│   small thumbnails    │  Professional lifestyle photography of   │
│   click to enlarge]   │  a handmade crochet cap in earthy        │
│                       │  tones, placed casually on a warm        │
│                       │  wooden shelf near a window...           │
│                       │  [Copy Prompt]                           │
│                       │                                         │
│                       │  ── Q&A Summary ───────────────────────  │
│                       │  Background: Cozy indoor, wooden shelf  │
│                       │  Lighting: Natural window light         │
│                       │  Mood: Warm, artisanal                  │
│                       │  ...                                    │
│                       │                                         │
│                       │  [Use This Template →]                  │
└───────────────────────┴─────────────────────────────────────────┘
```

---

## Feature 4: Using a Template in a New Session

When user clicks "Use" on a template card (or "Use This Template" in detail modal):

1. If coming from the **Active Product Banner**: open the wizard modal (Phase 3) with Step 5 pre-selected (template already chosen)
2. If coming from within the **wizard Step 5**: close the template picker, mark template as selected

The template passes its `session_config` context to Phase 5 (AI Q&A) as additional context:

In the system prompt for `next-question`, include:
```
TEMPLATE INSPIRATION (from a previously successful session):
Template Name: {template.name}
Prompt that worked: "{template.prompt}"
Q&A answers that led to this:
{template.session_config.qaAnswers formatted list}

Build on this template's direction, but ask questions to refine and potentially improve it for this new session. Don't just repeat the same answers — explore if the user wants variations or improvements.
```

---

## Feature 5: Template Count on Active Product Banner

Update the Active Product Banner (Phase 2) to show real template counts:
- "📁 View Templates (3)" — fetch count from DB on load
- Split into: "📁 M1: 1 · M2: 2" if both types exist

---

## API Routes

```
GET    /api/templates?productId=&type=&optionType=   → list templates (filtered)
POST   /api/templates                                 → create template from session
GET    /api/templates/[id]                            → get single template detail
DELETE /api/templates/[id]                            → delete template
GET    /api/products/[id]/template-count              → get M1/M2 counts for product banner
```

**`POST /api/templates` request:**
```typescript
{
  sessionId: string,
  name: string,
}
```

---

## Files to Create/Modify

```
app/
  dashboard/
    templates/
      [productId]/
        page.tsx                        — template browser page
components/
  templates/
    TemplateGrid.tsx                    — filtered grid of template cards
    TemplateCard.tsx                    — single template card (image, name, badges, actions)
    TemplateDetailModal.tsx             — detail view modal with prompt + Q&A summary
    SaveTemplateModal.tsx               — "Save as Template" modal (shown after generation)
    TemplatePicker.tsx                  — update from Phase 3: now fetches real templates
app/
  api/
    templates/
      route.ts                          — GET list + POST create
      [id]/
        route.ts                        — GET detail + DELETE
    products/[id]/
      template-count/route.ts           — GET counts
```

**Modify from Phase 3:**
- `components/wizard/Step5TemplateSelect.tsx` → update to fetch real templates from API, show real thumbnail grid

**Modify from Phase 2:**
- `components/ActiveProductBanner.tsx` → update template count to fetch real data, add link to template browser page

**Modify from Phase 7:**
- `components/session/ResultsGallery.tsx` → wire up "Save as Template" to open `SaveTemplateModal`

---

## End-to-End Verification (Full App Flow)

This is the final phase — run the complete flow to verify everything works together:

- [ ] Login → Dashboard loads
- [ ] Create product "Crochet Cap" → appears in product grid
- [ ] Click "Open" on product → Active Product Banner appears ("View Templates: 0")
- [ ] Click "Create New Mockup" → Wizard opens
- [ ] Select Option B, M2, upload 2 product photos + 1 reference photo
- [ ] Select IDEA mode, similarity slider hidden
- [ ] Step 5: "Browse Templates" shows empty state (no templates yet)
- [ ] Click "Start Fresh" → wizard closes, redirect to session page
- [ ] Session page shows Option B → "Analyzing reference image..." appears
- [ ] Analysis summary card shows extracted reference details
- [ ] Q&A starts: first question appears with 4 options + AI suggestion + text input
- [ ] Answer 6-8 questions → AI returns "done: true" with final prompt
- [ ] Prompt Enhancer loads with the final prompt in textarea
- [ ] Click "✨ Enhance" → vague words highlighted, suggestions panel appears
- [ ] Accept 2 suggestions → prompt updates inline
- [ ] Select fal.io model from dropdown (must have one configured in Settings)
- [ ] Click "Generate 4 Mockups" → generation panel loads
- [ ] 4 image progress rows appear; images generate one by one
- [ ] Results gallery shows 4 images with Download, View Full buttons
- [ ] Click "💾 Save as Template" → modal opens; name it "Cozy Indoor Test"
- [ ] Click "Save Template" → success toast
- [ ] Navigate to "View Templates" on Active Product Banner → template appears in grid
- [ ] Click "Use" on the template → wizard opens with template pre-selected in Step 5
- [ ] Start new session with template → AI Q&A references template context
- [ ] Delete the template → confirmation, then removed from grid
- [ ] Logout → redirected to login page
