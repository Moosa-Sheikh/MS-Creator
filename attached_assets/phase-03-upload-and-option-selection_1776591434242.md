# Phase 3 — Upload & Option Selection Flow

## Context
You are building an AI-powered Etsy mockup creation tool. Phases 1 & 2 are complete: the app has login, PostgreSQL, a sidebar, and product management (create/select products).

This phase builds the **complete input collection wizard** — everything the user configures BEFORE the AI starts working. When a user clicks "Create New Mockup" on an active product, this multi-step wizard opens.

The wizard collects:
1. Option A or B (what type of input)
2. M1 or M2 (how many output mockups)
3. Photo upload(s)
4. (Option B only) Reference style: SAME or IDEA + similarity slider
5. Template inspiration: use a saved template or start from scratch

After completing the wizard, the session is created in the DB and the user proceeds to the AI Q&A phase (Phase 5).

---

## Session State Object

Every wizard session tracks this state object. Persist it in React state and save to DB on completion:

```typescript
interface SessionMode {
  productId: string;
  option: 'A' | 'B';
  output: 'M1' | 'M2';
  photoCount: 'single' | 'multiple';
  // Option B only:
  referenceStyle?: 'SAME' | 'IDEA';
  similarityLevel?: number; // 1-100, only for SAME
  // Template:
  templateInspirationId?: string | null;
  // Uploaded files (temp storage):
  productImageUrls: string[];  // user's product photos
  referenceImageUrl?: string;  // Option B: the reference mockup
}
```

---

## Wizard Flow

The wizard is a **step-by-step modal** (full-screen overlay or large centered modal). Steps shown as numbered progress indicator at top.

### Step 1 — Choose Option A or B

**Title:** "How would you like to create your mockup?"

Two large option cards side by side:

```
┌────────────────────────────────┐  ┌────────────────────────────────┐
│  Option A                      │  │  Option B                      │
│  📷 Your Product Only          │  │  📷 + 🖼️ With Reference        │
│                                │  │                                │
│  Upload your product photo(s)  │  │  Upload your product photo(s)  │
│  and let AI create a           │  │  AND a reference mockup image  │
│  professional mockup from      │  │  (e.g., a competitor's listing │
│  scratch in your style.        │  │  or an expert sample). AI will │
│                                │  │  use the reference as          │
│  Best for: starting fresh with │  │  inspiration or replicate      │
│  no reference in mind.         │  │  its setup for your product.   │
│                                │  │                                │
│  [Select Option A]             │  │  [Select Option B]             │
└────────────────────────────────┘  └────────────────────────────────┘
```

Clicking a card selects it (indigo border + checkmark) and enables the "Next" button.

---

### Step 2 — Choose M1 or M2

**Title:** "How many mockup images do you want?"

Two large option cards:

```
┌────────────────────────────────┐  ┌────────────────────────────────┐
│  M1 — Single Mockup            │  │  M2 — Multiple Mockups         │
│  🖼️                            │  │  🖼️🖼️🖼️🖼️                    │
│                                │  │                                │
│  One final mockup image.       │  │  A set of mockup images        │
│  Perfect for testing or when   │  │  (you choose how many).        │
│  you know exactly what         │  │  Great for listing with        │
│  you want.                     │  │  multiple angles/styles.       │
│                                │  │                                │
│  [Select M1]                   │  │  [Select M2]                   │
└────────────────────────────────┘  └────────────────────────────────┘
```

If M2 is selected, show a small inline field below the cards:
- Label: "How many mockups?" 
- Number input (min 2, max 8, default 4)

---

### Step 3 — Upload Photos

**Title depends on option:**
- Option A: "Upload Your Product Photo(s)"
- Option B: "Upload Your Photos"

**For Option A:**
- Single upload zone labeled "Your Product Photo(s)"
  - Drag & drop or click to browse
  - Accepts: JPG, PNG, WEBP (max 10MB each)
  - Toggle switch: "Single photo" / "Multiple photos"
    - Single: accepts 1 file
    - Multiple: accepts up to 8 files
  - Uploaded images show as thumbnails in a grid with an X to remove each

**For Option B:**
Two upload zones stacked vertically:

```
┌─────────────────────────────────────────────────────────┐
│  Zone 1: Your Product Photo(s)                          │
│  [drag & drop or click] — same as Option A above        │
│  Toggle: Single / Multiple                              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Zone 2: Reference Mockup Image                         │
│  [drag & drop or click]                                 │
│  This is the successful mockup image you want AI        │
│  to analyze — e.g., a competitor's Etsy listing photo,  │
│  an expert sample, or any mockup you admire.            │
│  (1 image only, max 10MB)                               │
└─────────────────────────────────────────────────────────┘
```

**File Upload Implementation:**
- Upload files immediately on drop/select via `POST /api/upload`
- Show upload progress spinner per file
- Store returned URL in session state
- Use Replit Object Storage (`@replit/object-storage`) to store uploaded files
- Return permanent URL for each uploaded file

**API Route — `POST /api/upload`:**
- Accepts `multipart/form-data` with file(s)
- Saves each file to Replit Object Storage under path `uploads/{uuid}-{filename}`
- Returns `{ urls: string[] }` — public URLs for each file

---

### Step 4 — Option B Only: Reference Style

**This step is skipped entirely if Option A was chosen.**

**Title:** "How should AI use the reference image?"

Two option cards:

