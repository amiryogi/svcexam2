import { describe, expect, it } from 'vitest';
import { suggestNebCode } from './gradeSetup.service.js';

describe('suggestNebCode', () => {
  it('follows the NEB pattern of +10 per grade', () => {
    expect(suggestNebCode('0011', 1, new Set())).toBe('0021');
    expect(suggestNebCode('4271', 1, new Set())).toBe('4281');
  });

  it('marks clashes so the admin must fix them', () => {
    expect(suggestNebCode('0011', 1, new Set(['0021']))).toBe('0021?');
  });
});
