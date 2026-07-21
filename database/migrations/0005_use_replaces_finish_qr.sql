-- ===========================================================================
-- Replace unused finish / qr_code_value fields with suggested_use.
-- Keywords live in the existing fabric_tags table.
-- Run via the Supabase SQL editor.
-- ===========================================================================

-- search_vector references finish, so rebuild it without finish and with
-- suggested_use.
alter table public.fabrics drop column if exists search_vector;
drop index if exists idx_fabrics_finish;
alter table public.fabrics drop column if exists finish;
alter table public.fabrics drop column if exists qr_code_value;
alter table public.fabrics add column if not exists suggested_use text;

alter table public.fabrics
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(fabric_code, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(fabric_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(fabric_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(composition, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(color, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(suggested_use, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'D')
  ) stored;

create index if not exists idx_fabrics_search on public.fabrics using gin (search_vector);
