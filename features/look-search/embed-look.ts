import { openAiEmbed } from '@/lib/openai';
import { lookSearch } from '@/lib/config/visual-tags.config';

/**
 * Embedding of the AI's one-line description of a buyer's photo. Called once
 * per photo search (app/api/search/look) and stored with it; the results
 * page reads the stored copy.
 */
export async function embedLookDescription(description: string): Promise<number[] | undefined> {
  const text = description.trim();
  if (!text || lookSearch.embeddingWeight <= 0) return undefined;
  try {
    const [embedding] = await openAiEmbed([text], lookSearch.embeddingModel);
    return embedding;
  } catch (error) {
    // Search still works on tags alone; don't fail the request over the extra signal.
    console.error('embedLookDescription failed:', error);
    return undefined;
  }
}
