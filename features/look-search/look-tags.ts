import { visualTags } from '@/lib/config/visual-tags.config';

/**
 * A photo search lives in the URL as ?look=pattern:floral,colour:navy,use:shirts
 * so removing a chip, paginating or sharing the link never repeats the AI call.
 * Pure helpers, used by the server page and the browser chips alike.
 */

const USE_TAG = /^use:[a-z][a-z -]{1,39}$/;

/** A tag is valid if it is in the visual vocabulary, or a plausible "use:" tag. */
export function isLookTag(tag: string): boolean {
  if (USE_TAG.test(tag)) return true;
  const [group, value] = tag.split(':');
  return (visualTags as Record<string, readonly string[]>)[group]?.includes(value) ?? false;
}

export function parseLook(param: string | null | undefined): string[] {
  const tags = (param ?? '').split(',').map((t) => t.trim()).filter(isLookTag);
  return [...new Set(tags)].slice(0, 30);
}

export function formatLook(tags: string[]): string {
  return tags.join(',');
}

/** Chip text: "floral", "for shirts". */
export function lookLabel(tag: string): string {
  const [group, value] = tag.split(':');
  return group === 'use' ? `for ${value}` : value;
}
