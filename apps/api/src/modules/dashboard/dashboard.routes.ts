import { Router } from 'express';
import { z } from 'zod';
import type { DashboardSummary } from '@svi/shared';
import { idSchema, paginationQuery } from '@svi/shared';
import { parse } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { toExamDto } from '../exams/exams.service.js';
import { examProgress } from '../marks/marks.service.js';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', async (_req, res) => {
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  const [students, enrollments, exams, recent] = await Promise.all([
    prisma.student.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
    year
      ? prisma.enrollment.findMany({
          where: { academicYearId: year.id, student: { deletedAt: null } },
          select: { grade: true, stream: { select: { name: true } }, student: { select: { gender: true } } },
        })
      : Promise.resolve([]),
    year
      ? prisma.exam.findMany({ where: { academicYearId: year.id }, include: { academicYear: true }, orderBy: { createdAt: 'asc' } })
      : Promise.resolve([]),
    prisma.auditLog.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { user: true } }),
  ]);

  const groups = new Map<string, DashboardSummary['byGrade'][number]>();
  for (const e of enrollments) {
    const key = `${e.grade}|${e.stream.name}`;
    const g = groups.get(key) ?? { grade: e.grade, stream: e.stream.name, male: 0, female: 0, other: 0 };
    if (e.student.gender === 'MALE') g.male++;
    else if (e.student.gender === 'FEMALE') g.female++;
    else g.other++;
    groups.set(key, g);
  }

  const examsWithProgress = await Promise.all(
    exams.map(async (ex) => {
      const p = await examProgress(ex.id);
      const expected = p.reduce((s, x) => s + x.expected, 0);
      const entered = p.reduce((s, x) => s + Math.min(x.entered, x.expected), 0);
      return { ...toExamDto(ex), progressPercent: expected ? Math.round((entered / expected) * 100) : 0 };
    }),
  );

  const body: DashboardSummary = {
    currentAcademicYear: year ? { id: year.id, name: year.name } : null,
    totals: { students, enrolled: enrollments.length },
    byGrade: [...groups.values()].sort((a, b) => a.grade - b.grade || a.stream.localeCompare(b.stream)),
    exams: examsWithProgress,
    recentActivity: recent.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      user: a.user?.fullName ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
  res.json(body);
});

export const auditRouter = Router();

auditRouter.get('/', async (req, res) => {
  const q = parse(
    paginationQuery.extend({
      entity: z.string().trim().max(40).optional(),
      entityId: z.string().trim().max(64).optional(),
      userId: idSchema.optional(),
      action: z.string().trim().max(40).optional(),
      from: z.iso.date().optional(),
      to: z.iso.date().optional(),
    }),
    req.query,
  );
  const where = {
    entity: q.entity,
    entityId: q.entityId,
    userId: q.userId,
    action: q.action,
    createdAt: {
      ...(q.from && { gte: new Date(q.from) }),
      ...(q.to && { lt: new Date(new Date(q.to).getTime() + 86_400_000) }),
    },
  };
  const [total, items] = await prisma.$transaction([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  res.json({
    total,
    page: q.page,
    pageSize: q.pageSize,
    items: items.map((a) => ({
      id: a.id,
      action: a.action,
      entity: a.entity,
      entityId: a.entityId,
      user: a.user?.fullName ?? null,
      ip: a.ip,
      before: a.before,
      after: a.after,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});
