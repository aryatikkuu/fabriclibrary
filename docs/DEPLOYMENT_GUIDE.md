# Deployment Guide

Target stack: **Vercel** (app) + **Supabase cloud** (DB/auth/storage) + **n8n** (cloud or self-hosted).

## 0. Prerequisites

- Supabase project set up per `docs/SUPABASE_SETUP.md` (migrations run, seeded, admin user created).
- The repo pushed to GitHub/GitLab/Bitbucket.

## 1. Deploy to Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo. Framework is auto-detected (Next.js); defaults are fine.
2. **Environment Variables** — add all of these (Production + Preview):

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase API settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public — safe in the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** — server only |
| `OPENAI_API_KEY` | **secret** |
| `N8N_WEBHOOK_SECRET` | **secret** — same value as in n8n |
| `NEXT_PUBLIC_APP_NAME` | branding (optional) |
| `AI_CONFIDENCE_THRESHOLD` | optional, default 75 |
| `STORAGE_BUCKET_NAME` | optional, default `textile-library` |

3. **Deploy.** Pages are dynamic (server-rendered per request) so no extra config is needed.

## 2. Point n8n at production

Update `TEXTILE_LIBRARY_URL` in n8n to the Vercel URL and activate the workflow. Drop a test hanger photo in the watched folder; within ~1 minute the fabric should appear on the site or in `/review`.

## 3. Production checklist

- [ ] Drop a test image → record appears (check `ai_extraction_logs` for the run).
- [ ] `/review` reachable for admin/editor, redirects for anonymous.
- [ ] Anonymous browsing shows **approved** fabrics only.
- [ ] Images render (Supabase Storage public URL; `next.config.mjs` already allows `*.supabase.co`).
- [ ] `N8N_WEBHOOK_SECRET` is long and random; a request without it returns 401.
- [ ] Supabase **Auth → URL Configuration**: site URL set to the Vercel domain.
- [ ] Custom domain added in Vercel (optional).

## 4. Updates & rollbacks

- Push to the production branch → Vercel builds and deploys; previews per PR.
- Instant rollback: Vercel → Deployments → Promote a previous build.
- New SQL migrations: add a numbered file in `database/migrations/` and run it in Supabase **before** deploying code that depends on it (additive columns make this safe — see `docs/ADDING_NEW_FIELDS.md`).

## 5. Self-hosting notes (alternative)

`npm run build && npm run start` runs anywhere Node 18+ does (Docker, a VPS, Railway, Fly.io). Keep the same env vars. n8n self-hosted on the same host can reach the app via its internal URL; if n8n runs in Docker beside a local app, use `http://host.docker.internal:3000`.

## 6. Operations

- **Logs:** Vercel → Functions for API routes; Supabase → Logs for DB/storage/auth; n8n → Executions for ingestion runs.
- **Backups:** Supabase daily backups on paid tiers; `pg_dump` works too. Storage files are replaceable from the original photo folder.
- **AI audit:** `ai_extraction_logs` keeps every raw model response — your forensic trail when a field looks wrong.
