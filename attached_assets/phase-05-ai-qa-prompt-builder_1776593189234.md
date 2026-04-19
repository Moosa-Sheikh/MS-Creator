# Phase 5 — AI Q&A Prompt Builder

## Context
You are building an AI-powered Etsy mockup creation tool. Phases 1–4 are complete: login, product management, the upload/option wizard (Phase 3), and settings with configured fal.io + LLM models (Phase 4).

This phase builds the **AI Q&A screen** — the heart of the app. After the wizard in Phase 3, the user lands on the session page at `/dashboard/session/[sessionId]`. Here the AI asks a series of targeted questions, one at a time, to gather all the creative details needed to construct a perfect image generation prompt.

The AI engine uses the active LLM config from settings (OpenRouter or Claude, whichever is active). For Option B sessions, the AI first analyzes the reference image before asking questions.

At the end of the Q&A, the app builds a structured **final prompt** and passes it to Phase 6 (Prompt Enhancer).

---

## Session Page Layout (`app/dashboard/session/[sessionId]/page.tsx`)

The page is divided into two areas:

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Crochet Cap    Session: Option B / M2 / IDEA               │
├───────────────────────────────┬──────────────────────────────────┤
│                               │                                  │
│   LEFT PANEL (40%)            │   RIGHT PANEL (60%)              │
│   Session Context             │   AI Q&A Chat                    │
│                               │                                  │
│   Product: Crochet Cap        │   [Question card stack]          │
│   Mode: Option B, IDEA, M2   │                                  │
│   Reference: [thumbnail]      │                                  │
│   Your Photos: [thumbnails]   │                                  │
│                               │                                  │
│   ── Progress ─────────────   │                                  │
│   Questions answered: 4/~8   │                                  │
│   [████████░░░░░░░░] 50%      │                                  │
│                               │                                  │
└───────────────────────────────┴──────────────────────────────────┘
```

---

## Step 1: Image Analysis (Option B Only)

When the session has `option_type = 'B'`, before the Q&A starts, the app automatically:

1. Shows a loading state: "Analyzing your reference image..."
2. Calls `POST /api/sessions/[id]/analyze` 
3. The API endpoint:
   - Gets the reference image URL from the session
   - Calls the active LLM with a **vision request** (the LLM must support vision — ensure the model selected in settings supports image inputs)
   - System prompt for analysis:
     ```
     You are an expert Etsy product mockup analyst. Analyze the provided reference mockup image and extract:
     1. Background setting (indoor/outdoor, colors, textures, materials)
     2. Lighting style (natural/studio/dramatic, direction, warmth)
     3. Product placement and angle
     4. Props or additional elements in the scene
     5. Overall mood and aesthetic style
     6. Photography style (lifestyle/flat lay/close-up/etc.)
     Return as structured JSON with these exact keys:
     { background, lighting, placement, props, mood, photography_style, additional_notes }
     ```
   - Saves the JSON analysis result to `sessions.qa_answers` as the first entry with `type: 'reference_analysis'`
4. On success: shows a brief summary card of what the AI detected:
   ```
   ✓ Reference analyzed
   Background: Cozy indoor setting, warm wooden shelf
   Lighting: Natural window light, soft shadows
   Style: Lifestyle photography
   [Continue to Questions →]
   ```
   User clicks Continue to start Q&A.

---

## Step 2: AI Q&A Flow

### How It Works
The AI asks questions one at a time. After each answer, it asks the next question. This continues until the AI determines it has enough information (typically 6-10 questions).

### Question Card UI

Each question appears as a card that slides in from the right:

```
┌─────────────────────────────────────────────────────────┐
│  Question 3 of ~8                                       │
│                                                         │
│  What background/setting should your mockup be in?      │
│                                                         │
│  🤖 AI suggests: Based on your reference image, a       │
│     warm indoor setting would complement your crochet   │
│     cap perfectly.                                      │
│                                                         │
│  ○ Cozy indoor — wooden surfaces, warm textures         │
│  ○ Minimal white/neutral studio background              │
│  ○ Outdoor nature — soft greens, natural light          │
│  ○ Urban lifestyle — city or café setting               │
│                                                         │
│  ✏ Or describe your own idea:                          │
│  [                                                    ] │
│                                                         │
│  [← Go Back]                    [Next Question →]       │
└─────────────────────────────────────────────────────────┘
```

**Rules:**
- 3-4 multiple choice options per question (never more)
- Each option has a short label + brief description
- "Or describe your own idea" text input at the bottom of EVERY question
- AI suggestion text (gray/italic, prefixed with 🤖) explains WHY the AI suggests a specific option
- User can select one multiple-choice option OR type in the free-text field (not both — selecting a choice clears the text input and vice versa)
- "Next Question" is disabled until either an option is selected or the text field has content

### Answer Recording

Each answered question is stored as:
```typescript
{
  type: 'qa',
  questionIndex: number,
  question: string,
  options: string[],
  aiSuggestion: string,
  selectedOption: string | null,  // null if user typed custom
  customAnswer: string | null,    // null if user selected option
  finalAnswer: string,            // whichever was provided
  timestamp: string
}
```

All answers are stored in `sessions.qa_answers` (JSONB array) and saved to DB after each answer.

### Question Generation Logic

**API Route: `POST /api/sessions/[id]/next-question`**

Request body:
```typescript
{ previousAnswers: QAAnswer[] }
```

The API:
1. Loads the session (mode, images, reference analysis if present)
2. Loads the active LLM config from settings
3. Calls the LLM with a **carefully constructed system prompt**:

```
You are a professional Etsy product mockup designer AI. You are building a prompt for an AI image generator to create a product mockup.

