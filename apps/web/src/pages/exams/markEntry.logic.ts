import type { MarkStatus } from '@svi/shared';

export interface Cell {
  marks: string;
  status: MarkStatus;
}

export function validateCell(cell: Cell, fullMark: number): string | null {
  if (cell.status !== 'PRESENT' || cell.marks.trim() === '') return null;
  const n = Number(cell.marks);
  if (!Number.isFinite(n)) return 'Not a number';
  if (n < 0 || n > fullMark) return `0–${fullMark}`;
  if (!/^\d+(\.\d{1,2})?$/.test(cell.marks.trim())) return 'Max 2 decimals';
  return null;
}

/** True when the edited cell differs from what the server has. */
export const isDirty = (edit: Cell, server: Cell | undefined): boolean =>
  !server || server.marks !== edit.marks.trim() || server.status !== edit.status;

/**
 * Rows that may be saved (by autosave or "Save now"): changed, valid, and not in conflict.
 * A conflicted row was changed by someone else, so it waits until the user picks "Keep mine",
 * "Use theirs" or types a new value; otherwise autosave would silently overwrite the other change.
 */
export function savableIds(dirty: number[], invalid: number[], conflicts: ReadonlySet<number>): number[] {
  return dirty.filter((id) => !invalid.includes(id) && !conflicts.has(id));
}

/**
 * Conflicts after a save: rows reported as conflicts are added; rows that were sent and saved
 * are cleared. Conflicts on rows not part of this save stay, so a later save of other rows never
 * releases them to autosave.
 */
export function mergeConflicts(
  current: ReadonlySet<number>,
  sent: Iterable<number>,
  conflicted: Iterable<number>,
): Set<number> {
  const next = new Set(current);
  for (const id of sent) next.delete(id);
  for (const id of conflicted) next.add(id);
  return next;
}
