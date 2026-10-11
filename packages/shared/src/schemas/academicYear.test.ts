import { describe, expect, it } from 'vitest';
import { academicYearNumber, academicYearSchema, isLaterAcademicYear } from './setup.js';

describe('academic year ordering', () => {
  it('reads the B.S. year from the name', () => {
    expect(academicYearNumber('2083')).toBe(2083);
  });

  it('knows which year is later', () => {
    expect(isLaterAcademicYear({ name: '2084' }, { name: '2083' })).toBe(true);
    expect(isLaterAcademicYear({ name: '2083' }, { name: '2084' })).toBe(false);
    expect(isLaterAcademicYear({ name: '2084' }, { name: '2084' })).toBe(false);
  });
});

describe('academic year validation', () => {
  it('accepts only a plain 4-digit B.S. year', () => {
    expect(academicYearSchema.safeParse({ name: '2084' }).success).toBe(true);
    expect(academicYearSchema.safeParse({ name: ' 2084 ' }).success).toBe(true);
    for (const name of ['2082/83', '2082-83', '84', '20845', 'Year 2084', '']) {
      expect(academicYearSchema.safeParse({ name }).success, name).toBe(false);
    }
  });

  it('rejects an end date before the start date', () => {
    const r = academicYearSchema.safeParse({ name: '2087', startDateAd: '2027-06-01', endDateAd: '2026-01-01' });
    expect(r.success).toBe(false);
  });

  it('accepts missing or ordered dates', () => {
    expect(academicYearSchema.safeParse({ name: '2087' }).success).toBe(true);
    expect(academicYearSchema.safeParse({ name: '2087', startDateAd: '2030-04-14', endDateAd: '2031-04-13' }).success).toBe(true);
  });
});
