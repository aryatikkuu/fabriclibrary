-- ============================================================================
-- 0012 — the public sees only complete fabrics
--
-- A fabric is complete when it has a code, a composition, a GSM and at least
-- one photo. Visitors (anonymous and viewers) see only fabrics that are
-- approved AND complete; admins and editors still see everything, so the
-- rest can be finished from the review queue.
--
-- Because this is RLS, it applies everywhere at once: listings, search,
-- photo search (match_fabrics_by_look runs as the caller), mill counts,
-- similar fabrics, fabric pages (404) and swatch requests.
--
-- is_complete   — generated from the fabric's own columns (always current).
-- fabric_has_image() — the photo check. It is security definer so the
--   fabrics policy can look at fabric_images without triggering that table's
--   own policy (which looks back at fabrics — infinite recursion otherwise).
--
-- Paste into the Supabase SQL editor. Safe to re-run.
-- ============================================================================

alter table public.fabrics add column if not exists is_complete boolean
  generated always as (
    nullif(btrim(fabric_code), '') is not null
    and nullif(btrim(composition), '') is not null
    and gsm is not null
  ) stored;

create index if not exists idx_fabrics_is_complete on public.fabrics (is_complete) where is_complete;

create or replace function public.fabric_has_image(p_fabric_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from fabric_images where fabric_id = p_fabric_id);
$$;
revoke all on function public.fabric_has_image(uuid) from public;
grant execute on function public.fabric_has_image(uuid) to anon, authenticated;

-- fabrics: visitors read approved + complete; staff read everything --------
drop policy if exists "fabrics: viewers read approved" on public.fabrics;
drop policy if exists "fabrics: public read complete" on public.fabrics;
create policy "fabrics: public read complete" on public.fabrics for select using (
  public.current_role() in ('admin', 'editor')
  or (review_status = 'approved' and is_complete and public.fabric_has_image(id))
);

-- images and documents: visible exactly where their fabric is -------------
drop policy if exists "images: read" on public.fabric_images;
create policy "images: read" on public.fabric_images for select
  using (exists (select 1 from public.fabrics f where f.id = fabric_id));

drop policy if exists "documents: read" on public.fabric_documents;
create policy "documents: read" on public.fabric_documents for select
  using (exists (select 1 from public.fabrics f where f.id = fabric_id));
