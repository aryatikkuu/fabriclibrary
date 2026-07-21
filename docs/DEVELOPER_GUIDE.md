# Developer Guide

## Ground rules

1. **Repositories are the only files that query Supabase.** If you're writing `.from('…')` anywhere else, stop and add a repository method.
2. **Services own business rules** and are constructed only via `buildServices(db)` in `lib/container.ts`. Pass the user-scoped client (`lib/supabase/server.ts`) for normal requests; the admin client (`lib/supabase/admin.ts`) only inside trusted automation routes.
3. **Nothing domain-specific is hardcoded.** Mills, similarity weights, filter options, role permissions, storage paths, thresholds → `lib/config/`. If a reviewer can ask "why is this string in a component?", it belongs in config.
4. **AI output is untrusted.** It must pass `extractionResultSchema` before any repository call. Prompts live in `features/ai-extraction/prompts/` as exported constants.
5. **API routes follow one shape:** parse → `requirePermission(...)` (or `verifyWebhookSecret`) → call a service → return JSON; errors funnel through `handleApiError`.

## Mental map

```
Request ─► app/api/*/route.ts ─► requirePermission ─► buildServices(createClient())
                                                         │
                                  service method ────────┤  (business rules, audit log)
                                                         │
                                  repository method ─────┘  (the SQL/Supabase bit)
Pages: app/**/page.tsx are async server components doing the same minus HTTP.
Client components ('use client') only where interaction demands it:
search bar, filters, assistant chat, review table, uploader, pagination, login.
```

## Common tasks

**Add an API endpoint** — create `app/api/<path>/route.ts`:

```ts
export async function POST(request: Request) {
  try {
    await requirePermission('fabrics.update');
    const body = mySchema.parse(await request.json());
    const services = buildServices(createClient());
    return NextResponse.json(await services.fabricService.doThing(body));
  } catch (error) {
    return handleApiError(error);
  }
}
```

**Add a permission** — one line in `lib/config/roles.config.ts`; guard with `requirePermission('your.permission')`. The matrix test in `tests/unit/roles-config.test.ts` keeps admins covered.

**Add a page** — async server component; fetch via services; compose existing components (`PremiumPageHeader`, `FabricGrid`, …). Add `export const dynamic = 'force-dynamic'` since data is per-request.

**Change similarity behaviour** — weights/ranges in `lib/config/similarity.config.ts`; logic in `features/similarity/similarity-engine.ts` (pure — extend the tests alongside). Recalculation is triggered on create and on ingest; you can also batch-recalculate by iterating fabrics and calling `similarityService.recalculateForFabric`.

**Other guides:** new mill → `ADDING_NEW_MILL.md` · new fabric attribute → `ADDING_NEW_FIELDS.md` · re-branding → `BRANDING_GUIDE.md`.

## Testing

```bash
npm test            # vitest run
npm run test:watch
npm run typecheck
```

Unit tests cover the pure core: similarity scoring, the extraction Zod contract, storage path sanitisation, the role matrix. Pattern to follow: pure functions in `features/` and `lib/config/` get tests; thin glue (routes, pages) is kept simple enough not to need them. For service tests, construct the service with hand-rolled fake repositories — constructor injection makes this trivial.

## Conventions

- Types in `types/` mirror DB rows in `snake_case` — no mapping layer.
- Errors: throw `lib/errors.ts` classes; never `NextResponse` from services.
- Formatting of display values goes through `utils/format.ts`.
- Imports use the `@/` alias (tsconfig paths).

## Gotchas

- `useSearchParams()` in a client component must sit under `<Suspense>` (already done for search bar/filters/pagination).
- Supabase joins use the FK-name syntax in `similarity.repository.ts` (`fabric_similarities_similar_fabric_id_fkey`) — renaming the constraint breaks the join.
- `fabrics.updated_at` and `search_vector` are DB-maintained; never write them.
- A 401 from `/api/ingest` usually means the n8n secret and the app secret diverged.
