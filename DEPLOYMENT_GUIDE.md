# Etsy Mockup Tool — Setup & Deployment Guide

This guide explains everything you need to run this app on your own computer or on Hostinger.
Written in plain language — no technical background assumed.

---

## What This App Is Made Of

The app has three parts working together:

| Part | What it does |
|------|-------------|
| **Frontend** | The visual interface you see in the browser (React/Vite) |
| **Backend (API Server)** | The brain that handles uploads, AI calls, settings, database queries (Node.js/Express) |
| **Database** | Stores your products, sessions, templates, AI settings (PostgreSQL) |

Plus two external services you pay for directly:
- **fal.io** — generates the mockup images using AI
- **OpenRouter** (or Anthropic/OpenAI directly) — the AI that asks you questions and builds prompts

---

## Accounts & Services You Need

Before you can run this app anywhere, you need accounts at these places:

### 1. fal.io (Image Generation)
- Sign up at https://fal.ai
- Go to your dashboard → API Keys → Create a key
- Keep this key — you'll paste it into the app's Settings screen

### 2. OpenRouter (AI for the Q&A flow)
- Sign up at https://openrouter.ai
- Go to Keys → Create Key
- Keep this key — you'll paste it into the app's Settings screen
- Add some credits (pay-as-you-go, very cheap for this use case)

### 3. Cloud File Storage — **IMPORTANT READ THIS**
This is the one Replit-specific part of the app that needs to change when you leave Replit.

**What it does:** When you upload a product photo, or when the AI generates a mockup image, the file gets saved to cloud storage so it can be displayed and kept permanently.

**On Replit:** The app uses Replit's built-in storage (Google Cloud Storage behind the scenes, authenticated automatically). This will NOT work outside Replit.

**Outside Replit (locally or Hostinger):** You need to replace this with one of these options:

