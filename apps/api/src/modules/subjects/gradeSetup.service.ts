import type { z } from 'zod';
import { catalogSubject, type copyGradeSchema, type GradeSetupPlan, type GradeSetupRow } from '@svi/shared';
import { recordAudit, type Ctx } from '../../lib/audit.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { n, type Db } from '../../lib/prisma.js';

/**
 * NEB codes of a subject's continuation in the next grade usually differ by 10 (0011 → 0021,
 * 1011 → 1021). Used only when a subject is not in the official catalog.
 */
export function suggestNebCode(code: string, gradeDelta: number, used: Set<string>): string {
  const suggested = /^\d{4}$/.test(code) ? String(Number(code) + gradeDelta * 10).padStart(4, '0') : code;
  if (!used.has(suggested)) return suggested;
  // Clearly invalid placeholder the admin must replace (fails the 3–6 digit rule on save).
  return `${suggested}?`.slice(0, 10);
}

/** Subjects of `from` that have no `to` version yet, pre-filled from the NEB catalog (or the +10 pattern). */
export async function buildGradeSetupPlan(db: Db, from: number, to: number): Promise<GradeSetupPlan> {
  const [source, target, components] = await Promise.all([
    db.subject.findMany({ where: { grade: from }, include: { components: { orderBy: { type: 'asc' } } }, orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    db.subject.findMany({ where: { grade: to } }),
    db.subjectComponent.findMany({ select: { nebCode: true } }),
  ]);
  const existing = new Set(target.map((s) => s.familyCode));
  const used = new Set(components.map((c) => c.nebCode));

  const rows: GradeSetupRow[] = source
    .filter((s) => !existing.has(s.familyCode))
    .map((s) => {
      const cat = catalogSubject(to, s.familyCode);
      if (cat) {
        return {
          familyCode: s.familyCode,
          sourceName: s.name,
          name: cat.name,
          category: cat.category,
          source: 'catalog' as const,
          components: (['TH', 'IN'] as const).map((type) => {
            const c = type === 'TH' ? cat.th : cat.in;
            const passPercent = n(s.components.find((x) => x.type === type)?.passPercent ?? 35);
            return { type, nebCode: c.code, creditHour: c.creditHour, fullMark: c.fullMark, passPercent };
          }),
        };
      }
      return {
        familyCode: s.familyCode,
        sourceName: s.name,
        name: s.name,
        category: s.category,
        source: 'pattern' as const,
        components: s.components.map((c) => {
          const nebCode = suggestNebCode(c.nebCode, to - from, used);
          used.add(nebCode);
          return { type: c.type, nebCode, creditHour: n(c.creditHour), fullMark: n(c.fullMark), passPercent: n(c.passPercent) };
        }),
      };
    });

  const streams = await db.stream.findMany({ orderBy: { name: 'asc' } });
  const curriculumToCopy: string[] = [];
  const curriculumMissing: string[] = [];
  for (const st of streams) {
    if (await db.curriculumGroup.count({ where: { streamId: st.id, grade: to } })) continue;
    if (await db.curriculumGroup.count({ where: { streamId: st.id, grade: from } })) curriculumToCopy.push(st.name);
    else if (st.isActive) curriculumMissing.push(st.name);
  }
  return { from, to, rows, curriculumToCopy, curriculumMissing };
}

/**
 * Creates the `to`-grade subjects (auto: from the plan; manual: from the admin's values) and copies
 * each stream's curriculum groups. Existing subjects and curricula are never overwritten.
 */
export async function applyGradeSetup(db: Db, input: z.output<typeof copyGradeSchema>, ctx: Ctx) {
  const { from, to } = input;
  const plan = await buildGradeSetupPlan(db, from, to);
  const planned = new Map(plan.rows.map((r) => [r.familyCode, r]));

  let rows: GradeSetupRow[];
  if (input.items) {
    rows = input.items.map((item) => {
      const base = planned.get(item.familyCode);
      if (!base) throw badRequest(`${item.familyCode} already exists in Grade ${to} or has no Grade ${from} subject`);
      return { ...base, name: item.name, source: 'pattern', components: item.components };
    });
  } else {
    rows = plan.rows;
  }

  // NEB codes must be unique across all grades.
  const codes = rows.flatMap((r) => r.components.map((c) => c.nebCode));
  const dupInRequest = codes.find((c, i) => codes.indexOf(c) !== i);
  if (dupInRequest) throw badRequest(`NEB code ${dupInRequest} is used twice`);
  const taken = await db.subjectComponent.findMany({ where: { nebCode: { in: codes } }, include: { subject: true } });
  if (taken.length) {
    throw conflict(`NEB code ${taken[0]!.nebCode} is already used by ${taken[0]!.subject.name} (Grade ${taken[0]!.subject.grade})`);
  }
  const invalid = codes.find((c) => !/^\d{3,6}$/.test(c));
  if (invalid) throw badRequest(`NEB code "${invalid}" must be 3–6 digits`);

  const createdSubjects: string[] = [];
  for (const r of rows) {
    await db.subject.create({
      data: {
        grade: to,
        name: r.name,
        category: r.category,
        familyCode: r.familyCode,
        components: { create: r.components },
      },
    });
    createdSubjects.push(r.name);
  }

  const targetByFamily = new Map((await db.subject.findMany({ where: { grade: to } })).map((s) => [s.familyCode, s.id]));
  const copiedCurricula: string[] = [];
  for (const stream of await db.stream.findMany()) {
    if (await db.curriculumGroup.count({ where: { streamId: stream.id, grade: to } })) continue;
    const groups = await db.curriculumGroup.findMany({
      where: { streamId: stream.id, grade: from },
      include: { subjects: { include: { subject: true } } },
      orderBy: { sortOrder: 'asc' },
    });
    let copied = false;
    for (const g of groups) {
      const subjectIds = g.subjects.flatMap((gs) => {
        const id = targetByFamily.get(gs.subject.familyCode);
        return id ? [id] : [];
      });
      if (!subjectIds.length) continue;
      await db.curriculumGroup.create({
        data: {
          streamId: stream.id,
          grade: to,
          name: g.name,
          minSelect: Math.min(g.minSelect, subjectIds.length),
          maxSelect: Math.min(g.maxSelect, subjectIds.length),
          sortOrder: g.sortOrder,
          subjects: { create: subjectIds.map((subjectId) => ({ subjectId })) },
        },
      });
      copied = true;
    }
    if (copied) copiedCurricula.push(stream.name);
  }

  await recordAudit(db, ctx, {
    action: 'COPY_GRADE',
    entity: 'subject',
    after: { from, to, mode: input.items ? 'manual' : 'auto', subjects: rows, copiedCurricula },
  });
  return { createdSubjects, copiedCurricula };
}
