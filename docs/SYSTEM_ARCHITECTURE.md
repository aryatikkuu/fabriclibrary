# System Architecture

## Overview

The platform turns a folder of fabric photos into a published, searchable textile archive with no manual data entry. It has four cooperating systems:

1. **n8n** — watches a folder, encodes each new image, calls the app.
2. **Next.js app (Vercel)** — public website, staff tools, and the API that runs the ingestion pipeline.
3. **Supabase** — Postgres (with Row Level Security), email auth, and object Storage.
4. **OpenAI Vision** — reads the hanger label/QR and returns structured JSON.

## End-to-end data flow

```
 Staff phone/camera
        │  photo of hanger
        ▼
 Watched folder (Drive/Dropbox/local)
        │  n8n trigger
        ▼
 n8n: download → filter images → base64
        │  POST /api/ingest  (x-webhook-secret)
        ▼
 ┌──────────────────────────────────────────────────────┐
 │ /api/ingest (admin Supabase client — trusted server) │
 │ 1. AIExtractionService → OpenAI Vision → raw JSON    │
 │ 2. Zod validation (extraction.schema.ts)             │
 │ 3. MillService.resolveByName → mill row              │
 │ 4. StorageService.upload → Supabase Storage          │
 │ 5. FabricRepository upsert (mill_id, fabric_code)    │
 │ 6. ExtractionLogRepository.insert (audit of AI run)  │
 │ 7. SimilarityService.recalculateForFabric            │
 └──────────────────────────────────────────────────────┘
        │ review_status: approved | needs_review
        ▼
 Website (instant)            Review Queue (staff)
```

Confidence below `AI_CONFIDENCE_THRESHOLD` (default 75) → `needs_review`; the record exists but is hidden from the public until a human approves it.

## Application layers

```
app/ (pages + API routes)        ── HTTP edge: parse input, check permission, call a service
        │
services/                        ── business rules; orchestrate repositories; write audit logs
        │
repositories/                    ── the ONLY place Supabase queries live
        │
Supabase (Postgres + Storage)    ── RLS as the final defence
```

Cross-cutting modules:

- `lib/container.ts` — composition root. `buildServices(db)` wires repositories → services for a given Supabase client. Pages/API routes pass the **user-scoped server client** (RLS applies); automation endpoints (`/api/ingest`, `/api/ai-extraction/extract` via webhook) pass the **admin client**.
- `lib/config/*` — every tunable: app branding + threshold, mills registry, similarity weights, search filter options, role permission matrix, storage path builder.
- `lib/errors.ts` + `lib/api-helpers.ts` — typed errors mapped to a uniform JSON error envelope; `requirePermission()` guards; `verifyWebhookSecret()` for n8n.
- `features/` — vertical slices that own their domain: `ai-extraction` (prompts, schema, service), `similarity` (pure scoring engine), `fabrics` (zod input schemas).

## Security model

| Caller | Client used | Protection |
|---|---|---|
| Public visitor | anon (RLS) | sees `review_status = 'approved'` only |
| Signed-in staff | user-scoped (RLS) | role checked via `profiles.role` + `requirePermission` |
| n8n | service-role (bypasses RLS) | `x-webhook-secret` header must match `N8N_WEBHOOK_SECRET` |

Defence in depth: even if an API permission check were bypassed, RLS policies in `database/migrations/0002_row_level_security.sql` enforce the same matrix at the database.

## AI boundary

AI output is treated as untrusted input. The raw model response is logged verbatim to `ai_extraction_logs`, then parsed by `extractionResultSchema` (defaults for missing fields, GSM coercion/sanity bounds, confidence 0–100). Only the validated object reaches a repository. Prompts are code-reviewed artifacts in `features/ai-extraction/prompts/` — never inline strings.

## Similarity engine versions

- **V1 (shipped):** `computeSimilarity(a, b)` — deterministic weighted rules (type 30, GSM 25 with linear falloff, composition Jaccard 20, colour family 10, finish 10, same-mill 5). Results persisted to `fabric_similarities` with human-readable reasons.
- **V2 (planned):** text embeddings of the spec; blend score into the same table with `similarity_method = 'embedding'`.
- **V3 (planned):** visual embedding of the fabric photo; `similarity_method = 'visual'`.

Because scores live in one table keyed by method, the UI and API never change between versions.

## Why these decisions

- **Repository pattern + DI** — swapping Supabase, mocking in tests, and choosing RLS vs admin per request all happen at one seam.
- **snake_case types matching DB rows** — no mapping layer to drift out of sync.
- **One `/api/ingest` call for n8n** — the workflow stays trivial; all sequencing/transaction-like behaviour is server-side where it can be tested.
- **Server components for pages** — data fetched with the user's own RLS context; minimal client JS for an image-led site.
