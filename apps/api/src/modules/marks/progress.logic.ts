import type { EffectiveExamComponent, ExamProgressItem } from '@svi/shared';

export interface EnrolledSubject {
  enrollmentId: number;
  subjectId: number;
}

export interface EnteredMark {
  enrollmentId: number;
  subjectComponentId: number;
}

/**
 * Mark-entry progress per included component. A mark counts only when its student is still in the
 * class (`taking` lists active enrollments only) and still takes the subject, so marks left behind by
 * deleted students or dropped subjects can't make a component look complete while marks are missing.
 */
export function countProgress(
  components: EffectiveExamComponent[],
  taking: EnrolledSubject[],
  marks: EnteredMark[],
): ExamProgressItem[] {
  const expected = new Map<number, number>();
  const takes = new Set<string>();
  for (const t of taking) {
    expected.set(t.subjectId, (expected.get(t.subjectId) ?? 0) + 1);
    takes.add(`${t.enrollmentId}:${t.subjectId}`);
  }
  const subjectOf = new Map(components.map((c) => [c.subjectComponentId, c.subjectId]));
  const entered = new Map<number, number>();
  for (const m of marks) {
    const subjectId = subjectOf.get(m.subjectComponentId);
    if (subjectId === undefined || !takes.has(`${m.enrollmentId}:${subjectId}`)) continue;
    entered.set(m.subjectComponentId, (entered.get(m.subjectComponentId) ?? 0) + 1);
  }
  return components
    .filter((c) => c.included)
    .map((c) => ({
      subjectComponentId: c.subjectComponentId,
      subjectName: c.subjectName,
      type: c.type,
      nebCode: c.nebCode,
      expected: expected.get(c.subjectId) ?? 0,
      entered: entered.get(c.subjectComponentId) ?? 0,
    }))
    .filter((p) => p.expected > 0);
}
