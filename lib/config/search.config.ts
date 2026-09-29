/** Filter options surfaced in the search UI. Extend here, not in components. */
export const searchConfig = {
  fabricTypes: [
    'Single Jersey', 'Interlock', 'Rib', 'Pique', 'Fleece', 'French Terry',
    'Plain Weave', 'Twill Weave', 'Satin Weave', 'Jacquard', 'Dobby', 'Crepe',
  ],
  colorFamilies: [
    'White', 'Black', 'Grey', 'Blue', 'Green', 'Red', 'Pink',
    'Orange', 'Yellow', 'Brown', 'Purple', 'Multi',
  ],
  /**
   * Fibre filter: each choice matches every way labels write that fibre
   * (case-insensitive regular expressions; \m and \M are Postgres word
   * boundaries, so "Poly" matches but "Polyamide" doesn't count as polyester).
   * Most-used first.
   */
  fibres: {
    Cotton: ['cotton', '\\mctn\\M'],
    Polyester: ['polyester', '\\mpoly\\M'],
    Elastane: ['elastane', 'spandex', 'spndx', 'lycra'],
    Viscose: ['viscose', 'rayon'],
    Metallic: ['metallic'],
    Wool: ['wool'],
    Linen: ['linen'],
    Modal: ['modal'],
    Lyocell: ['lyocell', 'tencel'],
    Nylon: ['nylon', 'polyamide'],
    Acrylic: ['acrylic'],
    Bamboo: ['bamboo'],
    Silk: ['silk'],
  } as Record<string, readonly string[]>,
  gsm: { min: 40, max: 600, step: 10 },
  sortOptions: [
    { value: 'newest', label: 'Newest first' },
    { value: 'gsm_asc', label: 'GSM — light to heavy' },
    { value: 'gsm_desc', label: 'GSM — heavy to light' },
    { value: 'code', label: 'Fabric code A–Z' },
  ],
} as const;
