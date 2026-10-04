/**
 * One-time import of the old Access exam database (exported to CSV by tools/import-access/export-accdb.ps1).
 *
 *   npm run import:access -w @svi/api -- --dir ../../tools/import-access/out \
 *     --year 2081 --grade 11 --exam "Final" [--exam-year-bs 2081 --exam-year-ad 2024] [--publish] [--dry-run]
 *
 * --exam-year-bs/--exam-year-ad are optional; without them the grade sheet prints the academic year.
 *
 * Idempotent: students are matched by admission number, enrollments by (student, year),
 * marks by (exam, enrollment, component). --dry-run rolls everything back at the end.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { formatGp } from '@svi/shared';
import { prisma } from '../lib/prisma.js';
import { computeExamResults, publishExam } from '../modules/results/results.service.js';
import { validateSubjectSelection } from '../modules/subjects/curriculum.logic.js';
import { defaultGradeScaleId, loadGroupRules } from '../modules/subjects/subjects.service.js';
import { getExam } from '../modules/exams/exams.service.js';
import { transformAccess } from './importAccess.transform.js';

const { values: args } = parseArgs({
  options: {
    dir: { type: 'string', default: '../../tools/import-access/out' },
    year: { type: 'string' },
    grade: { type: 'string', default: '11' },
    exam: { type: 'string', default: 'Final' },
    'exam-year-bs': { type: 'string' },
    'exam-year-ad': { type: 'string' },
    'admission-prefix': { type: 'string', default: 'SVI-' },
    section: { type: 'string', default: 'A' },
    publish: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

class DryRunRollback extends Error {}

async function main() {
  if (!args.year) {
    throw new Error('Required: --year <academic year, e.g. 2081>');
  }
  const grade = Number(args.grade);
  if (grade !== 11 && grade !== 12) throw new Error('--grade must be 11 or 12');
  const dir = path.resolve(args.dir!);
  const read = (f: string) => readFile(path.join(dir, f), 'utf8');
  const data = transformAccess(
    {
      studentDetails: await read('StudentDetails.csv'),
      nebDetails: await read('NEB_Details.csv'),
      subject: await read('Subject.csv'),
      scores: await read('Scores.csv'),
    },
    args['admission-prefix'],
  );
  console.log(`Read ${data.students.length} students, ${data.subjects.length} subject components`);

  const components = await prisma.subjectComponent.findMany({ where: { subject: { grade } }, include: { subject: true } });
  const componentByCode = new Map(components.map((c) => [c.nebCode, c]));
  const missing = data.subjects.filter((s) => !componentByCode.has(s.code));
  if (missing.length) {
    throw new Error(`Subjects missing in the database (run the seed or add them): ${missing.map((m) => m.code).join(', ')}`);
  }
  const streams = await prisma.stream.findMany();
  const streamByName = new Map(streams.map((s) => [s.name.toLowerCase(), s]));

  const warnings = [...data.warnings];
  let examId = 0;
  try {
    await prisma.$transaction(
      async (tx) => {
        // A newly created year becomes the current one when no year is current yet.
        const hasCurrent = (await tx.academicYear.count({ where: { isCurrent: true } })) > 0;
        const year = await tx.academicYear.upsert({
          where: { name: args.year! },
          create: { name: args.year!, isCurrent: !hasCurrent },
          update: {},
        });
        const exam = await tx.exam.upsert({
          where: { academicYearId_grade_name: { academicYearId: year.id, grade, name: args.exam! } },
          create: {
            academicYearId: year.id,
            grade,
            name: args.exam!,
            type: 'FINAL',
            examYearBs: args['exam-year-bs'] ?? null,
            examYearAd: args['exam-year-ad'] ?? null,
            status: 'MARK_ENTRY',
            gradeScaleId: await defaultGradeScaleId(tx),
          },
          update: {},
        });
        if (exam.status !== 'MARK_ENTRY') throw new Error(`Exam "${exam.name}" is ${exam.status}; unpublish it before re-importing`);
        examId = exam.id;

        let markCount = 0;
        for (const s of data.students) {
          const stream = streamByName.get(s.stream.toLowerCase());
          if (!stream) {
            warnings.push(`Student ${s.legacyId}: unknown stream "${s.stream}", skipped`);
            continue;
          }
          const studentData = {
            firstName: s.firstName,
            middleName: s.middleName,
            lastName: s.lastName,
            gender: s.gender,
            dobBs: s.dobBs,
            dobAd: s.dobAd ? new Date(s.dobAd) : null,
            nebRegistrationNo: s.nebRegistrationNo,
          };
          const student = await tx.student.upsert({
            where: { admissionNo: s.admissionNo },
            create: { admissionNo: s.admissionNo, ...studentData },
            update: studentData,
          });

          const subjectIds = [...new Set(s.scores.map((sc) => componentByCode.get(sc.thCode)!.subjectId))];
          const problems = validateSubjectSelection(await loadGroupRules(tx, stream.id, grade), subjectIds);
          problems.forEach((p) => warnings.push(`Student ${s.legacyId}: ${p}`));

          const enrollment = await tx.enrollment.upsert({
            where: { studentId_academicYearId: { studentId: student.id, academicYearId: year.id } },
            create: {
              studentId: student.id,
              academicYearId: year.id,
              grade,
              streamId: stream.id,
              section: args.section!,
              rollNo: s.legacyId,
              symbolNo: s.symbolNo,
            },
            update: { streamId: stream.id, symbolNo: s.symbolNo },
          });
          await tx.enrollmentSubject.deleteMany({ where: { enrollmentId: enrollment.id } });
          await tx.enrollmentSubject.createMany({ data: subjectIds.map((subjectId) => ({ enrollmentId: enrollment.id, subjectId })) });

          for (const sc of s.scores) {
            for (const [code, value] of [[sc.thCode, sc.thMarks], [sc.inCode, sc.inMarks]] as const) {
              const c = componentByCode.get(code)!;
              if (value !== null && value > Number(c.fullMark)) {
                warnings.push(`Student ${s.legacyId}: ${code} marks ${value} > full mark, skipped`);
                continue;
              }
              await tx.mark.upsert({
                where: { examId_enrollmentId_subjectComponentId: { examId: exam.id, enrollmentId: enrollment.id, subjectComponentId: c.id } },
                create: { examId: exam.id, enrollmentId: enrollment.id, subjectComponentId: c.id, marks: value },
                update: { marks: value, status: 'PRESENT', version: { increment: 1 } },
              });
              markCount++;
            }
          }
        }
        console.log(`Imported ${data.students.length} students, ${markCount} marks into "${exam.name}" (${year.name}, Grade ${grade})`);

        // Spot-check results against the old Access grade sheets.
        const results = await computeExamResults(tx, await getExam(tx, exam.id));
        const summary = { PASS: 0, NG: 0, INCOMPLETE: 0 };
        results.forEach((r) => summary[r.result.outcome]++);
        console.log('Outcomes:', summary);
        for (const r of results.slice(0, 5)) {
          console.log(`  ${r.rollNo} ${r.fullName.padEnd(28)} GPA ${r.result.gpaWithheld ? 'withheld' : formatGp(r.result.gpa)} ${r.result.outcome}`);
        }
        if (args['dry-run']) throw new DryRunRollback();
      },
      { timeout: 300_000, maxWait: 10_000 },
    );
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
    console.log('Dry run: all changes rolled back.');
  }

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    warnings.forEach((w) => console.log(`  - ${w}`));
  }

  if (args.publish && !args['dry-run']) {
    const r = await publishExam(examId, false, 'Imported from Access', { userId: null, ip: null });
    console.log(`Published ${r.published} grade sheets.`);
  }
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
