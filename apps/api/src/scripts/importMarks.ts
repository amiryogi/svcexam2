/**
 * Imports exam marks from a teachers' Excel workbook (one sheet per class, see importMarks.transform.ts).
 *
 *   node dist/scripts/importMarks.js --file "First Term 2083.xlsx" --year 2083 --exam "First Term"
 *     [--create-students] [--default-gender O] [--admission-prefix SVI-2083-] [--section A]
 *     [--user <username>] [--commit] [--parse-only]
 *   (locally: npm run import:marks -w @svi/api -- --file … )
 *
 * Without --commit it only reports what it would do. Each grade's exam is found by academic year, grade
 * and name. Students are matched by stream and roll number and checked by name; the marks are saved
 * through saveMarks(), the same code as mark entry in the app (full-mark and subject checks, audit log).
 * Excel wins: marks already in the app are overwritten. Blank cells and "*" leave the mark as it is.
 *
 * --create-students: students not found in the year's class are created and enrolled (stream, roll,
 * subjects = the sheet's non-blank columns, gender from a "Gender" column), unless a student with the
 * same name already exists anywhere in the app: those are reported, to be enrolled or promoted in the app.
 * --default-gender M|F|O: gender for new students whose sheet has none (a placeholder to correct in the app).
 */
import { parseArgs } from 'node:util';
import ExcelJS from 'exceljs';
import type { z } from 'zod';
import { fullName, type marksUpsertSchema } from '@svi/shared';
import { recordAudit, type Ctx } from '../lib/audit.js';
import { num, prisma } from '../lib/prisma.js';
import { effectiveComponents } from '../modules/exams/exams.service.js';
import { saveMarks } from '../modules/marks/marks.service.js';
import { validateSubjectSelection } from '../modules/subjects/curriculum.logic.js';
import { loadGroupRules } from '../modules/subjects/subjects.service.js';
import {
  parseGender,
  parseMarksSheets,
  closestName,
  nameSimilarity,
  sameName,
  SIMILAR,
  splitName,
  type Gender,
  type ParsedWorkbook,
  type SheetStudent,
} from './importMarks.transform.js';

const { values: args } = parseArgs({
  options: {
    file: { type: 'string' },
    year: { type: 'string' },
    exam: { type: 'string' },
    user: { type: 'string' },
    'create-students': { type: 'boolean', default: false },
    'default-gender': { type: 'string' },
    /** Default: SVI-<year>- */
    'admission-prefix': { type: 'string' },
    section: { type: 'string', default: 'A' },
    commit: { type: 'boolean', default: false },
    'parse-only': { type: 'boolean', default: false },
  },
});

type Item = z.output<typeof marksUpsertSchema>['items'][number];
const CHUNK = 500;
/** From --default-gender, checked in main(). */
let defaultGender: Gender | null = null;

interface NewStudent {
  label: string;
  /** Gender came from --default-gender, not the sheet. */
  placeholderGender: boolean;
  admissionNo: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  gender: Gender;
  grade: number;
  streamId: number;
  rollNo: number | null;
  subjectIds: number[];
}

interface Plan {
  report: string[];
  warnings: string[];
  errors: string[];
  exams: { examId: number; label: string; items: Item[] }[];
  toCreate: NewStudent[];
}

/** Plain cell values: formula results, rich text and hyperlinks flattened. */
function cellValue(v: ExcelJS.CellValue): unknown {
  if (v === null || v === undefined || typeof v !== 'object' || v instanceof Date) return v;
  if ('result' in v) return v.result;
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('text' in v) return v.text;
  return null;
}

async function readWorkbook(file: string) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  return wb.worksheets.map((ws) => {
    const rows: unknown[][] = [];
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const cells: unknown[] = [];
      for (let c = 1; c <= ws.columnCount; c++) cells.push(cellValue(row.getCell(c).value));
      rows.push(cells);
    }
    return { name: ws.name, rows };
  });
}

