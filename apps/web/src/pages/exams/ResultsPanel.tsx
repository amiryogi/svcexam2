import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronDown, ChevronRight, FileSpreadsheet, Printer, Search } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import {
  formatGp,
  hasMissingMarks,
  rankByGpa,
  subjectStats,
  type ComponentResult,
  type ExamDto,
  type ResultRow,
} from '@svi/shared';
import { downloadFile, printReport, api } from '../../api/client';
import { useStreams } from '../../api/hooks';
import type { Enrollment } from '../../api/types';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorBlock, Input, LoadingBlock, Select, Table, Tabs, Td, Th } from '../../components/ui';
import { toastError } from '../../lib/forms';
import { classSections } from './markEntry.logic';

type Sort = 'roll' | 'name' | 'gpa';
type View = 'students' | 'subjects';

const componentText = (c: ComponentResult) => {
  if (c.status === 'ABSENT') return 'ABS';
  if (c.status === 'WITHHELD') return 'W';
  if (c.marks === null) return '—';
  return `${c.marks}/${c.fullMark} · ${c.grade}`;
};

export function ResultsPanel({ exam }: { exam: ExamDto }) {
  const streams = useStreams();
  const [streamId, setStreamId] = useState('');
  const [section, setSection] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('roll');
  const [view, setView] = useState<View>('students');
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const filters = { streamId: streamId || undefined, section: section || undefined };

  const q = useQuery({
    queryKey: ['results', exam.id, filters],
    queryFn: () => api<ResultRow[]>(`/exams/${exam.id}/results`, { query: filters }),
  });
  // The class, for the section list.
  const classRows = useQuery({
    queryKey: ['enrollments', exam.academicYearId, exam.grade, 'class'],
    queryFn: () => api<Enrollment[]>('/enrollments', { query: { academicYearId: exam.academicYearId, grade: exam.grade } }),
  });
  const classStreamIds = new Set(classRows.data?.map((e) => e.streamId));
  const streamOptions = classRows.data ? (streams.data?.filter((s) => classStreamIds.has(s.id)) ?? []) : (streams.data ?? []);
  const sectionOptions = classSections(classRows.data ?? [], streamId ? Number(streamId) : null);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  };

  const rows = q.data;
  const ranks = useMemo(() => rankByGpa(rows ?? []), [rows]);
  const stats = useMemo(() => subjectStats(rows ?? []), [rows]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = (rows ?? []).filter(
      (r) =>
        !needle ||
        [r.fullName, r.rollNo, r.symbolNo, r.nebRegistrationNo, r.admissionNo].some((v) => v !== null && String(v).toLowerCase().includes(needle)),
    );
    if (sort === 'name') return [...list].sort((a, b) => a.fullName.localeCompare(b.fullName));
    if (sort === 'roll') {
      // By each row's own section and roll no.: published rows show the roll no. frozen in their
      // snapshot, while the API orders them by the current enrollment.
      return [...list].sort(
        (a, b) =>
          a.section.localeCompare(b.section, undefined, { numeric: true }) ||
          (a.rollNo ?? Infinity) - (b.rollNo ?? Infinity) ||
          a.fullName.localeCompare(b.fullName),
      );
    }
    if (sort === 'gpa') {
      // Ranked students first by position, then everyone else by GPA (missing last).
      return [...list].sort((a, b) => {
        const ra = ranks.get(a.enrollmentId) ?? Infinity;
        const rb = ranks.get(b.enrollmentId) ?? Infinity;
        return ra - rb || (b.result.gpa ?? -1) - (a.result.gpa ?? -1);
      });
    }
    return list;
  }, [rows, search, sort, ranks]);

  const toggle = (id: number) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const published = exam.status === 'PUBLISHED' || exam.status === 'LOCKED';
  const subjects = new Map<number, string>();
  rows?.forEach((r) => r.result.subjects.forEach((s) => subjects.set(s.subjectId, s.name)));
  const summary = { PASS: 0, NG: 0, INCOMPLETE: 0 };
  rows?.forEach((r) => summary[r.result.outcome]++);
  const missing = rows?.filter((r) => hasMissingMarks(r.result)).length ?? 0;
  const graded = summary.PASS + summary.NG;
  const columns = subjects.size + 6; // roll, name, subjects…, GPA, rank, result, print

  return (
    <Card>
      <CardHeader
        title="Results"
        description={published ? 'Published results – frozen at the time of publishing.' : 'Live results – grade sheets print as PROVISIONAL until the exam is published.'}
        actions={
          <>
            <Button variant="secondary" loading={busy === 'sheets'} onClick={() => run('sheets', () => printReport(`/reports/exams/${exam.id}/gradesheets`, filters))}>
              <Printer className="size-4" /> Print grade sheets
            </Button>
            <Button variant="secondary" loading={busy === 'ledger'} onClick={() => run('ledger', () => printReport(`/reports/exams/${exam.id}/ledger`, filters))}>
              <Printer className="size-4" /> Print ledger
            </Button>
            <Button variant="secondary" loading={busy === 'xlsx'} onClick={() => run('xlsx', () => downloadFile(`/reports/exams/${exam.id}/ledger`, { ...filters, format: 'xlsx' }))}>
              <FileSpreadsheet className="size-4" /> Ledger Excel
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <Select className="w-44" value={streamId} aria-label="Stream" onChange={(e) => { setStreamId(e.target.value); setSection(''); }}>
          <option value="">All streams</option>
          {streamOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select className="w-36" value={section} aria-label="Section" onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections</option>
          {sectionOptions.map((s) => <option key={s} value={s}>Section {s}</option>)}
        </Select>
        {rows && (
          <div className="ml-auto flex flex-wrap gap-2 text-sm">
            <Badge color="green">Pass {summary.PASS}{graded > 0 && ` (${Math.round((summary.PASS * 100) / graded)}%)`}</Badge>
            <Badge color="red">NG {summary.NG}</Badge>
            <Badge color="amber">Incomplete {summary.INCOMPLETE}</Badge>
          </div>
        )}
        <p className="w-full text-xs text-slate-500">
          Printing opens your browser's print window. To keep a file, choose <b>Save as PDF</b>. Under <b>More settings</b>, untick <b>Headers and footers</b> and keep <b>Margins: Default</b> and <b>Scale: Default (100%)</b>, so grade sheets fill the A4 page exactly like the official format (the browser remembers this).{exam.sheetLayout !== 'OFFICIAL' && <> This exam prints <b>A5 sheets, two per A4 page</b>: the page turns to landscape by itself; cut each page down the dashed line.</>}
        </p>
      </div>
      {q.isPending ? (
        <LoadingBlock />
      ) : q.isError ? (
        <div className="p-4"><ErrorBlock error={q.error} /></div>
      ) : q.data.length === 0 ? (
        <EmptyState title="No students for this selection" />
      ) : (
        <>
          {missing > 0 && (
            <div className="p-4 pb-0">
              <Alert tone={published ? 'red' : 'amber'}>
                {published ? (
                  <>
                    <b>{missing} of {q.data.length}</b> students had missing marks when this exam was published, so their
                    grade sheets print without grades and are marked INCOMPLETE. Use <b>Unpublish</b> to reopen mark entry, then publish again.
                  </>
                ) : (
                  <>{missing} of {q.data.length} students still have missing marks.</>
                )}
              </Alert>
            </div>
          )}
          <div className="px-4 pt-4">
            <Tabs<View>
              tabs={[{ id: 'students', label: 'Students' }, { id: 'subjects', label: 'Subject summary' }]}
              value={view}
              onChange={setView}
            />
          </div>
          {view === 'subjects' ? (
            <SubjectSummary stats={stats} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 px-4 pb-3">
                <div className="relative w-64">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-8" placeholder="Search name, roll, symbol no." aria-label="Search students" value={search} onChange={(e) => setSearch(e.target.value)} />
                </div>
                <Select className="w-48" value={sort} aria-label="Sort by" onChange={(e) => setSort(e.target.value as Sort)}>
                  <option value="roll">Sort by roll no.</option>
                  <option value="name">Sort by name</option>
                  <option value="gpa">Sort by GPA (rank)</option>
                </Select>
                <span className="text-xs text-slate-500">
                  {shown.length !== q.data.length && `${shown.length} of ${q.data.length} shown · `}Click a student to see their marks. Rank is within the selected stream and section.
                </span>
              </div>
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Roll</Th><Th>Name</Th>
                    {[...subjects.entries()].map(([id, name]) => <Th key={id} className="text-center normal-case">{name}</Th>)}
                    <Th className="text-center">GPA</Th>
                    <Th className="text-center" title="Position by GPA among students who passed every subject">Rank</Th>
                    <Th>Result</Th><Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.length === 0 && (
                    <tr><Td colSpan={columns} className="py-6 text-center text-slate-500">No student matches "{search}".</Td></tr>
                  )}
                  {shown.map((r) => {
                    const bySubject = new Map(r.result.subjects.map((s) => [s.subjectId, s]));
                    const isOpen = open.has(r.enrollmentId);
                    return (
                      <Fragment key={r.enrollmentId}>
                        <tr className={clsx('cursor-pointer hover:bg-slate-50', isOpen && 'bg-slate-50')} onClick={() => toggle(r.enrollmentId)}>
                          <Td>{r.rollNo ?? '—'}</Td>
                          <Td className="font-medium">
                            <button
                              type="button"
                              className="flex items-center gap-1 text-left"
                              aria-expanded={isOpen}
                              onClick={(e) => { e.stopPropagation(); toggle(r.enrollmentId); }}
                            >
                              {isOpen ? <ChevronDown className="size-4 shrink-0 text-slate-400" /> : <ChevronRight className="size-4 shrink-0 text-slate-400" />}
                              {r.fullName}
                            </button>
                          </Td>
                          {[...subjects.keys()].map((sid) => {
                            const s = bySubject.get(sid);
                            return (
                              <Td key={sid} className={clsx('text-center', s?.outcome === 'NG' && 'font-semibold text-red-600', s?.outcome === 'PENDING' && 'text-slate-400')}>
                                {s ? (s.remarks && s.remarks !== 'NG' ? s.remarks : s.finalGrade) : ''}
                              </Td>
                            );
                          })}
                          <Td className="text-center font-semibold">{r.result.gpaWithheld ? '—' : formatGp(r.result.gpa)}</Td>
                          <Td className="text-center">{ranks.get(r.enrollmentId) ?? '—'}</Td>
                          <Td>
                            <Badge color={r.result.outcome === 'PASS' ? 'green' : r.result.outcome === 'NG' ? 'red' : 'amber'}>{r.result.outcome}</Badge>
                          </Td>
                          <Td className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Grade sheet"
                              onClick={(e) => {
                                e.stopPropagation();
                                void run(`one-${r.enrollmentId}`, () => printReport(`/reports/exams/${exam.id}/gradesheets`, { enrollmentId: r.enrollmentId }));
                              }}
                              loading={busy === `one-${r.enrollmentId}`}
                            >
                              <Printer className="size-4" />
                            </Button>
                          </Td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/60">
                            <Td colSpan={columns} className="pt-0">
                              <StudentMarks row={r} />
                            </Td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}
        </>
      )}
    </Card>
  );
}

/** One student's marks per subject component, shown under their row. */
function StudentMarks({ row }: { row: ResultRow }) {
  return (
    <div className="space-y-2 py-2">
      <p className="text-xs text-slate-500">
        {[row.stream, row.section && `Section ${row.section}`, row.symbolNo && `Symbol ${row.symbolNo}`, row.nebRegistrationNo && `Reg. ${row.nebRegistrationNo}`]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {row.result.subjects.map((s) => (
          <div key={s.subjectId} className={clsx('rounded-md border bg-white px-3 py-2 text-sm', s.outcome === 'NG' ? 'border-red-200' : 'border-slate-200')}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-800">{s.name}</span>
              <span className={clsx('font-semibold', s.outcome === 'NG' ? 'text-red-600' : s.outcome === 'PENDING' ? 'text-slate-400' : 'text-slate-800')}>
                {s.remarks && s.remarks !== 'NG' ? s.remarks : s.finalGrade}
                {s.finalGradePoint !== null && <span className="ml-1 font-normal text-slate-500">({formatGp(s.finalGradePoint)})</span>}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-600">
              {s.components.map((c) => (
                <span key={c.componentId} className={clsx(c.outcome === 'NG' && 'text-red-600')}>
                  {c.type === 'TH' ? 'Theory' : 'Internal'}: {componentText(c)}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectSummary({ stats }: { stats: ReturnType<typeof subjectStats> }) {
  if (stats.length === 0) return <EmptyState title="No subjects in this selection" />;
  return (
    <Table>
      <thead className="bg-slate-50">
        <tr>
          <Th>Subject</Th>
          <Th className="text-right">Students</Th>
          <Th className="text-right">Passed</Th>
          <Th className="text-right">NG</Th>
          <Th className="text-right">Pass %</Th>
          <Th className="text-right" title="Average final grade point of students who passed">Avg GP</Th>
          <Th className="text-right">Highest GP</Th>
          <Th>Grades</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {stats.map((s) => (
          <tr key={s.subjectId}>
            <Td className="font-medium">{s.name}</Td>
            <Td className="text-right">
              {s.students}
              {s.graded < s.students && <span className="ml-1 text-xs text-amber-700" title="Students still waiting for marks">({s.students - s.graded} pending)</span>}
            </Td>
            <Td className="text-right">{s.passed}</Td>
            <Td className={clsx('text-right', s.ng > 0 && 'font-semibold text-red-600')}>{s.ng}</Td>
            <Td className="text-right">{s.passPercent === null ? '—' : `${s.passPercent}%`}</Td>
            <Td className="text-right">{formatGp(s.averageGp)}</Td>
            <Td className="text-right">{formatGp(s.highestGp)}</Td>
            <Td>
              <div className="flex flex-wrap gap-1">
                {s.grades.map((g) => (
                  <Badge key={g.letter} color={g.letter === 'NG' ? 'red' : 'gray'}>{g.letter} × {g.count}</Badge>
                ))}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
