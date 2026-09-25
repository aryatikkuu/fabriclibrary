-- ============================================================================
-- 0006 — photo search ("find fabrics that look like this")
--
-- The search tab turns a buyer's photo and/or note into tags from the fixed
-- vocabulary (lib/config/visual-tags.config.ts). These functions rank the
-- library against those tags in a single query — no AI, no per-fabric cost.
--
-- Visual tags are stored in fabric_tags as "<group>:<value>" ("pattern:floral");
-- end-use tags are stored bare ("shirts") and are searched as "use:<tag>".
-- Paste into the Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- Lets "which fabrics have any of these tags" use an index-only scan.
create index if not exists idx_fabric_tags_tag_fabric on public.fabric_tags (tag, fabric_id);

-- Score = weighted average over the searched groups of
--   visual groups: |searched ∩ fabric| / |searched ∪ fabric|   (Jaccard)
--   use:           1 if any searched use tag matches, else 0
-- Filters mirror FabricRepository.search. security invoker = the caller's RLS
-- applies, so visitors still only see approved fabrics.
create or replace function public.match_fabrics_by_look(
  look            text[],
  group_weights   jsonb,
  min_score       real    default 0.3,
  p_mill_slug     text    default null,
  p_fabric_type   text    default null,
  p_color_family  text    default null,
  p_composition   text    default null,
  p_gsm_min       int     default null,
  p_gsm_max       int     default null,
  p_review_status text    default null,
  p_limit         int     default 24,
  p_offset        int     default 0
)
returns table (fabric_id uuid, score real, total bigint)
language sql stable security invoker set search_path = public as $$
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
  scored as (
    select fabric_id,
           (sum(w * case when grp = 'use' then least(hit, 1)::real
                         else hit::real / (n + own - hit) end)
            / nullif((select sum(w) from qg), 0))::real as score
    from per_group group by fabric_id
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
  where s.score >= min_score
  order by s.score desc, f.fabric_code
  limit p_limit offset p_offset;
$$;

-- End-use tags common enough to offer the AI when reading a buyer's note.
create or replace function public.popular_use_tags(min_count int default 20)
returns table (tag text, fabrics bigint)
language sql stable security invoker set search_path = public as $$
  select tag, count(*) from fabric_tags
  where tag not like '%:%'
  group by tag having count(*) >= min_count
  order by count(*) desc;
$$;

grant execute on function public.match_fabrics_by_look(text[], jsonb, real, text, text, text, text, int, int, text, int, int) to anon, authenticated;
grant execute on function public.popular_use_tags(int) to anon, authenticated;
