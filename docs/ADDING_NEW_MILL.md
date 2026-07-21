# Adding a New Mill

Adding a mill requires **no business-logic changes**. Two small steps, five minutes.

## 1. Insert the mill row

Supabase SQL editor:

```sql
insert into public.mills (name, slug, description, country, is_active)
values (
  'Hela Clothing',
  'hela-clothing',          -- lowercase, hyphens; becomes the URL and storage folder
  'Sri Lanka-based apparel manufacturer — knit programs for global brands.',
  'Sri Lanka',
  true
);
```

Slug rules: lowercase letters, digits, hyphens only. It appears in `/mills/{slug}` and in storage paths `mills/{slug}/fabrics/…`, so don't change it once fabrics exist.

## 2. Mirror it in config (recommended)

`lib/config/mills.config.ts` drives seeding and gives new environments the same registry:

```ts
{
  name: 'Hela Clothing',
  slug: 'hela-clothing',
  country: 'Sri Lanka',
  shortLine: 'Knit apparel programs.',
},
```

Also add it to `scripts/seed.mjs` if you want `npm run db:seed` to create it on fresh setups.

## That's it — what happens automatically

- The mill appears on the homepage **Mills** section and gets its page at `/mills/hela-clothing` with its own filterable fabric grid.
- The search filter's mill dropdown picks it up (it's read from the DB).
- **AI ingestion resolves it by name:** when a hanger label says "Hela Clothing", `MillService.resolveByName` matches the new row and files the fabric under it. Until the row exists, ingestion of that mill's photos returns `422 MILL_NOT_RESOLVED` (visible in n8n executions) — add the mill, re-drop the photos.
- Storage folders are created implicitly on first upload.

## Notes

- The label name and `mills.name` must match (case-insensitive). If a mill prints variant names on labels (e.g. "MTM" vs "Masood Textile Mills"), either standardise the label or extend `resolveByName` with an alias list — that's the single resolution point.
- Deactivate a mill with `update mills set is_active = false …`; it disappears from the site but its data remains.
