import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { FileSpreadsheet, Printer } from 'lucide-react';
import { useState } from 'react';
import { formatGp, hasMissingMarks, type ExamDto, type ResultRow } from '@svi/shared';
import { downloadFile, printReport, api } from '../../api/client';
import { useStreams } from '../../api/hooks';
import { Alert, Badge, Button, Card, CardHeader, EmptyState, ErrorBlock, Input, LoadingBlock, Select, Table, Td, Th } from '../../components/ui';
import { toastError } from '../../lib/forms';

export function ResultsPanel({ exam }: { exam: ExamDto }) {
  const streams = useStreams();
  const [streamId, setStreamId] = useState('');
  const [section, setSection] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const filters = { streamId: streamId || undefined, section: section || undefined };

  const q = useQuery({
    queryKey: ['results', exam.id, filters],
    queryFn: () => api<ResultRow[]>(`/exams/${exam.id}/results`, { query: filters }),
  });

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

  const published = exam.status === 'PUBLISHED' || exam.status === 'LOCKED';
  const subjects = new Map<number, string>();
  q.data?.forEach((r) => r.result.subjects.forEach((s) => subjects.set(s.subjectId, s.name)));
  const summary = { PASS: 0, NG: 0, INCOMPLETE: 0 };
  q.data?.forEach((r) => summary[r.result.outcome]++);
  const missing = q.data?.filter((r) => hasMissingMarks(r.result)).length ?? 0;

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
        <Select className="w-48" value={streamId} onChange={(e) => setStreamId(e.target.value)}>
          <option value="">All streams</option>
          {streams.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Input className="w-32" placeholder="Section" value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} />
        {q.data && (
          <div className="ml-auto flex gap-2 text-sm">
            <Badge color="green">Pass {summary.PASS}</Badge>
            <Badge color="red">NG {summary.NG}</Badge>
            <Badge color="amber">Incomplete {summary.INCOMPLETE}</Badge>
          </div>
        )}
        <p className="w-full text-xs text-slate-500">
          Printing opens your browser's print window. To keep a file, choose <b>Save as PDF</b>. Under <b>More settings</b>, untick <b>Headers and footers</b> (the browser remembers this).
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
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>Roll</Th><Th>Name</Th>
                {[...subjects.values()].map((name) => <Th key={name} className="text-center normal-case">{name}</Th>)}
                <Th className="text-center">GPA</Th><Th>Result</Th><Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.map((r) => {
                const bySubject = new Map(r.result.subjects.map((s) => [s.subjectId, s]));
                return (
                  <tr key={r.enrollmentId} className="hover:bg-slate-50">
                    <Td>{r.rollNo ?? '—'}</Td>
                    <Td className="font-medium">{r.fullName}</Td>
                    {[...subjects.keys()].map((sid) => {
                      const s = bySubject.get(sid);
                      return (
                        <Td key={sid} className={clsx('text-center', s?.outcome === 'NG' && 'font-semibold text-red-600', s?.outcome === 'PENDING' && 'text-slate-400')}>
                          {s ? (s.remarks && s.remarks !== 'NG' ? s.remarks : s.finalGrade) : ''}
                        </Td>
                      );
                    })}
                    <Td className="text-center font-semibold">{r.result.gpaWithheld ? '—' : formatGp(r.result.gpa)}</Td>
                    <Td>
                      <Badge color={r.result.outcome === 'PASS' ? 'green' : r.result.outcome === 'NG' ? 'red' : 'amber'}>{r.result.outcome}</Badge>
                    </Td>
                    <Td className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        title="Grade sheet"
                        onClick={() => run(`one-${r.enrollmentId}`, () => printReport(`/reports/exams/${exam.id}/gradesheets`, { enrollmentId: r.enrollmentId }))}
                        loading={busy === `one-${r.enrollmentId}`}
                      >
                        <Printer className="size-4" />
                      </Button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </>
      )}
    </Card>
  );
}
