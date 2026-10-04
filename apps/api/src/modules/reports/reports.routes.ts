import { Router, type Response } from 'express';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import { formatGp, idSchema, resultsQuery } from '@svi/shared';
import { ctxOf, recordAudit } from '../../lib/audit.js';
import { notFound, parse } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { renderPdf } from '../../pdf/browser.js';
import { gradeSheetsHtml } from '../../pdf/templates/gradesheet.js';
import { ledgerColumns, ledgerHtml, markText } from '../../pdf/templates/ledger.js';
import { getExam, toExamDto } from '../exams/exams.service.js';
import { gradeSheets, examResultRows } from '../results/results.service.js';
import { getSettingsRow, logoDataUri, toSchoolInfo } from '../settings/settings.service.js';

export const reportsRouter = Router();

const examParams = z.object({ examId: idSchema });
const sheetQuery = resultsQuery.extend({ enrollmentId: idSchema.optional() });

const safeName = (s: string) => s.replace(/[^\w.-]+/g, '_').slice(0, 80);

function sendFile(res: Response, buf: Buffer, mime: string, filename: string) {
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(filename)}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buf);
}

reportsRouter.get('/exams/:examId/gradesheets.pdf', async (req, res) => {
  const { examId } = parse(examParams, req.params);
  const q = parse(sheetQuery, req.query);
  const exam = await getExam(prisma, examId);
  const sheets = await gradeSheets(examId, {
    streamId: q.streamId,
    section: q.section,
    enrollmentIds: q.enrollmentId ? [q.enrollmentId] : undefined,
  });
  if (sheets.length === 0) throw notFound('Results for this selection');
  const pdf = await renderPdf(gradeSheetsHtml(sheets, await logoDataUri()));
  await recordAudit(prisma, ctxOf(req), {
    action: 'PRINT_GRADESHEETS',
    entity: 'exam',
    entityId: examId,
    after: { count: sheets.length, ...q },
  });
  const who = sheets.length === 1 ? sheets[0]!.student.fullName : `${sheets.length}-students`;
  sendFile(res, pdf, 'application/pdf', `gradesheet_${exam.name}_G${exam.grade}_${who}.pdf`);
});

async function ledgerData(examId: number, q: z.output<typeof resultsQuery>) {
  const exam = await getExam(prisma, examId);
  const rows = await examResultRows(examId, q);
  if (rows.length === 0) throw notFound('Students for this selection');
  const stream = q.streamId ? (await prisma.stream.findUnique({ where: { id: q.streamId } }))?.name : undefined;
  const subtitle = [stream, q.section && `Section ${q.section}`].filter(Boolean).join(' · ');
  return { exam, rows, subtitle };
}

reportsRouter.get('/exams/:examId/ledger.pdf', async (req, res) => {
  const { examId } = parse(examParams, req.params);
  const q = parse(resultsQuery, req.query);
  const { exam, rows, subtitle } = await ledgerData(examId, q);
  const school = toSchoolInfo(await getSettingsRow());
  const pdf = await renderPdf(ledgerHtml(school, toExamDto(exam), rows, subtitle), { landscape: true });
  sendFile(res, pdf, 'application/pdf', `ledger_${exam.name}_G${exam.grade}.pdf`);
});

reportsRouter.get('/exams/:examId/ledger.xlsx', async (req, res) => {
  const { examId } = parse(examParams, req.params);
  const q = parse(resultsQuery, req.query);
  const { exam, rows, subtitle } = await ledgerData(examId, q);
  const cols = ledgerColumns(rows);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SVI Exam App';
  const ws = wb.addWorksheet('Ledger', { views: [{ state: 'frozen', xSplit: 4, ySplit: 3 }] });
  ws.addRow([`${exam.name} · Grade ${exam.grade} · ${exam.academicYear.name}${subtitle ? ` · ${subtitle}` : ''}`]);
  const header1: string[] = ['Roll', 'Symbol No.', 'Reg. No.', 'Name'];
  const header2: string[] = ['', '', '', ''];
  for (const c of cols) {
    c.components.forEach((k, i) => {
      header1.push(i === 0 ? c.name : '');
      header2.push(`${k.type} (${k.fullMark})`);
    });
    header1.push('');
    header2.push('FG');
  }
  header1.push('GPA', 'Result');
  header2.push('', '');
  ws.addRow(header1).font = { bold: true };
  ws.addRow(header2).font = { bold: true };

  for (const r of rows) {
    const bySubject = new Map(r.result.subjects.map((s) => [s.subjectId, s]));
    const cells: (string | number)[] = [r.rollNo ?? '', r.symbolNo ?? '', r.nebRegistrationNo ?? '', r.fullName];
    for (const c of cols) {
      const s = bySubject.get(c.subjectId);
      for (const k of c.components) {
        const comp = s?.components.find((x) => x.componentId === k.componentId);
        cells.push(comp?.status === 'PRESENT' && comp.marks !== null ? comp.marks : markText(comp));
      }
      cells.push(s?.finalGrade ?? '');
    }
    cells.push(r.result.gpaWithheld ? '—' : formatGp(r.result.gpa), r.result.outcome);
    ws.addRow(cells);
  }
  ws.getColumn(4).width = 28;
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  sendFile(res, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', `ledger_${exam.name}_G${exam.grade}.xlsx`);
});
