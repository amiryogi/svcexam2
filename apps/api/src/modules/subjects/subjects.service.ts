import type { Prisma } from '@prisma/client';
import type { CurriculumGroupDto, GradingRules, SubjectDto } from '@svi/shared';
import { badRequest } from '../../lib/errors.js';
import { n, prisma, type Db } from '../../lib/prisma.js';
import type { GroupRule } from './curriculum.logic.js';

export const subjectInclude = {
  components: { orderBy: { type: 'asc' } },
} satisfies Prisma.SubjectInclude;

type SubjectWithComponents = Prisma.SubjectGetPayload<{ include: typeof subjectInclude }>;

export const toSubjectDto = (s: SubjectWithComponents): SubjectDto => ({
  id: s.id,
  grade: s.grade,
  name: s.name,
  shortName: s.shortName,
  category: s.category,
  familyCode: s.familyCode,
  isActive: s.isActive,
  components: s.components.map((c) => ({
    id: c.id,
    type: c.type,
    nebCode: c.nebCode,
    creditHour: n(c.creditHour),
    fullMark: n(c.fullMark),
    passPercent: n(c.passPercent),
  })),
});

export async function loadCurriculum(db: Db, streamId: number, grade: number): Promise<CurriculumGroupDto[]> {
  const groups = await db.curriculumGroup.findMany({
    where: { streamId, grade },
    include: { subjects: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    sortOrder: g.sortOrder,
    subjectIds: g.subjects.map((s) => s.subjectId),
  }));
}

export async function loadGroupRules(db: Db, streamId: number, grade: number): Promise<GroupRule[]> {
  return loadCurriculum(db, streamId, grade);
}

export async function loadGradingRules(db: Db, gradeScaleId: number): Promise<GradingRules> {
  const scale = await db.gradeScale.findUniqueOrThrow({
    where: { id: gradeScaleId },
    include: { bands: true, finalBands: true },
  });
  return {
    withholdGpaOnNg: scale.withholdGpaOnNg,
    gradeBands: scale.bands.map((b) => ({ minPercent: n(b.minPercent), letter: b.letter, gradePoint: n(b.gradePoint) })),
    finalGradeBands: scale.finalBands.map((b) => ({ minGp: n(b.minGp), inclusive: b.inclusive, letter: b.letter })),
  };
}

export async function defaultGradeScaleId(db: Db = prisma): Promise<number> {
  const scale =
    (await db.gradeScale.findFirst({ where: { isDefault: true } })) ??
    (await db.gradeScale.findFirst({ orderBy: { id: 'asc' } }));
  if (!scale) throw badRequest('No grade scale configured. Run the database seed first.');
  return scale.id;
}
