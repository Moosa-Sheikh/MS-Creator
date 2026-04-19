# Phase 6 — Prompt Enhancer & Refinement

## Context
You are building an AI-powered Etsy mockup creation tool. Phases 1–5 are complete: login, product management, the upload wizard, settings, and the AI Q&A system that produces a `final_prompt`.

This phase builds the **Prompt Enhancer** — the screen where the user reviews the AI-generated prompt, refines it, and gets it to a state they're happy with before generating the actual image.

The Prompt Enhancer appears automatically after the AI Q&A completes (on the same session page, different view state). It has four tools:
1. **Enhancer Mode** — AI highlights vague words and suggests detailed replacements inline
2. **Revision Comment** — user types feedback, AI rewrites affected parts
3. **Regenerate** — re-runs the entire Q&A from scratch
4. **Complete Rewrite** — AI fully rewrites the prompt from the session context

---

## UI Layout

The session page (`/dashboard/session/[sessionId]`) switches to this layout when `status = 'prompt_ready'`:

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Crochet Cap    Session: Option B / M2 / IDEA               │
├───────────────────────────────┬──────────────────────────────────┤
│                               │                                  │
│   LEFT PANEL (35%)            │   RIGHT PANEL (65%)              │
│   Session Summary             │   Prompt Editor                  │
│                               │                                  │
│   Product: Crochet Cap        │   [Toolbar]                      │
│   Mode: Option B, IDEA, M2   │                                  │
│   Reference: [thumb]          │   [Prompt text area]             │
│   Photos: [thumbs]            │                                  │
│                               │   [Enhancer suggestions panel]   │
│   ── Q&A Summary ──           │                                  │
│   Background: Cozy indoor     │   [Action buttons]               │
│   Lighting: Window light      │                                  │
│   Mood: Warm, artisanal       │   [Generate →]                   │
│   ...                         │                                  │
│                               │                                  │
└───────────────────────────────┴──────────────────────────────────┘
```

---

## Right Panel: Prompt Editor

### Toolbar (row of buttons above the prompt text area):
```
[✨ Enhance]  [💬 Revise]  [🔄 Regenerate Q&A]  [📝 Rewrite All]
```

### Prompt Text Area:
- Large textarea (10+ rows, full width of right panel)
- Displays the `final_prompt` from the session
- Directly editable by the user (they can type/delete freely)
- Font: monospace or serif, readable size
- Character count shown below: "247 characters"

---

## Tool 1: Enhance Mode

**Trigger:** User clicks "✨ Enhance" button

**What it does:**
1. Button shows loading spinner: "Analyzing prompt..."
2. Calls `POST /api/sessions/[id]/enhance`
3. The API sends the prompt to the active LLM with this instruction:

```
You are a prompt engineering expert for AI image generators. 
Analyze the following image generation prompt and identify words or phrases that are too vague for an AI image generator to interpret accurately.

For each vague term, provide:
- The exact word/phrase that is vague
- Why it's vague
- A specific, detailed replacement that gives the AI a clear visual instruction

Examples of vague words: "beautiful", "nice", "good", "perfect", "stylish", "modern", "cozy"
Examples of specific replacements:
- "beautiful" → "soft natural light with warm golden tones, shallow depth of field"
- "cozy" → "warm earthy color palette, soft knit textures, candlelight-adjacent warmth"
- "stylish" → "clean Scandinavian minimalist aesthetic, muted pastel tones"

Prompt to analyze:
{current_prompt}

Return JSON:
{
  "suggestions": [
    {
      "original": "beautiful",
      "startIndex": 12,
      "endIndex": 21,
      "reason": "Too subjective — AI doesn't know what 'beautiful' means visually",
      "replacement": "soft natural window light, warm golden undertones, shallow depth of field"
    }
  ]
}
Return empty suggestions array if the prompt is already specific enough.
```

4. Response: highlighted version of the prompt with suggestions

**Rendering highlighted suggestions in the UI:**

Transform the prompt text area into a **rich display** when suggestions exist:
- The prompt text is shown as static (non-editable in this mode)
- Each suggested word is shown with a **yellow underline highlight**
- Below the text area, show the **Suggestions Panel**:

```
┌─────────────────────────────────────────────────────────┐
│  ✨ Enhancement Suggestions (3 found)                   │
├─────────────────────────────────────────────────────────┤
│  1. "beautiful"                                         │
│     Why: Too subjective — AI can't interpret visually   │
│     → Replace with:                                     │
│     "soft natural window light, warm golden undertones, │
│      shallow depth of field"                            │
│     [✓ Accept]  [✗ Skip]                                │
├─────────────────────────────────────────────────────────┤
│  2. "cozy"                                              │
│     Why: Non-visual term — needs sensory description    │
│     → Replace with:                                     │
│     "warm earthy color palette, textured wooden         │
│      surfaces, soft ambient lighting"                   │
│     [✓ Accept]  [✗ Skip]                                │
├─────────────────────────────────────────────────────────┤
│  [✓ Accept All]                    [Done Enhancing]     │
└─────────────────────────────────────────────────────────┘
```

**Accepting a suggestion:**
- Replaces the word in the prompt text area immediately
- Suggestion card grays out with a "✓ Applied" label
- Prompt textarea re-enables editing

**Skipping a suggestion:**
- Suggestion card grays out with "Skipped" label

**"Accept All"** applies every suggestion at once.

**"Done Enhancing"** collapses the suggestions panel, prompt textarea becomes editable again.

The enhanced prompt is saved to `sessions.enhanced_prompt` in DB.

---

## Tool 2: Revision Comment

**Trigger:** User clicks "💬 Revise" button

Opens an input area below the toolbar:
```
┌─────────────────────────────────────────────────────────┐
│  Tell the AI what to change:                            │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Make the background more minimalist, and add a  │   │
│  │ hint of autumn colors                           │   │
│  └─────────────────────────────────────────────────┘   │
│  [Cancel]                          [Apply Revision]     │
└─────────────────────────────────────────────────────────┘
```

**On "Apply Revision":**
1. Loading spinner on the prompt area
2. Calls `POST /api/sessions/[id]/revise` with `{ comment: string, currentPrompt: string }`
3. LLM system prompt:
```
You are a prompt engineering expert. The user has an image generation prompt and wants specific changes made to it.

