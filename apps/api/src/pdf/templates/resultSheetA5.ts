import { formatGp, hasMissingMarks, type ExamResult, type GradeSheetData, type ResultSheetLayout } from '@svi/shared';
import { html, raw, type SafeHtml } from '../html.js';
import { fitPt, gp, typeLabel } from './sheetHelpers.js';

/*
 * A5 result sheets for terminal exams: grades only or marks only, two side by side on an A4
 * landscape page with a dashed cut line between them. Only the date of issue and the campus chief's
 * signature appear under the table, right below it: no prepared/checked by and no footnote.
 */
const MARGIN_MM = 7.62; // 0.3 in on every side of the A5 sheet
const ROW_MM = 7; // body row height at which 14 rows (7 Th + In subjects) fill ROWS_AREA_MM
const MAX_ROW_MM = 9; // shorter sheets get taller rows, up to this
const ROWS_AREA_MM = 14 * ROW_MM;
const CELL_PT = 9; // cell text at ROW_MM rows; it grows and shrinks with the row height
const MAX_CELL_PT = 10;
const SIGN_GAP_MM = 13; // room to sign, between the GPA / percentage line and the signature
// Subject column widths: what the 133.26 mm inside the margins leaves after the other columns and
// the table's outer border.
const GRADES_SUBJECT_MM = 53.5;
const MARKS_SUBJECT_MM = 58;
const CHARS_PER_MM_AT_CELL_PT = 33 / 51; // subject-name characters that fit per mm at CELL_PT

const css = raw(`
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "Times New Roman", "Liberation Serif", Tinos, "Noto Serif", Times, serif; color: #000; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.page { position: relative; width: 297mm; height: 209.8mm; overflow: hidden; break-after: page; display: flex; }
.page:last-child { break-after: auto; }
.cut { position: absolute; left: 148.5mm; top: 0; bottom: 0; border-left: 0.2mm dashed #999; }
.half { position: relative; width: 148.5mm; height: 100%; padding: ${MARGIN_MM}mm; overflow: hidden; }
b { font-weight: bold; }

.head { display: grid; grid-template-columns: 18mm 1fr 18mm; align-items: center; text-align: center; }
.logo { width: 17mm; height: 17mm; overflow: hidden; contain: paint; }
.logo img { display: block; width: 100%; height: 100%; object-fit: contain; }
.school { font-size: 16pt; font-weight: bold; line-height: 1.1; }
.addr { font-size: 10pt; font-weight: bold; margin-top: 1mm; }
.title { font-size: 11pt; font-weight: bold; margin-top: 3mm; }

.info { margin-top: 4mm; font-size: 10pt; line-height: 6.2mm; }
.info .pair { margin-right: 4mm; white-space: nowrap; }

table { width: 100%; margin-top: 2.5mm; table-layout: fixed; border-collapse: collapse; border: 0.25mm solid #000; }
th { height: 11mm; padding: 0 0.5mm; font-size: 8pt; font-weight: normal; line-height: 1.15; text-align: center; vertical-align: middle; border-left: 0.25mm solid #000; border-bottom: 0.35mm solid #000; }
td { height: var(--row); padding: 0 1mm; font-size: var(--cell); font-weight: bold; line-height: 1; vertical-align: middle; border-left: 0.25mm solid #000; white-space: nowrap; overflow: hidden; }
th:first-child, td:first-child { border-left: 0; }
td.c { text-align: center; }
td.r { text-align: right; padding-right: 2.5mm; }
td.wrap { white-space: normal; }
tbody.subject + tbody.subject td { border-top: 0.25mm solid #000; }
tbody.subject + tbody.subject tr + tr td { border-top: 0; }
tr.total td { border-top: 0.35mm solid #000; height: 7mm; }

.below { margin-top: 2mm; font-size: 9pt; font-weight: bold; text-align: right; }
.below span { margin-left: 3mm; }
.below .gap { margin-left: 10mm; }

.foot { margin-top: ${SIGN_GAP_MM}mm; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10pt; }
.sign { text-align: center; font-weight: bold; line-height: 1.35; }

.watermark { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 40pt; color: rgba(200,0,0,.12); transform: rotate(-28deg); font-weight: bold; }
`);

/**
 * Totals for a marks-only sheet. Absent counts as 0; missing marks leave the totals blank. A withheld
 * mark withholds the whole result: RESULT reads WITHHELD and the totals stay blank.
 */
export interface MarksSummary {
  fullTotal: number;
  /** null while any mark is missing or withheld. */
  obtainedTotal: number | null;
  /** obtained ÷ full × 100 to 2 decimals; null while any mark is missing or withheld. */
  percent: number | null;
  result: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'WITHHELD';
}

