/**
 * Visual-tag instructions shared by the library tagger (fabric-verify.prompt.ts)
 * and photo search (buildLookPrompt below). Search only works if a customer's
 * photo is described with exactly the same rules as the library was, so these
 * rules must live in one place.
 */
export function buildTagInstructions(vocabulary: Record<string, readonly string[]>): string {
  const lists = Object.entries(vocabulary)
    .map(([group, values]) => `- ${group}: ${values.join(', ')}`)
    .join('\n');

  return `   Choose tags ONLY from these lists (use the exact words):
${lists}
   pattern: 1-2 values. scale: 1 value ("none" for solid). colour: 1-4 values, dominant first.
   texture, finish, technique: 0-2 values each. construction: 1 value.`;
}

/**
 * Photo search (app/api/search/look): turn a customer's photo and/or a note
 * ("for summer shirts") into the library's tags. Output is filtered against
 * the vocabulary afterwards, so the note cannot inject arbitrary tags.
 */
export function buildLookPrompt(options: {
  vocabulary: Record<string, readonly string[]>;
  useTags: readonly string[];
  hasImage: boolean;
  note: string;
}): string {
  const { vocabulary, useTags, hasImage, note } = options;

  const fabric = hasImage
    ? `1. FABRIC — the photo shows a fabric the customer wants to find. Describe only the cloth itself.
   Ignore hangers, labels, people, garments' cut, furniture and background.
${buildTagInstructions(vocabulary)}
   If the photo shows several fabrics, tag the main one.`
    : `1. FABRIC — there is no photo. Only fill tags the customer's note clearly states
   (e.g. "navy floral" -> colour navy, pattern floral). Leave everything else empty.
${buildTagInstructions(vocabulary)}`;

  const use = note
    ? `2. USE — the customer wrote: """${note}"""
   Pick 0-5 end-use tags from this list that match what they want the fabric for
   (include close synonyms, e.g. shirts + shirting): ${useTags.join(', ')}
   Also apply any fabric words in the note to step 1.`
    : `2. USE — no note given; return an empty list.`;

  return `You help buyers search a fabric library.

${fabric}

${use}

3. description: one short phrase of what you searched for, e.g. "Navy large floral jacquard for dresses".

Return JSON only:
{
  "tags": { "pattern": [], "scale": [], "colour": [], "texture": [], "finish": [], "construction": [], "technique": [] },
  "use": [],
  "description": ""
}`;
}
