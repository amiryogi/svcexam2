import { describe, expect, it } from 'vitest';
import { isDirty, mergeConflicts, savableIds, validateCell } from './markEntry.logic';

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
