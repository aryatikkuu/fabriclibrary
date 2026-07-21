# Adding a New Fabric Field

Worked example: adding **`stretch_percent`** (numeric). Substitute your field throughout. Order matters — database first, deploy last.

## 1. Database (additive migration)

New file `database/migrations/0004_add_stretch_percent.sql`:

```sql
alter table public.fabrics
  add column if not exists stretch_percent numeric
  check (stretch_percent is null or (stretch_percent >= 0 and stretch_percent <= 100));
```

Run it in Supabase **before** deploying code. Nullable column → zero downtime, old code unaffected.

> Want it full-text searchable? The `search_vector` is a generated column — recreate it including the new field in the same migration.

## 2. Type — `types/fabric.ts`

```ts
stretch_percent: number | null;
```

## 3. Validation — `features/fabrics/types/fabric.schema.ts`

Add to `fabricCreateSchema` (update schema inherits via `.partial()`):

```ts
stretch_percent: z.coerce.number().min(0).max(100).nullable().optional(),
```

## 4. AI extraction (only if the model should read it from labels)

1. `prompts/fabric-extraction.prompt.ts` — add `"stretch_percent": null` to the JSON template and a line telling the model where it appears on labels.
2. `extraction.schema.ts` — add a field with a safe default (copy the defensive `gsm` pattern for numerics).
3. If it's must-have data, add it to `CORE_EXTRACTION_FIELDS` so a missing value lowers effective completeness and shows in `missing_fields`.
4. Map it in the two places extraction results are written to fabrics: `app/api/ingest/route.ts` and `ReviewService.rerunExtraction`.

## 5. UI

- **Spec strip** — one row in `components/fabrics/FabricTechnicalData.tsx`:
  ```ts
  ['Stretch', fabric.stretch_percent != null ? `${fabric.stretch_percent}%` : '—'],
  ```
- **Review queue** — add `['stretch_percent', 'Stretch %']` to `EDITABLE_FIELDS` in `ReviewQueueTable.tsx` so staff can correct it.
- **Card** — optionally append to the metadata line in `FabricCard.tsx`.

## 6. Search/filter (optional)

Add the param to `FabricSearchParams` (`types/fabric.ts`) and `fabricSearchSchema`, one `.eq`/`.gte` line in `FabricRepository.search`, and — if it should be a dropdown — options in `lib/config/search.config.ts` (the filter UI is config-driven).

## 7. Similarity (optional)

If similar fabrics should weigh it: add a weight in `lib/config/similarity.config.ts`, a comparison block in `similarity-engine.ts`, and a test in `tests/unit/similarity-engine.test.ts`. Keep weights summing to 100 so scores stay readable as percentages.

## Checklist

- [ ] Migration run in Supabase
- [ ] `types/fabric.ts` + zod schema
- [ ] Prompt + extraction schema + ingest/rerun mapping (if AI-extracted)
- [ ] Spec strip row + review queue field
- [ ] Search param (optional) · similarity weight (optional)
- [ ] `npm run typecheck && npm test`
