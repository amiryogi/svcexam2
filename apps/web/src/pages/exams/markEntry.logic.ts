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

/** What the marks box shows for a student who is absent or withheld. */
export const STATUS_SHORT: Record<Exclude<MarkStatus, 'PRESENT'>, string> = { ABSENT: 'AB', WITHHELD: 'W' };

/**
 * Keyboard shortcuts in the marks box: A = absent, W = withheld. In an absent/withheld cell,
 * typing a digit starts a mark and Backspace/Delete/P clears it back to present.
 * Returns the new cell, or null to let the key behave normally.
 */
export function cellFromKey(key: string, cell: Cell): Cell | null {
  const k = key.toLowerCase();
  if (k === 'a') return { marks: '', status: 'ABSENT' };
  if (k === 'w') return { marks: '', status: 'WITHHELD' };
  if (cell.status === 'PRESENT') return null;
  if (/^[\d.]$/.test(key)) return { marks: key, status: 'PRESENT' };
  if (key === 'Backspace' || key === 'Delete' || k === 'p') return { marks: '', status: 'PRESENT' };
  return null;
}

/** One pasted value: a mark, blank, or an absent / withheld code as written in Excel ledgers. */
export function parseMarkText(text: string): Cell {
  const t = text.trim();
  if (/^(a|ab|abs|absent)$/i.test(t)) return { marks: '', status: 'ABSENT' };
  if (/^(w|wh|withheld)$/i.test(t)) return { marks: '', status: 'WITHHELD' };
  return { marks: t, status: 'PRESENT' };
}

/**
 * A column copied from Excel: one value per line, first column only. Excel ends every row with a
 * line break, so only the empty piece after the last one is dropped; blank cells, including ones
 * at the end of the copied range, stay as blank marks so rows stay aligned.
 */
export function parsePastedColumn(text: string): Cell[] {
  if (text === '') return [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines.at(-1)!.trim() === '') lines.pop();
  return lines.map((line) => parseMarkText(line.split('\t')[0] ?? ''));
}

/** Distinct sections of a class, optionally within one stream, sorted. */
export function classSections(enrollments: { streamId: number; section: string }[], streamId: number | null): string[] {
  const set = new Set(enrollments.filter((e) => streamId === null || e.streamId === streamId).map((e) => e.section));
  return [...set].filter(Boolean).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Runs async tasks one at a time, in the order queued; a failed task doesn't block the next.
 * Mark saves go through one, so a save never races another still in flight.
 */
export function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result;
    },
    /** Resolves once everything queued so far has finished. */
    idle: (): Promise<void> => tail.then(() => undefined),
  };
}