export function marksSummary(result: ExamResult): MarksSummary {
  // Integer hundredths, so 0.1-step marks never add up to 409.99999.
  let fullH = 0;
  let obtainedH = 0;
  let pending = false;
  let withheld = false;
  for (const s of result.subjects) {
    for (const c of s.components) {
      fullH += Math.round(c.fullMark * 100);
      if (c.status === 'WITHHELD') withheld = true;
      if (c.status === 'ABSENT' || c.status === 'WITHHELD') continue;
      if (c.marks === null) pending = true;
      else obtainedH += Math.round(c.marks * 100);
    }
  }
  if (withheld) return { fullTotal: fullH / 100, obtainedTotal: null, percent: null, result: 'WITHHELD' };
  const verdict = result.outcome === 'PASS' ? 'PASS' : result.outcome === 'NG' ? 'FAIL' : 'INCOMPLETE';
  if (pending || fullH === 0) return { fullTotal: fullH / 100, obtainedTotal: null, percent: null, result: verdict };
  return {
    fullTotal: fullH / 100,
    obtainedTotal: obtainedH / 100,
    percent: Math.round((obtainedH * 10000) / fullH) / 100,
    result: verdict,
  };
}

const markCell = (c: { status: string; marks: number | null }) =>
  c.status === 'ABSENT' ? 'ABS' : c.status === 'WITHHELD' ? 'W' : gp(c.marks);

/**
 * Pass marks = full mark × pass % (75 × 35% = 26.25), rounded *up* to the hundredth with the grading
 * engine's integer arithmetic (meetsPercent), so a student on the printed pass mark always passes.
 */
export const passMarks = (c: { fullMark: number; passPercent: number }) =>
  gp(Math.ceil((Math.round(c.passPercent * 100) * Math.round(c.fullMark * 100)) / 10000) / 100);

/** Subject-name characters that fit in a column of `colMm` at `cellPt`. */
const subjectFit = (colMm: number, cellPt: number) => Math.floor((CHARS_PER_MM_AT_CELL_PT * colMm * CELL_PT) / cellPt);

function gradeRows(s: GradeSheetData['result']['subjects'][number], cellPt: number): SafeHtml {
  const n = s.components.length;
  const subjPt = fitPt(s.name.length + 5, subjectFit(GRADES_SUBJECT_MM, cellPt), cellPt, 5.5);
  return html`<tbody class="subject">${s.components.map(
    (c, i) => html`<tr>
      <td class="c">${c.code}</td>
      <td class="${subjPt === 5.5 ? 'wrap' : ''}" style="font-size:${subjPt}pt">${s.name} (${typeLabel[c.type]})</td>
      <td class="c">${c.creditHour.toFixed(2)}</td>
      <td class="c">${c.outcome === 'ABSENT' || c.outcome === 'WITHHELD' ? '' : gp(c.gradePoint)}</td>
      <td class="c">${c.grade}</td>
      ${i === 0 ? html`<td class="c" rowspan="${n}">${s.finalGrade}</td><td class="c" rowspan="${n}">${s.remarks}</td>` : ''}
    </tr>`,
  )}</tbody>`;
}

function markRows(s: GradeSheetData['result']['subjects'][number], cellPt: number): SafeHtml {
  const subjPt = fitPt(s.name.length + 5, subjectFit(MARKS_SUBJECT_MM, cellPt), cellPt, 5.5);
  return html`<tbody class="subject">${s.components.map(
    (c) => html`<tr>
      <td class="c">${c.code}</td>
      <td class="${subjPt === 5.5 ? 'wrap' : ''}" style="font-size:${subjPt}pt">${s.name} (${typeLabel[c.type]})</td>
      <td class="c">${gp(c.fullMark)}</td>
      <td class="c">${passMarks(c)}</td>
      <td class="c">${markCell(c)}</td>
    </tr>`,
  )}</tbody>`;
}

