import { openAiChatJson } from '@/lib/openai';
import { visualTags } from '@/lib/config/visual-tags.config';
import { buildLookPrompt } from '@/features/ai-extraction/prompts/fabric-tags.prompt';
import { isLookTag } from './look-tags';

/** Same model that tagged the library, so a photo is described the same way. */
const LOOK_MODEL = 'gpt-5.4-mini';

/**
 * One AI call: a buyer's photo and/or note → library tags.
 * Anything outside the vocabulary (or the offered use tags) is dropped,
 * so neither the model nor the note can put arbitrary text into a query.
 */
export async function readLook(options: {
  imageDataUrl: string | null;
  note: string;
  useTags: string[];
}): Promise<{ look: string[]; description: string }> {
  const { imageDataUrl, note, useTags } = options;
  const prompt = buildLookPrompt({ vocabulary: visualTags, useTags, hasImage: !!imageDataUrl, note });

  const { parsed } = await openAiChatJson({
    model: LOOK_MODEL,
    maxTokens: 1500,
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        ...(imageDataUrl ? [{ type: 'image_url' as const, image_url: { url: imageDataUrl, detail: 'high' as const } }] : []),
      ],
    }],
  });

  const out = parsed as { tags?: Record<string, unknown>; use?: unknown; description?: unknown };
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

  const visual = Object.keys(visualTags).flatMap((group) => list(out.tags?.[group]).map((v) => `${group}:${v}`));
  const use = list(out.use).filter((t) => useTags.includes(t)).map((t) => `use:${t}`);

  return {
    look: [...new Set([...visual, ...use])].filter(isLookTag),
    // Plain single line: no control characters, no markup, capped.
    description: typeof out.description === 'string'
      ? out.description.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      : '',
  };
}
