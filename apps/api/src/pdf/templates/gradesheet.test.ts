import { describe, expect, it } from 'vitest';
import { rowHeightMm, slashDate } from './gradesheet.js';

describe('slashDate', () => {
  it('formats ISO dates like the official grade sheet (M/D/YYYY)', () => {
    expect(slashDate('2065-12-26')).toBe('12/26/2065');
    expect(slashDate('2009-04-08')).toBe('4/8/2009');
    expect(slashDate(null)).toBe('');
  });
});

describe('rowHeightMm', () => {
  it('uses the official 8.6 mm rows for up to 12 rows (six Th + In subjects)', () => {
    expect(rowHeightMm(12)).toBe(8.6);
    expect(rowHeightMm(6)).toBe(8.6);
  });
  it('shrinks rows so more subjects still end above the footer', () => {
    expect(rowHeightMm(14)).toBe(7.37);
    expect(14 * rowHeightMm(14)).toBeLessThanOrEqual(103.2);
    expect(16 * rowHeightMm(16)).toBeLessThanOrEqual(103.2);
  });
});
