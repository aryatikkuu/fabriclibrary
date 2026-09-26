# Digital Textile Library

A premium digital archive for mill fabrics. Hanger/fabric photos are read (fabric code, composition, GSM, width, colour, suggested use) by `npm run extract`, which sends each photo to OpenAI Vision with the app's own extraction prompt, then loads the results through `scripts/bulk-insert.mjs` — uploading the image to Supabase Storage and saving the record to Supabase Postgres. (An n8n workflow is retained in `n8n/workflows/` as an alternative path.) Every extraction lands in the Review Queue. Nothing publishes without a human confirming it, regardless of confidence score.

```
photo folder ──► npm run extract (OpenAI Vision, resumable) ──► JSON batch
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
| Automation | Node scripts in `scripts/` (see below). n8n workflow retained in `n8n/workflows/` as an alternative path. |
| AI | OpenAI Vision (`gpt-5.4-nano`, cheapest) for label extraction; `gpt-5.4-mini` + text embeddings for photo search |
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

# 4. Seed mills (fabrics are imported separately — see Maintenance scripts)
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
n8n/workflows/        Ingestion workflow (alternative to the script pipeline)
docs/                 Full documentation set (see below)
tests/unit/           Vitest suites for the pure logic
scripts/              Maintenance scripts (below); shared helpers in scripts/lib/common.mjs
```

## Maintenance scripts

Run from the repo root through npm — the npm scripts pass Node's `--experimental-strip-types` so
the scripts can import the app's own TypeScript config (prompts, storage paths, mill list) instead
of keeping copies. Needs Node 22.6+.

| Command | What it does |
|---|---|
| `npm run extract -- <mill-slug> "<photo folder>" [concurrency]` | Read hanger photos with OpenAI Vision and import them (resumable via `.extraction-progress-<mill>.json`) |
| `npm run bulk-insert -- <batch.json>` | Import an already-extracted JSON batch (used by `extract`) |
| `npm run verify-tag -- [--budget 1]` | Re-read every label blind and tag what each fabric looks like (paid; resumable; report in `reports/`) |
| `npm run verify-tag -- --save [--fix-codes] [--apply]` | Store the tags, descriptions and label checks; `--fix-codes` fixes near-miss codes and sends big disagreements to review |
| `npm run retag -- [--budget 1]` then `-- --save [--groups detail] --apply` | Re-tag the look of checks, stripes, textured fabrics and swatch cards after the tag list grows (≈0.13¢ per fabric; saves only the named groups) |
| `npm run embed [-- --all]` | Embed new/changed fabric descriptions for photo search (run after `verify-tag -- --save` and after a restore; whole library ≈ 0.2¢) |
| `npm run dedupe [-- --apply]` | Merge duplicate fabric records (dry run unless `--apply`; writes the plan to `backups/`) |
| `npm run backup [-- --with-files]` | Snapshot every table (+ pipeline state files) to `backups/<date>/`. Copy it off this machine. |
| `npm run restore -- backups/<date> [--confirm]` | Load a snapshot back (dry run unless `--confirm`) |
| `npm run db:seed` | Create the mills (idempotent) |

`backups/` is git-ignored — it contains user profiles and audit logs.

## Adding new fabric photos (standard procedure)

Every new batch goes through the same steps, in this order, so each fabric ends up with the same data:
label details, cover photo, photo-search tags, a searchable description and its embedding.
Skipping step 3 or 4 leaves fabrics that browse fine but **never appear in photo search**.

**Photos:** one hanger per photo, label readable and in focus, JPEG/PNG/WebP. Put each mill's photos in
their own folder. The mill must already exist (`lib/config/mills.config.ts`, then `npm run db:seed`).

| # | Command | API calls | Writes | Cost (approx.) |
|---|---|---|---|---|
| 1 | `npm run backup` | — | `backups/<date>/` | free |
| 2 | `npm run extract -- <mill-slug> "<photo folder>" 8` | OpenAI `gpt-5.4-nano` vision, 1 per photo — reads the label | fabric rows (`needs_review`), cover photo in Storage, end-use tags | < 0.1¢ / photo |
| 3 | `npm run verify-tag -- --budget 5` | OpenAI `gpt-5.4-mini` vision, 1 per **new** fabric — re-reads the label blind, tags the look, writes a one-line description | `reports/verify-gpt-5.4-mini.json` only | ≈ 0.26¢ / fabric |
| 4 | `npm run verify-tag -- --save` (check the dry run) then `npm run verify-tag -- --save --apply` | none | visual tags, `ai_description`, label checks — **new rows only** | free |
| 5 | `npm run embed` | OpenAI `text-embedding-3-small`, batched — new/changed descriptions only | `fabric_embeddings` | < 0.01¢ / fabric |
| 6 | Review queue (`/review`, staff) | none | approve / fix / reject; only approved fabrics are public | free |
| 7 | `npm run backup` | — | — | free |

- Steps 2, 3 and 5 are resumable and skip work already done — re-running after an interruption is safe.
- Step 3 stops at `--budget` USD. Add `--fix-codes` to step 4 to let it correct near-miss codes and send big disagreements to review.
- `--save` writes only rows it hasn't saved before. `--save --all` re-applies the whole report over later fixes
  (e.g. the `detail` tags and plain-fabric corrections) — only use it deliberately.

