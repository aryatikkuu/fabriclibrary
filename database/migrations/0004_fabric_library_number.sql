-- ===========================================================================
-- Add a human-friendly sequential library number to fabrics.
-- Run via: supabase db push  (or paste into the Supabase SQL editor)
-- ===========================================================================

alter table public.fabrics
  add column if not exists library_no bigint generated always as identity unique;
