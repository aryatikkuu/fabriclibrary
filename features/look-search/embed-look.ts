import { openAiEmbed } from '@/lib/openai';
import { lookSearch } from '@/lib/config/visual-tags.config';

/**
 * Embedding of the AI's description of a buyer's photo (the ?lookNote= in the
 * URL). Paging through results or changing a filter re-renders the page with
 * the same note, so recent notes are kept in memory instead of re-embedded.
 */
const cache = new Map<string, number[]>();
const CACHE_SIZE = 500;

export async function embedLookNote(note: string): Promise<number[] | undefined> {
  const text = note.trim();
  if (!text || lookSearch.embeddingWeight <= 0) return undefined;

  const hit = cache.get(text);
  if (hit) return hit;
  try {
    const [embedding] = await openAiEmbed([text], lookSearch.embeddingModel);
    if (cache.size >= CACHE_SIZE) cache.delete(cache.keys().next().value!);
    cache.set(text, embedding);
    return embedding;
  } catch (error) {
    // Search still works on tags alone; don't fail the page over the extra signal.
    console.error('embedLookNote failed:', error);
    return undefined;
  }
}
