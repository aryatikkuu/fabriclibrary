import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildServices } from '@/lib/container';
import { handleApiError } from '@/lib/api-helpers';
import { openAiChatJson } from '@/lib/openai';
import { SEARCH_ASSISTANT_SYSTEM_PROMPT } from '@/features/ai-extraction/prompts/search-assistant.prompt';
import { millsConfig } from '@/lib/config/mills.config';

const assistantRequestSchema = z.object({ question: z.string().min(2).max(500) });

const assistantFiltersSchema = z.object({
  q: z.string().default(''),
  millSlug: z.string().default(''),
  fabricType: z.string().default(''),
  colorFamily: z.string().default(''),
  gsmMin: z.number().nullable().default(null),
  gsmMax: z.number().nullable().default(null),
  similarToCode: z.string().default(''),
  answer: z.string().default(''),
});

/**
 * POST /api/assistant — conversational fabric search.
 * Natural language → structured filters (validated) → FabricService search.
 */
export async function POST(request: NextRequest) {
  try {
    const { question } = assistantRequestSchema.parse(await request.json());

    const systemPrompt = SEARCH_ASSISTANT_SYSTEM_PROMPT.replace(
      '{{MILLS}}',
      millsConfig.map((m) => `${m.name} -> ${m.slug}`).join('; '),
    );

    const { parsed } = await openAiChatJson({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
      maxTokens: 400,
    });
    const filters = assistantFiltersSchema.parse(parsed);

    const { fabricService, similarityService } = buildServices(await createClient());

    // "Alternatives to BWR01" — resolve the code, return its similar fabrics.
    if (filters.similarToCode) {
      const source = await fabricService.getByCode(filters.similarToCode);
      if (source) {
        const similar = await similarityService.getTopSimilar(source.id);
        return NextResponse.json({
          answer: filters.answer || `Alternatives to ${source.fabric_code}`,
          mode: 'similar',
          source,
          items: similar.map((s) => s.fabric),
        });
      }
    }

    const result = await fabricService.search({
      q: filters.q || undefined,
      millSlug: filters.millSlug || undefined,
      fabricType: filters.fabricType || undefined,
      colorFamily: filters.colorFamily || undefined,
      gsmMin: filters.gsmMin ?? undefined,
      gsmMax: filters.gsmMax ?? undefined,
      pageSize: 12,
    });

    return NextResponse.json({
      answer: filters.answer || 'Here is what I found.',
      mode: 'search',
      items: result.items,
      total: result.total,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
