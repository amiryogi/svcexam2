import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { CheckCircle2, ChevronLeft, ChevronRight, CloudUpload, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  gradeComponent,
  NEB_RULES,
  type EffectiveExamComponent,
  type ExamProgressItem,
  type GradingRules,
  type MarksGrid,
  type MarksSaveResult,
  type MarkStatus,
} from '@svi/shared';
import { api } from '../../api/client';
import type { Enrollment, GradeScale } from '../../api/types';
import { useExams, useStreams } from '../../api/hooks';
import { Alert, Badge, Button, Card, EmptyState, ErrorBlock, Field, LoadingBlock, PageHeader, Select, Table, Td, Th } from '../../components/ui';
import { gradeLabel } from '../../lib/format';
import { toastError } from '../../lib/forms';
import {
  cellFromKey,
  classSections,
  isDirty,
  mergeConflicts,
  parsePastedColumn,
  savableIds,
  serialQueue,
  STATUS_SHORT,
  validateCell as validate,
  type Cell,
} from './markEntry.logic';

const AUTOSAVE_MS = 2000;

const STATUS_LABEL: Record<MarkStatus, string> = { PRESENT: 'Present', ABSENT: 'Absent', WITHHELD: 'Withheld' };
const cellText = (c: Cell | undefined) => (!c ? 'blank' : c.status !== 'PRESENT' ? STATUS_LABEL[c.status] : c.marks || 'blank');