const fmt = (e: { status: string; marks: number | null }) =>
  e.status === 'PRESENT' ? String(e.marks) : e.status;

/** Works out everything the import would do, without writing anything. */
async function plan(parsed: ParsedWorkbook, yearId: number, yearName: string): Promise<Plan> {
  const p: Plan = { report: [], warnings: [], errors: [], exams: [], toCreate: [] };
  const { report, warnings, errors } = p;
  const streams = new Map((await prisma.stream.findMany()).map((s) => [s.code, s]));
  const section = args.section!;
  const prefix = args['admission-prefix'] ?? `SVI-${yearName}-`;
  const everyone = args['create-students']
    ? await prisma.student.findMany({
        where: { deletedAt: null },
        include: { enrollments: { include: { academicYear: true, stream: true } } },
      })
    : [];
  const admissionNos = new Set(everyone.map((s) => s.admissionNo));

  for (const grade of [...new Set(parsed.classes.map((c) => c.grade))].sort()) {
    // ── The exam ──
    const exams = await prisma.exam.findMany({
      where: { academicYearId: yearId, grade },
      orderBy: { id: 'asc' },
    });
    const wanted = args.exam!.trim().toLowerCase();
    let matches = exams.filter((e) => e.name.trim().toLowerCase() === wanted);
    if (matches.length === 0) matches = exams.filter((e) => e.name.toLowerCase().includes(wanted));
    if (matches.length !== 1) {
      errors.push(
        `Grade ${grade}: ${matches.length ? 'several exams match' : 'no exam matches'} "${args.exam}" in ${yearName}. ` +
          `Exams: ${exams.map((e) => `"${e.name}"`).join(', ') || 'none'}`,
      );
      continue;
    }
    const exam = matches[0]!;
    const label = `Grade ${grade} "${exam.name}" (id ${exam.id}, ${exam.status.replace('_', ' ').toLowerCase()})`;
    report.push(`\n═══ ${label}`);
    if (exam.status !== 'MARK_ENTRY') {
      errors.push(
        `${label}: marks can only be saved in MARK ENTRY. Open mark entry for this exam in the app first.`,
      );
    }

    const components = (await effectiveComponents(prisma, exam)).filter((c) => c.included);
    const subjects = await prisma.subject.findMany({ where: { grade } });
    const familyOf = new Map(subjects.map((s) => [s.id, s.familyCode]));
    const subjectByFamily = new Map(subjects.map((s) => [s.familyCode, s]));
    const thByFamily = new Map(
      components.filter((c) => c.type === 'TH').map((c) => [familyOf.get(c.subjectId)!, c]),
    );
    if (components.some((c) => c.type === 'IN')) {
      warnings.push(
        `${label} also counts internal (IN) marks, which the workbook does not have; they stay empty.`,
      );
    }
    // Roll numbers are unique per year, grade and section, across streams.
    const takenRolls = new Set(
      (
        await prisma.enrollment.findMany({
          where: { academicYearId: yearId, grade, section },
          select: { rollNo: true },
        })
      ).map((e) => e.rollNo),
    );

    const items: Item[] = [];
    const counts = { new: 0, changed: 0, unchanged: 0, absent: 0, newStudents: 0, theirMarks: 0 };
    for (const cls of parsed.classes.filter((c) => c.grade === grade)) {
      const where = `"${cls.sheet}"`;
      // Full marks in the sheet must match the exam's theory components.
      for (const [family, fm] of new Map(
        cls.students.flatMap((s) => s.cells.map((c) => [c.family, c.fullMark])),
      )) {
        const comp = thByFamily.get(family);
        if (!comp) errors.push(`${where}: ${family} has no theory component in ${label}`);
        else if (comp.fullMark !== fm)
          errors.push(
            `${where}: ${family} FM ${fm} in the sheet, but ${comp.fullMark} in ${label}`,
          );
      }

      const stream = streams.get(cls.streamCode);
      if (!stream) {
        errors.push(`${where}: stream ${cls.streamCode} not found`);
        continue;
      }
      const enrollments = await prisma.enrollment.findMany({
        where: {
          academicYearId: yearId,
          grade,
          streamId: stream.id,
          student: { deletedAt: null },
        },
        include: { student: true, subjects: true, marks: { where: { examId: exam.id } } },
      });
      const nameOf = (e: (typeof enrollments)[number]) => fullName(e.student);
      const groupRules = args['create-students']
        ? await loadGroupRules(prisma, stream.id, grade)
        : [];

      // ── Match students ──
      // 1. roll number with the same (or a similar) name, or the same name under another roll;
      // 2. the clearly closest similar name among the rest (spelling differences, missing middle name);
      // 3. otherwise create the student (--create-students) or report it.
      type Enrollment = (typeof enrollments)[number];
      const used = new Set<number>();
      const byNameOnly: string[] = [];
      const matched: { s: SheetStudent; e: Enrollment }[] = [];
      const take = (s: SheetStudent, e: Enrollment) => {
        used.add(e.id);
        matched.push({ s, e });
      };
      const atOf = (s: SheetStudent) => `${where} row ${s.row} (roll ${s.rollNo}, ${s.name})`;
      const leftover: SheetStudent[] = [];
      for (const s of cls.students) {
        const byRoll = enrollments.find((e) => e.rollNo === s.rollNo && !used.has(e.id));
        const byName = enrollments.filter((e) => !used.has(e.id) && sameName(s.name, nameOf(e)));
        if (byRoll && sameName(s.name, nameOf(byRoll))) take(s, byRoll);
        else if (byRoll && nameSimilarity(s.name, nameOf(byRoll)) >= SIMILAR) {
          warnings.push(
            `${atOf(s)}: matched to "${nameOf(byRoll)}" (same roll, name spelled differently)`,
          );
          take(s, byRoll);
        } else if (byName.length === 1) {
          byNameOnly.push(`${s.name} (${s.rollNo} → ${byName[0]!.rollNo ?? 'none'})`);
          take(s, byName[0]!);
        } else if (byName.length > 1) {
          errors.push(`${atOf(s)}: several students in the app have this name`);
        } else leftover.push(s);
      }
      const unmatched: SheetStudent[] = [];
      for (const s of leftover) {
        const best = closestName(
          s.name,
          enrollments.filter((e) => !used.has(e.id)),
          nameOf,
        );
        if (best) {
          warnings.push(
            `${atOf(s)}: matched to "${nameOf(best.c)}" (roll ${best.c.rollNo ?? 'none'} in the app), ` +
              `a similar name (${Math.round(best.score * 100)}%). Check this is the same student.`,
          );
          take(s, best.c);
        } else unmatched.push(s);
      }
      for (const s of unmatched) {
        if (!s.cells.some((c) => c.entry !== null && c.entry !== 'STARRED')) {
          warnings.push(`${atOf(s)}: not in the app and has no marks in the sheet; skipped`);
          continue;
        }
        if (args['create-students']) {
          const n = newStudent(s, atOf(s));
          if (n) {
            p.toCreate.push(n);
            counts.newStudents++;
            counts.theirMarks += s.cells.filter(
              (c) => c.entry !== null && c.entry !== 'STARRED',
            ).length;
          }
        } else {
          const byRoll = enrollments.find((e) => e.rollNo === s.rollNo);
          errors.push(
            `${atOf(s)}: no matching student in the app` +
              (byRoll ? ` (roll ${s.rollNo} there is "${nameOf(byRoll)}")` : ''),
          );
        }
      }

      /** A student to create, or null (with an error) when that is not safe. */
      function newStudent(s: SheetStudent, at: string): NewStudent | null {
        const before = errors.length;
        // Never create a second record for someone already in the app, even under another spelling.
        // Students already in another class this year are other people (one class per year).
        const elsewhere = everyone.filter(
          (x) =>
            !x.enrollments.some((en) => en.academicYearId === yearId) &&
            nameSimilarity(s.name, fullName(x)) >= SIMILAR,
        );
        if (elsewhere.length) {
          const where = elsewhere
            .map(
              (x) =>
                `${fullName(x)} (${x.admissionNo}; ${
                  x.enrollments
                    .map((en) => `${en.academicYear.name} Grade ${en.grade} ${en.stream.code}`)
                    .join(', ') || 'not enrolled'
                })`,
            )
            .join('; ');
          errors.push(
            `${at}: already in the app as ${where}, but not in ${yearName} Grade ${grade} ${cls.streamCode}. Enroll or promote them in the app.`,
          );
          return null;
        }
        const names = splitName(s.name);
        if (!names) errors.push(`${at}: needs a first and a last name to be created`);
        const gender = s.gender ?? defaultGender;
        if (!gender) {
          errors.push(
            `${at}: no gender; fill in the "Gender" column (M/F), or run with --default-gender O`,
          );
        }
        const families = s.cells.filter((c) => c.entry !== null).map((c) => c.family);
        const chosen = families.map((f) => subjectByFamily.get(f));
        if (chosen.some((x) => !x || !x.isActive)) {
          errors.push(
            `${at}: some of the subjects ${families.join(', ')} are missing or inactive in Grade ${grade}`,
          );
        } else {
          const problems = validateSubjectSelection(
            groupRules,
            chosen.map((x) => x!.id),
          );
          if (problems.length) {
            errors.push(
              `${at}: subjects ${families.join(', ')} do not fit the ${cls.streamCode} curriculum: ${problems.join('; ')}`,
            );
          }
        }
        const admissionNo = `${prefix}G${grade}-${cls.streamCode}${String(s.rollNo).padStart(3, '0')}`;
        if (admissionNos.has(admissionNo))
          errors.push(`${at}: admission number ${admissionNo} is already used`);
        if (errors.length > before) return null;
        // Like promotion: a roll number already taken in the class is left empty, to set in the app.
        const rollNo = takenRolls.has(s.rollNo) ? null : s.rollNo;
        if (rollNo === null) {
          warnings.push(
            `${at}: roll ${s.rollNo} is already taken in ${yearName} Grade ${grade} section ${section}; created without a roll number`,
          );
        }
        admissionNos.add(admissionNo);
        takenRolls.add(rollNo);
        return {
          label:
            `${s.name} (${admissionNo}, Grade ${grade} ${cls.streamCode}, roll ${rollNo ?? 'none'}, ${families.join(' ')}` +
            (s.gender ? ')' : `, gender ${gender!.toLowerCase()}: placeholder)`),
          placeholderGender: !s.gender,
          admissionNo,
          ...names!,
          gender: gender!,
          grade,
          streamId: stream!.id,
          rollNo,
          subjectIds: chosen.map((x) => x!.id),
        };
      }

      if (byNameOnly.length) {
        warnings.push(
          `${where}: ${byNameOnly.length} student(s) matched by name, as their roll numbers differ (sheet → app): ` +
            byNameOnly.join(', '),
        );
      }
      const missing = enrollments.filter((e) => !used.has(e.id));
      if (missing.length) {
        warnings.push(
          `${where}: ${missing.length} student(s) in the app are not in the sheet: ` +
            missing.map((e) => `${nameOf(e)} (roll ${e.rollNo ?? '-'})`).join(', '),
        );
      }

      // ── Marks ──
      for (const { s, e } of matched) {
        const at = `${where} ${s.name}`;
        const takes = new Set(e.subjects.map((x) => x.subjectId));
        for (const cell of s.cells) {
          const comp = thByFamily.get(cell.family);
          if (!comp) continue; // reported above
          const enrolled = takes.has(comp.subjectId);
          if (cell.entry === null) {
            if (enrolled)
              warnings.push(`${at}: ${cell.header} is blank (${cell.ref}); left as it is`);
            continue;
          }
          if (cell.entry === 'STARRED') {
            if (enrolled)
              warnings.push(`${at}: ${cell.header} is "*" (${cell.ref}); left as it is`);
            continue;
          }
          if (!enrolled) {
            errors.push(
              `${at}: has ${fmt(cell.entry)} for ${cell.header} (${cell.ref}) but does not take ${comp.subjectName} in the app`,
            );
            continue;
          }
          const current = e.marks.find((m) => m.subjectComponentId === comp.subjectComponentId);
          if (cell.entry.status === 'ABSENT') counts.absent++;
          if (!current) counts.new++;
          else if (num(current.marks) === cell.entry.marks && current.status === cell.entry.status)
            counts.unchanged++;
          else {
            counts.changed++;
            report.push(
              `  change: ${at} ${cell.header}: ${fmt({ status: current.status, marks: num(current.marks) })} → ${fmt(cell.entry)}`,
            );
          }
          // Passing the current version lets saveMarks() overwrite it: the Excel value wins.
          items.push({
            enrollmentId: e.id,
            subjectComponentId: comp.subjectComponentId,
            ...cell.entry,
            version: current?.version,
          });
        }
        const sheetFamilies = new Set(s.cells.map((c) => c.family));
        for (const subjectId of takes) {
          const family = familyOf.get(subjectId);
          if (family && !sheetFamilies.has(family))
            warnings.push(`${at}: takes ${family}, which has no column in the sheet`);
        }
      }
      report.push(
        `  ${where}: ${matched.length}/${cls.students.length} students matched (${enrollments.length} in the app)`,
      );
    }
    report.push(
      `  ${items.length} marks: ${counts.new} new, ${counts.changed} changed, ${counts.unchanged} unchanged (${counts.absent} absent)`,
    );
    if (counts.newStudents) {
      report.push(
        `  + ${counts.newStudents} new students to create, with ${counts.theirMarks} marks (saved after they are created)`,
      );
    }
    p.exams.push({ examId: exam.id, label, items });
  }
  return p;
}

