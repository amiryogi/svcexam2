import { describe, expect, it } from 'vitest';
import {
  classOf,
  parseGender,
  parseMarksSheets,
  sameName,
  closestName,
  nameSimilarity,
  splitName,
} from './importMarks.transform.js';

const TITLE = 'FIRST TERMINAL EXAMINATION 2083 MANAGEMENT XII';
const HEADER = [null, null, 'ECO', 'ENG', 'HM', 'CS', 'TOTAL'];
const FM = ['R.N.', 'NAME', 'FM 75', 'FM 75', 'FM 50', 'FM50', null];

describe('parseMarksSheets', () => {
  const { classes, errors } = parseMarksSheets([
    { name: 'Sheet1', rows: [] },
    {
      name: 'XII MGMT',
      rows: [
        [TITLE, TITLE, TITLE],
        HEADER,
        FM,
        [1, 'AARYAN THAPA', 33, 59, null, 38, 237],
        [3, 'ANUP RAI ', 'A', null, null, null, null],
        [5, 'AVISHANT  PAUDEL', '*', '*', '*', '*', '*'],
        [6, 'JESHIKA SHRESTHA', '27', 43, 20, ' ', 210],
        // The header block repeats further down the sheet.
        [TITLE, TITLE, TITLE],
        HEADER,
        FM,
        [23, 'SURAJ BHATTA', 0, 53, null, 28, null],
      ],
    },
  ]);

  it('skips empty sheets and reads grade and stream from the sheet name', () => {
    expect(errors).toEqual([]);
    expect(classes).toHaveLength(1);
    expect(classes[0]).toMatchObject({ sheet: 'XII MGMT', grade: 12, streamCode: 'MGMT' });
  });

  it('reads students below a repeated header block, and ignores the TOTAL column', () => {
    const students = classes[0]!.students;
    expect(students.map((s) => s.rollNo)).toEqual([1, 3, 5, 6, 23]);
    expect(students[0]!.cells.map((c) => c.family)).toEqual(['ECO', 'ENG', 'HM', 'CS']);
    expect(students[4]!.cells[0]).toMatchObject({
      family: 'ECO',
      entry: { status: 'PRESENT', marks: 0 },
      ref: 'C11',
    });
  });

  it('parses full marks with and without a space', () => {
    expect(classes[0]!.students[0]!.cells.map((c) => c.fullMark)).toEqual([75, 75, 50, 50]);
  });

  it('maps numbers, numeric text, A, * and blanks', () => {
    const [aaryan, anup, avishant, jeshika] = classes[0]!.students;
    expect(aaryan!.cells.map((c) => c.entry)).toEqual([
      { status: 'PRESENT', marks: 33 },
      { status: 'PRESENT', marks: 59 },
      null,
      { status: 'PRESENT', marks: 38 },
    ]);
    expect(anup!.name).toBe('ANUP RAI');
    expect(anup!.cells.map((c) => c.entry)).toEqual([
      { status: 'ABSENT', marks: null },
      null,
      null,
      null,
    ]);
    expect(avishant!.name).toBe('AVISHANT PAUDEL');
    expect(avishant!.cells.every((c) => c.entry === 'STARRED')).toBe(true);
    expect(jeshika!.cells.map((c) => c.entry)).toEqual([
      { status: 'PRESENT', marks: 27 },
      { status: 'PRESENT', marks: 43 },
      { status: 'PRESENT', marks: 20 },
      null,
    ]);
  });

  it('takes the class from the title when the sheet name has none, and maps CHE to CHEM', () => {
    const r = parseMarksSheets([
      {
        name: 'Science',
        rows: [
          ['FIRST TERMINAL EXAMINATION 2083 XI SCIENCE'],
          [null, null, 'CHE', 'Math'],
          ['Roll No.', 'Names', 'FM 75', 'FM 75'],
          [101, 'ANIL B.K.', 27, 45],
        ],
      },
    ]);
    expect(r.errors).toEqual([]);
    expect(r.classes[0]).toMatchObject({ grade: 11, streamCode: 'SCI' });
    expect(r.classes[0]!.students[0]!.cells.map((c) => c.family)).toEqual(['CHEM', 'MATH']);
  });

  it('reports marks above the full mark, unknown values, duplicate rolls and unknown classes', () => {
    const r = parseMarksSheets([
      {
        name: 'XI MGMT',
        rows: [HEADER, FM, [1, 'A B', 80, 'x', 51, null], [1, 'C D', 1, 1, 1, 1]],
      },
      { name: 'Marks', rows: [HEADER, FM, [1, 'A B', 1, 1, 1, 1]] },
    ]);
    expect(r.errors).toEqual([
      '"XI MGMT" C3 (A B, ECO): mark 80 is above the full mark 75',
      '"XI MGMT" D3 (A B, ENG): unrecognised value "x" (use a number, A for absent, or * to leave empty)',
      '"XI MGMT" E3 (A B, HM): mark 51 is above the full mark 50',
      '"XI MGMT" A4: roll 1 appears twice (also row 3)',
      'Sheet "Marks": cannot tell the grade and stream from its name or title (e.g. "XII MGMT")',
    ]);
  });
});