```
┌────────────────────────────────┐  ┌────────────────────────────────┐
│  SAME — Replicate the Setup    │  │  IDEA — Use as Inspiration     │
│  🔁                            │  │  💡                            │
│                                │  │                                │
│  AI will replace the product   │  │  AI takes the style, mood,     │
│  in the reference image with   │  │  and composition IDEA from     │
│  YOUR product. The lighting,   │  │  the reference, then creates   │
│  angle, background, and setup  │  │  a fresh mockup tailored to    │
│  will stay the same.           │  │  your product.                 │
│                                │  │                                │
│  Best for: when you want the   │  │  Best for: when you love a     │
│  exact same look as the        │  │  competitor's aesthetic but    │
│  reference, adapted for you.   │  │  want something original.      │
│                                │  │                                │
│  [Select SAME]                 │  │  [Select IDEA]                 │
└────────────────────────────────┘  └────────────────────────────────┘
```

If **SAME** is selected, show below the cards:

```
Similarity Level
How closely should AI match the reference setup?

[──────────────●──────────────] 75%

Low similarity                High similarity
(Loosely inspired)            (Near-identical setup)
```
- Slider (range 1-100, default 75)
- Live label showing current % value

---

### Step 5 — Template Inspiration (Optional)

**Title:** "Start from a saved template or from scratch?"

```
┌─────────────────────────────────────────────────────────┐
│  📁 Use a Saved Template                                │
│  Start with a template you saved from a previous        │
│  successful mockup. AI will use it as context.          │
│                                                         │
│  [Browse Templates]   ← opens template picker grid      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  ✨ Start from Scratch                                  │
│  AI will ask questions and build your prompt fresh.     │
│                                                         │
│  [Start Fresh]                                          │
└─────────────────────────────────────────────────────────┘
```

**Template Picker (if Browse Templates clicked):**
- Shows grid of all templates for the current product, filtered by matching output type (M1 or M2)
- If no templates exist: "No templates saved yet for this product. Start fresh to create your first one."
- Each template card shows: thumbnail image, name, type badge (M1/M2), created date
- Clicking a template card selects it (indigo border + checkmark)
- "Use This Template" button confirms selection
- Template inspiration means: the template's prompt and session config will be passed to the AI as context in the next phase

---

## Progress Indicator

At top of wizard modal:
```
Step 1 of 5:  [●]──[○]──[○]──[○]──[○]
              Option  M1/M2  Upload  Style  Template
```
Steps adjust: Option B adds the "Style" step (Step 4). Option A skips it and shows 4 total steps.

---

## Navigation

- **"Back"** button on every step (except Step 1) — goes to previous step, preserving selections
- **"Next"** button advances to next step (disabled until current step's required selection is made)
- **"Cancel"** button (top-right X) — shows confirmation "Discard this session?" before closing
- On final step, "Next" becomes **"Start Creating"** button

---

## API Routes

### `POST /api/sessions`
Creates a session record in DB when user clicks "Start Creating":
```typescript
// Request:
{
  productId: string,
  optionType: 'A' | 'B',
  outputType: 'M1' | 'M2',
  photoCount: 'single' | 'multiple',
  referenceStyle?: 'SAME' | 'IDEA',
  similarityLevel?: number,
  templateInspirationId?: string,
  productImageUrls: string[],
  referenceImageUrl?: string,
  m2Count?: number, // how many images for M2
}
// Response:
{ session: { id, ...all fields, status: 'draft' } }
```

---

## Where This Leads

After clicking "Start Creating", the wizard closes and the user is taken to the **AI Q&A screen** (built in Phase 5). The `sessionId` is passed in the URL: `/dashboard/session/[sessionId]`.

For now (end of Phase 3), after "Start Creating" is clicked:
- Create the session in the DB
- Redirect to `/dashboard/session/[sessionId]`
- That page just shows: "Session created! AI Q&A coming in Phase 5." + a summary of the selected options

---

## Files to Create
```
components/
  wizard/
    WizardModal.tsx           — modal shell with progress bar + nav
    Step1OptionSelect.tsx     — Option A/B selection
    Step2OutputSelect.tsx     — M1/M2 + count
    Step3PhotoUpload.tsx      — upload zones
    Step4ReferenceStyle.tsx   — SAME/IDEA + slider (Option B only)
    Step5TemplateSelect.tsx   — template picker
    UploadZone.tsx            — reusable drag-drop upload component
    TemplatePicker.tsx        — template grid picker
app/
  api/
    upload/route.ts           — file upload handler
    sessions/route.ts         — POST create session
  dashboard/
    session/
      [sessionId]/
        page.tsx              — placeholder session page
```

---

## Verification Checklist
- [ ] "Create New Mockup" button on active product opens the wizard modal
- [ ] Step 1: clicking Option A card highlights it and enables Next
- [ ] Step 2: M2 shows count input; M1 hides it
- [ ] Option A flow: wizard shows 4 steps total (no Step 4)
- [ ] Option B flow: wizard shows 5 steps total (includes Step 4)
- [ ] Step 3 Option A: single/multiple toggle works; multiple allows up to 8 files
- [ ] Step 3 Option B: two separate upload zones work independently
- [ ] Files upload successfully; thumbnails appear; X removes them
- [ ] Step 4 (Option B): SAME shows similarity slider; IDEA hides it
- [ ] Similarity slider updates % label live
- [ ] Step 5: "Start Fresh" skips template; "Browse Templates" shows picker (empty state for now)
- [ ] Back button on each step preserves previous selections
- [ ] Clicking X asks for confirmation before closing
- [ ] "Start Creating" creates a session in DB and redirects to `/dashboard/session/[id]`
- [ ] Session page shows a summary of all selected options
