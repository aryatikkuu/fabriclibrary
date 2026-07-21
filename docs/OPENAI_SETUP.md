# OpenAI Setup

## 1. Key

Create an API key at [platform.openai.com](https://platform.openai.com/api-keys) → put it in `.env.local` / Vercel env as `OPENAI_API_KEY`. The key is only used server-side (`lib/openai.ts`).

## 2. Where AI is used

| Use | Entry point | Prompt file |
|---|---|---|
| Hanger label extraction (Vision) | `features/ai-extraction/extraction.service.ts` | `features/ai-extraction/prompts/fabric-extraction.prompt.ts` |
| Search assistant (NL → filters) | `app/api/assistant/route.ts` | `features/ai-extraction/prompts/search-assistant.prompt.ts` |

Model: **`gpt-5.4-nano`** (cheapest with vision), `response_format: json_object`, `temperature: 0` (deterministic extraction). The model name is a constant in `lib/openai.ts` — change it in one place to swap models.

## 3. The extraction contract

The model is instructed to return exactly this JSON shape (and nothing else):

```json
{
  "mill_name": "", "fabric_code": "", "fabric_name": "", "fabric_type": "",
  "composition": "", "gsm": null, "width": "", "color": "", "color_family": "",
  "finish": "", "season": "", "technical_notes": "", "qr_code_value": "",
  "confidence_score": 0, "missing_fields": [], "extraction_notes": ""
}
```

The response is then **validated by Zod** (`extraction.schema.ts`): defaults applied, GSM coerced from strings like `"180 GSM"` and bounded to a plausible range, confidence clamped to 0–100, `missing_fields` recomputed server-side from the core field list. Invalid output → `extraction_status: failed` in `ai_extraction_logs`, never a bad DB row.

## 4. Cost & performance

**gpt-5.4-nano pricing:**
- Input: **$0.20/M tokens**
- Output: **$1.25/M tokens**
- Per hanger: ~**$0.0003** (one photo ≈ 1–2k tokens)
- 1,000 photos: ~**$0.30**

vs gpt-4o ($0.005/photo, $5/1000 photos) = **16x cheaper**.

**Performance:**
- Latency: 5–12s per image
- Quality on structured labels: ⭐⭐⭐⭐⭐ (excellent — this is text recognition)
- Edge cases: Blurry/sideways/artistic hangers may fail more than gpt-4o, but industrial labels are rock-solid

**Every raw response is stored** in `ai_extraction_logs.raw_ai_response`, so you can re-validate historical runs after prompt changes without re-paying.

## 5. Confidence threshold

`AI_CONFIDENCE_THRESHOLD` (default **75**) decides `approved` vs `needs_review`. Tune it after a few dozen real hangers:

- Too many wrong fields slipping through → raise it.
- Review queue full of fine records → lower it.

## 6. If you need better quality

Swap the model in `lib/openai.ts`:

| Model | Input | Output | Per photo | Use case |
|---|---|---|---|---|
| gpt-5.4-nano | $0.20/M | $1.25/M | $0.0003 | **← Current (cheap)** |
| gpt-5.4-mini | $0.75/M | $4.50/M | $0.001 | Better on edge cases |
| gpt-5.4 | $2.50/M | $15.00/M | $0.004 | Strongest |

Just change one line:
```typescript
// lib/openai.ts, line ~31
model: options.model ?? 'gpt-5.4-mini',  // or gpt-5.4
```

## 7. Improving extraction quality

1. Edit the prompt file (it's versionable code) — e.g. add your mills' label layouts as examples.
2. Photograph hangers straight-on, label filling the frame, even light.
3. Use **Re-run AI** in the Review Queue after a prompt change to re-extract a fabric from its stored image.
