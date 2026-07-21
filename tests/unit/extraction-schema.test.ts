import { describe, it, expect } from 'vitest';
import { extractionResultSchema } from '@/features/ai-extraction/extraction.schema';

describe('extractionResultSchema', () => {
  it('accepts a well-formed extraction', () => {
    const parsed = extractionResultSchema.parse({
      mill_name: 'Orbit Exports',
      fabric_code: 'BWR01',
      fabric_name: 'Bridal Satin',
      fabric_type: 'Satin Weave',
      composition: '100% Polyester',
      gsm: 190,
      width: '58 inch',
      color: 'Ivory',
      color_family: 'White',
      finish: 'High lustre',
      season: 'AW',
      technical_notes: '',
      qr_code_value: 'ORB-BWR01',
      confidence_score: 96,
      missing_fields: [],
      extraction_notes: 'Label fully legible',
    });
    expect(parsed.fabric_code).toBe('BWR01');
    expect(parsed.gsm).toBe(190);
  });

  it('fills defaults for missing fields instead of failing', () => {
    const parsed = extractionResultSchema.parse({});
    expect(parsed.mill_name).toBe('');
    expect(parsed.gsm).toBeNull();
    expect(parsed.confidence_score).toBe(0);
    expect(parsed.missing_fields).toEqual([]);
  });

  it('coerces a stringy GSM like "180 GSM" to a number', () => {
    const parsed = extractionResultSchema.parse({ gsm: '180 GSM' });
    expect(parsed.gsm).toBe(180);
  });

  it('nulls out implausible GSM values', () => {
    expect(extractionResultSchema.parse({ gsm: 0 }).gsm).toBeNull();
    expect(extractionResultSchema.parse({ gsm: 99999 }).gsm).toBeNull();
    expect(extractionResultSchema.parse({ gsm: 'unknown' }).gsm).toBeNull();
  });

  it('clamps rejects out-of-range confidence', () => {
    expect(() => extractionResultSchema.parse({ confidence_score: 140 })).toThrow();
    expect(() => extractionResultSchema.parse({ confidence_score: -3 })).toThrow();
  });

  it('coerces a numeric-string confidence', () => {
    expect(extractionResultSchema.parse({ confidence_score: '85' }).confidence_score).toBe(85);
  });
});
