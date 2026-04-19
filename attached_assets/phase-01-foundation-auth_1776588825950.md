# Phase 1 — Foundation, Auth & Database Setup

## What You Are Building
An AI-powered Etsy mockup creation tool called **Etsy Mockup Tool**. This phase sets up the entire project foundation: Next.js app, PostgreSQL database with full schema, single-user password login, and the main sidebar layout shell.

This is Phase 1 of 8. After this phase, the app runs, shows a login page, and after login shows a sidebar with "Picture Analysis" nav item and an empty dashboard.

---

## Tech Stack
- **Framework:** Next.js 14 (App Router, TypeScript)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** PostgreSQL via `pg` package (use Replit's built-in PostgreSQL)
- **Auth:** Custom session using `iron-session` (cookie-based, no JWT complexity)
- **File uploads (later):** Will use Replit Object Storage — just install `@replit/object-storage` now, don't configure yet

---

## Step 1: Initialize the Project

Create a Next.js 14 project with TypeScript and Tailwind CSS:
```
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

Install all required packages:
```
npm install pg iron-session @types/pg
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-slot
npm install class-variance-authority clsx tailwind-merge lucide-react
npm install @replit/object-storage
```

Set up shadcn/ui:
```
npx shadcn@latest init
```
When prompted: style = Default, base color = Slate, CSS variables = yes.

Install shadcn components:
```
npx shadcn@latest add button input label card dialog dropdown-menu separator badge toast
```

---

## Step 2: Environment Variables

Create `.env.local` with these variables (Replit will fill them via Secrets):
```
APP_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=a_very_long_random_secret_string_at_least_32_chars
```

In Replit Secrets, set all three. The `DATABASE_URL` is auto-provided by Replit's PostgreSQL addon.

---

## Step 3: Database Schema

Create `lib/schema.sql` with the FULL schema for the entire app (all 8 phases):

```sql
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Products: each Etsy product the user works with
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAL.io model configurations (user adds via curl command)
CREATE TABLE IF NOT EXISTS fal_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  endpoint TEXT NOT NULL,
  curl_command TEXT,
  params_schema JSONB DEFAULT '{}',
  default_values JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LLM configurations (OpenRouter or Claude, user adds via curl command)
CREATE TABLE IF NOT EXISTS llm_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  provider VARCHAR(50) NOT NULL DEFAULT 'openrouter',
  model_id TEXT NOT NULL,
  endpoint TEXT,
  system_prompt TEXT DEFAULT '',
  curl_command TEXT,
  params_schema JSONB DEFAULT '{}',
  default_values JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Global settings (single row, id always = 1)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  fal_api_key TEXT DEFAULT '',
  openrouter_api_key TEXT DEFAULT '',
  claude_api_key TEXT DEFAULT '',
  claude_enabled BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Mockup generation sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  option_type VARCHAR(10) NOT NULL CHECK (option_type IN ('A', 'B')),
  output_type VARCHAR(10) NOT NULL CHECK (output_type IN ('M1', 'M2')),
  photo_count VARCHAR(10) NOT NULL DEFAULT 'single' CHECK (photo_count IN ('single', 'multiple')),
  reference_style VARCHAR(10) CHECK (reference_style IN ('SAME', 'IDEA')),
  similarity_level INTEGER CHECK (similarity_level BETWEEN 1 AND 100),
  template_inspiration_id UUID,
  product_image_urls JSONB DEFAULT '[]',
  reference_image_url TEXT,
  qa_answers JSONB DEFAULT '[]',
  final_prompt TEXT DEFAULT '',
  enhanced_prompt TEXT DEFAULT '',
  fal_model_id UUID REFERENCES fal_models(id) ON DELETE SET NULL,
  fal_params JSONB DEFAULT '{}',
  generated_image_urls JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates: saved successful sessions as reusable starting points
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('M1', 'M2')),
  option_type VARCHAR(10) NOT NULL CHECK (option_type IN ('A', 'B')),
  prompt TEXT NOT NULL,
  image_urls JSONB DEFAULT '[]',
  session_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Create `lib/db.ts`:
