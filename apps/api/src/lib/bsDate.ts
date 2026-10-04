import * as nepaliDateModule from 'nepali-date-converter';
import { badRequest } from './errors.js';

// The package ships a CommonJS/UMD bundle; under Node ESM the class sits one or two `.default`s deep.
type NepaliDateCtor = typeof import('nepali-date-converter').default;
type Nested = { default?: Nested } & Partial<NepaliDateCtor>;
const m = nepaliDateModule as unknown as Nested;
const NepaliDate = (m.default?.default ?? m.default ?? m) as unknown as NepaliDateCtor;

const pad = (v: number) => String(v).padStart(2, '0');
const isoAd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** BS 'YYYY-MM-DD' -> AD 'YYYY-MM-DD'. Throws 400 for dates outside the calendar or invalid days. */
export function bsToAd(bs: string): string {
  const [y, m, d] = bs.split('-').map(Number) as [number, number, number];
  try {
    const nd = new NepaliDate(y, m - 1, d);
    // The converter silently rolls invalid days over, so verify by round trip.
    if (nd.getYear() !== y || nd.getMonth() !== m - 1 || nd.getDate() !== d) throw new Error();
    return isoAd(nd.toJsDate());
  } catch {
    throw badRequest(`Invalid B.S. date: ${bs}`);
  }
}

/** AD 'YYYY-MM-DD' -> BS 'YYYY-MM-DD'. */
export function adToBs(ad: string): string {
  const [y, m, d] = ad.split('-').map(Number) as [number, number, number];
  try {
    const nd = new NepaliDate(new Date(y, m - 1, d));
    return `${nd.getYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}`;
  } catch {
    throw badRequest(`A.D. date out of supported range: ${ad}`);
  }
}

/**
 * Fill in whichever date of birth is missing and check that both agree when both are given.
 */
export function reconcileDob(dobBs: string | null, dobAd: string | null): { dobBs: string | null; dobAd: string | null } {
  if (dobBs && dobAd) {
    if (bsToAd(dobBs) !== dobAd) {
      throw badRequest('B.S. and A.D. dates of birth do not match', {
        fields: [{ path: 'dobAd', message: `${dobBs} B.S. is ${bsToAd(dobBs)} A.D.` }],
      });
    }
    return { dobBs, dobAd };
  }
  if (dobBs) return { dobBs, dobAd: bsToAd(dobBs) };
  if (dobAd) return { dobBs: adToBs(dobAd), dobAd };
  return { dobBs: null, dobAd: null };
}
