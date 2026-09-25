/**
 * Label re-read + visual tagging, one call per fabric photo
 * (scripts/verify-and-tag.mjs).
 *
 * The label is re-read BLIND — the model is never shown the stored values, so
 * it cannot simply agree with them; the script compares afterwards.
 * Visual tags must come from the supplied vocabulary (lib/config/visual-tags.config.ts).
 */
import { buildTagInstructions } from './fabric-tags.prompt.ts';

export function buildFabricVerifyPrompt(vocabulary: Record<string, readonly string[]>): string {
  return `You are checking a fabric library. The photo shows a fabric sample on a hanger / swatch card with a printed label.

1. LABEL — read the printed label exactly as printed. Copy codes character for character (keep dashes, slashes, spaces).
   fabric_code is the value printed next to "Lot #", "PD#", "Quality", "Article", "Art. No", "Style" or "Order"
   — NOT the colour name/number, NOT the barcode digits, NOT the price. Put that field's name in code_field.
   Some labels (e.g. Orbit Exports) print a long SKU such as "PBTA45191M012400" plus a short quality number
   such as "45191": put the long one in fabric_code and the short one in quality_number.
   gsm is the number only (e.g. 215 for "Actual GSM 215"; the GSM value, not GLM).
   If several labels are visible, read the main one (the largest or the one on the main swatch) and set label_count.
   Use "" / null for anything not printed or not readable. Never guess.

2. FABRIC — describe only the cloth itself. Ignore the hanger, header card, labels, stickers, desk and background.
${buildTagInstructions(vocabulary)}
   If the photo shows several different fabrics, tag what they have in common and set multi_fabric true.

3. description: one sentence (max 30 words) a buyer could search with, e.g.
   "Navy and cream large-scale floral jacquard with a soft sheen and heavy woven hand."

Return JSON only:
{
  "label": { "fabric_code": "", "code_field": "", "quality_number": "", "fabric_name": "", "composition": "", "gsm": null, "width": "", "color": "" },
  "label_count": 1,
  "label_readable": true,
  "tags": { "pattern": [], "detail": [], "scale": [], "colour": [], "texture": [], "finish": [], "construction": [], "technique": [] },
  "multi_fabric": false,
  "description": ""
}`;
}
