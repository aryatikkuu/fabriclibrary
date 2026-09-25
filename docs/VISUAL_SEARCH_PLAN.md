# Visual Search — Implementation Plan

Status: **planned, not built.** This document is the design of record. Nothing
in the app depends on it yet.

## What we are building

Two features from one engine:

1. **Query by photo** — a buyer uploads a swatch photo, gets the closest
   qualities in the archive.
2. **Visual "more like this"** — the similar-fabrics strip on a detail page
   stops being purely rule-based (GSM/composition/colour) and starts comparing
   the cloth itself.

Both reduce to: *one embedding per fabric image, then nearest-neighbour search.*

## Why this fits the existing architecture

The seams already exist — this fills them in rather than adding a new subsystem.

| Existing seam | Where | What it already allows |
|---|---|---|
| `similarity_method` accepts `'visual'` | `database/migrations/0001` CHECK constraint | Visual rows can live beside rule-based rows in the same table |
| `SimilarityService` V3 comment | `services/similarity.service.ts` | Blend a visual score in without touching pages or components |
| Crop + orientation correction | `imageBytes()` (rotate + crop via sharp) in `scripts/bulk-insert.mjs` | Per-record crop already supported and persisted |
| Structured filters | `components/search/FabricFilters.tsx`, `lib/config/search.config.ts` | Visual results can be filtered by mill / GSM / colour with no new UI |

## The hard part: hanger cards are not swatches

**This is the risk that decides whether the feature works.**

The archive is photographs of hanger *cards*: a large printed label, a wooden
desk background, often several colourway swatches on one card. Embed the whole
frame and the vector mostly encodes *"a hanger card on wood"* — every fabric
scores similar to every other, and the feature looks broken while being
technically correct.

**Approach: auto-crop to the fabric region, then human spot-check before backfill.**

1. For each image, detect the fabric region:
   - discard the label — a high-contrast, near-white, high-text-density rectangle;
   - discard the wooden/desk border — the low-saturation frame outside the card;
   - keep the largest region of consistent texture/colour.
2. Write the chosen crop box back to the record so embeddings are reproducible
   and re-runnable (same field the import path already understands).
3. **Gate on review:** render a contact sheet of ~100 sampled crops and eyeball
   them before embedding all ~4,700. If the crop is wrong the embeddings are
   worthless, and this is far cheaper to catch at 100 than at 4,700.
4. Cards with several colourways: crop each swatch separately where they are
   cleanly separable, otherwise fall back to the largest single swatch and flag
   the record. Do **not** silently average several colours into one vector.

Acceptance for this step is visual, not numeric: on the sample sheet, the crop
contains cloth and no label in a clear majority of cases.

## Model

OpenAI's embedding endpoints are text-only, so the existing `OPENAI_API_KEY`
does not help here.

| Option | Cost | Trade-off |
|---|---|---|
| **Local CLIP** via `@xenova/transformers` (ONNX, pure Node — no Python) | none | ~4,700 images ≈ 15–30 min one-off on an M-series Mac. Matches the existing `scripts/` pattern |
| Hosted (Replicate / Together) | per-image, recurring | Less setup, but ships the entire archive to a third party |

**Decision: local for the backfill.** These are commercially sensitive mill
fabrics; local embedding means no bulk egress of the archive to another vendor.
Same reasoning that keeps extraction on a script rather than a SaaS pipeline.

Pin an exact public checkpoint (e.g. `openai/clip-vit-base-patch32` at a fixed
revision). Using a *published* checkpoint rather than a bespoke build is what
makes the query path below possible — the same weights are available both
locally and from hosted inference providers.

### Free bonus: text→image search

CLIP puts images and text in one shared space, so the same vectors answer typed
queries — "indigo paisley", "chunky slub linen" — with no extra infrastructure.
Worth wiring into `/search` alongside photo upload; it is close to free once the
image vectors exist.

### The query path is a different problem — do not reuse local CLIP there

The app deploys to **Vercel serverless**, where running CLIP in the request
handler is a poor fit and a likely source of intermittent failures:

