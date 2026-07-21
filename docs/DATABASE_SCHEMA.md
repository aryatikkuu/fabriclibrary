# Database Schema

Migrations live in `database/migrations/` and are plain SQL — paste into the Supabase SQL editor in order, or run via the Supabase CLI.

| Migration | Purpose |
|---|---|
| `0001_initial_schema.sql` | All tables, triggers, indexes, full-text search vector |
| `0002_row_level_security.sql` | RLS policies for every table |
| `0003_storage_bucket.sql` | `textile-library` bucket + storage policies |

## Entity relationships

```
 mills 1 ──── * fabrics 1 ──── * fabric_images
                      │ 1
                      ├────── * fabric_documents
                      ├────── * fabric_tags
                      ├────── * ai_extraction_logs
                      └────── * fabric_similarities (source + similar, self-join)

 auth.users 1 ── 1 profiles        audit_logs * ──> profiles (nullable)
```

## Tables

### mills
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | `gen_random_uuid()` |
| name | text unique | e.g. "Orbit Exports" |
| slug | text unique | URL + storage path segment |
| description | text | shown on mill page |
| country | text | |
| logo_url | text | optional |
| is_active | boolean | inactive mills are hidden |
| created_at / updated_at | timestamptz | `touch_updated_at` trigger |

### fabrics
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| mill_id | uuid FK → mills | `on delete cascade` |
| fabric_code | text | **unique per mill** (`unique(mill_id, fabric_code)`) |
| fabric_name | text | |
| fabric_type | text | e.g. Single Jersey, Satin Weave |
| composition | text | e.g. "97% Polyester 3% Spandex" |
| gsm | integer | CHECK 0 < gsm ≤ 2000 |
| width | text | kept as text — "58 inch", "150 cm", "72 inch tubular" |
| color / color_family | text | family is the filterable bucket |
| finish | text | |
| season | text | AW / SS / Core |
| description | text | human-written |
| ai_description | text | model-written note, labelled in the UI |
| qr_code_value | text | decoded QR/data-matrix payload |
| extraction_confidence | numeric | 0–100 |
| review_status | text | `approved` \| `needs_review` \| `rejected` (CHECK) |
| search_vector | tsvector **generated** | code+name+type+composition+color+finish; GIN-indexed |
| created_by | uuid FK → profiles | nullable (automation) |
| created_at / updated_at | timestamptz | |

### fabric_images
`id, fabric_id FK, storage_path, public_url, image_type (hanger|fabric|qr|detail|other), is_primary, uploaded_at`. First image of a fabric is marked primary by the ingest pipeline.

### fabric_documents
`id, fabric_id FK, document_name, document_type (datasheet|certificate|testing_report|other), storage_path, public_url, uploaded_at`.

### fabric_tags
`id, fabric_id FK, tag, created_at` — free-form labels, unique per (fabric, tag).

### fabric_similarities
`id, source_fabric_id FK, similar_fabric_id FK, similarity_score numeric (0–100), similarity_reason text, similarity_method (rule_based|embedding|visual), created_at`. Unique on (source, similar, method). Replaced wholesale on each recalculation.

### ai_extraction_logs
`id, fabric_id FK nullable, source_image_path, raw_ai_response text, extracted_json jsonb, confidence_score, extraction_status (success|partial|failed), error_message, created_at`. The verbatim model output is always kept for audit/debugging.

### profiles
`id uuid PK = auth.users.id, email, full_name, role (admin|editor|viewer), created_at`. Created automatically by the `handle_new_user` trigger on signup with role `viewer`; promote users by updating this row.

### audit_logs
`id, user_id FK nullable, action text (e.g. fabric.update, review.approve), entity_type, entity_id, before_data jsonb, after_data jsonb, created_at`.

## RLS summary (0002)

- **Public/viewer:** `select` on mills (active), fabrics (`review_status = 'approved'`), their images/documents/tags/similarities.
- **Editor:** full read; insert/update fabrics and related; read review queue.
- **Admin:** everything, including delete, profiles and audit_logs.
- Helper `current_role()` reads the caller's `profiles.role` once per policy.
- Service-role key bypasses RLS by design — only used server-side by automation.

## Conventions

- All timestamps `timestamptz`, UTC.
- `updated_at` maintained by trigger — never set it in app code.
- Add new columns as nullable first; see `docs/ADDING_NEW_FIELDS.md`.