Current prompt:
{currentPrompt}

User's revision request:
{comment}

Instructions:
- Modify ONLY the parts of the prompt the user mentioned
- Keep everything else exactly as is
- Return the complete revised prompt (not just the changed parts)
- Do not add explanations, just return the revised prompt text
```
4. Replace the textarea content with the revised prompt
5. Show brief success toast: "Prompt revised"
6. Save to `sessions.final_prompt`

---

## Tool 3: Regenerate Q&A

**Trigger:** User clicks "🔄 Regenerate Q&A" button

Shows confirmation dialog:
```
Regenerate Q&A?
This will discard your current prompt and take you back through 
the questions. You'll start fresh with the same uploaded images 
and mode settings.

[Cancel]    [Yes, Regenerate]
```

On confirm:
- Clears `sessions.qa_answers`, `sessions.final_prompt`, `sessions.enhanced_prompt`
- Updates `sessions.status` to `'draft'`
- Returns user to the Q&A view (beginning of Phase 5 flow)

---

## Tool 4: Complete Rewrite

**Trigger:** User clicks "📝 Rewrite All" button

Shows confirmation dialog:
```
Completely Rewrite Prompt?
The AI will use your session settings and Q&A answers to write 
a completely fresh prompt from scratch, ignoring the current one.

[Cancel]    [Yes, Rewrite]
```

On confirm:
1. Loading state on prompt area
2. Calls `POST /api/sessions/[id]/rewrite`
3. LLM prompt:
```
You are a professional AI image prompt writer specializing in product photography for Etsy.

Based on this session context, write a completely new, highly detailed image generation prompt:

Product: {product_name} — {product_description}
Mode: Option {A|B}
{if B: Reference image analysis: {reference_analysis}}
Output: {M1: single image | M2: {count} images — write a prompt that can generate a cohesive set}
{if SAME: Similarity level: {level}% — closely match the reference composition}
{if IDEA: Use reference aesthetic as inspiration only}

Q&A answers:
{all qa_answers formatted as: Q: answer}

Write a single, complete, detailed image generation prompt. Be specific about:
- Subject and product description
- Background and setting
- Lighting
- Camera angle and composition  
- Mood and atmosphere
- Style references
- Technical photography terms

Return only the prompt text, no explanation.
```
4. Replace textarea with rewritten prompt
5. Save to `sessions.final_prompt`

---

## Final Action: Proceed to Generate

At the bottom of the right panel, always visible:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Ready to generate your mockup?                       │
│                                                         │
│   [🎨 Generate Mockup →]  (M1) or [🎨 Generate 4 Mockups →] (M2) │
│                                                         │
│   Select model: [▼ SeedEdit v4.5          ]            │
│   (This will open the generation panel — Phase 7)       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **Model dropdown**: lists all configured fal.io models from settings
- If no models configured: shows warning "No image models configured — go to Settings to add one"
- Clicking "Generate" saves the current prompt state and transitions to the Generation Panel (Phase 7, built on same page)
- Save `sessions.status = 'generating'` and `sessions.fal_model_id = selectedModelId`

---

## API Routes

```
POST /api/sessions/[id]/enhance    → analyze prompt for vague words, return suggestions
POST /api/sessions/[id]/revise     → apply user comment to revise prompt
POST /api/sessions/[id]/rewrite    → completely rewrite prompt from session context
```

---

## Files to Create/Modify

```
app/
  dashboard/
    session/
      [sessionId]/
        page.tsx                      — update to show Enhancer view when status='prompt_ready'
components/
  session/
    PromptEnhancer.tsx                — main right panel for prompt_ready state
    PromptTextArea.tsx                — editable/highlighted textarea component
    EnhancementSuggestions.tsx        — list of vague word suggestions with accept/skip
    RevisionInput.tsx                 — revision comment input area
    GenerateButton.tsx                — bottom CTA with model selector
```

---

## Verification Checklist
- [ ] When session `status = 'prompt_ready'`, the page shows the Prompt Enhancer layout
- [ ] Final prompt is pre-loaded in the textarea and is editable
- [ ] Q&A summary is shown in the left panel
- [ ] "✨ Enhance" calls the API; loading spinner shows during call
- [ ] Suggestions panel appears with vague words highlighted and replacements shown
- [ ] "Accept" replaces the word in the textarea; "Skip" grays out the card
- [ ] "Accept All" applies all suggestions at once
- [ ] "Done Enhancing" collapses suggestions panel, prompt becomes editable
- [ ] "💬 Revise" opens comment input; submitting rewrites only relevant parts
- [ ] "🔄 Regenerate Q&A" shows confirmation; confirming goes back to Q&A
- [ ] "📝 Rewrite All" shows confirmation; confirming replaces prompt with fresh version
- [ ] Model dropdown shows all fal.io models from settings
- [ ] "Generate" button (disabled if no model selected) saves status and transitions to generation view
- [ ] All prompt changes are auto-saved to DB (final_prompt / enhanced_prompt)
