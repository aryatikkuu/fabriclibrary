// Relative + .ts so scripts (node --experimental-strip-types) can import this too.
import { fibreCodes } from '../../lib/config/fibres.config.ts';
import { searchConfig } from '../../lib/config/search.config.ts';

/**
 * Hangers often print the blend as codes: "W/P/ELA 52/43/05". Buyers search
 * for words ("wool"), so these are written out in full:
 *   "W/P/ELA 52/43/05"  →  "52% Wool, 43% Polyester, 5% Elastane"
 *
 * Deliberately strict — the result replaces what the label said, so it must
 * be right. A composition is converted only when
 *   - it is codes followed by numbers and nothing else,
 *   - every code is in lib/config/fibres.config.ts, each fibre named once,
 *   - there is exactly one number per fibre, none of them 0 (a cut-off digit), and
 *   - the numbers add up to 100 (±3, for labels that round).
 * Anything else (already in words, typos, unknown codes) comes back as it was.
 */
export function readableComposition(raw: string): string {
  const parts = raw.trim().match(/^([A-Za-z][A-Za-z\s/,\-]*?)\s*[:=]?\s*\(?\s*(\d+(?:\s*%?\s*[/,\-]\s*\d+)+)\s*%?\s*\)?$/);
  if (!parts) return raw;

  const percents = parts[2].split(/[^\d]+/).filter(Boolean).map(Number);
  const total = percents.reduce((sum, n) => sum + n, 0);
  if (Math.abs(total - 100) > 3 || percents.includes(0)) return raw;

  // Spaces inside the codes are scanning noise ("EL A", "W/P ELA"); slashes are real.
  const segments = parts[1].replace(/\s+/g, '').split(/[/,\-]+/).filter(Boolean);
  const fibres = splitSegments(segments.map((s) => s.toUpperCase()), percents.length);
  if (!fibres) return raw;

  return fibres.map((fibre, i) => `${percents[i]}% ${fibre}`).join(', ');
}

/**
 * Read each segment as one or more known codes ("PV" = P + V, "VELA" = V +
 * ELA), so that the whole thing gives exactly `count` fibres. null when no
 * reading works or when more than one does (ambiguous, so leave it alone).
 */
function splitSegments(segments: string[], count: number): string[] | null {
  const readings = segments.reduce<string[][]>(
    (sofar, segment) => sofar.flatMap((prefix) => readSegment(segment).map((codes) => [...prefix, ...codes])),
    [[]],
  );
  const fitting = readings.filter(
    (codes) => codes.length === count && new Set(codes.map((c) => fibreCodes[c])).size === count,
  );
  const distinct = new Set(fitting.map((codes) => codes.map((c) => fibreCodes[c]).join('|')));
  return distinct.size === 1 ? fitting[0].map((c) => fibreCodes[c]) : null;
}

/** Every way to write one segment as a run of known codes. */
function readSegment(segment: string): string[][] {
  if (segment === '') return [[]];
  const ways: string[][] = [];
  for (let end = 1; end <= segment.length; end++) {
    const head = segment.slice(0, end);
    if (!fibreCodes[head]) continue;
    for (const rest of readSegment(segment.slice(end))) ways.push([head, ...rest]);
  }
  return ways;
}

/**
 * The Fibre filter's value as a case-insensitive regular expression for the
 * composition column (PostgREST imatch; ~* in match_fabrics_by_look, 0013).
 * A fibre from searchConfig.fibres matches all its spellings ("Cotton" →
 * cotton or Ctn); any other text is matched literally, so a URL can't send
 * its own pattern.
 */
export function compositionPattern(value: string): string {
  const spellings = searchConfig.fibres[value];
  if (spellings) return `(${spellings.join('|')})`;
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
