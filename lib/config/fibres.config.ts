/**
 * Fibre codes printed on mill hangers ("W/P/ELA 52/43/05") and the words
 * they stand for. Used by features/fabrics/composition.ts to write
 * compositions out in full, so "wool" finds "W/P/ELA".
 *
 * Only unambiguous codes belong here — a code that could mean two fibres
 * (S: silk or spandex? L: linen or Lycra — "C/L 97/3" is cotton-Lycra;
 * E or A on their own, which the label reader leaves behind when it breaks
 * up ELA — "P/V/A 64/34/02") is left out, and compositions using it stay as
 * printed. The EL… spellings are how the label reader misreads ELA.
 */
export const fibreCodes: Record<string, string> = {
  C: 'Cotton',
  COT: 'Cotton',
  COTT: 'Cotton',
  COTTON: 'Cotton',
  CO: 'Cotton',
  CTN: 'Cotton',
  P: 'Polyester',
  PES: 'Polyester',
  POLY: 'Polyester',
  V: 'Viscose',
  VISCOSE: 'Viscose',
  VI: 'Viscose',
  W: 'Wool',
  WO: 'Wool',
  LI: 'Linen',
  LIN: 'Linen',
  LINEN: 'Linen',
  N: 'Nylon',
  NY: 'Nylon',
  PA: 'Nylon',
  M: 'Modal',
  MODAL: 'Modal',
  LYOCELL: 'Lyocell',
  BAMBOO: 'Bamboo',
  HEMP: 'Hemp',
  ELASTANE: 'Elastane',
  SPDX: 'Elastane',
  SPANDEX: 'Elastane',
  MD: 'Modal',
  EA: 'Elastane',
  EL: 'Elastane',
  ELA: 'Elastane',
  ELAA: 'Elastane',
  ELAE: 'Elastane',
  ELAS: 'Elastane',
  ELDA: 'Elastane',
  ELIA: 'Elastane',
  ELLA: 'Elastane',
  EDA: 'Elastane',
  LA: 'Elastane',
  LY: 'Elastane',
  SP: 'Elastane',
};

/**
 * Other ways labels write a fibre in words, and the one word the library
 * uses. Compositions are saved with the standard word, so a search or the
 * Fibre filter for "Cotton" also finds labels that said "Ctn".
 */
export const fibreSpellings: Record<string, string> = {
  Ctn: 'Cotton',
  Poly: 'Polyester',
  Spandex: 'Elastane',
  Spndx: 'Elastane',
  Spdx: 'Elastane',
  Lycra: 'Elastane',
  Rayon: 'Viscose',
  Tencel: 'Lyocell',
  Polyamide: 'Nylon',
};
