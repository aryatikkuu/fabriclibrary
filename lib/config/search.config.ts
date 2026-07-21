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
  gsm: { min: 40, max: 600, step: 10 },
  sortOptions: [
    { value: 'newest', label: 'Newest first' },
    { value: 'gsm_asc', label: 'GSM — light to heavy' },
    { value: 'gsm_desc', label: 'GSM — heavy to light' },
    { value: 'code', label: 'Fabric code A–Z' },
  ],
} as const;
