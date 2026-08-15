# Digital Textile Library

A premium digital archive for mill fabrics. Hanger/fabric photos are read (fabric code, composition, GSM, width, colour, suggested use) — currently via a local Claude agent run reading a batch of photos into structured JSON, with an n8n + OpenAI Vision workflow retained in `n8n/workflows/` as an alternative path — then loaded through `scripts/bulk-insert.mjs`, which uploads the image to Supabase Storage and saves the record to Supabase Postgres. Every extraction lands in the Review Queue. Nothing publishes without a human confirming it, regardless of confidence score.

```
photo folder ──► local Claude agent run (or OpenAI Vision) ──► JSON batch
           ──► scripts/bulk-insert.mjs ──► needs_review ──► human review ──► public catalog
                                                   │
                              Supabase Storage ◄───┤ image upload
                              Supabase Postgres ◄──┤ validated record + extraction log
                              Similarity engine ◄──┘ top-6 similar fabrics
```

## Stack

| Layer | Technology |
|---|---|
| Web app | Next.js 14 (App Router) · TypeScript · Tailwind CSS |
| Database / Auth / Storage | Supabase (Postgres, RLS, email auth, Storage) |
| Automation | Local agent run. n8n workflow retained in `n8n/workflows/` as an alternative path, not the current default. |
| AI | OpenAI Vision (`gpt-5.4-nano`, cheapest) for label extraction + search assistant |
| Validation | Zod — AI output never touches the database unvalidated |
| Tests | Vitest |
| Hosting | Vercel (app) + Supabase cloud |

## Quick start

```bash
# 1. Install
npm install

# 2. Configure — copy and fill in your keys
cp .env.example .env.local

# 3. Set up Supabase (run the 3 migrations + storage bucket)
#    See docs/SUPABASE_SETUP.md — paste database/migrations/*.sql into the SQL editor

# 4. Seed mills (fabrics are imported separately — see scripts/bulk-insert.mjs)
npm run db:seed

# 5. Run
npm run dev        # http://localhost:3000

# Quality gates
npm run typecheck
npm test
```

## Project layout

```
app/                  Pages (server components) + API routes
components/           UI — fabrics, mills, search, review, layout, primitives
features/             Vertical slices: ai-extraction (prompts + service), similarity, fabric schemas
services/             Business logic (fabric, mill, storage, similarity, review, audit)
repositories/         All Supabase queries — nothing else talks to the DB
lib/                  Config (all tunables), Supabase clients, DI container, errors, OpenAI client
database/             SQL migrations + seed
n8n/workflows/        Ingestion workflow (alternative to the local agent pipeline)
docs/                 Full documentation set (see below)
tests/unit/           Vitest suites for the pure logic
scripts/bulk-insert.mjs  Batch import — the current default pipeline
scripts/seed.mjs      Idempotent mill-seeding script
```

## Documentation

| Doc | What it covers |
|---|---|
| [SECURITY](docs/SECURITY.md) | Private storage, rate limiting, audit logging, setup checklist |
| [SYSTEM_ARCHITECTURE](docs/SYSTEM_ARCHITECTURE.md) | Layers, data flow, design decisions |
| [DATABASE_SCHEMA](docs/DATABASE_SCHEMA.md) | Every table, column and relationship |
| [SUPABASE_SETUP](docs/SUPABASE_SETUP.md) | Project, migrations, storage, first admin user |
| [N8N_SETUP](docs/N8N_SETUP.md) | Importing the workflow, env vars, swapping folder sources |
| [OPENAI_SETUP](docs/OPENAI_SETUP.md) | API key, model, cost notes, prompt locations |
| [DEPLOYMENT_GUIDE](docs/DEPLOYMENT_GUIDE.md) | Vercel deploy, env vars, production checklist |
| [DEVELOPER_GUIDE](docs/DEVELOPER_GUIDE.md) | Architecture rules, how to extend safely, testing |
| [ADDING_NEW_MILL](docs/ADDING_NEW_MILL.md) | Add a mill in minutes — no code changes |
| [ADDING_NEW_FIELDS](docs/ADDING_NEW_FIELDS.md) | Add a fabric attribute end-to-end |
| [BRANDING_GUIDE](docs/BRANDING_GUIDE.md) | Palette, type, voice — how to re-skin |

## Roles

| Permission | Admin | Editor | Viewer / Public |
|---|---|---|---|
| Browse approved fabrics | ✅ | ✅ | ✅ |
| Create / edit fabrics | ✅ | ✅ | — |
| Review queue (approve / reject / re-run AI) | ✅ | ✅ | — |
| Delete fabrics | ✅ | — | — |
| Manage mills & users | ✅ | — | — |

## Key conventions

- **Config over code.** Mills, similarity weights, search filter options, role permissions, storage paths and the confidence threshold all live in `lib/config/` — see `docs/DEVELOPER_GUIDE.md`.
- **AI is untrusted input.** Everything the model returns passes through `features/ai-extraction/extraction.schema.ts` before persistence.
- **Storage layout:** `mills/{mill-slug}/fabrics/{FABRIC_CODE}/images/{filename}` (and `/documents/`).
- **Similarity V1 is rule-based** and pure (`features/similarity/similarity-engine.ts`); V2 embeddings and V3 visual similarity plug into `SimilarityService` without touching the rest of the app.
