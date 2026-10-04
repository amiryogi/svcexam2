export interface GroupRule {
  name: string;
  minSelect: number;
  maxSelect: number;
  subjectIds: number[];
}

/**
 * Checks a subject selection against the curriculum groups of a stream/grade.
 * Returns human-readable problems; an empty array means the selection is valid.
 */
export function validateSubjectSelection(groups: GroupRule[], selected: number[]): string[] {
  const problems: string[] = [];
  if (groups.length === 0) {
    return ['No curriculum is configured for this stream and grade. Set it up under Setup → Curriculum.'];
  }
  const unique = new Set(selected);
  if (unique.size !== selected.length) problems.push('A subject was selected more than once');

  const allowed = new Set(groups.flatMap((g) => g.subjectIds));
  const outside = [...unique].filter((id) => !allowed.has(id));
  if (outside.length) problems.push(`${outside.length} selected subject(s) are not part of this stream's curriculum`);

  const counted = new Set<number>();
  for (const g of groups) {
    const picked = g.subjectIds.filter((id) => unique.has(id) && !counted.has(id));
    picked.forEach((id) => counted.add(id));
    if (picked.length < g.minSelect || picked.length > g.maxSelect) {
      const want = g.minSelect === g.maxSelect ? `${g.minSelect}` : `${g.minSelect}–${g.maxSelect}`;
      problems.push(`${g.name}: choose ${want} (selected ${picked.length})`);
    }
  }
  return problems;
}