describe('gender column', () => {
  it('is read from the subject row or the full-mark row, as M/F', () => {
    const inFmRow = parseMarksSheets([
      {
        name: 'XI SCIENCE',
        rows: [
          [null, null, 'CHE', 'ENG', null],
          ['Roll No.', 'Names', 'FM 75', 'FM 75', 'Gender'],
          [101, 'AAKRITI KUMARI SHARMA', 8, 34, 'F'],
          [102, 'AAYURESH BAJRACHARYA', 46, 58, 'm'],
          [103, 'NO GENDER YET', 1, 1, null],
        ],
      },
    ]);
    expect(inFmRow.errors).toEqual([]);
    expect(inFmRow.classes[0]!.students.map((s) => s.gender)).toEqual(['FEMALE', 'MALE', null]);

    const inHeader = parseMarksSheets([
      {
        name: 'XI MGMT',
        rows: [
          [null, null, 'GENDER', 'ECO', 'ENG'],
          [null, null, null, 'FM 75', 'FM 75'],
          [1, 'A B', 'Male', 5, 6],
        ],
      },
    ]);
    expect(inHeader.classes[0]!.students[0]).toMatchObject({
      gender: 'MALE',
      cells: [{ family: 'ECO' }, { family: 'ENG' }],
    });
  });

  it('reports values that are not M or F', () => {
    const r = parseMarksSheets([
      {
        name: 'XI MGMT',
        rows: [
          [null, null, 'ECO', 'ENG', 'SEX'],
          [null, null, 'FM 75', 'FM 75'],
          [1, 'A B', 5, 6, 'X'],
        ],
      },
    ]);
    expect(r.errors).toEqual(['"XI MGMT" E3 (A B): gender "X" is not M or F']);
  });
});

describe('parseGender', () => {
  it('reads M/F/O and the words, nothing else', () => {
    expect(['m', 'F', ' o ', 'Female', 'boy', 'x'].map(parseGender)).toEqual([
      'MALE',
      'FEMALE',
      'OTHER',
      'FEMALE',
      'MALE',
      undefined,
    ]);
  });
});

describe('splitName', () => {
  it('title-cases and splits first, middle and last names', () => {
    expect(splitName('AAKRITI KUMARI SHARMA')).toEqual({
      firstName: 'Aakriti',
      middleName: 'Kumari',
      lastName: 'Sharma',
    });
    expect(splitName('ANIL B.K.')).toEqual({
      firstName: 'Anil',
      middleName: null,
      lastName: 'B.K.',
    });
    expect(splitName('NISCHAL MANI KAFLE')?.middleName).toBe('Mani');
    expect(splitName('PASANG')).toBeNull();
  });
});

describe('classOf', () => {
  it('tells XII from XI', () => {
    expect(classOf('XII SCIENCE')).toEqual({ grade: 12, streamCode: 'SCI' });
    expect(classOf('XI MGMT')).toEqual({ grade: 11, streamCode: 'MGMT' });
  });
});

describe('name matching', () => {
  it('ignores spacing, dots and word order', () => {
    expect(sameName('SANGHARSHA  KC', 'Sangharsha K.C.')).toBe(true);
    expect(sameName('ANIL B.K.', 'Anil Bk')).toBe(true);
    expect(sameName('THAPA AARYAN', 'Aaryan Thapa')).toBe(true);
    expect(sameName('AARYAN THAPA', 'ARYAN THAPA')).toBe(false);
  });

  it('scores spelling differences and missing middle names as similar', () => {
    for (const [a, b] of [
      ['RIJWANA KHATOON', 'Rizwana Khatoon'],
      ['KIRAN KUMARI CHAURASIA', 'Kiran Kumari Chaurasiya'],
      ['SUBODH BOMJON', 'Subodh Bomjan'],
      ['SANJILA SAHANI', 'Sanjila Kumari Sahani'],
      ['NGOEDUP LHAMU', 'Ngoedup Lhamo Baijee'],
      ['BISHAL NEPALI', 'Bisal Nepali'],
      ['BISESTA KHATRI', 'Bisheshta Khatri'],
      ['NAMKHA GYALBO BAIJEE', 'Namkha Gyalpo Baijee'],
      ['BISHAL CHAUDAHRY', 'Bishal Chaudhary'],
    ]) {
      expect(nameSimilarity(a!, b!), `${a} ~ ${b}`).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('keeps different people apart', () => {
    for (const [a, b] of [
      ['BISHAL NEPALI', 'Bishal Chaudhary'],
      ['AARAB KHADKA', 'Aaryan Thapa'],
      ['SURAJ BHATTA', 'Suprim Gurung'],
      ['RITU RAI', 'Anup Rai'],
    ]) {
      expect(nameSimilarity(a!, b!), `${a} vs ${b}`).toBeLessThan(0.8);
    }
  });

  it('only picks a candidate that is clearly the closest', () => {
    const names = ['Bisal Nepali', 'Bishal Chaudhary', 'Sandip Chepang'];
    expect(closestName('BISHAL NEPALI', names, (n) => n)?.c).toBe('Bisal Nepali');
    expect(
      closestName('SANDEEP CHEPANG', ['Sandip Chepang', 'Sandeep Chepan'], (n) => n),
    ).toBeNull();
    expect(closestName('NEW STUDENT', names, (n) => n)).toBeNull();
  });
});