```typescript
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

export async function initDB() {
  const schemaPath = path.join(process.cwd(), 'lib', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);
}
```

---

## Step 4: Auth System

Create `lib/auth.ts`:
```typescript
import { IronSession, getIronSession } from 'iron-session';
import { cookies } from 'next/headers';

export interface SessionData {
  isLoggedIn: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: 'etsy-mockup-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return session;
}
```

Create `app/api/auth/login/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  
  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }
  
  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();
  
  return NextResponse.json({ success: true });
}
```

Create `app/api/auth/logout/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ success: true });
}
```

Create `middleware.ts` at project root:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { SessionData } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow login page and auth API routes
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }
  
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, {
    password: process.env.SESSION_SECRET as string,
    cookieName: 'etsy-mockup-session',
  });
  
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## Step 5: DB Initialization API Route

Create `app/api/db/init/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { initDB } from '@/lib/db';

export async function GET() {
  try {
    await initDB();
    return NextResponse.json({ success: true, message: 'Database initialized' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
```

---

## Step 6: Login Page

Create `app/login/page.tsx` — a centered login form on a dark background:

**Visual spec:**
- Full-screen dark background (`bg-gray-950`)
- Centered card (white/dark card, 400px wide)
- App title "Etsy Mockup Tool" at top of card (bold, large)
- Subtitle: "AI-Powered Mockup Creator"
- Password input (type="password") with label "Access Password"
- "Login" button (full width, primary color)
- Shows error message "Incorrect password" in red if auth fails
- On success, redirects to `/dashboard`
- Calls `POST /api/auth/login` with `{ password }`

---

## Step 7: Main Layout with Sidebar

Create `app/dashboard/layout.tsx` — the persistent shell for all dashboard pages:

**Visual spec:**
- Full-height flex row layout
- **Left sidebar** (240px wide, dark: `bg-gray-900`, full height):
  - App logo/name at top: "Etsy Mockup Tool" with a small wand/sparkle icon
  - Nav section label: "FEATURES" (small uppercase gray text)
  - Nav item: "Picture Analysis" with a camera/image icon — links to `/dashboard`
  - At bottom of sidebar: "Settings" link with gear icon → links to `/settings`
  - "Logout" button at very bottom with door icon → calls `POST /api/auth/logout` then redirects to `/login`
- **Main content area** (flex-1, `bg-gray-50` or similar): renders `{children}`

Create `app/dashboard/page.tsx` — the empty dashboard shell:

**Visual spec:**
- Shows a placeholder state:
  - Large heading: "Picture Analysis"
  - Subtext: "Create AI-powered mockups for your Etsy products."
  - A "Get Started" button (disabled for now with tooltip "Coming in next phase")
  - Or a simple welcome message showing the feature is ready to be built

---

## Step 8: Root Page Redirect

`app/page.tsx` — just redirects:
```typescript
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function Home() {
  const session = await getSession();
  if (session.isLoggedIn) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}
```

---

## Step 9: Initialize the Database

After the app starts, visit `http://localhost:3000/api/db/init` once to create all tables. Add a note in the README about this step.

---

## App Color Theme
Use a clean, professional dark-accented design:
- Sidebar: `bg-gray-900` text `white`
- Main area: `bg-gray-50`
- Primary action color: Indigo (`indigo-600`)
- Cards: `bg-white` with `border border-gray-200 rounded-xl shadow-sm`

---

## Verification Checklist
After building Phase 1, verify:
- [ ] `npm run dev` starts without errors
- [ ] Visiting `http://localhost:3000` redirects to `/login`
- [ ] Login with wrong password shows "Incorrect password" error
- [ ] Login with correct password (`APP_PASSWORD` env var) redirects to `/dashboard`
- [ ] Dashboard shows sidebar with "Picture Analysis" and "Settings" nav items
- [ ] Visiting `http://localhost:3000/api/db/init` returns `{ success: true }`
- [ ] Refreshing `/dashboard` while logged in stays on dashboard (session persists)
- [ ] Clicking "Logout" redirects back to `/login`
