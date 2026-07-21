import { ExtractionError } from '@/lib/errors';

interface VisionMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'low' | 'high' | 'auto' };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | VisionMessageContent[];
}

/**
 * Thin wrapper over the OpenAI Chat Completions API.
 * Centralised so the model, retries and JSON handling live in one place.
 */
export async function openAiChatJson(options: {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<{ raw: string; parsed: unknown }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ExtractionError('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? 'gpt-5.4-nano',
      max_tokens: options.maxTokens ?? 1200,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: options.messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ExtractionError(`OpenAI request failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? '';
  if (!raw) throw new ExtractionError('OpenAI returned an empty response');

  try {
    return { raw, parsed: JSON.parse(raw.replace(/```json|```/g, '').trim()) };
  } catch {
    throw new ExtractionError('OpenAI response was not valid JSON');
  }
}