export function MarkEntryPage() {
  const [params, setParams] = useSearchParams();
  const examId = params.get('examId') ? Number(params.get('examId')) : null;
  const componentId = params.get('componentId') ? Number(params.get('componentId')) : null;
  const streamId = params.get('streamId') ?? '';
  const section = params.get('section') ?? '';
  const exams = useExams();
  const streams = useStreams();

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === 'examId') next.delete('componentId');
    if (key === 'streamId') next.delete('section');
    setParams(next, { replace: true });
  };

  const components = useQuery({
    queryKey: ['exam-components', examId],
    queryFn: () => api<EffectiveExamComponent[]>(`/exams/${examId}/components`),
    enabled: Boolean(examId),
  });
  const scales = useQuery({ queryKey: ['grade-scales'], queryFn: () => api<GradeScale[]>('/grade-scales'), staleTime: 5 * 60_000 });
  const exam = exams.data?.find((e) => e.id === examId);
  const rules: GradingRules = useMemo(() => {
    const s = scales.data?.find((x) => x.id === exam?.gradeScaleId);
    return s ? { gradeBands: s.gradeBands, finalGradeBands: s.finalGradeBands, withholdGpaOnNg: s.withholdGpaOnNg } : NEB_RULES;
  }, [scales.data, exam?.gradeScaleId]);

  // Entered / expected per component, shown in the subject list.
  const progress = useQuery({
    queryKey: ['exam-progress', examId],
    queryFn: () => api<ExamProgressItem[]>(`/exams/${examId}/progress`),
    enabled: Boolean(examId),
  });
  const progressById = new Map(progress.data?.map((p) => [p.subjectComponentId, p]));
  const progressText = (id: number) => {
    const p = progressById.get(id);
    if (!p) return '';
    return p.entered >= p.expected ? ` · ✓ ${p.entered}/${p.expected}` : ` · ${p.entered}/${p.expected}`;
  };

  // The exam's class, for the stream and section lists (only those that have students).
  const classRows = useQuery({
    queryKey: ['enrollments', exam?.academicYearId, exam?.grade, 'class'],
    queryFn: () => api<Enrollment[]>('/enrollments', { query: { academicYearId: exam!.academicYearId, grade: exam!.grade } }),
    enabled: Boolean(exam),
  });
  const classStreamIds = new Set(classRows.data?.map((e) => e.streamId));
  const streamOptions = classRows.data ? (streams.data?.filter((s) => classStreamIds.has(s.id)) ?? []) : (streams.data ?? []);
  const sectionOptions = classSections(classRows.data ?? [], streamId ? Number(streamId) : null);
  if (section && !sectionOptions.includes(section)) sectionOptions.push(section);

  const included = components.data?.filter((c) => c.included) ?? [];
  const at = included.findIndex((c) => c.subjectComponentId === componentId);
  const label = (c: EffectiveExamComponent) => `${c.subjectName} (${c.type === 'TH' ? 'Theory' : 'Internal'})`;
  const nav = {
    prev: at > 0 ? { id: included[at - 1]!.subjectComponentId, label: label(included[at - 1]!) } : null,
    next: at >= 0 && at < included.length - 1 ? { id: included[at + 1]!.subjectComponentId, label: label(included[at + 1]!) } : null,
    go: (id: number) => setParam('componentId', String(id)),
  };

  const openExams = exams.data?.filter((e) => e.status === 'MARK_ENTRY') ?? [];
  const otherExams = exams.data?.filter((e) => e.status !== 'MARK_ENTRY') ?? [];

  return (
    <>
      <PageHeader title="Mark entry" description="Choose an exam and a subject component, then type marks: A for absent, W for withheld. Enter or ↑/↓ moves between students. You can also paste a column of marks copied from Excel." />
      <Card className="mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Exam">
          <Select value={examId ?? ''} onChange={(e) => setParam('examId', e.target.value || null)}>
            <option value="">Choose exam…</option>
            {openExams.length > 0 && (
              <optgroup label="Open for mark entry">
                {openExams.map((e) => <option key={e.id} value={e.id}>{e.name} · {gradeLabel(e.grade)} · {e.academicYear}</option>)}
              </optgroup>
            )}
            {otherExams.length > 0 && (
              <optgroup label="Read only">
                {otherExams.map((e) => <option key={e.id} value={e.id}>{e.name} · {gradeLabel(e.grade)} · {e.academicYear} ({e.status.toLowerCase()})</option>)}
              </optgroup>
            )}
          </Select>
        </Field>
        <Field label="Subject component" className="lg:col-span-2">
          <Select value={componentId ?? ''} disabled={!components.data} onChange={(e) => setParam('componentId', e.target.value || null)}>
            <option value="">Choose subject…</option>
            {included.map((c) => (
              <option key={c.subjectComponentId} value={c.subjectComponentId}>
                {c.nebCode} · {c.subjectName} — {c.type === 'TH' ? 'Theory' : 'Internal'} (FM {c.fullMark}){progressText(c.subjectComponentId)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Stream">
            <Select value={streamId} onChange={(e) => setParam('streamId', e.target.value || null)}>
              <option value="">All</option>
              {streamOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Section">
            <Select value={section} onChange={(e) => setParam('section', e.target.value || null)}>
              <option value="">All</option>
              {sectionOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        </div>
      </Card>

      {!examId || !componentId ? (
        <Card><EmptyState title="Choose an exam and a subject component" description={exams.data?.length === 0 ? 'Create an exam first.' : undefined} action={exams.data?.length === 0 ? <Link to="/exams"><Button>Go to exams</Button></Link> : undefined} /></Card>
      ) : (
        <MarksGridView key={`${examId}-${componentId}-${streamId}-${section}`} examId={examId} componentId={componentId} streamId={streamId} section={section} rules={rules} nav={nav} />
      )}
    </>
  );
}

interface SubjectNav {
  prev: { id: number; label: string } | null;
  next: { id: number; label: string } | null;
  go: (id: number) => void;
}

function MarksGridView({ examId, componentId, streamId, section, rules, nav }: { examId: number; componentId: number; streamId: string; section: string; rules: GradingRules; nav: SubjectNav }) {
  const qc = useQueryClient();
  const queryKey = ['marks', examId, componentId, streamId, section];
  const grid = useQuery({
    queryKey,
    queryFn: () => api<MarksGrid>(`/exams/${examId}/marks`, { query: { subjectComponentId: componentId, streamId, section } }),
  });
  const [edits, setEdits] = useState<Record<number, Cell>>({});
  const [conflicts, setConflicts] = useState<Set<number>>(new Set());
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [navigating, setNavigating] = useState(false);
  // False once the grid has closed: a save still running then can only report through a toast.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const server = useMemo(() => {
    const m = new Map<number, { cell: Cell; version: number | null }>();
    grid.data?.rows.forEach((r) => m.set(r.enrollmentId, { cell: { marks: r.marks === null ? '' : String(r.marks), status: r.status }, version: r.version }));
    return m;
  }, [grid.data]);

  const fullMark = grid.data?.component.fullMark ?? 0;
  const dirtyIds = Object.keys(edits)
    .map(Number)
    .filter((id) => isDirty(edits[id]!, server.get(id)?.cell));
  const invalidIds = dirtyIds.filter((id) => validate(edits[id]!, fullMark));
  // Rows changed by someone else are held back until the user decides (see markEntry.logic.ts).
  const savable = savableIds(dirtyIds, invalidIds, conflicts);
  // A conflict whose values now agree (the other person saved the same mark) needs no review.
  const review = new Set(dirtyIds.filter((id) => conflicts.has(id)));

  const subjectLabel = grid.data ? `${grid.data.component.subjectName} (${grid.data.component.type === 'TH' ? 'Theory' : 'Internal'})` : 'this subject';

  const save = useMutation({
    mutationFn: async (requested: number[]) => {
      // A queued save can run after an earlier one already saved some of these rows.
      const ids = requested.filter((id) => edits[id]);
      // Remember exactly what was sent, so typing that happens while the request is in flight is kept.
      const sent = new Map(ids.map((id) => [id, { ...edits[id]! }]));
      if (ids.length === 0) return { result: { saved: 0, conflicts: [], rows: [] } as MarksSaveResult, sent, label: subjectLabel };
      // Versions come from the cache at send time, not from when the save was queued: an earlier
      // save that just finished has already put its new versions there (see onSuccess).
      const versions = new Map(qc.getQueryData<MarksGrid>(queryKey)?.rows.map((r) => [r.enrollmentId, r.version]));
      const result = await api<MarksSaveResult>(`/exams/${examId}/marks`, {
        method: 'PUT',
        body: {
          items: ids.map((id) => {
            const e = sent.get(id)!;
            return {
              enrollmentId: id,
              subjectComponentId: componentId,
              marks: e.status === 'PRESENT' && e.marks.trim() !== '' ? Number(e.marks) : null,
              status: e.status,
              version: versions.get(id) ?? undefined,
            };
          }),
        },
      });
      return { result, sent, label: subjectLabel };
    },
    onSuccess: async ({ result: r, sent, label }) => {
      const conflicted = new Set(r.conflicts.map((c) => c.enrollmentId));
      setConflicts((cur) => mergeConflicts(cur, sent.keys(), conflicted));

      // Put the saved values (and their new versions) into the grid straight away, so the cell never
      // flashes back to the old mark while the grid reloads.
      const savedById = new Map(r.rows.map((row) => [row.enrollmentId, row.version]));
      qc.setQueryData<MarksGrid>(queryKey, (old) =>
        old && {
          ...old,
          rows: old.rows.map((row) => {
            if (!savedById.has(row.enrollmentId) || conflicted.has(row.enrollmentId)) return row;
            const e = sent.get(row.enrollmentId)!;
            const version = savedById.get(row.enrollmentId)!;
            return {
              ...row,
              status: e.status,
              marks: e.status === 'PRESENT' && e.marks.trim() !== '' ? Number(e.marks) : null,
              version: version > 0 ? version : null,
            };
          }),
        },
      );
      // Drop an edit only if it still equals what was saved; newer typing stays pending (and autosaves).
      setEdits((cur) =>
        Object.fromEntries(
          Object.entries(cur).filter(([idS, cell]) => {
            const id = Number(idS);
            const s = sent.get(id);
            if (!s || conflicted.has(id)) return true;
            return !(s.marks.trim() === cell.marks.trim() && s.status === cell.status);
          }),
        ),
      );
      if (conflicted.size) {
        toast.warning(
          mounted.current
            ? `${conflicted.size} mark(s) were changed by someone else. Review the highlighted rows: keep your value or use theirs.`
            : `${conflicted.size} mark(s) in ${label} were changed by someone else and were not saved. Open ${label} again to check them.`,
        );
      }
      void qc.invalidateQueries({ queryKey });
      void qc.invalidateQueries({ queryKey: ['exam-progress', examId] });
    },
    onError: (e, ids) => {
      if (!mounted.current) toast.error(`${ids.length} mark(s) in ${subjectLabel} were not saved. Open ${subjectLabel} again and re-enter them.`);
      toastError(e);
    },
  });

  // Saves run one at a time, so a save on leaving can't race an autosave still in flight: it waits,
  // then sends with the versions that save returned.
  const { mutateAsync, isPending } = save;
  const [queue] = useState(serialQueue);
  const enqueue = useCallback((ids: number[]) => queue.run(() => mutateAsync(ids)), [queue, mutateAsync]);
  // Failures are already reported by onError.
  const saveInBackground = useCallback((ids: number[]) => void enqueue(ids).catch(() => undefined), [enqueue]);

  // Autosave valid changes shortly after typing stops.
  const savableKey = savable.join(',');
  useEffect(() => {
    if (!savableKey || isPending || !grid.data?.editable) return;
    const t = setTimeout(() => saveInBackground(savableKey.split(',').map(Number)), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [savableKey, isPending, saveInBackground, grid.data?.editable, edits]);

  // Save valid changes when the grid closes (another subject, filter or page) instead of losing them
  // to the autosave delay. The ref always holds the latest values. Next/Previous save first and set
  // `left`, so there is nothing more to send.
  const left = useRef(false);
  const flush = useRef<() => void>(() => {});
  useEffect(() => {
    flush.current = () => {
      if (!left.current && savable.length && grid.data?.editable) saveInBackground(savable);
    };
  });
  useEffect(() => () => flush.current(), []);

  // Warn before leaving with unsaved changes.
  const hasUnsaved = dirtyIds.length > 0;
  useEffect(() => {
    if (!hasUnsaved) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved]);

  const cellOf = useCallback((id: number): Cell => edits[id] ?? server.get(id)?.cell ?? { marks: '', status: 'PRESENT' }, [edits, server]);
  const setCell = (id: number, patch: Partial<Cell>) => {
    setEdits((cur) => ({ ...cur, [id]: { ...cellOf(id), ...patch } }));
    // Typing a new value in a conflicted row is the user's decision; it saves from now on.
    if (conflicts.has(id)) resolveConflict(id, 'mine');
  };
  const resolveConflict = (id: number, keep: 'mine' | 'theirs') => {
    setConflicts((cur) => {
      const next = new Set(cur);
      next.delete(id);
      return next;
    });
    if (keep === 'theirs') {
      setEdits((cur) => {
        const next = { ...cur };
        delete next[id];
        return next;
      });
    }
  };

  const move = (index: number, delta: number) => {
    const el = inputs.current[index + delta];
    if (el) {
      el.focus();
      el.select();
    }
  };

  if (grid.isPending) return <LoadingBlock />;
  if (grid.isError) return <ErrorBlock error={grid.error} onRetry={() => grid.refetch()} />;
  const { component, editable, rows } = grid.data;
  const entered = rows.filter((r) => {
    const c = cellOf(r.enrollmentId);
    return c.status !== 'PRESENT' || c.marks.trim() !== '';
  }).length;

  // Saves first and moves on only when that worked, so a clash or error keeps the marks on screen.
  // Invalid or conflicted rows can't be saved, so ask before leaving them behind.
  const goTo = async (id: number) => {
    const stuck = dirtyIds.length - savable.length;
    if (stuck && !window.confirm(`${stuck} mark(s) are invalid or need review and will not be saved. Go to the other subject anyway?`)) return;
    setNavigating(true);
    try {
      if (editable && savable.length) {
        const { result } = await enqueue(savable);
        if (result.conflicts.length) return; // the rows to review are now highlighted
      } else {
        await queue.idle(); // let a save in flight finish first
      }
    } catch {
      return; // onError reported it
    } finally {
      if (mounted.current) setNavigating(false);
    }
    if (!mounted.current) return;
    left.current = true;
    nav.go(id);
  };

  /** Pastes a column copied from Excel into this row and the ones below it. */
  const paste = (e: React.ClipboardEvent<HTMLInputElement>, index: number) => {
    const values = parsePastedColumn(e.clipboardData.getData('text'));
    if (!editable || values.length === 0) return;
    e.preventDefault();
    const targets = rows.slice(index, index + values.length);
    setEdits((cur) => {
      const next = { ...cur };
      targets.forEach((r, k) => {
        next[r.enrollmentId] = values[k]!;
      });
      return next;
    });
    // Pasting over a conflicted row is the user's decision, as with typing.
    setConflicts((cur) => {
      const next = new Set(cur);
      targets.forEach((r) => next.delete(r.enrollmentId));
      return next;
    });
    if (values.length > 1) {
      const extra = values.length - targets.length;
      toast.success(
        `Pasted ${targets.length} value(s) from roll ${rows[index]?.rollNo ?? index + 1} down. Check the order matches.` +
          (extra > 0 ? ` ${extra} extra value(s) were left out.` : ''),
      );
    }
  };

  const navButtons = (
    <>
      {nav.prev && (
        <Button size="sm" variant="ghost" title={`Previous subject: ${nav.prev.label}`} disabled={navigating} onClick={() => void goTo(nav.prev!.id)}>
          <ChevronLeft className="size-4" /> {nav.prev.label}
        </Button>
      )}
      {nav.next && (
        <Button size="sm" variant="secondary" title={`Next subject: ${nav.next.label}`} loading={navigating} onClick={() => void goTo(nav.next!.id)}>
          {nav.next.label} <ChevronRight className="size-4" />
        </Button>
      )}
    </>
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3">
        <div>
          <p className="font-semibold text-slate-900">{component.nebCode} · {component.subjectName} — {component.type === 'TH' ? 'Theory' : 'Internal'}</p>
          <p className="text-xs text-slate-500">Full mark {component.fullMark} · pass {component.passPercent}% · {entered}/{rows.length} entered</p>
        </div>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {!editable && <Badge color="amber">Read only</Badge>}
          {invalidIds.length > 0 && <span className="flex items-center gap-1 text-red-600"><TriangleAlert className="size-4" /> {invalidIds.length} invalid</span>}
          {review.size > 0 && <span className="flex items-center gap-1 text-amber-700"><TriangleAlert className="size-4" /> {review.size} to review</span>}
          {editable && (save.isPending ? (
            <span className="flex items-center gap-1 text-slate-500"><CloudUpload className="size-4 animate-pulse" /> Saving…</span>
          ) : dirtyIds.length ? (
            <span className="text-amber-700">{dirtyIds.length} unsaved</span>
          ) : (
            <span className="flex items-center gap-1 text-green-700"><CheckCircle2 className="size-4" /> All saved</span>
          ))}
          {editable && <Button size="sm" disabled={!savable.length} loading={save.isPending} onClick={() => saveInBackground(savable)}>Save now</Button>}
          {navButtons}
        </div>
      </div>
      {!editable && <ReadOnlyNotice exam={grid.data.exam} included={component.included} type={component.type} />}
      {rows.length === 0 ? (
        <EmptyClass exam={grid.data.exam} streamId={streamId} section={section} />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr><Th className="w-16">Roll</Th><Th>Student</Th><Th>Symbol no.</Th><Th className="w-32">Marks / {component.fullMark}</Th><Th className="w-40">Attendance</Th><Th className="w-24 text-center">Grade</Th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => {
              const cell = cellOf(r.enrollmentId);
              const error = validate(cell, component.fullMark);
              const dirty = dirtyIds.includes(r.enrollmentId);
              let grade: { grade: string; outcome: string } | null = null;
              if (!error && (cell.status !== 'PRESENT' || cell.marks.trim() !== '')) {
                grade = gradeComponent(
                  {
                    componentId: component.subjectComponentId,
                    type: component.type,
                    code: component.nebCode,
                    creditHour: component.creditHour,
                    fullMark: component.fullMark,
                    passPercent: component.passPercent,
                    marks: cell.status === 'PRESENT' ? Number(cell.marks) : null,
                    status: cell.status,
                  },
                  rules,
                );
              }
              return (
                <tr key={r.enrollmentId} className={clsx(review.has(r.enrollmentId) && 'bg-amber-50', dirty && !review.has(r.enrollmentId) && 'bg-blue-50/40')}>
                  <Td>{r.rollNo ?? '—'}</Td>
                  <Td className="font-medium">{r.fullName}<span className="ml-2 text-xs font-normal text-slate-400">{r.stream} {r.section}</span></Td>
                  <Td className="font-mono text-xs">{r.symbolNo ?? '—'}</Td>
                  <Td>
                    <input
                      ref={(el) => { inputs.current[i] = el; }}
                      // Text, not number: a number input changes its value when the mouse wheel scrolls over it.
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={!editable}
                      value={cell.status === 'PRESENT' ? cell.marks : STATUS_SHORT[cell.status]}
                      aria-label={`Marks for ${r.fullName}`}
                      aria-invalid={Boolean(error)}
                      title={error ?? 'Type a mark, A for absent or W for withheld'}
                      onChange={(e) =>
                        setCell(
                          r.enrollmentId,
                          cell.status === 'PRESENT'
                            ? { marks: e.target.value }
                            : { marks: e.target.value.replace(/[^\d.]/g, ''), status: 'PRESENT' },
                        )
                      }
                      onPaste={(e) => paste(e, i)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
                          const next = cellFromKey(e.key, cell);
                          if (next) {
                            e.preventDefault();
                            setCell(r.enrollmentId, next);
                            return;
                          }
                        }
                        if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); move(i, 1); }
                        if (e.key === 'ArrowUp') { e.preventDefault(); move(i, -1); }
                      }}
                      className={clsx(
                        'w-24 rounded-md border-0 px-2 py-1 text-right text-sm ring-1 ring-inset focus:ring-2 focus:outline-none disabled:bg-slate-100',
                        cell.status !== 'PRESENT' && 'bg-slate-100 font-semibold text-slate-600',
                        error ? 'ring-red-500 focus:ring-red-500' : 'ring-slate-300 focus:ring-brand-600',
                      )}
                    />
                    {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
                    {review.has(r.enrollmentId) && (
                      <div className="mt-1 text-xs text-amber-800">
                        Someone else saved <b>{cellText(server.get(r.enrollmentId)?.cell)}</b>; yours is <b>{cellText(edits[r.enrollmentId])}</b>.
                        <span className="mt-1 flex gap-2">
                          <Button size="sm" variant="secondary" onClick={() => resolveConflict(r.enrollmentId, 'mine')}>Keep mine</Button>
                          <Button size="sm" variant="ghost" onClick={() => resolveConflict(r.enrollmentId, 'theirs')}>Use theirs</Button>
                        </span>
                      </div>
                    )}
                  </Td>
                  <Td>
                    <select
                      disabled={!editable}
                      value={cell.status}
                      onChange={(e) => setCell(r.enrollmentId, { status: e.target.value as MarkStatus })}
                      className="rounded-md border-0 py-1 pr-7 pl-2 text-sm ring-1 ring-slate-300 ring-inset disabled:bg-slate-100"
                    >
                      <option value="PRESENT">Present</option>
                      <option value="ABSENT">Absent</option>
                      <option value="WITHHELD">Withheld</option>
                    </select>
                  </Td>
                  <Td className="text-center">
                    {grade && <Badge color={grade.outcome === 'PASS' ? 'green' : 'red'}>{grade.grade}</Badge>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      {(nav.prev || nav.next) && rows.length > 0 && (
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{navButtons}</div>
      )}
    </Card>
  );
}

/** Explains an empty mark grid: wrong exam grade/year (nobody enrolled) vs. nobody taking this subject. */
function EmptyClass({ exam, streamId, section }: { exam: MarksGrid['exam']; streamId: string; section: string }) {
  const enrolled = useQuery({
    queryKey: ['enrollments', exam.academicYearId, exam.grade, 'class'],
    queryFn: () => api<Enrollment[]>('/enrollments', { query: { academicYearId: exam.academicYearId, grade: exam.grade } }),
  });
  if (enrolled.isPending) return <LoadingBlock />;
  if (enrolled.data && enrolled.data.length === 0) {
    return (
      <div className="p-5">
        <Alert>
          <p className="font-medium">
            "{exam.name}" is set up for {gradeLabel(exam.grade)} in {exam.academicYear}, but no {gradeLabel(exam.grade)} students are enrolled
            in {exam.academicYear}.
          </p>
          <p className="mt-1">
            If this exam is meant for another grade, open the exam and change its grade (possible while no marks are entered).
          </p>
          <Link to={`/exams/${exam.id}`} className="mt-2 inline-block font-medium underline">
            Open {exam.name}
          </Link>
        </Alert>
      </div>
    );
  }
  return (
    <EmptyState
      title="No students take this subject in the selected class"
      description={streamId || section ? 'Try clearing the stream or section filter.' : undefined}
    />
  );
}

/** Explains why marks can't be edited and how to make them editable. */
function ReadOnlyNotice({ exam, included, type }: { exam: MarksGrid['exam']; included: boolean; type: MarksGrid['component']['type'] }) {
  const open = (
    <Link to={`/exams/${exam.id}`} className="mt-2 inline-block">
      <Button size="sm" variant="secondary">Open {exam.name}</Button>
    </Link>
  );
  let body: React.ReactNode;
  const theoryOnly = !included && type === 'IN' && !exam.includeInternal;
  if (theoryOnly) {
    body = <>"{exam.name}" is a theory-only exam, so internal marks are not entered. To include them, open the exam, click <b>Edit</b> and tick <b>Include internal (practical) marks</b>.</>;
  } else if (!included) {
    body = <>This component is left out of "{exam.name}" (see the exam's <b>Full marks &amp; components</b> tab), so it takes no marks.</>;
  } else if (exam.status === 'PUBLISHED') {
    body = (
      <>
        <p className="font-medium">"{exam.name}" is published, so its marks are locked.</p>
        <p className="mt-1">
          To correct a mark: open the exam and click <b>Unpublish</b> (give a reason), change the marks here, then click
          <b> Publish results</b> again. The grade sheets are regenerated with the corrected marks.
        </p>
      </>
    );
  } else if (exam.status === 'LOCKED') {
    body = <>"{exam.name}" is locked. Only a super admin can unlock it (then unpublish) before marks can change.</>;
  } else {
    body = <>"{exam.name}" is still a draft. Open the exam and click <b>Open mark entry</b> to start entering marks.</>;
  }
  return (
    <div className="px-5 pt-4">
      <Alert tone="amber">
        {body}
        {(included || theoryOnly) && exam.status !== 'LOCKED' && <div>{open}</div>}
      </Alert>
    </div>
  );
}
