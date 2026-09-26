-- ============================================================================
-- 0009 — photo search for everyone, with limits that can't be bypassed
--
-- Every photo search (POST /api/search/look) is one row here. The row is
-- claimed BEFORE the AI is called, by claim_look_search(), which checks and
-- inserts under a lock — so parallel requests can't slip past a limit, and a
-- failed or abandoned call still counts.
--
-- Limits (rolling 24 hours, values passed from lookSearch.limits in
-- lib/config/visual-tags.config.ts):
--   · per signed-in user   (client_key 'user:<id>')
--   · per visitor          (client_key 'ip:<sha-256 of IP>' — the IP itself is never stored)
--   · one ceiling for all non-admin searches together — the real cost cap,
--     since a visitor can change IP but not this total.
-- Admins are recorded but never limited.
--
-- The row also keeps what the AI returned, including the description
-- embedding, so the results page reads it by id instead of calling OpenAI
-- again — a crafted URL can't trigger any AI call.
--
-- No RLS policies: only the service role (server code) can read or write.
-- Paste into the Supabase SQL editor. Safe to re-run.
-- ============================================================================

create table if not exists public.look_searches (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  client_key  text not null,
  user_id     uuid references auth.users (id) on delete set null,
  is_admin    boolean not null default false,
  look        text[],
  description text,
  embedding   extensions.vector(1536)
);

create index if not exists idx_look_searches_created on public.look_searches (created_at);
create index if not exists idx_look_searches_client on public.look_searches (client_key, created_at);

alter table public.look_searches enable row level security;

-- Returns the new row's id, or null plus the limit that was hit ('client' | 'global').
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
  return query
    insert into look_searches (client_key, user_id, is_admin)
    values (p_client_key, p_user_id, p_is_admin)
    returning look_searches.id, null::text;
end;
$$;

revoke all on function public.claim_look_search(text, uuid, boolean, int, int) from public, anon, authenticated;
grant execute on function public.claim_look_search(text, uuid, boolean, int, int) to service_role;
