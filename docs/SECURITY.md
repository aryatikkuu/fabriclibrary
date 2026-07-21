# Security Guide

Three layers of security improvements are built into this version:

## 1. Storage: Public Bucket + Signed URL Option

**Status:** ✅ Safe default, private option available

- **Default (recommended): bucket stays PUBLIC.** Fabric hanger photos are not sensitive data, and public URLs are permanent — they never break. All the sensitive data (prices, buyers, extraction logs) lives in the database, which is protected by RLS and never public.
- **`getSignedUrl(path, expiresIn)`** is available in `services/storage.service.ts` if you later make the bucket private — call it at *render time*, never store its output in the database (signed URLs expire).
- **Important rule:** the database stores the permanent URL + storage path. Expiring URLs must never be saved to `fabric_images.public_url` or images break when the link expires.

**Why this default:** a private bucket would require signing URLs on every page load for every image. For swatch photos the gain is minimal and the complexity is real. Revisit only if you ever store confidential documents.

---

## 2. Rate Limiting

**Status:** ✅ Implemented

- **10 requests per minute per IP** on API endpoints
- **Non-blocking** — if exceeded, the API returns 429 (Too Many Requests) and the user is asked to try again
- **In-memory tracking** — runs on the server, no database hit
- **Applied to:** POST /api/fabrics (and can be added to other endpoints)

**How it works:**
```
User/bot makes 11 requests in 1 minute → 
  first 10 succeed, 11th returns 429 → 
  user waits 60 seconds → counter resets
```

**Why:** Prevents brute force attacks, scraping, and API abuse.

**To add rate limiting to more endpoints:** Add `requireRateLimit(request)` at the top of any API POST/PATCH/DELETE handler:

```typescript
export async function POST(request: NextRequest) {
  try {
    requireRateLimit(request);  // ← Add this line
    // rest of handler...
  }
}
```

---

## 3. Audit Logging

**Status:** ✅ Implemented

- **Every action is logged** — who did what, when, to which fabric
- **Stored in `audit_logs` table** — kept in Supabase forever
- **Before/after snapshots** — see exactly what changed
- **Automatic** — no code needed; the services handle it

**What gets logged:**
- ✅ Fabric created
- ✅ Fabric updated
- ✅ Fabric deleted
- ✅ AI extraction approved
- ✅ AI extraction rejected
- ✅ Extraction rerun

**View the audit log:**
Supabase → SQL Editor → Run this:
```sql
select * from audit_logs 
order by created_at desc 
limit 50;
```

**Why:** You can see a complete history of who approved which fabrics, made which changes, and when. Helps catch mistakes or unauthorized actions.

---

## Setup Checklist

- [ ] **Supabase → Storage:** Keep `textile-library` bucket **Public** (default; see section 1)
- [ ] **Supabase → Authentication:** Turn off **"Enable email signups"** (staff signup by admin only)
- [ ] **Supabase → Authentication:** Enable **Multi-Factor Authentication (MFA)** for all users
- [ ] **npm install:** Rate limiting is built in; no additional setup needed
- [ ] **Test rate limit:** Make 11 rapid requests to POST /api/fabrics, see if the 11th fails (expected)
- [ ] **View audit log:** Check Supabase SQL to confirm actions are being logged

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

**Rate limiting is too strict:**
- Limit is 10/minute per IP; if you need higher, edit `checkRateLimit()` in `lib/api-helpers.ts`
- Test environment may share an IP — if testing from the same machine, you'll hit the limit; wait 60 seconds

**Audit log is empty:**
- Check that the `audit_logs` table exists (run migrations in Supabase)
- Check that staff users are actually making changes (they must be logged in)

---

## Questions?

This guide covers the three improvements in this version. For Supabase-specific security (2FA, RLS, backups), see their docs at supabase.com/security.
