import { describe, expect, it } from 'vitest';
import { html, lines, raw } from './html.js';

describe('html template', () => {
  it('escapes interpolated values', () => {
    const name = '<script>alert("x")</script>';
    expect(html`<b>${name}</b>`.value).toBe('<b>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</b>');
  });

  it('does not double-escape nested templates and arrays', () => {
    const items = ['a&b', 'c'].map((i) => html`<li>${i}</li>`);
    expect(html`<ul>${items}</ul>`.value).toBe('<ul><li>a&amp;b</li><li>c</li></ul>');
  });

  it('skips null, undefined and false', () => {
    expect(html`${null}${undefined}${false}${0}`.value).toBe('0');
  });

  it('keeps raw HTML and converts line breaks safely', () => {
    expect(html`${raw('<br>')}`.value).toBe('<br>');
    expect(lines('a<b\nc').value).toBe('a&lt;b<br>c');
  });
});
