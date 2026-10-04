import { describe, expect, it } from 'vitest';
import { catalogSubject, NEB_SUBJECT_CATALOG } from './catalog.js';

describe('NEB subject catalog', () => {
  it('has unique NEB codes across both grades', () => {
    const codes = NEB_SUBJECT_CATALOG.flatMap((s) => [s.th.code, s.in.code]);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('uses internal code = theory code + 1', () => {
    for (const s of NEB_SUBJECT_CATALOG) expect(Number(s.in.code)).toBe(Number(s.th.code) + 1);
  });

  it('matches the Grade 12 routine 2083 theory codes', () => {
    const g12 = Object.fromEntries(NEB_SUBJECT_CATALOG.filter((s) => s.grade === 12).map((s) => [s.familyCode, s.th.code]));
    expect(g12).toEqual({
      NEP: '0021', ENG: '0041', SOC: '0061', MATH: '0081', PHY: '1021', ACC: '1041',
      BIO: '2021', BUS: '2161', CHEM: '3021', ECO: '3041', CS: '4281', HM: '4401',
    });
  });

  it('gives each subject the NEB credit-hour total (Nepali 3, English 4, others 5)', () => {
    for (const s of NEB_SUBJECT_CATALOG) {
      const total = s.th.creditHour + s.in.creditHour;
      expect(total).toBe(s.familyCode === 'NEP' ? 3 : s.familyCode === 'ENG' ? 4 : 5);
    }
  });

  it('has the same families in Grade 11 and 12, so promotion can map them', () => {
    for (const s of NEB_SUBJECT_CATALOG.filter((x) => x.grade === 11)) {
      expect(catalogSubject(12, s.familyCode)).toBeDefined();
    }
  });
});
