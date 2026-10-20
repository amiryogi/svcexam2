/** Helpers shared by the official A4 grade sheet and the A5 terminal result sheets. */

/** 'YYYY-MM-DD' -> 'M/D/YYYY' as printed on the school's grade sheet. */
export function slashDate(iso: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : '';
}

/** 2.4 / 4 / 3.6 – numbers without trailing zeros, like the official sheet. */
export const gp = (v: number | null) => (v === null ? '' : String(Number(v.toFixed(2))));

export const typeLabel = { TH: 'Th', IN: 'In' } as const;

/**
 * Font size that fits `len` characters where `fitLen` characters fit at `basePt` (shrinking in
 * half points, never below `minPt`). Text that still doesn't fit wraps or is clipped by its box.
 */
export function fitPt(len: number, fitLen: number, basePt: number, minPt: number): number {
  if (len <= fitLen) return basePt;
  return Math.max(minPt, Math.floor(((basePt * fitLen) / len) * 2) / 2);
}
