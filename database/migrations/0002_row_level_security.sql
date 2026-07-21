-- ===========================================================================
-- Row Level Security
-- Viewers: read approved fabrics. Editors/Admins: full read + write.
-- The service-role key (used by n8n / server routes) bypasses RLS.
-- ===========================================================================

alter table public.mills                enable row level security;
alter table public.profiles             enable row level security;
alter table public.fabrics              enable row level security;
alter table public.fabric_images        enable row level security;
alter table public.fabric_documents     enable row level security;
alter table public.fabric_tags          enable row level security;
alter table public.fabric_similarities  enable row level security;
alter table public.ai_extraction_logs   enable row level security;
alter table public.audit_logs           enable row level security;

-- Helper: current user's role.
create or replace function public.current_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

-- profiles --------------------------------------------------------------
create policy "profiles: self read"   on public.profiles for select using (id = auth.uid() or public.current_role() = 'admin');
create policy "profiles: self update" on public.profiles for update using (id = auth.uid());
create policy "profiles: admin write" on public.profiles for all    using (public.current_role() = 'admin');

-- mills ------------------------------------------------------------------
create policy "mills: read all"    on public.mills for select using (true);
create policy "mills: admin write" on public.mills for all    using (public.current_role() = 'admin');

-- fabrics ----------------------------------------------------------------
create policy "fabrics: viewers read approved" on public.fabrics for select
  using (review_status = 'approved' or public.current_role() in ('admin', 'editor'));
create policy "fabrics: staff insert" on public.fabrics for insert
  with check (public.current_role() in ('admin', 'editor'));
create policy "fabrics: staff update" on public.fabrics for update
  using (public.current_role() in ('admin', 'editor'));
create policy "fabrics: admin delete" on public.fabrics for delete
  using (public.current_role() = 'admin');

-- child tables follow the parent fabric's visibility ----------------------
create policy "images: read" on public.fabric_images for select using (
  exists (select 1 from public.fabrics f where f.id = fabric_id
          and (f.review_status = 'approved' or public.current_role() in ('admin', 'editor')))
);
create policy "images: staff write" on public.fabric_images for all
  using (public.current_role() in ('admin', 'editor'));

create policy "documents: read" on public.fabric_documents for select using (
  exists (select 1 from public.fabrics f where f.id = fabric_id
          and (f.review_status = 'approved' or public.current_role() in ('admin', 'editor')))
);
create policy "documents: staff write" on public.fabric_documents for all
  using (public.current_role() in ('admin', 'editor'));

create policy "tags: read"        on public.fabric_tags for select using (true);
create policy "tags: staff write" on public.fabric_tags for all
  using (public.current_role() in ('admin', 'editor'));

create policy "similarities: read"        on public.fabric_similarities for select using (true);
create policy "similarities: staff write" on public.fabric_similarities for all
  using (public.current_role() in ('admin', 'editor'));

-- logs: staff only ---------------------------------------------------------
create policy "extraction logs: staff read" on public.ai_extraction_logs for select
  using (public.current_role() in ('admin', 'editor'));
create policy "extraction logs: staff write" on public.ai_extraction_logs for insert
  with check (public.current_role() in ('admin', 'editor'));

create policy "audit logs: admin read" on public.audit_logs for select
  using (public.current_role() = 'admin');
