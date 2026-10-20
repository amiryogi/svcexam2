import { describe, expect, it } from 'vitest';
import { DEFAULT_GRADESHEET_NOTE, fitPt, noteFontPt, rowHeightMm, slashDate } from './gradesheet.js';

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

describe('fitPt', () => {
  it('keeps the base size when the text fits', () => {
    expect(fitPt(33, 33, 12, 6.5)).toBe(12);
  });
  it('shrinks in half points, never below the minimum', () => {
    expect(fitPt(44, 33, 12, 6.5)).toBe(9);
    expect(fitPt(200, 33, 12, 6.5)).toBe(6.5);
  });
});

describe('noteFontPt', () => {
  it('prints the standard note at the official 14pt', () => {
    expect(noteFontPt(DEFAULT_GRADESHEET_NOTE)).toBe(14);
  });
  it('shrinks a long custom note so it fits above the page bottom', () => {
    const long = Array.from({ length: 8 }, () => 'Internal assessment includes project work, practicals and presentations.').join('\n');
    const pt = noteFontPt(long);
    expect(pt).toBeLessThan(14);
    expect(pt).toBeGreaterThanOrEqual(6);
  });
});
