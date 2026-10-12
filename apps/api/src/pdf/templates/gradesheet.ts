import { formatGp, hasMissingMarks, type GradeSheetData } from '@svi/shared';
import { html, raw, type SafeHtml } from '../html.js';

/*
 * Layout follows the school's official "Format of grade sheet.pdf" (Times, A4 portrait):
 * letterhead with round logo, label/value lines, paired TH/IN rows per subject,
 * GPA line, signatures and the credit-hour note.
 */
const css = raw(`
@page { size: A4; margin: 14mm 15mm 12mm; }
* { box-sizing: border-box; }
body { font-family: "Times New Roman", "Liberation Serif", "Noto Serif", Times, serif; color: #000; font-size: 11.5pt; margin: 0; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
.sheet { position: relative; }
.sheet + .sheet { break-before: page; }

.head { display: grid; grid-template-columns: 96px 1fr 96px; align-items: start; text-align: center; break-inside: avoid; }
/* Fixed, clipped box: Chromium otherwise bleeds a sliver of large downscaled PNGs onto the previous page. */
.head .logo { width: 88px; height: 88px; margin-left: 4px; overflow: hidden; contain: paint; }
.head .logo img { display: block; width: 100%; height: 100%; object-fit: contain; }
.head h1 { font-size: 22pt; font-weight: bold; margin: 0; letter-spacing: .2px; }
.head .addr { font-size: 11pt; font-weight: bold; margin-top: 4px; }
.head .title { font-size: 12.5pt; font-weight: bold; margin-top: 18px; }

.info { margin-top: 18px; line-height: 2.05; }
.info b { font-weight: bold; }
.gap { display: inline-block; width: 26px; }
.gap-s { display: inline-block; width: 12px; }

table { width: 100%; border-collapse: collapse; margin-top: 2px; border: 1px solid #000; }
th { font-weight: normal; font-size: 10pt; line-height: 1.15; padding: 4px 3px; border-left: 1px solid #000; border-bottom: 2px solid #000; text-align: center; vertical-align: middle; }
th:first-child { border-left: 0; }
td { font-weight: bold; font-size: 10.5pt; padding: 3px 6px; border-left: 1px solid #000; vertical-align: middle; }
td:first-child { border-left: 0; }
td.c { text-align: center; }
td.l { text-align: left; }
tr.first td { padding-top: 8px; }
tr.last td { padding-bottom: 8px; }
tbody.subject + tbody.subject tr.first td { border-top: 3px double #000; }
td.span { border-top: 3px double #000; }
tbody.subject:first-of-type td.span { border-top: 0; }

.gpa { margin-top: 6px; text-align: right; padding-right: 21%; font-weight: bold; font-size: 10.5pt; }
.gpa span { display: inline-block; margin-left: 22px; }

.foot { margin-top: 64px; display: flex; justify-content: space-between; align-items: flex-end; }
.foot .left { line-height: 1; }
.foot .left p { margin: 0 0 20px; }
.foot .left p:last-child { margin-bottom: 0; }
.foot .right { text-align: center; font-weight: bold; font-size: 11pt; line-height: 1.25; padding-right: 6px; }
.rule { border-top: 1.5px solid #000; margin: 12px -15mm 0 0; }
.note { margin-top: 8px; font-size: 10.5pt; line-height: 1.3; white-space: pre-wrap; padding-left: 8px; }

.watermark { position: absolute; top: 38%; left: 0; right: 0; text-align: center; font-size: 64pt; color: rgba(200,0,0,.12); transform: rotate(-28deg); font-weight: bold; }
`);

