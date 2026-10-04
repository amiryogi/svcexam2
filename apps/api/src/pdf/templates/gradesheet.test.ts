import { describe, expect, it } from 'vitest';
import { slashDate } from './gradesheet.js';

describe('slashDate', () => {
  it('formats ISO dates like the official grade sheet (M/D/YYYY)', () => {
    expect(slashDate('2065-12-26')).toBe('12/26/2065');
    expect(slashDate('2009-04-08')).toBe('4/8/2009');
    expect(slashDate(null)).toBe('');
  });
});
