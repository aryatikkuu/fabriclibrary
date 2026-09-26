# Security Guide

How the library is protected, and what to check when setting it up. The short version is in the README's Security section.

## 1. Storage: Public Bucket + Signed URL Option

**Status:** ✅ Safe default, private option available

- **Default (recommended): bucket stays PUBLIC.** Fabric hanger photos are not sensitive data, and public URLs are permanent — they never break. All the sensitive data (prices, buyers, extraction logs) lives in the database, which is protected by RLS and never public.
- **`getSignedUrl(path, expiresIn)`** is available in `services/storage.service.ts` if you later make the bucket private — call it at *render time*, never store its output in the database (signed URLs expire).
- **Important rule:** the database stores the permanent URL + storage path. Expiring URLs must never be saved to `fabric_images.public_url` or images break when the link expires.

**Why this default:** a private bucket would require signing URLs on every page load for every image. For swatch photos the gain is minimal and the complexity is real. Revisit only if you ever store confidential documents.

---

## 2. Access control

**Status:** ✅ Enforced in the database (RLS) and re-checked by every API route

- Visitors and viewers see **approved fabrics only**, plus those fabrics' images, tags and similarity links (migrations 0002, 0010).
- Editors and admins create, edit and review; only admins delete.
- **Roles change only in Supabase** (Table Editor → `profiles`). Signed-in users can update nothing on their profile but `full_name` — column privileges, migration 0010. (Before 0010 a viewer could promote themselves to admin.)
- API routes call `requirePermission(...)`; the n8n endpoints check `x-webhook-secret` in constant time (`verifyWebhookSecret`).

**Test it the way the browser does** — with the anon key through the API, not by switching roles in the SQL editor (it runs as `postgres` and gives misleading results).

---

## 3. Photo search limits

**Status:** ✅ Enforced in the database before any AI call

- Open to everyone. Per rolling 24 h: 10 per visitor, 30 per signed-in user, 300 for all non-admins together (~$0.42/day ceiling); at most 5 a minute each; admins unlimited. Values: `lookSearch.limits` in `lib/config/visual-tags.config.ts`.
- `claim_look_search()` (migrations 0009/0010) checks and records each search under a lock, so parallel requests can't exceed a limit; only the service role can call it.
- Visitors are identified by the platform's IP (`request.ip`), stored as a hash; `X-Forwarded-For` and similar headers are ignored because clients can fake them. History older than 30 days is deleted automatically.
- Results pages read a search's description and embedding by id — a crafted URL can't trigger an AI call.

---

## 4. Uploads and AI input

- Every photo endpoint (`/api/upload`, `/api/ingest`, `/api/ai-extraction/extract`, `/api/search/look`) accepts only JPEG, PNG or WebP, **recognised from the file's bytes** (`lib/images.ts`), with a size cap.
- Storage paths are built only from sanitised segments (`lib/config/storage.config.ts`), so `../` can't escape a mill's folder; uploads to unknown mills are rejected.
- AI output is untrusted: tags must come from the fixed vocabulary, descriptions are cleaned to one plain line, and a customer's note is passed as quoted data, never instructions.

---

## 5. Audit logging

**Status:** ✅ Working since migration 0010 (before it, staff inserts were silently rejected, so older actions weren't logged)

- Fabric create/update/delete and review approve/reject/rerun are logged by the services, with before/after snapshots. Staff can only log their own actions.

```sql
select * from audit_logs order by created_at desc limit 50;
```

---

## 6. Security headers

`next.config.mjs` sends a Content-Security-Policy (this site + Supabase only), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, HSTS, and strict referrer and permissions policies on every response.

---

## Setup Checklist

- [ ] **Supabase → Storage:** keep the `textile-library` bucket **Public** (section 1)
- [ ] **Supabase → Authentication:** turn off **"Allow new users to sign up"** — an admin creates accounts
- [ ] **Supabase → Authentication:** enable **MFA** for staff
- [ ] **Vercel:** `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY` and `N8N_WEBHOOK_SECRET` set, and nothing secret named `NEXT_PUBLIC_…`
- [ ] **Migrations 0001–0010** applied

---

## Still in scope (not in this code)

These are good ideas but left out to keep the setup simple:

- **Database encryption at rest** — Supabase Pro plan includes this
- **IP whitelisting** — you can configure in Supabase firewall
- **Detailed alerting** — set up email notifications in Supabase if suspicious activity detected
- **API key rotation** — manually regenerate your keys in Supabase monthly
- **Backups** — Supabase Pro includes automatic daily backups

---

## If something goes wrong

**Images broken (403 Forbidden):**
- Bucket was switched to private without moving reads to signed URLs → set it back to Public, or refactor reads to `getSignedUrl()`
- RLS/storage policy missing → re-run `0003_storage_bucket.sql`

**"Too many photo searches" / daily limit reached:**
- Limits are in `lookSearch.limits` (`lib/config/visual-tags.config.ts`); admins are never limited
- Local development has no real IP, so all local visitors share one limit

**Audit log is empty:**
- Check migration 0010 is applied (it adds the staff insert policy)
- Only signed-in staff actions are logged

---

## Questions?

For Supabase-specific security (2FA, RLS, backups), see their docs at supabase.com/security.