const NOTE_CREDIT_HOUR = 'Note : 1 Credit Hour is equal to 32 working hours.';
const NOTE_INTERNAL = [
  'IN (Internal) : Project work, Practical, Presentation, Community Work, Presentation,',
  '            Terminal Examinations',
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

function subjectRows(s: GradeSheetData['result']['subjects'][number]): SafeHtml {
  const n = s.components.length;
  return html`<tbody class="subject">${s.components.map(
    (c, i) => html`<tr class="${[i === 0 ? 'first' : '', i === n - 1 ? 'last' : ''].join(' ')}">
      <td class="c">${c.code}</td>
      <td class="l">${s.name} (${typeLabel[c.type]})</td>
      <td class="c">${c.creditHour.toFixed(2)}</td>
      <td class="c">${c.outcome === 'ABSENT' || c.outcome === 'WITHHELD' ? '' : gp(c.gradePoint)}</td>
      <td class="c">${c.grade}</td>
      ${i === 0 ? html`<td class="c span" rowspan="${n}">${s.finalGrade}</td><td class="c span" rowspan="${n}">${s.remarks}</td>` : ''}
    </tr>`,
  )}</tbody>`;
}

function sheet(d: GradeSheetData, logo: string | null): SafeHtml {
  const { school, exam, student, result } = d;
  const gpa = result.gpaWithheld ? '—' : formatGp(result.gpa);
  const examName = exam.name.toUpperCase();

  return html`<section class="sheet">
    ${hasMissingMarks(result)
      ? html`<div class="watermark">INCOMPLETE</div>`
      : d.provisional
        ? html`<div class="watermark">PROVISIONAL</div>`
        : ''}
    <div class="head">
      <div>${logo ? html`<div class="logo"><img src="${logo}" alt=""></div>` : ''}</div>
      <div>
        <h1>${school.name}</h1>
        ${school.address ? html`<div class="addr">${school.address}</div>` : ''}
        <div class="title">GRADE-SHEET</div>
      </div>
      <div></div>
    </div>

    <div class="info">
      <div>THE GRADE(S) SECURED BY:<span class="gap"></span><b>${student.fullName.toUpperCase()}</b></div>
      <div>DATE OF BIRTH:<span class="gap"></span><b>${slashDate(student.dobBs)}</b><span class="gap-s"></span><b>B.S.</b><span class="gap-s"></span><b>(</b><span class="gap"></span><b>${slashDate(student.dobAd)} A.D.</b><span class="gap-s"></span><b>)</b></div>
      <div>REGISTRATION NO.<span class="gap-s"></span><b>${student.nebRegistrationNo ?? ''}</b><span class="gap"></span><span class="gap"></span>SYMBOL NO.<span class="gap-s"></span><b>${student.symbolNo ?? ''}</b><span class="gap"></span><b>GRADE ${exam.gradeRoman}</b></div>
      <div>IN THE ${examName} EXAMINATION CONDUCTED IN<span class="gap-s"></span><b>${exam.examYearBs} B.S. (${exam.examYearAd} A.D.)</b></div>
      <div>ARE GIVEN BELOW.</div>
    </div>

    <table>
      <colgroup>
        <col style="width:12%"><col style="width:34%"><col style="width:9%"><col style="width:10%">
        <col style="width:10%"><col style="width:10%"><col style="width:15%">
      </colgroup>
      <thead><tr>
        <th>SUBJECT<br>CODE</th>
        <th>SUBJECTS</th>
        <th>CREDIT<br>HOURS<br>(CH)</th>
        <th>GRADE<br>POINT<br>(GP)</th>
        <th>GRADE</th>
        <th>FINAL<br>GRADE<br>(FG)</th>
        <th>REMARKS</th>
      </tr></thead>
      ${result.subjects.map(subjectRows)}
    </table>
    <div class="gpa">Grade Point Average (GPA)<span>${gpa}</span></div>

    <div class="foot">
      <div class="left">
        <p>PREPARED BY:-${school.preparedByName ? html` <b>${school.preparedByName}</b>` : DOTS}</p>
        <p>CHECKED BY:-${school.checkedByName ? html` <b>${school.checkedByName}</b>` : DOTS}</p>
        <p>DATE OF ISSUE:-<span class="gap-s"></span><b>${exam.issueDateBs ? `${exam.issueDateBs} B.S.` : ''}</b></p>
      </div>
      <div class="right">
        <div>........................................</div>
        ${school.principalName ? html`<div>${school.principalName.toUpperCase()}</div>` : ''}
        <div>${school.principalTitle.toUpperCase()}</div>
      </div>
    </div>
    <div class="rule"></div>
    <div class="note">${school.gradesheetNote ?? (exam.theoryOnly ? THEORY_ONLY_GRADESHEET_NOTE : DEFAULT_GRADESHEET_NOTE)}</div>
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