**Automated imports (n8n).** The workflow in `n8n/workflows/` does step 2 per photo through the API:

```
POST /api/ingest
x-webhook-secret: <N8N_WEBHOOK_SECRET>
Content-Type: application/json

{ "filename": "IMG_1234.jpg", "image_base64": "<base64 JPEG/PNG/WebP, ≤ 15 MB>", "mill_slug": "orbit-exports" }
```

`mill_slug` is optional (otherwise the mill is read from the label). The response is the new fabric's
id, code, mill, review status and photo URL; confident reads are approved straight away, the rest go to
review. Fabrics added this way still need **steps 3–5** to appear in photo search.

**One photo from the app.** Staff can `POST /api/upload` (multipart: `file`, `mill_slug`, `fabric_code`) to
add a photo to Storage; attach it to a fabric and run steps 3–5 for it to be searchable.


**Photo search** (Search tab, open to everyone): a photo and/or a note ("for summer shirts") is turned into the same tags by one AI call (`app/api/search/look`, ~0.14¢), and the database ranks the library against them plus the description embedding (`match_fabrics_by_look`, migrations 0006/0008). Daily limits per visitor, per signed-in user and for all non-admins together are enforced in the database (`look_searches`, migration 0009); admins are unlimited. Tag lists, ranking weights and limits live in `lib/config/visual-tags.config.ts`.

## Documentation

| Doc | What it covers |
|---|---|
| [SECURITY](docs/SECURITY.md) | Access rules, photo-search limits, uploads, audit logging, headers, setup checklist |
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
| [VISUAL_SEARCH_PLAN](docs/VISUAL_SEARCH_PLAN.md) | Original design notes for photo search (now built: tags + description embeddings — see below) |

## Roles

| Permission | Admin | Editor | Viewer / Public |
|---|---|---|---|
| Browse approved fabrics | ✅ | ✅ | ✅ |
| Photo search | ✅ unlimited | ✅ 30/day | ✅ 30/day signed in, 10/day visitor |
| Create / edit fabrics | ✅ | ✅ | — |
| Review queue (approve / reject / re-run AI) | ✅ | ✅ | — |
| Delete fabrics | ✅ | — | — |
| Manage mills & users | ✅ | — | — |
| Request swatches / price | ✅ | ✅ | ✅ (10/day) |
| Analytics (views, requests, leads) | ✅ | — | — |

## Security

- **Access rules live in the database (RLS)**, migrations 0002 and 0010: visitors and viewers see approved fabrics only — and only those fabrics' images, tags and similarity links; staff write; only admins delete or change roles (a trigger blocks anyone else changing `profiles.role`). Every API route re-checks its permission (`requirePermission`) or the n8n secret (`verifyWebhookSecret`, constant-time).
- **Photo search limits** are enforced in one locked database step before any AI call (`claim_look_search`, migrations 0009/0010): 5 a minute and a daily limit per visitor/user, one daily ceiling for everyone but admins, 30-day retention. Visitors are identified by the platform's IP only (spoofable headers are ignored), stored hashed.
- **Uploads** (`lib/images.ts`): only JPEG, PNG and WebP, recognised from the file's bytes rather than its claimed type, with a size cap; storage paths are built from sanitised segments only (`lib/config/storage.config.ts`).
- **AI output is untrusted**: tags must come from the fixed vocabulary, the description is cleaned to one plain line, and the customer's note is passed as quoted data, never instructions. Results pages read a search's description and embedding from the database by id, so a crafted URL can't trigger an AI call or show made-up text.
- **Security headers** on every response (`next.config.mjs`): a Content-Security-Policy allowing only this site and Supabase, no framing, `nosniff`, HSTS, strict referrer and permissions policies.
- **Leads and page views** (migration 0011) are written only by server code and readable only by admins. "Request swatches / price" saves the request (`/api/leads`: validated, 10/day per visitor, bot honeypot) and opens the buyer's email app with a pre-filled draft to `appConfig.leads.email`. Views count once per fabric, per visitor, per day; staff and bots aren't counted. See `/analytics`.
- **Secrets** (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `N8N_WEBHOOK_SECRET`) are server-only; nothing secret uses the `NEXT_PUBLIC_` prefix.
- Tests: `tests/unit/security.test.ts`. Accounts are created by an admin — keep "Allow new users to sign up" off in Supabase.

## Key conventions

- **Config over code.** Mills, similarity weights, search filter options, role permissions, storage paths and the confidence threshold all live in `lib/config/` — see `docs/DEVELOPER_GUIDE.md`.
- **AI is untrusted input.** Everything the model returns passes through `features/ai-extraction/extraction.schema.ts` before persistence.
- **Storage layout:** `mills/{mill-slug}/fabrics/{FABRIC_CODE}/images/{filename}` (and `/documents/`).
- **Similarity V1 is rule-based** and pure (`features/similarity/similarity-engine.ts`); V2 embeddings and V3 visual similarity plug into `SimilarityService` without touching the rest of the app.
