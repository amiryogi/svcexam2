import { formatGp, hasMissingMarks, type GradeSheetData } from '@svi/shared';
import { html, raw, type SafeHtml } from '../html.js';

/*
 * Layout copies the school's official "Format of grade sheet.pdf" (repo root): A4 portrait, Times,
 * every block placed in millimetres from the page's top-left corner as measured on that PDF, so the
 * printout lands where the official one does. One deliberate difference: a single line between
 * subjects instead of the official double hairline.
 *
 * The page has no margins (@page margin 0): positions are absolute, and the browser has no room left
 * for its URL/date headers. The footer is pinned to the bottom like the official; the table's rows
 * shrink when a student has more rows than the official 12, so the GPA line never reaches the footer.
 */
const ROW_MM = 8.6; // official body row height (a Th + In subject is 17.2 mm)
const ROWS_AREA_MM = 12 * ROW_MM; // official space for body rows: 12 rows of 8.6 mm, table bottom ≈ 211 mm
const TABLE_TOP_MM = 90.6;
const HEAD_MM = 17.3;

const css = raw(`
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "Times New Roman", "Liberation Serif", Tinos, "Noto Serif", Times, serif; color: #000; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.sheet { position: relative; width: 210mm; height: 296.8mm; overflow: hidden; break-after: page; }
.sheet:last-child { break-after: auto; }
.a { position: absolute; white-space: nowrap; line-height: 1; }
b { font-weight: bold; }

/* Fixed, clipped box: Chromium otherwise bleeds a sliver of large downscaled PNGs onto the previous page. */
.logo { left: 15mm; top: 8.5mm; width: 25.4mm; height: 25.4mm; overflow: hidden; contain: paint; }
.logo img { display: block; width: 100%; height: 100%; object-fit: contain; }
.school { left: 12.8mm; right: 0; top: 10.5mm; text-align: center; font-size: 24pt; font-weight: bold; }
.addr { left: 14mm; right: 0; top: 21.35mm; text-align: center; font-size: 14pt; font-weight: bold; }
.title { left: 8mm; right: 0; top: 31.85mm; text-align: center; font-size: 16pt; font-weight: bold; }

.info { font-size: 14pt; }
.info .gap { margin-left: 3.3mm; }
.info .close { margin-left: 3.7mm; }

/* The table and GPA line flow together, so the GPA always follows the table however tall it renders. */
.body { position: absolute; left: 12.2mm; top: ${TABLE_TOP_MM}mm; width: 185.7mm; }
table { width: 100%; table-layout: fixed; border-collapse: collapse; border: 0.3mm solid #000; }
th { height: ${HEAD_MM}mm; padding: 0 0 1.2mm; font-size: 12pt; font-weight: normal; line-height: 4.9mm; text-align: center; vertical-align: middle; border-left: 0.35mm solid #000; border-bottom: 0.4mm solid #000; }
td { height: var(--row); padding: 0; font-size: var(--cell); font-weight: bold; line-height: 1; vertical-align: top; border-left: 0.35mm solid #000; white-space: nowrap; overflow: hidden; }
th:first-child, td:first-child { border-left: 0; }
th.subjects { padding: 2.6mm 0 0; }
td.c { text-align: center; }
td.code { padding-left: 7.6mm; }
td.ch { padding-left: 4.45mm; }
td.gp { padding-left: 8.5mm; }
/* The longest catalogue name fills the column exactly, as on the official sheet: let it touch the line. */
td.subj { padding-left: 1.6mm; overflow: visible; }
td.subj.wrap { white-space: normal; overflow: hidden; }
td.grade { padding-left: 5.5mm; }
td.fg { padding-left: 8.2mm; }
td.span { vertical-align: middle; }
/* Text sits where the official puts it: a Th row low in its half, the In row just under it. */
tr.first td { padding-top: calc(var(--row) * 0.43 - 0.25mm); }
tr.last td { padding-top: calc(var(--row) * 0.2 - 0.05mm); }
tr.first.last td { padding-top: 0; vertical-align: middle; }
/* Final grade sits a little low in a Th + In pair, as on the official; centred in a single row. */
tr.first:not(.last) td.span { padding-top: calc(var(--row) * 0.23); }
/* One line between subjects (the official's double hairline is not wanted). */
tbody.subject + tbody.subject tr.first td, tbody.subject + tbody.subject td.span { border-top: 0.3mm solid #000; }

.gpa { position: relative; height: 4.3mm; margin-top: 1.2mm; font-size: 12pt; font-weight: bold; }
.gpa-label { right: 47.1mm; top: 0; }
.gpa-value { left: 147.6mm; top: 0; }

.foot { font-size: 14pt; }
.sign { left: 133.8mm; width: 76mm; text-align: center; font-weight: bold; }
.rule { position: absolute; left: 16.1mm; top: 264.5mm; width: 187.3mm; border-top: 0.4mm solid #000; }
.note { left: 17.4mm; right: 6.6mm; top: 267.55mm; white-space: pre-wrap; }
/* Long values shrink (fitPt) and may wrap inside their space instead of running off the page. */
.wrap { white-space: normal; }

.watermark { position: absolute; top: 38%; left: 0; right: 0; text-align: center; font-size: 64pt; color: rgba(200,0,0,.12); transform: rotate(-28deg); font-weight: bold; }
`);