function sheet(d: GradeSheetData, logo: string | null, layout: Exclude<ResultSheetLayout, 'OFFICIAL'>): SafeHtml {
  const { school, exam, student, result } = d;
  const marks = layout === 'A5_MARKS';
  const rows = result.subjects.reduce((sum, s) => sum + s.components.length, 0);
  // Rows share ROWS_AREA_MM (taller for short sheets, capped at MAX_ROW_MM; shorter past 14 rows).
  const row = Math.min(MAX_ROW_MM, Math.floor((ROWS_AREA_MM / rows) * 100) / 100);
  const cellPt = Math.min(MAX_CELL_PT, Math.floor(((CELL_PT * row) / ROW_MM) * 2) / 2);
  const examLine = `IN THE ${exam.name.toUpperCase()} EXAMINATION CONDUCTED IN ${exam.examYearBs} B.S. (${exam.examYearAd} A.D.)`;
  const pairs: [string, string | number | null][] = [
    ['GRADE', exam.gradeRoman],
    ['SECTION', student.section || null],
    ['ROLL NO.', student.rollNo],
    ['SYMBOL NO.', student.symbolNo],
  ];
  const sum = marks ? marksSummary(result) : null;

  return html`<div class="half" style="--row:${row}mm;--cell:${cellPt}pt">
    ${hasMissingMarks(result)
      ? html`<div class="watermark">INCOMPLETE</div>`
      : d.provisional
        ? html`<div class="watermark">PROVISIONAL</div>`
        : ''}
    <div class="head">
      <div>${logo ? html`<div class="logo"><img src="${logo}" alt=""></div>` : ''}</div>
      <div>
        <div class="school" style="font-size:${fitPt(school.name.length, 32, 16, 10)}pt">${school.name}</div>
        ${school.address ? html`<div class="addr">${school.address}</div>` : ''}
        <div class="title">${marks ? 'MARK-SHEET' : 'GRADE-SHEET'}</div>
      </div>
      <div></div>
    </div>

    <div class="info">
      <div>${marks ? 'THE MARKS SECURED BY:' : 'THE GRADE(S) SECURED BY:'}
        <b style="margin-left:3mm;font-size:${fitPt(student.fullName.length, 26, 10, 7)}pt">${student.fullName.toUpperCase()}</b></div>
      <div>${pairs
        .filter(([, v]) => v !== null && v !== '')
        .map(([label, v]) => html`<span class="pair">${label} <b>${v}</b></span>`)}</div>
      <div style="font-size:${fitPt(examLine.length, 60, 10, 6.5)}pt">IN THE ${exam.name.toUpperCase()} EXAMINATION CONDUCTED IN
        <b>${exam.examYearBs} B.S. (${exam.examYearAd} A.D.)</b></div>
    </div>

    ${marks && sum
      ? html`<table>
      <colgroup><col style="width:13mm"><col style="width:${MARKS_SUBJECT_MM}mm"><col style="width:19mm"><col style="width:19mm"><col style="width:24mm"></colgroup>
      <thead><tr><th>SUBJECT<br>CODE</th><th>SUBJECTS</th><th>FULL<br>MARKS</th><th>PASS<br>MARKS</th><th>OBTAINED<br>MARKS</th></tr></thead>
      ${result.subjects.map((s) => markRows(s, cellPt))}
      <tbody><tr class="total"><td class="r" colspan="2">TOTAL</td><td class="c">${gp(sum.fullTotal)}</td><td></td><td class="c">${gp(sum.obtainedTotal)}</td></tr></tbody>
    </table>
    <div class="below">PERCENTAGE<span>${sum.percent === null ? '' : `${sum.percent.toFixed(2)} %`}</span><span class="gap">RESULT</span><span>${sum.result}</span></div>`
      : html`<table>
      <colgroup><col style="width:13mm"><col style="width:${GRADES_SUBJECT_MM}mm"><col style="width:12mm"><col style="width:11.5mm"><col style="width:12mm"><col style="width:14mm"><col style="width:17mm"></colgroup>
      <thead><tr><th>SUBJECT<br>CODE</th><th>SUBJECTS</th><th>CREDIT<br>HOURS<br>(CH)</th><th>GRADE<br>POINT<br>(GP)</th><th>GRADE</th><th>FINAL<br>GRADE<br>(FG)</th><th>REMARKS</th></tr></thead>
      ${result.subjects.map((s) => gradeRows(s, cellPt))}
    </table>
    <div class="below">Grade Point Average (GPA)<span class="gap">${result.gpaWithheld ? '—' : formatGp(result.gpa)}</span></div>`}

    <div class="foot">
      <div>DATE OF ISSUE:- <b>${exam.issueDateBs ? `${exam.issueDateBs} B.S.` : ''}</b></div>
      <div class="sign">
        <div>..............................</div>
        ${school.principalName ? html`<div style="font-size:${fitPt(school.principalName.length, 24, 10, 7)}pt">${school.principalName.toUpperCase()}</div>` : ''}
        <div>${school.principalTitle.toUpperCase()}</div>
      </div>
    </div>
  </div>`;
}

/** Two A5 sheets per A4 landscape page; an odd last sheet leaves the right half blank. */
export function resultSheetsA5Html(
  sheets: GradeSheetData[],
  logo: string | null,
  layout: Exclude<ResultSheetLayout, 'OFFICIAL'>,
  title: string,
): string {
  const pages: GradeSheetData[][] = [];
  for (let i = 0; i < sheets.length; i += 2) pages.push(sheets.slice(i, i + 2));
  return html`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
  <body>${pages.map(
    (pair) => html`<section class="page">${pair.map((d) => sheet(d, logo, layout))}<div class="cut"></div></section>`,
  )}</body></html>`.value;
}
