/** Marker for strings that are already safe HTML. */
export class SafeHtml {
  constructor(public readonly value: string) {}
  toString() {
    return this.value;
  }
}

export const escapeHtml = (v: unknown): string =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const render = (v: unknown): string => {
  if (v instanceof SafeHtml) return v.value;
  if (Array.isArray(v)) return v.map(render).join('');
  if (v === null || v === undefined || v === false) return '';
  return escapeHtml(v);
};

/** Tagged template that escapes every interpolated value unless it is SafeHtml (or an array of them). */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0] ?? '';
  values.forEach((v, i) => {
    out += render(v) + (strings[i + 1] ?? '');
  });
  return new SafeHtml(out);
}

export const raw = (s: string) => new SafeHtml(s);

/** Multi-line text with line breaks preserved (escaped). */
export const lines = (s: string | null | undefined) => raw(escapeHtml(s ?? '').replace(/\r?\n/g, '<br>'));