| Option | Cost | Easiness |
|--------|------|----------|
| **Cloudflare R2** | Free up to 10GB/month | Medium — needs code swap |
| **AWS S3** | Very cheap (~$0.023/GB) | Medium — needs code swap |
| **Backblaze B2** | Free up to 10GB | Easy pricing, needs code swap |
| **Local disk storage** | Free (your server's disk) | Simplest for local dev |

**What "code swap" means:** One file in the app (`artifacts/api-server/src/lib/objectStorage.ts`) handles all file storage. It currently uses Replit's system. Before going outside Replit, this file needs to be rewritten to use whichever cloud storage you pick above. This is a one-time change. When you're ready to do this, tell the agent and it will make the swap for you.

---

## Environment Variables (Secrets the App Needs)

These are settings the app reads at startup. Think of them like a config file. You need to set all of these whether running locally or on Hostinger.

### Required — Must Set

| Variable Name | What it is | Example |
|---------------|-----------|---------|
| `DATABASE_URL` | Connection address for PostgreSQL database | `postgresql://user:password@localhost:5432/mockuptool` |
| `APP_PASSWORD` | The password you type to log into the app | `MySecretPassword123` |
| `SESSION_SECRET` | A long random string used to encrypt your login cookie. **Must be at least 32 characters. Never share this.** | `a-very-long-random-string-at-least-32-chars` |

### Required for File Storage — Must Set (after swapping storage system)

| Variable Name | What it is | Notes |
|---------------|-----------|-------|
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | The bucket/container name in your cloud storage | Changes depending on which storage you use |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Path(s) for public assets in the bucket | Set during setup |
| `PRIVATE_OBJECT_DIR` | Path for user-uploaded files in the bucket | Set during setup |

### Optional

| Variable Name | What it is | Default |
|---------------|-----------|---------|
| `NODE_ENV` | Set to `production` when live, leave out for local dev | `development` |
| `PORT` | Which port the API server listens on | `8080` |
| `LOG_LEVEL` | How verbose the server logs are (`info`, `debug`, `error`) | `info` |

### Note: API Keys Are Stored in the App, Not Here
Your OpenRouter key, fal.io key, and Anthropic key are **not** environment variables. You add them inside the app through the Settings screen, and they get saved to the database. This means you only have to enter them once and they persist.

---

## Software You Need Installed Locally

To run the app on your own computer:

1. **Node.js v20 or higher**
   - Download from https://nodejs.org (choose "LTS" version)
   - After installing, open Terminal/Command Prompt and type: `node --version`
   - You should see something like `v20.x.x`

2. **pnpm** (a package manager, like npm but faster)
   - After installing Node.js, run: `npm install -g pnpm`
   - Verify: `pnpm --version`

3. **PostgreSQL** (the database)
   - Download from https://www.postgresql.org/download/
   - During install, set a password for the `postgres` user — remember this
   - After installing, you'll create a database for the app (see steps below)

---

## Running Locally — Step by Step

### Step 1: Get the code
Download/export this project from Replit as a ZIP, or use Git if you have it set up.

### Step 2: Create the database
Open your PostgreSQL tool (pgAdmin comes with the installer, or use the terminal):
```
CREATE DATABASE mockuptool;
```
Your `DATABASE_URL` will look like:
`postgresql://postgres:YOUR_PASSWORD@localhost:5432/mockuptool`

### Step 3: Create a `.env` file
In the root folder of the project, create a file called `.env` and paste this in:
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/mockuptool
APP_PASSWORD=choose-your-login-password
SESSION_SECRET=paste-a-long-random-string-here-minimum-32-characters
NODE_ENV=development
```

> **Note:** The `.env` file is already in `.gitignore` so it won't be accidentally shared.

### Step 4: Swap the storage system
**Before this step works**, you need to replace the Replit-specific file storage with a local alternative. The simplest option for local development is saving files directly to your computer's disk instead of cloud storage. Tell the agent: *"Set up local disk storage for development"* and it will update the one file needed.

### Step 5: Install dependencies
In Terminal, from the project root folder:
```
pnpm install
```

### Step 6: Set up the database tables
```
pnpm --filter @workspace/db run push
```
This creates all the tables the app needs.

### Step 7: Start the app
```
pnpm --filter @workspace/api-server run dev &
pnpm --filter @workspace/mockup-tool run dev
```
Open your browser and go to: `http://localhost:5173` (or whichever port Vite shows)

---

## Deploying on Hostinger — Key Points

Hostinger offers VPS (Virtual Private Server) hosting which is the right type for this app. Shared hosting will NOT work — this app needs Node.js.

### What plan to get
- **VPS plan** on Hostinger (their KVM 2 plan or higher is recommended)
- Make sure it includes Ubuntu 22.04 or 24.04 as the operating system

### Steps overview (high level)
1. Buy a VPS plan on Hostinger
2. Connect to your server via SSH (Hostinger provides instructions)
3. Install Node.js, pnpm, and PostgreSQL on the server
4. Upload your code to the server (via Git or SFTP)
5. Set up your environment variables (create a `.env` file or use a process manager like PM2)
6. Set up cloud storage (Cloudflare R2 is recommended — free tier is generous)
7. Set up a reverse proxy (Nginx) so your domain points to the app
8. Run the app with PM2 so it stays running even after you close your SSH connection

### Hostinger-specific help
When you're ready to deploy to Hostinger, tell the agent what plan/OS you have and ask for the full step-by-step. There are a few specific things to configure (Nginx config, PM2 setup, SSL certificate) and the agent can write all of those files for you.

---

## Summary of What Needs to Change When Leaving Replit

| Thing | Status | What to do |
|-------|--------|-----------|
| File/image storage | **Needs replacing** | Replace `objectStorage.ts` with Cloudflare R2, AWS S3, or local disk |
| Database | **Needs replacing** | Set up your own PostgreSQL and update `DATABASE_URL` |
| Environment variables | **Needs setting** | Create `.env` file with the variables listed above |
| OpenRouter API key | **Already portable** | Just enter it in app Settings — no change needed |
| fal.io API key | **Already portable** | Just enter it in app Settings — no change needed |
| Anthropic API key (if used) | **Already portable** | Just enter it in app Settings — no change needed |
| App password | **Already portable** | Set `APP_PASSWORD` env var |
| Session secret | **Needs generating** | Create any random 32+ character string |

---

## Quick Reference: Files That Matter

| File | What it does |
|------|-------------|
| `artifacts/api-server/src/lib/objectStorage.ts` | **The file to swap** when moving away from Replit storage |
| `artifacts/api-server/src/lib/session.ts` | Session/login config (reads `SESSION_SECRET`) |
| `artifacts/api-server/src/routes/auth.ts` | Login logic (reads `APP_PASSWORD`) |
| `lib/db/src/index.ts` | Database connection (reads `DATABASE_URL`) |
| `lib/db/src/schema/` | All database table definitions |

---

*Last updated: April 2026*
*This guide will be updated as the app evolves.*