- CLIP is ~40 MB quantised / ~150 MB full, against a serverless bundle ceiling
  around 250 MB unzipped;
- `@xenova/transformers` fetches weights **at runtime on cold start**, which
  against a short function timeout produces sporadic cold-start timeouts — a
  failure that reads as a random crash and is painful to diagnose;
- each warm instance holds the model in memory inside a ~1 GB function.

| Query-path option | Egress | Trade-off |
|---|---|---|
| **Hosted inference on the same public checkpoint** | only the user's own query image | **Recommended.** Simplest and most reliable; fast on mobile; archive still never leaves |
| Client-side (transformers.js in the browser) | none | Server sees only the vector; but ~40 MB model download on first use — harsh on the mobile users we just optimised for |
| Dedicated always-on service (Fly/Railway) | none | No cold starts, full control; one more piece of infrastructure |

> **Backfill and query must use the identical checkpoint.** Embedding the
> archive with one CLIP build and queries with another yields vectors that are
> not comparable — results look plausible but are meaningless, and nothing
> errors to tell you. Pin model name *and* revision, store it in
> `fabric_embeddings.model`, and assert on it at query time.

## Colour matching needs its own signal

CLIP is strong on **pattern, motif and weave structure** but weaker on the exact
colour axis — it will happily rate a red floral jacquard close to a blue one,
because it encodes *"floral jacquard"*. For a fabric buyer, colour is often the
primary question, so CLIP alone will feel wrong in a way that is hard to
articulate.

Store a second, cheap signal beside the embedding:

- a **dominant-palette / colour histogram** vector computed from the same crop
  (a few dozen floats in LAB space, so distance approximates perceived colour
  difference rather than RGB arithmetic);
- score at query time as a weighted blend of CLIP distance and colour distance.

This costs almost nothing to compute during the same backfill pass, and it makes
the feature controllable: expose a simple **"match pattern ↔ match colour"**
control in the UI, which is exactly the axis a sourcing decision moves along.
Keep the default blend in `lib/config/similarity.config.ts` beside the existing
V1 weights, so it is tunable without code changes — the same convention the rest
of the app follows.

Record the model name with every vector so a future upgrade can re-embed
without guessing what produced what.

## Prerequisites (do these first — both bite on this machine)

1. **Enable pgvector.** `create extension if not exists vector;` must be run in
   the Supabase SQL editor before migration `0006` will apply, same as the other
   migrations in `docs/SUPABASE_SETUP.md`.

2. **`~/.npmrc` on this Mac contains `os=linux`.** npm will therefore skip the
   macOS native binary for `onnxruntime-node` (the engine behind
   `@xenova/transformers`) and the model will fail to load at runtime with a
   missing-binding error that looks nothing like the real cause. Install with:

   ```bash
   npm install @xenova/transformers --os=darwin --cpu=arm64
   ```

## Schema — migration `0006_visual_search.sql`

```sql
create extension if not exists vector;

create table if not exists public.fabric_embeddings (
  id         uuid primary key default gen_random_uuid(),
  fabric_id  uuid not null references public.fabrics (id) on delete cascade,
  image_id   uuid not null references public.fabric_images (id) on delete cascade,
  embedding  vector(512) not null,   -- CLIP: pattern, motif, weave
  palette    vector(48),                -- LAB colour histogram: colour matching
  model      text not null,
  crop_box   jsonb,                     -- the region actually embedded
  created_at timestamptz not null default now(),
  unique (image_id, model)
);

create index on public.fabric_embeddings
  using hnsw (embedding vector_cosine_ops);
```

A separate table, not a column on `fabrics`:

- a fabric can have several images, each with its own vector;
- re-embedding with a better model does not destroy the previous set
  (`unique (image_id, model)` lets both coexist during a migration);
- `fabrics` stays a clean record of the cloth, not of our ML bookkeeping.

## Query path

A Postgres function does the search so the vector never round-trips:

