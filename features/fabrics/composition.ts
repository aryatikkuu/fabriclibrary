// Relative + .ts so scripts (node --experimental-strip-types) can import this too.
import { fibreCodes, fibreSpellings } from '../../lib/config/fibres.config.ts';

/**
 * Compositions are saved the way buyers search for them:
 *   - hanger codes written out: "W/P/ELA 52/43/05" → "52% Wool, 43% Polyester, 5% Elastane"
 *   - one word per fibre: "65% Ctn 35% Poly" → "65% Cotton 35% Polyester"
 *     (fibreSpellings in lib/config/fibres.config.ts)
 * Runs on every import (extraction schema) and over the library with
 * `npm run compositions`.
 */
export function readableComposition(raw: string): string {
  return standardSpellings(writeOutCodes(raw));
}

/** Other spellings of a fibre ("Ctn", "Spandex") → the library's word. Whole words only. */
function standardSpellings(text: string): string {
  return text.replace(/[A-Za-z]+/g, (word) => {
    const match = Object.keys(fibreSpellings).find((k) => k.toLowerCase() === word.toLowerCase());
    return match ? fibreSpellings[match] : word;
  });
}

/**
 * Deliberately strict — the result replaces what the label said, so it must
 * be right. Codes are written out only when
 *   - it is codes followed by numbers and nothing else,
 *   - every code is in lib/config/fibres.config.ts, each fibre named once,
 *   - there is exactly one number per fibre, none of them 0 (a cut-off digit), and
 *   - the numbers add up to 100 (±3, for labels that round).
 * Anything else (already in words, typos, unknown codes) comes back as it was.
 */
function writeOutCodes(raw: string): string {
  const parts = raw.trim().match(/^([A-Za-z][A-Za-z\s:/,\-]*?)\s*[:=]?\s*\(?\s*(\d+(?:\s*%?\s*[:/,\-]\s*\d+)+)\s*%?\s*\)?$/);
  if (!parts) return raw;

  const percents = parts[2].split(/[^\d]+/).filter(Boolean).map(Number);
  const total = percents.reduce((sum, n) => sum + n, 0);
  if (Math.abs(total - 100) > 3 || percents.includes(0)) return raw;

  // Spaces inside the codes are scanning noise ("EL A", "W/P ELA"); slashes are real.
  const segments = parts[1].replace(/\s+/g, '').split(/[:/,\-]+/).filter(Boolean);
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
