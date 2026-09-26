-- ============================================================================
-- 0010 — security hardening (audit of 2026-09-26)
--
--   1. Users can no longer change their own role. The "self update" policy
--      let any signed-in viewer set role = 'admin' on their own profile; now
--      only full_name is updatable by signed-in users (column privileges).
--   2. Tags and similarity links are readable only for fabrics the caller can
--      see (they were readable for unapproved fabrics too).
--   3. Staff can write audit entries. There was no insert policy, so every
--      audit entry was silently rejected (audit_logs was empty).
--   4. Photo search: a per-minute burst limit and 30-day retention move into
--      claim_look_search, replacing the per-server in-memory limiter.
--
-- Paste into the Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- 1. Roles change only from the Supabase dashboard or server code. ----------
-- Column privileges, not a trigger: signed-in users (and visitors) may update
-- only full_name; any update touching role or id fails with "permission
-- denied", whatever the RLS policies say. The dashboard (postgres) and the
-- service role keep full access — change roles in Table Editor → profiles.
drop trigger if exists protect_profile_role on public.profiles;
drop function if exists public.protect_profile_role();

-- Supabase grants every table privilege to anon/authenticated by default and
-- relies on RLS; for profiles, take them all back and return only what's used.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Self-update now only reaches full_name, and still only on the caller's row.
drop policy if exists "profiles: self update" on public.profiles;
create policy "profiles: self update" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- 2. Child tables follow the parent fabric's visibility (as images already do). --
drop policy if exists "tags: read" on public.fabric_tags;
create policy "tags: read" on public.fabric_tags for select
  using (exists (select 1 from public.fabrics f where f.id = fabric_id));

drop policy if exists "similarities: read" on public.fabric_similarities;
create policy "similarities: read" on public.fabric_similarities for select
  using (exists (select 1 from public.fabrics f where f.id = source_fabric_id)
     and exists (select 1 from public.fabrics f where f.id = similar_fabric_id));

-- 3. Staff record their own actions; nobody can write entries for someone else. --
drop policy if exists "audit logs: staff insert" on public.audit_logs;
create policy "audit logs: staff insert" on public.audit_logs for insert
  with check (public.current_role() in ('admin', 'editor') and user_id = auth.uid());

-- 4. Photo search: burst limit + retention, inside the same locked claim. --
create or replace function public.claim_look_search(
  p_client_key   text,
  p_user_id      uuid,
  p_is_admin     boolean,
  p_client_limit int,
  p_global_limit int
)
returns table (id uuid, limit_hit text)
language plpgsql security definer set search_path = public as $$
begin
  if not p_is_admin then
    -- One lock for all non-admin claims: counting and inserting can't interleave.
    perform pg_advisory_xact_lock(hashtext('look_searches'));
    -- Bursts: at most 5 a minute from one visitor or user.
    if (select count(*) from look_searches s
        where s.client_key = p_client_key and s.created_at > now() - interval '1 minute') >= 5 then
      return query select null::uuid, 'burst'::text;
      return;
    end if;
    if (select count(*) from look_searches s
        where s.client_key = p_client_key and s.created_at > now() - interval '24 hours') >= p_client_limit then
      return query select null::uuid, 'client'::text;
      return;
    end if;
    if (select count(*) from look_searches s
        where not s.is_admin and s.created_at > now() - interval '24 hours') >= p_global_limit then
      return query select null::uuid, 'global'::text;
      return;
    end if;
  end if;
  -- Keep 30 days of history (hashed IPs, descriptions); limits only need 24 h.
  delete from look_searches s where s.created_at < now() - interval '30 days';
  return query
    insert into look_searches (client_key, user_id, is_admin)
    values (p_client_key, p_user_id, p_is_admin)
    returning look_searches.id, null::text;
end;
$$;

revoke all on function public.claim_look_search(text, uuid, boolean, int, int) from public, anon, authenticated;
grant execute on function public.claim_look_search(text, uuid, boolean, int, int) to service_role;
