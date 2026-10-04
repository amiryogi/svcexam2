import { describe, expect, it } from 'vitest';
import { adToBs, bsToAd, reconcileDob } from './bsDate.js';

describe('bsDate', () => {
  // Pairs taken from the old Access StudentDetails table.
  it.each([
    ['2065-12-26', '2009-04-08'],
    ['2065-10-22', '2009-02-04'],
    ['2066-11-06', '2010-02-18'],
  ])('%s B.S. <-> %s A.D.', (bs, ad) => {
    expect(bsToAd(bs)).toBe(ad);
    expect(adToBs(ad)).toBe(bs);
  });

  it('rejects days that do not exist in the month', () => {
    expect(() => bsToAd('2065-01-40')).toThrow(/Invalid B.S. date/);
  });

  it('fills in the missing date of birth', () => {
    expect(reconcileDob('2065-12-26', null)).toEqual({ dobBs: '2065-12-26', dobAd: '2009-04-08' });
    expect(reconcileDob(null, '2009-04-08')).toEqual({ dobBs: '2065-12-26', dobAd: '2009-04-08' });
  });

  it('rejects mismatching B.S. and A.D. dates', () => {
    expect(() => reconcileDob('2065-12-26', '2009-04-09')).toThrow(/do not match/);
  });
});
