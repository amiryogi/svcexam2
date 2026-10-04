import type { Prisma, Student } from '@prisma/client';
import { parse as parseCsv } from 'csv-parse/sync';
import {
  fullName,
  studentImportRowSchema,
  type Paginated,
  type StudentData,
  type StudentListItem,
} from '@svi/shared';
import type { z } from 'zod';
import type { studentListQuery } from '@svi/shared';
import { recordAudit, type Ctx } from '../../lib/audit.js';
import { reconcileDob } from '../../lib/bsDate.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { dateOnly, prisma } from '../../lib/prisma.js';

type ListQuery = z.output<typeof studentListQuery>;

const enrollmentSummary = {
  include: { academicYear: true, stream: true },
  orderBy: { academicYear: { name: 'desc' } },
} satisfies Prisma.Student$enrollmentsArgs;

export async function listStudents(q: ListQuery): Promise<Paginated<StudentListItem>> {
  const enrollmentFilter: Prisma.EnrollmentWhereInput = {
    ...(q.academicYearId && { academicYearId: q.academicYearId }),
    ...(q.grade && { grade: q.grade }),
    ...(q.streamId && { streamId: q.streamId }),
    ...(q.section && { section: q.section }),
  };
  const hasEnrollmentFilter = Object.keys(enrollmentFilter).length > 0;
  const terms = q.q?.split(/\s+/).filter(Boolean) ?? [];

  const where: Prisma.StudentWhereInput = {
    deletedAt: q.deleted === 'true' ? { not: null } : null,
    ...(q.status && { status: q.status }),
    ...(hasEnrollmentFilter && { enrollments: { some: enrollmentFilter } }),
    // every search word must match one of the name / number fields
    AND: terms.map((t) => ({
      OR: [
        { firstName: { contains: t } },
        { middleName: { contains: t } },
        { lastName: { contains: t } },
        { admissionNo: { contains: t } },
        { nebRegistrationNo: { contains: t } },
        { enrollments: { some: { symbolNo: { contains: t } } } },
      ],
    })),
  };
  const orderBy: Prisma.StudentOrderByWithRelationInput[] =
    q.sort === 'admissionNo'
      ? [{ admissionNo: 'asc' }]
      : q.sort === 'createdAt'
        ? [{ createdAt: 'desc' }]
        : [{ firstName: 'asc' }, { lastName: 'asc' }];

  const [total, rows] = await prisma.$transaction([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy,
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        enrollments: {
          ...enrollmentSummary,
          where: q.academicYearId ? { academicYearId: q.academicYearId } : undefined,
          take: 1,
        },
      },
    }),
  ]);

  return {
    total,
    page: q.page,
    pageSize: q.pageSize,
    items: rows.map((s) => {
      const e = s.enrollments[0];
      return {
        id: s.id,
        admissionNo: s.admissionNo,
        fullName: fullName(s),
        gender: s.gender,
        dobBs: s.dobBs,
        dobAd: dateOnly(s.dobAd),
        nebRegistrationNo: s.nebRegistrationNo,
        status: s.status,
        deletedAt: s.deletedAt?.toISOString() ?? null,
        currentEnrollment: e
          ? {
              id: e.id,
              academicYear: e.academicYear.name,
              grade: e.grade,
              stream: e.stream.name,
              section: e.section,
              rollNo: e.rollNo,
              symbolNo: e.symbolNo,
            }
          : null,
      };
    }),
  };
}

export const toStudentDto = (s: Student) => ({
  id: s.id,
  admissionNo: s.admissionNo,
  firstName: s.firstName,
  middleName: s.middleName,
  lastName: s.lastName,
  fullName: fullName(s),
  gender: s.gender,
  dobAd: dateOnly(s.dobAd),
  dobBs: s.dobBs,
  nebRegistrationNo: s.nebRegistrationNo,
  guardianName: s.guardianName,
  guardianPhone: s.guardianPhone,
  phone: s.phone,
  email: s.email,
  address: s.address,
  status: s.status,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
  deletedAt: s.deletedAt?.toISOString() ?? null,
});

