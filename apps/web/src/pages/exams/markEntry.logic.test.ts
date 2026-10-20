import { describe, expect, it } from 'vitest';
import { cellFromKey, classSections, isDirty, mergeConflicts, parsePastedColumn, savableIds, validateCell } from './markEntry.logic';

describe('validateCell', () => {
  it('accepts empty, absent and in-range marks', () => {
    expect(validateCell({ marks: '', status: 'PRESENT' }, 75)).toBeNull();
    expect(validateCell({ marks: 'x', status: 'ABSENT' }, 75)).toBeNull();
    expect(validateCell({ marks: '74.25', status: 'PRESENT' }, 75)).toBeNull();
  });
  it('rejects out-of-range marks and more than two decimals', () => {
    expect(validateCell({ marks: '76', status: 'PRESENT' }, 75)).toBe('0–75');
    expect(validateCell({ marks: '10.125', status: 'PRESENT' }, 75)).toBe('Max 2 decimals');
  });
});

describe('isDirty', () => {
  it('compares trimmed marks and status with the server', () => {
    expect(isDirty({ marks: ' 50 ', status: 'PRESENT' }, { marks: '50', status: 'PRESENT' })).toBe(false);
    expect(isDirty({ marks: '50', status: 'ABSENT' }, { marks: '50', status: 'PRESENT' })).toBe(true);
    expect(isDirty({ marks: '50', status: 'PRESENT' }, undefined)).toBe(true);
  });
});

describe('conflicts and autosave', () => {
  it('never offers a conflicted row for saving', () => {
    expect(savableIds([1, 2, 3], [2], new Set([3]))).toEqual([1]);
  });

  it('keeps an earlier conflict when a later save covers other rows', () => {
    // Row 5 conflicted on the first save; the user then edits row 6, which saves cleanly.
    const afterFirst = mergeConflicts(new Set(), [5], [5]);
    const afterSecond = mergeConflicts(afterFirst, [6], []);
    expect([...afterSecond]).toEqual([5]);
    // Row 5 is still edited and differs from the server, but must not autosave.
    expect(savableIds([5, 6], [], afterSecond)).toEqual([6]);
  });

  it('clears a conflict once that row is sent again and saves', () => {
    expect([...mergeConflicts(new Set([5]), [5], [])]).toEqual([]);
  });
});

describe('cellFromKey', () => {
  const present = { marks: '45', status: 'PRESENT' as const };
  const absent = { marks: '', status: 'ABSENT' as const };
  it('sets absent and withheld with A and W', () => {
    expect(cellFromKey('a', present)).toEqual({ marks: '', status: 'ABSENT' });
    expect(cellFromKey('W', present)).toEqual({ marks: '', status: 'WITHHELD' });
  });
  it('leaves ordinary typing in a present cell alone', () => {
    expect(cellFromKey('5', present)).toBeNull();
    expect(cellFromKey('Backspace', present)).toBeNull();
  });
  it('turns an absent cell back into a mark', () => {
    expect(cellFromKey('7', absent)).toEqual({ marks: '7', status: 'PRESENT' });
    expect(cellFromKey('Backspace', absent)).toEqual({ marks: '', status: 'PRESENT' });
    expect(cellFromKey('ArrowDown', absent)).toBeNull();
  });
});

describe('parsePastedColumn', () => {
  it('reads an Excel column with absent codes, blanks and a trailing line break', () => {
    expect(parsePastedColumn('45\r\nAB\r\n\r\n60.5\tignored\r\nW\r\n')).toEqual([
      { marks: '45', status: 'PRESENT' },
      { marks: '', status: 'ABSENT' },
      { marks: '', status: 'PRESENT' },
      { marks: '60.5', status: 'PRESENT' },
      { marks: '', status: 'WITHHELD' },
    ]);
  });
  it('keeps unreadable values so validation can flag them', () => {
    expect(parsePastedColumn('4o')).toEqual([{ marks: '4o', status: 'PRESENT' }]);
  });
});

describe('classSections', () => {
  const rows = [
    { streamId: 1, section: 'B' },
    { streamId: 1, section: 'A' },
    { streamId: 2, section: 'C' },
    { streamId: 1, section: 'A' },
    { streamId: 2, section: '' },
  ];
  it('lists distinct sections, optionally for one stream', () => {
    expect(classSections(rows, null)).toEqual(['A', 'B', 'C']);
    expect(classSections(rows, 2)).toEqual(['C']);
  });
});
