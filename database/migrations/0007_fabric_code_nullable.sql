-- ============================================================================
-- 0007 — fabrics without a printed code
--
-- Some hanger photos carry no readable code (close-ups, cards with no label).
-- fabric_code was NOT NULL, so those fabrics had to be given a fake unique
-- value. Make it nullable instead: unique (mill_id, fabric_code) still holds
-- for real codes, and Postgres allows any number of NULLs under a unique
-- constraint. Blank/whitespace-only placeholders written by earlier clean-ups
-- become NULL. Paste into the Supabase SQL editor. Safe to re-run.
-- ============================================================================

alter table public.fabrics alter column fabric_code drop not null;

update public.fabrics set fabric_code = null where fabric_code is not null and btrim(fabric_code) = '';

-- Keep blank strings out from now on: no code is NULL, never ''.
alter table public.fabrics drop constraint if exists fabrics_fabric_code_not_blank;
alter table public.fabrics add constraint fabrics_fabric_code_not_blank
  check (fabric_code is null or btrim(fabric_code) <> '');
