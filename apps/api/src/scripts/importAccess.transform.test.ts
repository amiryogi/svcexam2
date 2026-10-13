import { describe, expect, it } from 'vitest';
import { normalizeBs, transformAccess } from './importAccess.transform.js';

const csv = {
  studentDetails: [
    '"StuId","Fname","MiddleName","LName","DOB(BS)","Gender","DOB(AD)","Stream"',
    '"1","AARYAN","THAPA","","12/26/2065","MALE","2009-04-08","Management"',
    '"14","DIWAKAR","THAPA","MAGAR","1/2/2066","MALE","","Science"',
  ].join('\n'),
  nebDetails: ['"StuId","RegNo","SymbolNo","RegSubs"', '"1","833270280001","12707223","0011; 0031"'].join('\n'),
  subject: [
    '"SubCode","SubName","CreditHour","FullMark","SubType"',
    '"0011","Comp. Nepali (Th)","2.25","75","Theory"',
    '"0012","Comp. Nepali (In)","0.75","25","Practical"',
  ].join('\n'),
  scores: ['"StuID","SubCode_Th","Score_Th","SubCode_In","Score_In"', '"1","0011","39","0012","19"'].join('\n'),
};

describe('transformAccess', () => {
  const result = transformAccess(csv);

  it('moves the surname out of MiddleName when LName is empty', () => {
    const s = result.students[0]!;
    expect([s.firstName, s.middleName, s.lastName]).toEqual(['Aaryan', null, 'Thapa']);
  });

  it('keeps a real middle name', () => {
    const s = result.students[1]!;
    expect([s.firstName, s.middleName, s.lastName]).toEqual(['Diwakar', 'Thapa', 'Magar']);
  });

  it('normalizes dates and fills A.D. from B.S.', () => {
    expect(result.students[0]).toMatchObject({ dobBs: '2065-12-26', dobAd: '2009-04-08' });
    expect(result.students[1]!.dobBs).toBe('2066-01-02');
    expect(result.students[1]!.dobAd).toMatch(/^2009-04-/);
  });

  it('maps NEB numbers, scores and admission numbers', () => {
    expect(result.students[0]).toMatchObject({
      admissionNo: 'SVI-0001',
      nebRegistrationNo: '833270280001',
      symbolNo: '12707223',
      scores: [{ thCode: '0011', thMarks: 39, inCode: '0012', inMarks: 19 }],
    });
  });

  it('warns about missing NEB details and scores', () => {
    expect(result.warnings).toEqual(['Student 14: no NEB details', 'Student 14: no scores']);
  });

  it('reads subject components', () => {
    expect(result.subjects).toEqual([
      { code: '0011', name: 'Comp. Nepali (Th)', creditHour: 2.25, fullMark: 75, type: 'TH' },
      { code: '0012', name: 'Comp. Nepali (In)', creditHour: 0.75, fullMark: 25, type: 'IN' },
    ]);
  });

  it('parses m/d/yyyy text and yyyy-mm-dd from Access Date fields', () => {
    expect(normalizeBs('2/26/2066')).toBe('2066-02-26');
    expect(normalizeBs('2066-02-26')).toBe('2066-02-26');
    expect(normalizeBs('2064-8-4')).toBe('2064-08-04');
    expect(normalizeBs('26/2066')).toBeNull();
  });

  it('reads B.S. dates exported from a Date field', () => {
    const r = transformAccess({
      ...csv,
      studentDetails: [
        '"StuId","Fname","MiddleName","LName","DOB(BS)","Gender","DOB(AD)","Stream"',
        '"1","RAM","","SHARMA","2065-12-26","MALE","2009-04-08","Science"',
      ].join('\n'),
    });
    expect(r.students[0]).toMatchObject({ dobBs: '2065-12-26', dobAd: '2009-04-08' });
    expect(r.warnings.filter((w) => w.includes('date'))).toEqual([]);
  });

  it('uses the given admission number prefix', () => {
    expect(transformAccess(csv, 'SVI-2081-').students[0]!.admissionNo).toBe('SVI-2081-0001');
  });
});
