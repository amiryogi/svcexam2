import { describe, expect, it } from 'vitest';
import { examIncludesInternal, examSchema, examSheetLayout, examYears } from './exams.js';

describe('examYears', () => {
  it('derives the printed year from the academic year', () => {
    expect(examYears(null, null, '2083')).toEqual({ bs: '2083', ad: '2026' });
    expect(examYears(null, null, '2082/83')).toEqual({ bs: '2082', ad: '2025' });
  });

  it('prefers the exam’s own year when set', () => {
    expect(examYears('2081', '2024', '2083')).toEqual({ bs: '2081', ad: '2024' });
    expect(examYears('2084', null, '2083')).toEqual({ bs: '2084', ad: '2027' });
  });

  it('accepts blank conducted-in years', () => {
    const r = examSchema.parse({ academicYearId: 1, grade: 11, name: 'Final', type: 'FINAL', examYearBs: '', examYearAd: '' });
    expect(r.examYearBs).toBeNull();
    expect(r.examYearAd).toBeNull();
  });
});

describe('examIncludesInternal', () => {
  it('always includes internal marks in send-up and final exams', () => {
    expect(examIncludesInternal('FINAL', false)).toBe(true);
    expect(examIncludesInternal('SENDUP', false)).toBe(true);
  });

  it('follows the exam setting for terminal exams', () => {
    expect(examIncludesInternal('TERMINAL', false)).toBe(false);
    expect(examIncludesInternal('TERMINAL', true)).toBe(true);
  });
});

describe('examSheetLayout', () => {
  it('lets terminal exams choose their result sheet', () => {
    expect(examSheetLayout('TERMINAL', 'A5_MARKS')).toBe('A5_MARKS');
    expect(examSheetLayout('TERMINAL', null)).toBe('OFFICIAL');
  });
  it('always prints the official sheet for send-up and final exams', () => {
    expect(examSheetLayout('SENDUP', 'A5_GRADES')).toBe('OFFICIAL');
    expect(examSheetLayout('FINAL', 'A5_MARKS')).toBe('OFFICIAL');
  });
});