SESSION CONTEXT:
- Product: {product_name} — {product_description}
- Mode: Option {A|B}, {M1: single mockup | M2: {count} mockups}
- User's product photos: {count} photo(s) uploaded
{if Option B: - Reference image analysis: {JSON analysis}}
{if SAME mode: - Similarity level: {level}% — user wants very similar to reference}
{if IDEA mode: - User wants to USE the reference's aesthetic as inspiration, not copy it}
{if template used: - Template context: {template prompt}}
{if M2: - Goal: build ONE master prompt that, when run {count} times, produces a cohesive but varied set of mockups}

ANSWERS SO FAR:
{list of previousAnswers with question + answer}

YOUR TASK:
Ask the NEXT most important question needed to build a complete image generation prompt.

Rules for your response:
1. Return exactly ONE question.
2. Provide exactly 3-4 multiple choice options (concise label + 8-word description).
3. Give ONE AI suggestion with brief reasoning (1-2 sentences).
4. If you have enough information (after 7+ answers), instead return { "done": true, "finalPrompt": "..." } — a complete, detailed image generation prompt.
5. Adapt questions to the mode:
   - Option A: ask about setting, lighting, mood, style, composition
   - Option B SAME: focus on how to adapt the reference for this product
   - Option B IDEA: explore creative direction inspired by reference
   - M2: include questions about variety between images
6. Never repeat a question topic already covered in previous answers.

Return JSON:
{
  "done": false,
  "question": "What lighting style should your mockup have?",
  "options": [
    { "label": "Natural window light", "description": "Soft, warm, realistic daytime feel" },
    { "label": "Studio lighting", "description": "Clean, even, professional product shot" },
    { "label": "Golden hour", "description": "Warm, dreamy outdoor sunset tones" },
    { "label": "Dramatic moody", "description": "Strong shadows, editorial magazine look" }
  ],
  "aiSuggestion": "Based on your crochet cap and the cozy indoor reference, natural window light would feel authentic and lifestyle-oriented."
}

OR when done:
{
  "done": true,
  "finalPrompt": "Professional lifestyle product photography of a handmade crochet cap in earthy tones, placed casually on a warm wooden shelf near a window. Natural soft window light from the left, creating gentle shadows. Cozy indoor setting with blurred warm-toned background. Shallow depth of field, lifestyle photography style. Authentic, artisanal feel. High resolution, sharp product focus."
}
```

4. Parse the LLM JSON response
5. Return to frontend: `{ done: boolean, question?: QuestionData, finalPrompt?: string }`

If `done: true` → session transitions to prompt review (Phase 6)

### Question Topics to Cover (AI decides order based on context)

For **Option A:**
- Setting / background environment
- Lighting style
- Mood / aesthetic
- Product placement / angle
- Photography style (lifestyle / flat lay / studio / close-up)
- Color palette / tones
- Props or additional elements
- For M2: variation strategy (same setting different angles? different settings? same mood different props?)

For **Option B SAME:**
- Confirm understanding of reference elements to keep
- What to adapt for this specific product
- Any elements from reference to intentionally change
- Level of adaptation per element

For **Option B IDEA:**
- What specifically inspired the user about the reference
- How to translate that aesthetic to this product type
- Creative direction for the user's own style

### End of Q&A

When the AI returns `{ done: true }`:
1. Save `final_prompt` to the session in DB
2. Update `session.status` to `'prompt_ready'`
3. Show a transition: "Your prompt is ready! ✓"
4. Auto-navigate to the Prompt Enhancer view (Phase 6) — same page, different state

---

## Previous Answers Panel

Below the session context in the left panel, show a collapsible list of all answered questions:
```
Q1: What background? → Cozy indoor, wooden surfaces
Q2: What lighting? → Natural window light
Q3: What mood? → Warm, artisanal, handmade feel
...
```
User can click any answered question to **edit** that answer (goes back to that question card, re-answering it clears all subsequent answers and restarts from that point).

---

## API Routes

```
POST /api/sessions/[id]/analyze         → run reference image analysis (Option B only)
POST /api/sessions/[id]/next-question   → get next question or finalPrompt
PUT  /api/sessions/[id]                 → update session fields (qa_answers, final_prompt, status)
GET  /api/sessions/[id]                 → load full session data
```

---

## Files to Create/Modify
```
app/
  dashboard/
    session/
      [sessionId]/
        page.tsx                        — session page (replaces placeholder from Phase 3)
components/
  session/
    SessionContextPanel.tsx             — left panel: session info + progress + answered Qs
    QuestionCard.tsx                    — animated question card with options + text input
    AnalysisResultCard.tsx              — shows reference image analysis summary
    QAProgressBar.tsx                   — "Questions answered: X/~Y" progress
app/
  api/
    sessions/[id]/
      route.ts                          — GET + PUT session
      analyze/route.ts                  — POST reference image analysis
      next-question/route.ts            — POST get next question
```

---

## Verification Checklist
- [ ] Navigating to `/dashboard/session/[id]` loads the session context in the left panel
- [ ] Option B session: "Analyzing reference image..." appears, then analysis summary card
- [ ] Option A session: skips analysis, goes straight to first question
- [ ] First question appears as a card with 3-4 options + AI suggestion + text input
- [ ] Selecting an option highlights it; selecting another deselects the previous
- [ ] Typing in text input clears any selected option
- [ ] "Next Question" disabled until answer provided
- [ ] Clicking Next submits the answer, shows loading, then next question slides in
- [ ] Left panel progress bar increments with each answer
- [ ] Answered questions appear in left panel list (collapsible)
- [ ] Clicking an answered question reopens it; subsequent answers are cleared
- [ ] After 6-10 questions, AI returns `done: true` with a final prompt
- [ ] "Prompt is ready" transition message appears
- [ ] Session status updates to `prompt_ready` in DB
