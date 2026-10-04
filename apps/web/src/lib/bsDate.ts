import NepaliDate from 'nepali-date-converter';

const pad = (v: number) => String(v).padStart(2, '0');
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** BS 'YYYY-MM-DD' -> AD 'YYYY-MM-DD', or null if invalid. The server re-validates. */
export function bsToAd(bs: string): string | null {
  if (!ISO.test(bs)) return null;
  const [y, m, d] = bs.split('-').map(Number) as [number, number, number];
  try {
    const nd = new NepaliDate(y, m - 1, d);
    if (nd.getYear() !== y || nd.getMonth() !== m - 1 || nd.getDate() !== d) return null;
    const js = nd.toJsDate();
    return `${js.getFullYear()}-${pad(js.getMonth() + 1)}-${pad(js.getDate())}`;
  } catch {
    return null;
  }
}

export function adToBs(ad: string): string | null {
  if (!ISO.test(ad)) return null;
  const [y, m, d] = ad.split('-').map(Number) as [number, number, number];
  try {
    const nd = new NepaliDate(new Date(y, m - 1, d));
    return `${nd.getYear()}-${pad(nd.getMonth() + 1)}-${pad(nd.getDate())}`;
  } catch {
    return null;
  }
}
