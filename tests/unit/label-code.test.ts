import { describe, it, expect } from 'vitest';
import { cleanLabelCode } from '@/features/look-search/read-look';

describe('cleanLabelCode', () => {
  it('keeps a code as printed', () => {
    expect(cleanLabelCode('PFTND2325W071400')).toBe('PFTND2325W071400');
    expect(cleanLabelCode('  KIM - 50284 ')).toBe('KIM - 50284');
    expect(cleanLabelCode('77928-#19-RAISING')).toBe('77928-#19-RAISING');
  });

  it('drops anything that could break out of a search filter', () => {
    expect(cleanLabelCode('D2325,fabric_name.ilike.%a%')).not.toMatch(/[,()%_]/);
    expect(cleanLabelCode('50277)(')).toBe('50277');
  });

  it('refuses words, empties and non-strings: a code has a digit and a sensible length', () => {
    expect(cleanLabelCode('Banswara')).toBe('');
    expect(cleanLabelCode('12')).toBe('');
    expect(cleanLabelCode('1'.repeat(41))).toBe('');
    expect(cleanLabelCode(undefined)).toBe('');
    expect(cleanLabelCode(['PFTND2325'])).toBe('');
  });
});
