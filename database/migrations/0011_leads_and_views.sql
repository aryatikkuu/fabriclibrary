-- ============================================================================
-- 0011 — swatch / price requests (leads) and fabric page views
--
-- leads        — one row per "Request swatches / price" submission
--                (app/api/leads). The same request is also emailed by the
--                buyer from a pre-filled draft; this row is the record.
-- fabric_views — one row per fabric, per visitor, per day (fabric page),
--                so reloads don't inflate counts. Staff and bots aren't counted.
--
-- Both are written only by server code (service role) and read only by
-- admins (the analytics page). fabric_analytics() runs as the caller, so the
-- same admin-only rules apply to it.
-- Paste into the Supabase SQL editor. Safe to re-run.
-- ============================================================================

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  fabric_id   uuid references public.fabrics (id) on delete set null,
  fabric_code text,                          -- snapshot: survives the fabric being deleted
  mill_id     uuid references public.mills (id) on delete set null,
  request     text not null check (request in ('swatch', 'price', 'both')),
  name        text not null,
  company     text,
  whatsapp    text,
  email       text not null,
  message     text,
  client_key  text not null                  -- hashed visitor id, for the daily limit
);
create index if not exists idx_leads_created on public.leads (created_at desc);
create index if not exists idx_leads_fabric  on public.leads (fabric_id);
create index if not exists idx_leads_client  on public.leads (client_key, created_at);

create table if not exists public.fabric_views (
  fabric_id  uuid not null references public.fabrics (id) on delete cascade,
  viewed_on  date not null default current_date,
  visitor    text not null,                  -- hashed visitor id
  primary key (fabric_id, viewed_on, visitor)
);
create index if not exists idx_fabric_views_day on public.fabric_views (viewed_on);

alter table public.leads        enable row level security;
alter table public.fabric_views enable row level security;

drop policy if exists "leads: admin read"   on public.leads;
drop policy if exists "leads: admin delete" on public.leads;
create policy "leads: admin read"   on public.leads for select using (public.current_role() = 'admin');
create policy "leads: admin delete" on public.leads for delete using (public.current_role() = 'admin');

drop policy if exists "views: admin read" on public.fabric_views;
create policy "views: admin read" on public.fabric_views for select using (public.current_role() = 'admin');

-- Supabase grants every privilege to anon/authenticated by default; these
-- tables are written by the server only, so take the write privileges back.
revoke insert, update, delete, truncate on public.leads, public.fabric_views from anon, authenticated;
grant delete on public.leads to authenticated;  -- admins (policy above) can remove a lead

-- Views and requests per fabric since p_since (null = all time), for every
-- fabric with at least one of either.
create or replace function public.fabric_analytics(p_since timestamptz default null)
returns table (
  mill_slug text, mill_name text, fabric_id uuid, fabric_code text, fabric_name text,
  views bigint, requests bigint
)
language sql stable security invoker set search_path = public as $$
  with v as (
    select fabric_id, count(*) as n from fabric_views
    where p_since is null or viewed_on >= p_since::date
    group by fabric_id
  ),
  l as (
    select fabric_id, count(*) as n from leads
    where fabric_id is not null and (p_since is null or created_at >= p_since)
    group by fabric_id
  )
  select m.slug, m.name, f.id, f.fabric_code, f.fabric_name,
         coalesce(v.n, 0), coalesce(l.n, 0)
  from fabrics f
  join mills m on m.id = f.mill_id
  left join v on v.fabric_id = f.id
  left join l on l.fabric_id = f.id
  where v.n is not null or l.n is not null
  order by m.name, coalesce(l.n, 0) desc, coalesce(v.n, 0) desc;
$$;

grant execute on function public.fabric_analytics(timestamptz) to authenticated;
