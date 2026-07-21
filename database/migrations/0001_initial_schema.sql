-- ===========================================================================
-- Digital Textile Library — initial schema
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- mills
-- ---------------------------------------------------------------------------
create table if not exists public.mills (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text,
  country     text,
  logo_url    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (extends Supabase auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text,
  email      text,
  role       text not null default 'viewer'
             check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- fabrics
-- ---------------------------------------------------------------------------
create table if not exists public.fabrics (
  id                    uuid primary key default gen_random_uuid(),
  mill_id               uuid not null references public.mills (id) on delete restrict,
  fabric_code           text not null,
  fabric_name           text,
  fabric_type           text,
  composition           text,
  gsm                   integer check (gsm is null or gsm between 1 and 2000),
  width                 text,
  color                 text,
  color_family          text,
  finish                text,
  season                text,
  description           text,
  ai_description        text,
  qr_code_value         text,
  extraction_confidence numeric(5, 2)
                        check (extraction_confidence is null
                               or extraction_confidence between 0 and 100),
  review_status         text not null default 'needs_review'
                        check (review_status in ('approved', 'needs_review', 'rejected')),
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (mill_id, fabric_code)
);

create index if not exists idx_fabrics_mill_id       on public.fabrics (mill_id);
create index if not exists idx_fabrics_fabric_code   on public.fabrics (fabric_code);
create index if not exists idx_fabrics_gsm           on public.fabrics (gsm);
create index if not exists idx_fabrics_fabric_type   on public.fabrics (fabric_type);
create index if not exists idx_fabrics_color_family  on public.fabrics (color_family);
create index if not exists idx_fabrics_finish        on public.fabrics (finish);
create index if not exists idx_fabrics_review_status on public.fabrics (review_status);
create index if not exists idx_fabrics_created_at    on public.fabrics (created_at desc);

-- Full-text search over the searchable text columns.
alter table public.fabrics
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(fabric_code, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(fabric_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(fabric_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(composition, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(color, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(finish, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'D')
  ) stored;

create index if not exists idx_fabrics_search on public.fabrics using gin (search_vector);

-- updated_at maintenance
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fabrics_touch on public.fabrics;
create trigger trg_fabrics_touch before update on public.fabrics
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_mills_touch on public.mills;
create trigger trg_mills_touch before update on public.mills
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- fabric_images
-- ---------------------------------------------------------------------------
create table if not exists public.fabric_images (
  id           uuid primary key default gen_random_uuid(),
  fabric_id    uuid not null references public.fabrics (id) on delete cascade,
  storage_path text not null,
  public_url   text,
  image_type   text not null default 'hanger'
               check (image_type in ('hanger', 'fabric', 'qr', 'detail', 'other')),
  is_primary   boolean not null default false,
  uploaded_at  timestamptz not null default now()
);

create index if not exists idx_fabric_images_fabric_id on public.fabric_images (fabric_id);

-- ---------------------------------------------------------------------------
-- fabric_documents
-- ---------------------------------------------------------------------------
create table if not exists public.fabric_documents (
  id            uuid primary key default gen_random_uuid(),
  fabric_id     uuid not null references public.fabrics (id) on delete cascade,
  document_name text not null,
  document_type text not null default 'other'
                check (document_type in ('datasheet', 'certificate', 'testing_report', 'other')),
  storage_path  text not null,
  public_url    text,
  uploaded_at   timestamptz not null default now()
);

create index if not exists idx_fabric_documents_fabric_id on public.fabric_documents (fabric_id);

-- ---------------------------------------------------------------------------
-- fabric_tags
-- ---------------------------------------------------------------------------
create table if not exists public.fabric_tags (
  id         uuid primary key default gen_random_uuid(),
  fabric_id  uuid not null references public.fabrics (id) on delete cascade,
  tag        text not null,
  created_at timestamptz not null default now(),
  unique (fabric_id, tag)
);

create index if not exists idx_fabric_tags_tag on public.fabric_tags (tag);

-- ---------------------------------------------------------------------------
-- fabric_similarities
-- ---------------------------------------------------------------------------
create table if not exists public.fabric_similarities (
  id                uuid primary key default gen_random_uuid(),
  source_fabric_id  uuid not null references public.fabrics (id) on delete cascade,
  similar_fabric_id uuid not null references public.fabrics (id) on delete cascade,
  similarity_score  numeric(5, 2) not null check (similarity_score between 0 and 100),
  similarity_reason text,
  similarity_method text not null default 'rule_based'
                    check (similarity_method in ('rule_based', 'embedding', 'visual')),
  created_at        timestamptz not null default now(),
  unique (source_fabric_id, similar_fabric_id, similarity_method),
  check (source_fabric_id <> similar_fabric_id)
);

create index if not exists idx_similarities_source
  on public.fabric_similarities (source_fabric_id, similarity_score desc);

-- ---------------------------------------------------------------------------
-- ai_extraction_logs
-- ---------------------------------------------------------------------------
create table if not exists public.ai_extraction_logs (
  id                uuid primary key default gen_random_uuid(),
  fabric_id         uuid references public.fabrics (id) on delete set null,
  source_image_path text,
  raw_ai_response   text,
  extracted_json    jsonb,
  confidence_score  numeric(5, 2),
  extraction_status text not null default 'success'
                    check (extraction_status in ('success', 'partial', 'failed')),
  error_message     text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_extraction_logs_fabric_id on public.ai_extraction_logs (fabric_id);

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity on public.audit_logs (entity_type, entity_id);
