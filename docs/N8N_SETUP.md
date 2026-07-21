# n8n Setup — Fabric Image Ingestion

The workflow in `n8n/workflows/fabric-image-ingestion.json` is the only automation piece. Its job is deliberately small: **detect a new photo, base64-encode it, POST it to `/api/ingest`**. The app does everything else (AI extraction, storage upload, database write, extraction log, similarity recalculation) in that one call, so the workflow stays robust and swappable.

## 1. Import

n8n (cloud or self-hosted) → **Workflows → Import from file** → select `fabric-image-ingestion.json`.

## 2. Environment variables

Set these in n8n (**Settings → Variables**, or container env for self-hosted):

| Variable | Value |
|---|---|
| `TEXTILE_LIBRARY_URL` | Your deployed app, e.g. `https://textile-library.vercel.app` (or `http://host.docker.internal:3000` for local dev) |
| `N8N_WEBHOOK_SECRET` | Long random string — **must equal** the app's `N8N_WEBHOOK_SECRET` |
| `WATCH_FOLDER_ID` | ID of the watched Google Drive folder (from its URL) |
| `NOTIFY_FROM_EMAIL` / `NOTIFY_TO_EMAIL` | For review-queue notifications |

Generate a secret with: `openssl rand -hex 32`.

## 3. Credentials

- **Google Drive** nodes: connect a Google account with access to the watched folder (n8n's built-in OAuth flow).
- **Send Email** node: any SMTP credentials — or replace the node with Slack/Teams/Telegram; only the message text would change.

## 4. Node-by-node

| Node | What it does |
|---|---|
| **Watch Folder (Google Drive)** | Polls every minute for new files in `WATCH_FOLDER_ID` |
| **Download Image** | Fetches the file binary |
| **Only Images** | Skips non-image files dropped in the folder |
| **Encode Base64** | Converts binary → `{file_name, mime_type, image_base64}` |
| **POST /api/ingest** | Calls the app with the `x-webhook-secret` header; 120 s timeout (Vision can take 10–30 s) |
| **Needs Review?** | Branches on `fabric.review_status` in the response |
| **Notify Staff (Email)** | Sends code, confidence, missing fields + a link to `/review` |

## 5. Swapping the folder source

Only the first two nodes are source-specific. Replace them with:

| Source | Trigger node | Download node |
|---|---|---|
| Google Drive (default) | Google Drive Trigger | Google Drive → Download |
| Dropbox | Dropbox Trigger | Dropbox → Download |
| Local folder (self-hosted n8n) | Local File Trigger | — (binary already present) |
| OneDrive | Microsoft OneDrive Trigger | OneDrive → Download |

Everything from **Only Images** onward is source-agnostic.

## 6. The `/api/ingest` contract

Request:

```json
POST /api/ingest
x-webhook-secret: <secret>
{ "image_base64": "...", "mime_type": "image/jpeg", "file_name": "IMG_2041.jpg" }
```

Success response (abridged):

```json
{
  "fabric": { "id": "…", "fabric_code": "BWR01", "review_status": "approved" },
  "extraction": { "confidence_score": 96, "mill_name": "Orbit Exports", "missing_fields": [] },
  "image": { "storage_path": "mills/orbit-exports/fabrics/BWR01/images/IMG_2041.jpg" },
  "similar_count": 4
}
```

Errors worth handling: `401` bad/missing secret · `422 MILL_NOT_RESOLVED` (label's mill name didn't match any active mill — add the mill or fix the label, then re-drop the photo) · `502 EXTRACTION_ERROR` (OpenAI failure; n8n's retry-on-fail covers transient cases).

## 7. Testing without n8n

```bash
IMG=$(base64 -i hanger.jpg)
curl -X POST http://localhost:3000/api/ingest \
  -H "x-webhook-secret: $N8N_WEBHOOK_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$IMG\",\"mime_type\":\"image/jpeg\",\"file_name\":\"hanger.jpg\"}"
```