export async function getStudent(id: number) {
  const s = await prisma.student.findUnique({
    where: { id },
    include: {
      enrollments: {
        include: {
          academicYear: true,
          stream: true,
          subjects: { include: { subject: true } },
        },
        orderBy: { academicYear: { name: 'desc' } },
      },
    },
  });
  if (!s) throw notFound('Student');
  return {
    ...toStudentDto(s),
    enrollments: s.enrollments.map((e) => ({
      id: e.id,
      academicYearId: e.academicYearId,
      academicYear: e.academicYear.name,
      grade: e.grade,
      streamId: e.streamId,
      stream: e.stream.name,
      section: e.section,
      rollNo: e.rollNo,
      symbolNo: e.symbolNo,
      subjects: e.subjects.map((es) => ({ id: es.subject.id, name: es.subject.name })),
    })),
  };
}

function toData(input: StudentData) {
  const { dobBs, dobAd } = reconcileDob(input.dobBs ?? null, input.dobAd ?? null);
  return {
    ...input,
    nebRegistrationNo: input.nebRegistrationNo ?? null,
    dobBs,
    dobAd: dobAd ? new Date(dobAd) : null,
  };
}

export async function createStudent(input: StudentData, ctx: Ctx) {
  return prisma.$transaction(async (tx) => {
    const s = await tx.student.create({ data: toData(input) });
    await recordAudit(tx, ctx, { action: 'CREATE', entity: 'student', entityId: s.id, after: toStudentDto(s) });
    return toStudentDto(s);
  });
}

export async function updateStudent(id: number, input: StudentData, ctx: Ctx) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.student.findUnique({ where: { id } });
    if (!before) throw notFound('Student');
    const s = await tx.student.update({ where: { id }, data: toData(input) });
    await recordAudit(tx, ctx, {
      action: 'UPDATE',
      entity: 'student',
      entityId: id,
      before: toStudentDto(before),
      after: toStudentDto(s),
    });
    return toStudentDto(s);
  });
}

export async function setDeleted(id: number, deleted: boolean, ctx: Ctx) {
  await prisma.$transaction(async (tx) => {
    const before = await tx.student.findUnique({ where: { id } });
    if (!before) throw notFound('Student');
    await tx.student.update({ where: { id }, data: { deletedAt: deleted ? new Date() : null } });
    await recordAudit(tx, ctx, { action: deleted ? 'DELETE' : 'RESTORE', entity: 'student', entityId: id });
  });
}

export interface ImportReport {
  dryRun: boolean;
  total: number;
  created: number;
  errors: { row: number; message: string }[];
}

/**
 * CSV columns (header row required): admissionNo, firstName, middleName, lastName, gender,
 * dobBs, dobAd, nebRegistrationNo, guardianName, guardianPhone, phone, address.
 * All-or-nothing: nothing is written if any row has an error.
 */
export async function importStudents(csv: string, dryRun: boolean, ctx: Ctx): Promise<ImportReport> {
  let records: Record<string, string>[];
  try {
    records = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
  } catch (e) {
    throw badRequest(`Could not read CSV: ${(e as Error).message}`);
  }
  if (records.length === 0) throw badRequest('The CSV file has no rows');
  if (records.length > 2000) throw badRequest('Import at most 2000 students at a time');

  const errors: ImportReport['errors'] = [];
  const rows: ReturnType<typeof toData>[] = [];
  const seen = new Set<string>();
  records.forEach((r, i) => {
    const rowNo = i + 2; // header is row 1
    const parsed = studentImportRowSchema.safeParse(r);
    if (!parsed.success) {
      errors.push({ row: rowNo, message: parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
      return;
    }
    if (seen.has(parsed.data.admissionNo)) {
      errors.push({ row: rowNo, message: `Duplicate admission no ${parsed.data.admissionNo} in file` });
      return;
    }
    seen.add(parsed.data.admissionNo);
    try {
      rows.push(toData({ ...parsed.data, email: null, status: 'ACTIVE' }));
    } catch (e) {
      errors.push({ row: rowNo, message: (e as Error).message });
    }
  });

  const existing = await prisma.student.findMany({
    where: { admissionNo: { in: [...seen] } },
    select: { admissionNo: true },
  });
  for (const e of existing) errors.push({ row: 0, message: `Admission no ${e.admissionNo} already exists` });

  if (dryRun || errors.length) return { dryRun, total: records.length, created: 0, errors };

  await prisma.$transaction(async (tx) => {
    await tx.student.createMany({ data: rows });
    await recordAudit(tx, ctx, { action: 'IMPORT', entity: 'student', after: { count: rows.length } });
  });
  return { dryRun, total: records.length, created: rows.length, errors };
}
