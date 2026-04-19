# Phase 7 — Image Generation via fal.io

## Context
You are building an AI-powered Etsy mockup creation tool. Phases 1–6 are complete: login, product management, the upload wizard, settings (with configured fal.io models), the AI Q&A system, and the Prompt Enhancer.

This phase builds **Image Generation** — the moment the user's prompt becomes an actual mockup image (or set of images for M2). The user has already:
1. Chosen a fal.io model from the dropdown in Phase 6
2. Finalized their prompt

Now they enter the Generation Panel on the same session page, configure the model parameters one last time, and fire off the generation.

---

## Page State Machine

The session page (`/dashboard/session/[sessionId]`) now has these states:
```
draft → prompt_ready → generating → completed
```

When `status = 'generating'` (set at end of Phase 6), the page shows the **Generation Panel**.
When `status = 'completed'`, it shows the **Results Gallery**.

---

## Generation Panel Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Crochet Cap    Session: Option B / M2 (4 images) / IDEA     │
├───────────────────────────────┬──────────────────────────────────┤
│                               │                                  │
│   LEFT PANEL (35%)            │   RIGHT PANEL (65%)              │
│   Model Configuration         │   Generation Control             │
│                               │                                  │
│   Model: SeedEdit v4.5        │   Final Prompt:                  │
│   ─────────────────────────   │   [prompt preview, read-only,    │
│   Parameters:                 │    truncated with expand]        │
│                               │                                  │
│   num_images    [4    ]       │   ─────────────────────────────  │
│   guidance_scale [7.5  ]      │   For M2 — Image Count: [4]     │
│   seed          [OFF   ]      │                                  │
│   [other params...]           │   [🎨 Generate Now]              │
│                               │                                  │
│   [← Back to Prompt]          │   ─────────────────────────────  │
│                               │   Progress will appear here      │
│                               │   once generation starts         │
└───────────────────────────────┴──────────────────────────────────┘
```

---

## Left Panel: Model Parameter Configuration

When the generation panel loads:
1. Load the selected fal.io model config from DB (the `fal_model_id` stored in session)
2. Show the model name and endpoint URL (small text, gray)
3. Render the **same dynamic parameter form** as built in Phase 4 (Settings)
   - Use the saved `default_values` from the model config as initial values
   - User can override any non-auto param before generating
   - Auto-filled params (`prompt`, `image_url`) show the actual values they'll receive:
     - `prompt`: shows first 100 chars of the final prompt with "..." 
     - `image_url`: shows reference image thumbnail (if applicable)

**M2 special param:**
- If `output_type = 'M2'`, show a dedicated "Number of images to generate" field at the top of params
- Range: 2–8, default pulled from M2 count set in wizard (Phase 3)
- Explanation: "Each image will be generated as a separate API call using the same prompt"

---

## Right Panel: Generation Control

**Prompt Preview:**
- The final/enhanced prompt shown in a read-only box (gray background)
- "Edit Prompt ←" link that goes back to Phase 6 (prompt enhancer view)

**Generate Button:**
- Large primary button: "🎨 Generate Mockup" (M1) or "🎨 Generate 4 Mockups" (M2, showing the count)
- On click: starts the generation process

---

## Generation Process

### For M1 (single image):

1. Button changes to loading state: "Generating..."
2. Call `POST /api/sessions/[id]/generate`
3. API builds the fal.io request:
   ```typescript
   const body = buildFalRequestBody(model, session, userParams);
   // body = { prompt: finalPrompt, ...userParams } 
   // For Option B SAME mode: also includes image_url: session.referenceImageUrl
   ```
4. Make the fal.io API call:
   ```typescript
   const response = await fetch(model.endpoint, {
     method: 'POST',
     headers: {
       'Authorization': `Key ${settings.fal_api_key}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify(body),
   });
   ```
5. fal.io responses are usually synchronous for most models, but some use a queue pattern. Handle both:
   - **Synchronous**: response contains `images` array directly
   - **Queue pattern**: response has `request_id`; poll `GET https://queue.fal.run/{modelPath}/requests/{requestId}` until status = `COMPLETED`
6. Extract image URLs from response
7. Save to `sessions.generated_image_urls` (JSONB array)
8. Update `sessions.status = 'completed'`
9. Return image URLs to frontend

**Progress UI during generation (M1):**
```
┌─────────────────────────────────────────────────────────┐
│  🎨 Generating your mockup...                           │
│                                                         │
│  [████████████████████░░░░] 80%                        │
│                                                         │
│  Estimated: ~15 seconds remaining                       │
└─────────────────────────────────────────────────────────┘
```
- Use polling to track fal.io queue status and update progress bar
- Pulse animation on the progress bar while waiting

### For M2 (multiple images):

Generate images **sequentially** (not in parallel — avoid rate limits):

```
Image 1 of 4: [████████████████████] ✓
Image 2 of 4: [████████░░░░░░░░░░░░] Generating...
Image 3 of 4: [░░░░░░░░░░░░░░░░░░░░] Waiting...
Image 4 of 4: [░░░░░░░░░░░░░░░░░░░░] Waiting...
```

- Each row shows individual progress
- Completed images appear in the results area immediately (don't wait for all)
- If one image fails, show error on that row + "Retry" button; continue with remaining images

---

## Results Gallery

When `status = 'completed'`, replace the generation UI with the results:

```
┌──────────────────────────────────────────────────────────────────┐
│  ✓ Your Mockup is Ready!  (M1) or  ✓ 4 Mockups Generated! (M2) │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [M1: Full-width image display]                                  │
│                                                                  │
│  OR [M2: 2-column grid of images]                                │
│                                                                  │
│  Each image card:                                                │
│  ┌────────────────────┐                                          │
│  │   [Image]          │                                          │
│  │                    │                                          │
│  │  [⬇ Download]      │                                          │
│  │  [🔍 View Full]    │                                          │
│  └────────────────────┘                                          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  [🔄 Generate Again] [📝 Edit Prompt] [💾 Save as Template]     │
└──────────────────────────────────────────────────────────────────┘
```

**Actions:**
- **Download**: downloads the image directly (set `Content-Disposition: attachment` header)
- **View Full**: opens image in a lightbox modal at full resolution
- **Generate Again**: goes back to Generation Panel with same params (allows tweaking params and regenerating)
- **Edit Prompt**: goes back to Prompt Enhancer
- **Save as Template**: triggers the template save flow (Phase 8)

---

## fal.io API Implementation Details

### Building the request body

```typescript
function buildFalRequestBody(
  model: FalModel,
  session: Session,
  userOverrides: Record<string, unknown>
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  
  for (const param of model.params_schema) {
    if (!param.enabled) continue;
    
    if (param.key === 'prompt') {
      // Use enhanced_prompt if available, else final_prompt
      body.prompt = session.enhanced_prompt || session.final_prompt;
    } else if (param.key === 'image_url' && session.option_type === 'B') {
      // For Option B: pass reference image
      body.image_url = session.reference_image_url;
    } else if (userOverrides[param.key] !== undefined) {
      body[param.key] = userOverrides[param.key];
    } else if (model.default_values[param.key] !== undefined) {
      body[param.key] = model.default_values[param.key];
    }
  }
  
  return body;
}
```

### Handling fal.io response formats

Different fal.io models return images differently. Handle all variants:
```typescript
function extractImageUrls(response: unknown): string[] {
  const r = response as Record<string, unknown>;
  // Format 1: { images: [{ url: "..." }] }
  if (r.images && Array.isArray(r.images)) {
    return (r.images as { url: string }[]).map(img => img.url);
  }
  // Format 2: { image: { url: "..." } }
  if (r.image && typeof r.image === 'object') {
    return [(r.image as { url: string }).url];
  }
  // Format 3: { output: ["url1", "url2"] }
  if (r.output && Array.isArray(r.output)) {
    return r.output as string[];
  }
  return [];
}
```

### Queue pattern polling

```typescript
async function pollFalQueue(requestId: string, modelPath: string, falApiKey: string): Promise<unknown> {
  const pollUrl = `https://queue.fal.run/${modelPath}/requests/${requestId}`;
  
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // poll every 2s
    const res = await fetch(pollUrl, {
      headers: { 'Authorization': `Key ${falApiKey}` }
    });
    const data = await res.json();
    
    if (data.status === 'COMPLETED') return data.output;
    if (data.status === 'FAILED') throw new Error(data.error || 'Generation failed');
    // Status is IN_QUEUE or IN_PROGRESS — continue polling
  }
}
```

---

## API Routes

```
POST /api/sessions/[id]/generate        → trigger M1 or M2 generation
GET  /api/sessions/[id]/generate-status → poll status for long-running generations
```

**`POST /api/sessions/[id]/generate` request body:**
```typescript
{
  userParams: Record<string, unknown>, // user's overrides for this generation
  m2Count?: number,                    // for M2: how many images
}
```

---

## Files to Create/Modify

```
app/
  dashboard/
    session/
      [sessionId]/
        page.tsx                        — add 'generating' and 'completed' state views
components/
  session/
    GenerationPanel.tsx                 — left: params config, right: generate button
    GenerationProgress.tsx              — M1 single progress bar
    M2GenerationProgress.tsx            — M2 per-image progress rows
    ResultsGallery.tsx                  — image grid with download/view/save buttons
    ImageLightbox.tsx                   — full-size image modal
lib/
  fal.ts                                — fal.io API utilities (buildRequestBody, extractImageUrls, pollQueue)
app/
  api/
    sessions/[id]/
      generate/route.ts                 — POST trigger generation
      generate-status/route.ts          — GET poll status
```

---

## Verification Checklist
- [ ] Generation Panel shows the selected model's name and dynamic parameter form
- [ ] Parameter form pre-fills with model's default values
- [ ] User can change any non-auto param value before generating
- [ ] `prompt` param shows first 100 chars of the final prompt (read-only)
- [ ] M2: image count field shows correctly
- [ ] Clicking "Generate" starts the generation; button becomes loading state
- [ ] M1: single progress bar animates; image appears in results when done
- [ ] M2: per-image progress rows update as each image completes; images appear immediately
- [ ] Results gallery shows all images in grid (2 columns for M2)
- [ ] Download button downloads the image file
- [ ] "View Full" opens image in lightbox
- [ ] "Generate Again" returns to Generation Panel (params preserved)
- [ ] "Edit Prompt" returns to Prompt Enhancer
- [ ] Generated image URLs saved to `sessions.generated_image_urls` in DB
- [ ] Session status updated to `completed` in DB
- [ ] Option B sessions pass `reference_image_url` as `image_url` param automatically
