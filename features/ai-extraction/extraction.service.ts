import { openAiChatJson } from '@/lib/openai';
import { appConfig } from '@/lib/config/app.config';
import { millsConfig } from '@/lib/config/mills.config';
import {
  extractionResultSchema,
  CORE_EXTRACTION_FIELDS,
  type ValidatedExtraction,
} from './extraction.schema';
import {
  FABRIC_EXTRACTION_SYSTEM_PROMPT,
  FABRIC_EXTRACTION_USER_PROMPT,
} from './prompts/fabric-extraction.prompt';

export interface ExtractionOutcome {
  result: ValidatedExtraction;
  raw: string;
  needsReview: boolean;
  status: 'success' | 'partial';
}

/**
 * AIExtractionService — the single gateway between OpenAI Vision and the
 * database. Image in, validated structured JSON out. Raw model output never
 * reaches storage without passing the Zod contract.
 */
export class AIExtractionService {
  constructor(
    private readonly confidenceThreshold: number = appConfig.aiConfidenceThreshold,
  ) {}

  /** Extract fabric data from an image URL (signed/public Supabase URL or any reachable URL). */
  async extractFromImageUrl(imageUrl: string): Promise<ExtractionOutcome> {
    const userPrompt = FABRIC_EXTRACTION_USER_PROMPT.replace(
      '{{MILL_NAMES}}',
      millsConfig.map((m) => m.name).join(', '),
    );

    const { raw, parsed } = await openAiChatJson({
      messages: [
        { role: 'system', content: FABRIC_EXTRACTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
          ],
        },
      ],
    });

    const result = this.validate(parsed);
    const needsReview = result.confidence_score < this.confidenceThreshold;
    const status = result.missing_fields.length > 0 ? 'partial' : 'success';

    return { result, raw, needsReview, status };
  }

  /** Extract from a base64 data URI (used when n8n posts the file directly). */
  async extractFromBase64(base64: string, mimeType = 'image/jpeg'): Promise<ExtractionOutcome> {
    const dataUrl = base64.startsWith('data:') ? base64 : `data:${mimeType};base64,${base64}`;
    return this.extractFromImageUrl(dataUrl);
  }

  /** Validate model output and defensively recompute missing_fields. */
  validate(parsed: unknown): ValidatedExtraction {
    const result = extractionResultSchema.parse(parsed);

    const computedMissing = CORE_EXTRACTION_FIELDS.filter((field) => {
      const value = result[field];
      return value === null || value === '';
    });
    const missing = Array.from(new Set([...result.missing_fields, ...computedMissing]));

    return { ...result, missing_fields: missing };
  }
}
