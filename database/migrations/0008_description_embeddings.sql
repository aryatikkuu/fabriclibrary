-- ============================================================================
-- 0008 — photo search also compares descriptions
--
-- Tags hold the broad look (pattern, colour, construction); the one-sentence
-- AI description also carries detail tags can't ("herringbone", "slub",
-- "dark navy vs bright blue"). Each description is turned into a text
-- embedding (npm run embed) and photo search blends the two:
--   score = (tag score + w · cosine similarity) / (1 + w)
-- Benchmark (reports/embedding-benchmark.json): same photo top-10 5→10 of 30,
-- different photo median rank 30→18, with w = 0.5.
--
-- Embeddings live in their own table so the 1,536 numbers are never loaded
-- with a fabric. Rebuildable at any time (well under 1¢ for the library), so
-- backups skip this table; run `npm run embed` after a restore.
-- Paste into the Supabase SQL editor. Safe to re-run.
-- ============================================================================

create extension if not exists vector with schema extensions;

create table if not exists public.fabric_embeddings (
  fabric_id   uuid primary key references public.fabrics (id) on delete cascade,
  embedding   extensions.vector(1536) not null,
  source_text text not null,          -- the description that was embedded, to detect changes
  model       text not null,
  updated_at  timestamptz not null default now()
);

-- Readable only where the fabric itself is (fabrics RLS applies inside the
-- subquery). Written only by the service role (scripts/embed-descriptions.mjs).
alter table public.fabric_embeddings enable row level security;
drop policy if exists fabric_embeddings_select on public.fabric_embeddings;
create policy fabric_embeddings_select on public.fabric_embeddings for select
  using (exists (select 1 from public.fabrics f where f.id = fabric_id));

-- New signature (two extra arguments), so drop the 0006 version first.
drop function if exists public.match_fabrics_by_look(text[], jsonb, real, text, text, text, text, int, int, text, int, int);

-- Tag score as in 0006: weighted average over the searched groups of
--   visual groups: |searched ∩ fabric| / |searched ∪ fabric|   (Jaccard)
--   use:           1 if any searched use tag matches, else 0
-- min_score filters on the tag score, so a description alone never pulls in
-- a fabric whose tags don't match. With query_embedding the order (and the
-- returned score) is the blend above; without it, the tag score alone.
create or replace function public.match_fabrics_by_look(
  look             text[],
  group_weights    jsonb,
  min_score        real    default 0.3,
  p_mill_slug      text    default null,
  p_fabric_type    text    default null,
  p_color_family   text    default null,
  p_composition    text    default null,
  p_gsm_min        int     default null,
  p_gsm_max        int     default null,
  p_review_status  text    default null,
  p_limit          int     default 24,
  p_offset         int     default 0,
  query_embedding  extensions.vector(1536) default null,
  embedding_weight real    default 0
)
returns table (fabric_id uuid, score real, total bigint)
language sql stable security invoker set search_path = public, extensions as $$
  with q as (                     -- searched tags, as stored
    select distinct split_part(t, ':', 1) as grp,
           case when t like 'use:%' then substr(t, 5) else t end as tag
    from unnest(look) as t
  ),
  qg as (                         -- searched groups and their weights
    select grp, count(*) as n, coalesce((group_weights ->> grp)::real, 0) as w
    from q group by grp
  ),
  candidates as (                 -- fabrics sharing at least one tag
    select distinct ft.fabric_id from fabric_tags ft where ft.tag in (select tag from q)
  ),
  per_group as (
    select ft.fabric_id, qg.grp, qg.w, qg.n,
           count(*) filter (where ft.tag in (select tag from q)) as hit,
           count(*) as own
    from fabric_tags ft
    join candidates c using (fabric_id)
    join qg on qg.grp = case when ft.tag like '%:%' then split_part(ft.tag, ':', 1) else 'use' end
    group by ft.fabric_id, qg.grp, qg.w, qg.n
  ),
  tagged as (
    select fabric_id,
           (sum(w * case when grp = 'use' then least(hit, 1)::real
                         else hit::real / (n + own - hit) end)
            / nullif((select sum(w) from qg), 0))::real as tag_score
    from per_group group by fabric_id
  ),
  scored as (
    select t.fabric_id, t.tag_score,
           case when query_embedding is null or embedding_weight <= 0 then t.tag_score
                else ((t.tag_score + embedding_weight * coalesce(1 - (e.embedding <=> query_embedding), 0))
                      / (1 + embedding_weight))::real end as score
    from tagged t
    left join fabric_embeddings e using (fabric_id)
    where t.tag_score >= min_score
  )
  -- lateral + "offset 0" = one primary-key lookup per scored fabric. Without
  -- the fence, Postgres merges this into a plain join, guesses the optional
  -- filters leave ~1 fabric, and compares every fabric with every score (~1 s).
  select s.fabric_id, s.score, count(*) over () as total
  from scored s
  cross join lateral (
    select f.fabric_code from fabrics f join mills m on m.id = f.mill_id
    where f.id = s.fabric_id
      and (p_mill_slug     is null or m.slug = p_mill_slug)
      and (p_fabric_type   is null or f.fabric_type ilike p_fabric_type)
      and (p_color_family  is null or f.color_family ilike p_color_family)
      and (p_composition   is null or f.composition ilike '%' || p_composition || '%')
      and (p_gsm_min       is null or f.gsm >= p_gsm_min)
      and (p_gsm_max       is null or f.gsm <= p_gsm_max)
      and (p_review_status is null or f.review_status = p_review_status)
    offset 0
  ) f
  order by s.score desc, f.fabric_code
  limit p_limit offset p_offset;
$$;

grant execute on function public.match_fabrics_by_look(text[], jsonb, real, text, text, text, text, int, int, text, int, int, extensions.vector, real) to anon, authenticated;
