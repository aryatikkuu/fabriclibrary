import { describe, it, expect } from 'vitest';
import { readableComposition } from '@/features/fabrics/composition';

describe('readableComposition', () => {
  it.each([
    ['W/P/ELA 52/43/05', '52% Wool, 43% Polyester, 5% Elastane'],
    ['P/V/ELA (63/34/03)', '63% Polyester, 34% Viscose, 3% Elastane'],
    ['W/P ELA 52/43/05', '52% Wool, 43% Polyester, 5% Elastane'], // stray space
    ['P/V/EL A 74/21/05', '74% Polyester, 21% Viscose, 5% Elastane'], // ELA split by the scan
    ['PV 65/35', '65% Polyester, 35% Viscose'], // codes run together
    ['P/VELA 62/33/05', '62% Polyester, 33% Viscose, 5% Elastane'],
    ['C/ELA 97%/03', '97% Cotton, 3% Elastane'],
    ['W/P/N/El = 39/32/25/04', '39% Wool, 32% Polyester, 25% Nylon, 4% Elastane'],
    ['COTTON:Elastane / 97:3', '97% Cotton, 3% Elastane'], // mill ticket style: words, then ratio
    ['COTTON : VISCOSE / 57:43', '57% Cotton, 43% Viscose'],
    ['LIN:COT-80:20', '80% Linen, 20% Cotton'],
    ['80% LYO, 10% VIS, 10% COT', '80% Lyocell, 10% Viscose, 10% Cotton'],
    ['65%Ctn 35%Poly', '65%Cotton 35%Polyester'], // other spellings → one word per fibre
    ['97% Cotton 3% Spandex', '97% Cotton 3% Elastane'],
    ['80% Cotton 20% Rec Poly', '80% Cotton 20% Rec Polyester'],
  ])('writes out %s', (raw, expected) => {
    expect(readableComposition(raw)).toBe(expected);
  });

  it.each([
    ['60% Cotton 40% Modal', 'already in words'],
    ['100% Polyester', 'Poly is only replaced as a whole word'],
    ['P/W/EL 63/43/03', 'adds up to 109'],
    ['PV/ELIA 76/23/0', 'a 0 — a digit was cut off'],
    ['W/P/ELA 51/47', 'a number missing'],
    ['C/L 97/3', 'L could be linen or Lycra'],
    ['P/V/A 64/34/02', 'lone A is a broken-up ELA'],
    ['P/E/ELA 74/23/3', 'the same fibre twice'],
    ['C/P/V/ELA', 'no numbers'],
  ])('leaves %s as printed (%s)', (raw) => {
    expect(readableComposition(raw)).toBe(raw);
  });
});
