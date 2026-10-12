import { formatGp, type ExamDto, type ResultRow, type SchoolInfo } from '@svi/shared';
import { html, raw } from '../html.js';

export interface LedgerColumn {
  subjectId: number;
  name: string;
  components: { componentId: number; type: string; code: string; fullMark: number }[];
}

/** Union of all subjects (and their components) appearing in the rows, in first-seen order. */
export function ledgerColumns(rows: ResultRow[]): LedgerColumn[] {
  const cols = new Map<number, LedgerColumn>();
  for (const r of rows) {
    for (const s of r.result.subjects) {
      if (!cols.has(s.subjectId)) {
        cols.set(s.subjectId, {
          subjectId: s.subjectId,
          name: s.name,
          components: s.components.map((c) => ({ componentId: c.componentId, type: c.type, code: c.code, fullMark: c.fullMark })),
        });
      }
    }
  }
  return [...cols.values()];
}

export const markText = (c: { status: string; marks: number | null } | undefined) =>
  !c ? '' : c.status === 'ABSENT' ? 'ABS' : c.status === 'WITHHELD' ? 'W' : c.marks === null ? '' : String(c.marks);

const css = raw(`
@page { size: A4 landscape; margin: 8mm; }
body { font-family: Arial, "Liberation Sans", "Noto Sans", sans-serif; font-size: 7.5pt; margin: 0; color: #111; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
h1 { font-size: 13pt; margin: 0; text-align: center; text-transform: uppercase; }
h2 { font-size: 10pt; margin: 2px 0 6px; text-align: center; font-weight: normal; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #555; padding: 2px 3px; text-align: center; }
th { background: #eee; }
td.name { text-align: left; white-space: nowrap; }
td.ng { color: #b00; font-weight: bold; }
thead { display: table-header-group; }
tr { break-inside: avoid; }
`);

export function ledgerHtml(school: SchoolInfo, exam: ExamDto, rows: ResultRow[], subtitle: string): string {
  const cols = ledgerColumns(rows);
  return html`<!doctype html><html><head><meta charset="utf-8"><title>Mark ledger</title><style>${css}</style></head><body>
  <h1>${school.name}</h1>
  <h2>Mark ledger · ${exam.name} · Grade ${exam.grade} · ${exam.academicYear} ${subtitle ? `· ${subtitle}` : ''}</h2>
  <table>
    <thead>
      <tr>
        <th rowspan="2">Roll</th><th rowspan="2">Symbol No.</th><th rowspan="2">Name</th>
        ${cols.map((c) => html`<th colspan="${c.components.length + 1}">${c.name}</th>`)}
        <th rowspan="2">GPA</th><th rowspan="2">Result</th>
      </tr>
      <tr>${cols.map((c) => html`${c.components.map((k) => html`<th>${k.type}<br>${k.fullMark}</th>`)}<th>FG</th>`)}</tr>
    </thead>
    <tbody>
      ${rows.map((r) => {
        const bySubject = new Map(r.result.subjects.map((s) => [s.subjectId, s]));
        return html`<tr>
          <td>${r.rollNo ?? ''}</td><td>${r.symbolNo ?? ''}</td><td class="name">${r.fullName}</td>
          ${cols.map((c) => {
            const s = bySubject.get(c.subjectId);
            return html`${c.components.map((k) => {
              const comp = s?.components.find((x) => x.componentId === k.componentId);
              return html`<td class="${comp && comp.outcome !== 'PASS' && comp.outcome !== 'PENDING' ? 'ng' : ''}">${markText(comp)}</td>`;
            })}<td class="${s?.outcome === 'NG' ? 'ng' : ''}">${s ? s.finalGrade : ''}</td>`;
          })}
          <td>${r.result.gpaWithheld ? '—' : formatGp(r.result.gpa)}</td>
          <td class="${r.result.outcome === 'NG' ? 'ng' : ''}">${r.result.outcome}</td>
        </tr>`;
      })}
    </tbody>
  </table></body></html>`.value;
}