const NOTE_CREDIT_HOUR = 'Note : 1 Credit Hour is equal to 32 working hours.';
const NOTE_INTERNAL = [
  'IN (Internal) : Project work, Practical, Presentation, Community Work, Presentation,',
  // Spaces line "Terminal Examinations" up under "Project", as on the official sheet.
  `${' '.repeat(22)}Terminal Examinations`,
];
const NOTE_THEORY = 'TH (Theory): Written External Examination';

export const DEFAULT_GRADESHEET_NOTE = [NOTE_CREDIT_HOUR, ...NOTE_INTERNAL, NOTE_THEORY].join('\n');
/** Default note for theory-only terminal exams, which print no internal rows. */
export const THEORY_ONLY_GRADESHEET_NOTE = [NOTE_CREDIT_HOUR, NOTE_THEORY].join('\n');

const DOTS = '....................................................';

/** 'YYYY-MM-DD' -> 'M/D/YYYY' as printed on the school's grade sheet. */
export function slashDate(iso: string | null): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${Number(m[2])}/${Number(m[3])}/${m[1]}` : '';
}

/** 2.4 / 4 / 3.6 – grade points without trailing zeros, like the official sheet. */
const gp = (v: number | null) => (v === null ? '' : String(Number(v.toFixed(2))));

const typeLabel = { TH: 'Th', IN: 'In' } as const;

/** Body row height: the official 8.6 mm, smaller when more rows must fit above the footer. */
export function rowHeightMm(rows: number): number {
  return rows <= 0 ? ROW_MM : Math.min(ROW_MM, Math.floor((ROWS_AREA_MM / rows) * 100) / 100);
}

/**
 * Font size that fits `len` characters where `fitLen` characters fit at `basePt` (shrinking in
 * half points, never below `minPt`). Text that still doesn't fit wraps or is clipped by its box.
 */
export function fitPt(len: number, fitLen: number, basePt: number, minPt: number): number {
  if (len <= fitLen) return basePt;
  return Math.max(minPt, Math.floor(((basePt * fitLen) / len) * 2) / 2);
}

const NOTE_WIDTH_MM = 186; // 17.4 mm to 6.6 mm from the right edge
const NOTE_HEIGHT_MM = 29; // from 267.55 mm to the bottom of the sheet
const PT_MM = 25.4 / 72;

/** Largest note size (14pt as on the official sheet) whose estimated lines fit above the page bottom. */
export function noteFontPt(note: string): number {
  for (let pt = 14; pt > 6; pt -= 0.5) {
    const charsPerLine = Math.floor(NOTE_WIDTH_MM / (pt * PT_MM * 0.43)); // ≈ average Times character width
    const lines = note.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / charsPerLine)), 0);
    if (lines * pt * (5.75 / 14) <= NOTE_HEIGHT_MM) return pt;
  }
  return 6;
}

/** Absolutely positioned text at x/y millimetres (the y is the top of the line box). */
const at = (x: number, y: number, body: SafeHtml | string, cls = '', style = '') =>
  html`<div class="a ${cls}" style="left:${x}mm;top:${y}mm;${style}">${body}</div>`;

const SUBJECT_MIN_PT = 6.5;

function subjectRows(s: GradeSheetData['result']['subjects'][number], cellPt: number): SafeHtml {
  const n = s.components.length;
  // "Comp. Soc. Std. & life Skill (Th)" (33 characters) is the longest label that fits at full size.
  const subjPt = fitPt(s.name.length + 5, 33, cellPt, SUBJECT_MIN_PT);
  return html`<tbody class="subject">${s.components.map(
    (c, i) => html`<tr class="${[i === 0 ? 'first' : '', i === n - 1 ? 'last' : ''].join(' ')}">
      <td class="code">${c.code}</td>
      <td class="subj ${subjPt === SUBJECT_MIN_PT ? 'wrap' : ''}" style="font-size:${subjPt}pt">${s.name} (${typeLabel[c.type]})</td>
      <td class="ch">${c.creditHour.toFixed(2)}</td>
      <td class="gp">${c.outcome === 'ABSENT' || c.outcome === 'WITHHELD' ? '' : gp(c.gradePoint)}</td>
      <td class="grade">${c.grade}</td>
      ${i === 0 ? html`<td class="fg span" rowspan="${n}">${s.finalGrade}</td><td class="c span" rowspan="${n}">${s.remarks}</td>` : ''}
    </tr>`,
  )}</tbody>`;
}

function sheet(d: GradeSheetData, logo: string | null): SafeHtml {
  const { school, exam, student, result } = d;
  const gpa = result.gpaWithheld ? '—' : formatGp(result.gpa);
  const rows = result.subjects.reduce((sum, s) => sum + s.components.length, 0);
  const row = rowHeightMm(rows);
  // Text shrinks with shorter rows so a row never grows past its height.
  const cellPt = Math.min(12, Math.floor(((12 * row) / ROW_MM) * 2) / 2);
  const examLine = `IN THE ${exam.name.toUpperCase()} EXAMINATION CONDUCTED IN ${exam.examYearBs} B.S. (${exam.examYearAd} A.D.)`;
  const note = school.gradesheetNote ?? (exam.theoryOnly ? THEORY_ONLY_GRADESHEET_NOTE : DEFAULT_GRADESHEET_NOTE);
  const notePt = noteFontPt(note);

  return html`<section class="sheet" style="--row:${row}mm;--cell:${cellPt}pt">
    ${hasMissingMarks(result)
      ? html`<div class="watermark">INCOMPLETE</div>`
      : d.provisional
        ? html`<div class="watermark">PROVISIONAL</div>`
        : ''}
    ${logo ? html`<div class="a logo"><img src="${logo}" alt=""></div>` : ''}
    <div class="a school">${school.name}</div>
    ${school.address ? html`<div class="a addr">${school.address}</div>` : ''}
    <div class="a title">GRADE-SHEET</div>

    <div class="info">
      ${at(12.6, 45.3, 'THE GRADE(S) SECURED BY:')}
      ${at(89.4, 45.3, html`<b>${student.fullName.toUpperCase()}</b>`, 'wrap', `max-width:114mm;font-size:${fitPt(student.fullName.length, 32, 14, 8)}pt`)}
      ${at(12.6, 54.8, 'DATE OF BIRTH:')}
      ${at(58.4, 54.8, html`<b>${slashDate(student.dobBs)}</b>`)}
      ${at(84.9, 54.8, html`<b>B.S.</b>`)}
      ${at(99.5, 54.8, html`<b>(</b>`)}
      ${at(109.3, 54.8, html`<b>${slashDate(student.dobAd)} A.D.</b><b class="close">)</b>`)}
      ${at(12.6, 64.9, 'REGISTRATION NO.')}
      ${at(60.6, 64.9, html`<b>${student.nebRegistrationNo ?? ''}</b>`)}
      ${at(101.5, 64.9, 'SYMBOL NO.')}
      ${at(136.2, 64.9, html`<b>${student.symbolNo ?? ''}</b>`)}
      ${at(162.7, 64.9, html`<b>GRADE ${exam.gradeRoman}</b>`)}
      ${at(12.6, 74.4, html`IN THE ${exam.name.toUpperCase()} EXAMINATION CONDUCTED IN<b class="gap">${exam.examYearBs} B.S. (${exam.examYearAd} A.D.)</b>`, 'wrap', `max-width:191mm;font-size:${fitPt(examLine.length, 70, 14, 8)}pt`)}
      ${at(12.6, 83.9, 'ARE GIVEN BELOW.')}
    </div>

    <div class="body">
    <table>
      <colgroup>
        <col style="width:25.3mm"><col style="width:60.05mm"><col style="width:16.65mm"><col style="width:22mm">
        <col style="width:18.8mm"><col style="width:19.8mm"><col style="width:23.1mm">
      </colgroup>
      <thead><tr>
        <th>SUBJECT<br>CODE</th>
        <th class="subjects">SUBJECTS</th>
        <th>CREDIT<br>HOURS<br>(CH)</th>
        <th>GRADE<br>POINT<br>(GP)</th>
        <th>GRADE</th>
        <th>FINAL<br>GRADE<br>(FG)</th>
        <th>REMARKS</th>
      </tr></thead>
      ${result.subjects.map((s) => subjectRows(s, cellPt))}
    </table>
    <div class="gpa"><div class="a gpa-label">Grade Point Average (GPA)</div><div class="a gpa-value">${gpa}</div></div>
    </div>

    <div class="foot">
      ${at(16.3, 234.0, html`PREPARED BY:-${school.preparedByName ? html` <b>${school.preparedByName}</b>` : DOTS}`)}
      ${at(16.3, 244.8, html`CHECKED BY:-${school.checkedByName ? html` <b>${school.checkedByName}</b>` : DOTS}`)}
      ${at(16.3, 255.7, 'DATE OF ISSUE:-')}
      ${exam.issueDateBs ? at(58.7, 255.7, html`<b>${exam.issueDateBs} B.S.</b>`) : ''}
      <div class="a sign" style="top:246.2mm">........................................</div>
      ${school.principalName ? html`<div class="a sign" style="top:252.0mm;font-size:${fitPt(school.principalName.length, 22, 14, 8)}pt">${school.principalName.toUpperCase()}</div>` : ''}
      <div class="a sign" style="top:257.8mm">${school.principalTitle.toUpperCase()}</div>
    </div>
    <div class="rule"></div>
    <div class="a note" style="font-size:${notePt}pt;line-height:${Math.round(((5.75 * notePt) / 14) * 100) / 100}mm">${note}</div>
  </section>`;
}

export function gradeSheetsHtml(sheets: GradeSheetData[], logo: string | null, generatedAt = new Date()): string {
  // Becomes the PDF title (shown on the browser tab), so an old tab can't be mistaken for a fresh print.
  const first = sheets[0];
  const who = sheets.length === 1 && first ? first.student.fullName : `${sheets.length} students`;
  const stamp = generatedAt.toLocaleString('en-GB', { timeZone: 'Asia/Kathmandu', dateStyle: 'medium', timeStyle: 'short' });
  const title = first ? `${first.exam.name} grade sheets – ${who} – generated ${stamp}` : 'Grade sheets';
  return html`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head>
  <body>${sheets.map((s) => sheet(s, logo))}</body></html>`.value;
}
