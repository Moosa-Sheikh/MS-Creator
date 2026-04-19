# Phase 2 — Product Management

## Context
You are building an AI-powered Etsy mockup creation tool. Phase 1 is already complete: the app runs with Next.js 14, PostgreSQL is connected, single-user password login works, and the sidebar layout shell exists.

This phase adds **Product Management** — the ability to create, view, and select products. Every mockup session in this app belongs to a product. The user creates a product (e.g., "Crochet Cap", "Tote Bag") with a short description, and then all mockup templates and sessions are scoped to that product.

After this phase: the dashboard shows a product selector, user can create products, and selecting a product sets the active context for everything that follows.

---

## Database
The `products` table already exists from Phase 1 schema:
```sql
products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```
No schema changes needed.

---

## API Routes to Create

### `GET /api/products`
Returns all products ordered by `created_at DESC`.
```typescript
// Response:
{ products: [{ id, name, description, created_at }] }
```

### `POST /api/products`
Creates a new product.
```typescript
// Request body:
{ name: string, description: string }
// Response:
{ product: { id, name, description, created_at } }
// Validation: name is required, max 100 chars. description optional, max 500 chars.
```

### `PUT /api/products/[id]`
Updates a product's name or description.
```typescript
// Request body:
{ name?: string, description?: string }
// Response:
{ product: { id, name, description } }
```

### `DELETE /api/products/[id]`
Deletes a product and all its associated sessions and templates (CASCADE handles this).
```typescript
// Response:
{ success: true }
```

---

## UI Changes

### 1. Dashboard Page Redesign (`app/dashboard/page.tsx`)

The dashboard is the main hub. After Phase 2 it should look like:

**Layout (top section):**
```
┌─────────────────────────────────────────────────────────┐
│  Picture Analysis                                        │
│  Create AI-powered mockups for your Etsy products.      │
├─────────────────────────────────────────────────────────┤
│  [+ New Product]              [▼ Select Product Dropdown]│
├─────────────────────────────────────────────────────────┤
│  (product list grid or empty state)                      │
└─────────────────────────────────────────────────────────┘
```

**When no products exist:**
- Empty state illustration (simple icon)
- Text: "No products yet. Create your first product to get started."
- Large "+ Create Product" button in the center

**When products exist — Product Grid:**
- Grid of product cards (3 columns on desktop, 1 on mobile)
- Each card shows:
  - Product name (bold, large)
  - Description (truncated to 2 lines, gray text)
  - "Created: X days ago" (small text)
  - Two buttons: **"Open"** (primary, opens this product's workspace) and **"⋮"** (context menu: Edit, Delete)
- Clicking "Open" sets this as the active product and shows the mockup creation area below

### 2. Create Product Modal

Triggered by "+ New Product" button or the empty state button.

**Modal content:**
- Title: "Create New Product"
- Form:
  - **Product Name** (required): text input, placeholder "e.g., Crochet Cap, Linen Tote Bag"
  - **Short Description** (optional): textarea (3 rows), placeholder "Describe what this product is — e.g., handmade crochet cap in earthy tones"
  - Character counter for description (0/500)
- Buttons: "Cancel" | "Create Product" (disabled until name is filled)
- On success: modal closes, new product card appears at top of grid, success toast

### 3. Edit Product Modal

Same form as Create, pre-filled with current values.
- Title: "Edit Product"
- On save: updates product card in place

### 4. Delete Product Confirmation

Inline confirmation in the context menu:
- Context menu shows: "Edit" | "Delete"
- Clicking "Delete" shows a confirmation dialog:
  - "Delete [Product Name]?"
  - "This will permanently delete this product and all its templates and sessions. This cannot be undone."
  - Buttons: "Cancel" | "Delete" (red/destructive)

### 5. Active Product State

When user clicks "Open" on a product card:
- The product card gets a highlighted border (indigo ring)
- Below the product grid, a new section appears:

```
┌─────────────────────────────────────────────────────────┐
│  ✓ Active Product: Crochet Cap                          │
│  "handmade crochet cap in earthy tones"                 │
│                                                         │
│  [🎨 Create New Mockup]    [📁 View Templates (0)]      │
└─────────────────────────────────────────────────────────┘
```

- **"Create New Mockup"** button: this is what Phase 3 will wire up. For now, show it but have it display a toast: "Coming soon — Mockup creation setup starts in Phase 3"
- **"View Templates"**: shows count in parens (0 for now), will be functional in Phase 8

### 6. Active Product in Sidebar

The sidebar (already built) should show the active product name below the "Picture Analysis" nav item when a product is selected:
```
Picture Analysis
└─ Crochet Cap  ← active product name, truncated, small gray text
```

---

## State Management

Use React state + `localStorage` to persist the active product across page refreshes:
- On product "Open": save `activeProductId` to `localStorage`
- On page load: read `activeProductId` from `localStorage`, fetch that product from API, restore active state
- If the stored product ID no longer exists (was deleted), clear localStorage and show empty state

---

## Component Files to Create
```
components/
  products/
    ProductGrid.tsx       — renders the grid of product cards
    ProductCard.tsx       — single product card with Open/menu buttons
    CreateProductModal.tsx — create/edit modal (reused for both)
    DeleteProductDialog.tsx — confirmation dialog
  ActiveProductBanner.tsx — the "Active Product: X" section below the grid
```

---

## Verification Checklist
After Phase 2, verify:
- [ ] Dashboard shows empty state with "Create Product" button when no products exist
- [ ] Clicking "Create Product" opens modal; submitting creates a product card
- [ ] Product grid shows cards with name, description, created date
- [ ] "Open" button highlights the card and shows the Active Product banner below
- [ ] Context menu "Edit" opens pre-filled modal; saving updates the card
- [ ] Context menu "Delete" shows confirmation; confirming removes the card
- [ ] Active product name appears in the sidebar
- [ ] Active product persists after page refresh (localStorage)
- [ ] Creating 4+ products shows them all in a 3-column grid