/** Creates the new students and their enrollments in one transaction: all of them or none. */
async function createStudents(list: NewStudent[], yearId: number, ctx: Ctx) {
  await prisma.$transaction(
    async (tx) => {
      for (const n of list) {
        const student = await tx.student.create({
          data: {
            admissionNo: n.admissionNo,
            firstName: n.firstName,
            middleName: n.middleName,
            lastName: n.lastName,
            gender: n.gender,
          },
        });
        await recordAudit(tx, ctx, {
          action: 'CREATE',
          entity: 'student',
          entityId: student.id,
          after: {
            admissionNo: n.admissionNo,
            name: fullName(n),
            gender: n.gender,
            source: 'Excel marks import',
          },
        });
        const enrollment = await tx.enrollment.create({
          data: {
            studentId: student.id,
            academicYearId: yearId,
            grade: n.grade,
            streamId: n.streamId,
            section: args.section!,
            rollNo: n.rollNo,
            subjects: { create: n.subjectIds.map((subjectId) => ({ subjectId })) },
          },
        });
        await recordAudit(tx, ctx, {
          action: 'CREATE',
          entity: 'enrollment',
          entityId: enrollment.id,
          after: {
            studentId: student.id,
            academicYearId: yearId,
            grade: n.grade,
            streamId: n.streamId,
            rollNo: n.rollNo,
            subjectIds: n.subjectIds,
          },
        });
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );
}

function print(p: Plan) {
  p.report.forEach((l) => console.log(l));
  if (p.toCreate.length) {
    console.log(`\n${p.toCreate.length} new student(s) to create:`);
    p.toCreate.forEach((n) => console.log(`  + ${n.label}`));
  }
  if (p.warnings.length) {
    console.log(`\n${p.warnings.length} warning(s):`);
    p.warnings.forEach((w) => console.log(`  - ${w}`));
  }
  if (p.errors.length) {
    console.log(`\n${p.errors.length} error(s):`);
    p.errors.forEach((e) => console.log(`  ✗ ${e}`));
  }
}

async function main() {
  if (!args.file) throw new Error('Required: --file <workbook.xlsx>');
  const parsed = parseMarksSheets(await readWorkbook(args.file));
  for (const c of parsed.classes) {
    const cells = c.students.flatMap((s) => s.cells);
    const absent = cells.filter(
      (x) => x.entry !== null && x.entry !== 'STARRED' && x.entry.status === 'ABSENT',
    );
    const starred = c.students.filter((s) => s.cells.some((x) => x.entry === 'STARRED'));
    const gendered = c.students.filter((s) => s.gender).length;
    console.log(
      `Sheet "${c.sheet}": Grade ${c.grade} ${c.streamCode}, ${c.students.length} students, ` +
        `subjects ${[...new Set(cells.map((x) => `${x.family}/${x.fullMark}`))].join(' ')}, ` +
        `${absent.length} absent, ${starred.length} with "*"` +
        (gendered ? `, ${gendered} with a gender` : ''),
    );
  }
  if (parsed.errors.length) {
    console.log(`\n${parsed.errors.length} error(s) in the workbook:`);
    parsed.errors.forEach((e) => console.log(`  ✗ ${e}`));
    throw new Error('Fix the workbook and run again. Nothing was saved.');
  }
  if (args['parse-only']) return;

  if (args['default-gender'] !== undefined) {
    defaultGender = parseGender(args['default-gender']) ?? null;
    if (!defaultGender) throw new Error('--default-gender must be M, F or O');
  }

  if (!args.year || !args.exam)
    throw new Error(
      'Required: --year <academic year, e.g. 2083 (the year the session started)> --exam <exam name>',
    );
  const year = await prisma.academicYear.findUnique({ where: { name: args.year } });
  if (!year) throw new Error(`Academic year ${args.year} not found`);
  const user = args.user ? await prisma.user.findUnique({ where: { username: args.user } }) : null;
  if (args.user && !user) throw new Error(`User "${args.user}" not found`);

  const first = await plan(parsed, year.id, year.name);
  const placeholders = first.toCreate.filter((n) => n.placeholderGender).length;
  if (placeholders) {
    first.warnings.push(
      `${placeholders} new student(s) get gender "${defaultGender!.toLowerCase()}" as a placeholder (none in the sheet). Correct them in the app later.`,
    );
  }
  print(first);
  if (first.errors.length)
    throw new Error('Nothing was saved. Fix the errors above and run again.');
  if (!args.commit) {
    console.log(
      '\nDry run: nothing was saved. Run again with --commit (and --user <your username>) to save.',
    );
    return;
  }

  const ctx = { userId: user?.id ?? null, ip: null };
  let final = first;
  if (first.toCreate.length) {
    await createStudents(first.toCreate, year.id, ctx);
    console.log(`\n✓ Created and enrolled ${first.toCreate.length} new students`);
    // Plan again: the new students are now matched like everyone else.
    final = await plan(parsed, year.id, year.name);
    if (final.errors.length || final.toCreate.length) {
      print(final);
      throw new Error(
        'The students were created, but their marks were not saved. Run the import again.',
      );
    }
  }
  for (const exam of final.exams) {
    let saved = 0;
    let conflicts = 0;
    for (let i = 0; i < exam.items.length; i += CHUNK) {
      const r = await saveMarks(exam.examId, { items: exam.items.slice(i, i + CHUNK) }, ctx);
      saved += r.saved;
      conflicts += r.conflicts.length;
    }
    console.log(
      `✓ ${exam.label}: ${saved} marks saved${conflicts ? `, ${conflicts} changed by someone else meanwhile (run again)` : ''}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(`✗ ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