```sql
create or replace function public.match_fabric_images(
  query_embedding vector(512),
  match_count     int    default 24,
  include_unreviewed boolean default false
)
returns table (fabric_id uuid, score float)
language sql stable as $$
  select f.id, 1 - (e.embedding <=> query_embedding) as score
  from public.fabric_embeddings e
  join public.fabrics f on f.id = e.fabric_id
  where include_unreviewed or f.review_status = 'approved'
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
```

> **The `review_status` filter is a security control, not a nicety.** Every
> existing page filters unreviewed records in the app layer. A vector search
> that skips this happily returns all ~2,400 unreviewed rows to an anonymous
> visitor, straight past the review gate. `include_unreviewed` must only ever be
> set from a server-side staff check — never from a request parameter.

## API and UI

- `POST /api/search/image` — multipart upload, returns ranked fabrics.
  - `requireRateLimit(request)` at the top of the handler (see `docs/SECURITY.md`).
  - Validate MIME type and size before decoding anything.
  - Embed **in memory**. The query image is never written to the public bucket
    and never gets a public URL. If it must be persisted for debugging, use a
    private path with a TTL.
  - Resolve `include_unreviewed` from the caller's role server-side.
- UI: a dropzone on `/search`, reusing the pattern in
  `components/fabrics/ImageUploader.tsx`.
- **Combine with the existing filters** — "looks like this *and* is 150–200 GSM
  *and* is Banswara" is the actual sourcing question, and the filter UI already
  exists. Apply structured filters to the candidate set returned by the vector
  search.

## Backfill script

`scripts/embed-fabrics.mjs`, shaped like `scripts/batch-extract.mjs`:

- resumable through a progress file (`.embedding-progress.json`);
- **only marks an image processed once its vector is stored** — the failure mode
  that bit us in extraction was marking work done before confirming it landed;
- concurrency flag, chunked writes, per-chunk progress persistence;
- re-runnable: `unique (image_id, model)` makes it idempotent.

## Rollout

| Phase | Deliverable | Done when |
|---|---|---|
| 1 | Migration + crop detection + sample contact sheet | Crops look right on a 100-image sample |
| 2 | Backfill script, all images embedded | `fabric_embeddings` count matches image count |
| 3 | RPC + `/api/search/image` | Known fabric photo returns itself as the top hit |
| 4 | `/search` dropzone | Filters compose with visual results |
| 5 | Wire `similarity_method='visual'` into `SimilarityService` | Detail pages show visual neighbours |

Phases 1–2 are offline and carry no risk to the live site: the migration is
purely additive (new extension, new table), no existing query is touched, and
the stored vectors total roughly 10 MB. The backfill reads the **local
originals** rather than re-downloading ~1 GB from Storage.

Risk is concentrated entirely in phase 3, and it is contained: the endpoint
shares no code path with the existing pages, so if it fails, fabrics, search and
review are unaffected.

## Security checklist

- [ ] `match_fabric_images` filters `review_status` for non-staff callers
- [ ] `include_unreviewed` derived server-side from role, never from input
- [ ] `fabric_embeddings` is RLS-locked; reachable only through the function
- [ ] `/api/search/image` is rate-limited (unauthenticated embedding is a
      free-compute DoS target)
- [ ] Upload MIME/size validated before decode
- [ ] Query images never written to the public bucket
- [ ] Model runs locally — no bulk archive egress

## Expected cost and performance

- Backfill: one-off, ~15–30 min locally, no API spend (4,671 images as of writing).
- Query: embedding ~30–80 ms locally + HNSW lookup a few ms at this corpus size.
- Ongoing: zero marginal cost per search.

## Side benefit

The same vectors make near-duplicate detection cheap — and the archive contains
many duplicate hanger shots of the same `fabric_code`. A "possible duplicates"
report falls out of this work almost for free.

## Open questions

- Multi-colourway cards: one vector per swatch, or one per card? Leaning
  per-swatch, but it depends on how separable they are in practice — decide
  from the phase 1 sample.
- Should visual similarity *replace* the rule-based score on detail pages, or
  blend with it? Blending keeps GSM/composition sanity; replacing is more
  visually honest. Decide after phase 3, with real results to look at.
