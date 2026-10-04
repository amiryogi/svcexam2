import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Lock, NotebookPen, Pencil, RotateCcw, Send, Trash2, Unlock } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { EffectiveExamComponent, ExamProgressItem, ExamStatus } from '@svi/shared';
import { api, ApiError } from '../../api/client';
import { qk, useExam } from '../../api/hooks';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, ConfirmDialog, EmptyState, ErrorBlock, Field, Input, LoadingBlock, PageHeader, Table, Tabs, Td, Textarea, Th } from '../../components/ui';
import { EXAM_STATUS_COLOR, EXAM_STATUS_LABEL, gradeLabel, titleCase } from '../../lib/format';
import { toastError } from '../../lib/forms';
import { ExamFormDialog } from './ExamFormDialog';
import { ResultsPanel } from './ResultsPanel';

type Tab = 'progress' | 'components' | 'results';

export function ExamDetailPage() {
  const id = Number(useParams().id);
  const exam = useExam(id);
  const [tab, setTab] = useState<Tab>('progress');
  const [editOpen, setEditOpen] = useState(false);

  if (exam.isPending) return <LoadingBlock />;
  if (exam.isError) return <ErrorBlock error={exam.error} onRetry={() => exam.refetch()} />;
  const e = exam.data;

  return (
    <>
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{e.name} <Badge color={EXAM_STATUS_COLOR[e.status]}>{EXAM_STATUS_LABEL[e.status]}</Badge></span>}
        description={`${gradeLabel(e.grade)} · ${e.academicYear} · ${titleCase(e.type)} · conducted ${e.effectiveYearBs} B.S. (${e.effectiveYearAd} A.D.)${e.issueDateBs ? ` · issue date ${e.issueDateBs}` : ''}`}
        actions={
          <>
            {e.status !== 'LOCKED' && (
              <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="size-4" /> {e.status === 'PUBLISHED' ? 'Print details' : 'Edit'}</Button>
            )}
            <StatusActions examId={id} status={e.status} />
          </>
        }
      />
      <Tabs<Tab>
        tabs={[
          { id: 'progress', label: 'Mark entry progress' },
          { id: 'components', label: 'Full marks & components' },
          { id: 'results', label: 'Results & grade sheets' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'progress' && <ProgressPanel examId={id} status={e.status} />}
      {tab === 'components' && <ComponentsPanel examId={id} editable={e.status === 'DRAFT' || e.status === 'MARK_ENTRY'} />}
      {tab === 'results' && <ResultsPanel exam={e} />}
      <ExamFormDialog open={editOpen} onClose={() => setEditOpen(false)} exam={e} />
    </>
  );
}

function StatusActions({ examId, status }: { examId: number; status: ExamStatus }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dialog, setDialog] = useState<'publish' | 'unpublish' | 'unlock' | 'lock' | 'delete' | null>(null);
  const [allowIncomplete, setAllowIncomplete] = useState(false);
  const [reason, setReason] = useState('');
  const [incomplete, setIncomplete] = useState<{ total: number; count: number; names: string[] } | null>(null);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: qk.exam(examId) });
    await qc.invalidateQueries({ queryKey: ['exams'] });
    await qc.invalidateQueries({ queryKey: ['results', examId] });
  };
  const close = () => {
    setDialog(null);
    setReason('');
    setAllowIncomplete(false);
    setIncomplete(null);
  };

  const action = useMutation({
    mutationFn: async (kind: 'MARK_ENTRY' | 'DRAFT' | 'LOCKED' | 'publish' | 'unpublish' | 'unlock' | 'delete') => {
      switch (kind) {
        case 'publish':
          return api(`/exams/${examId}/publish`, { method: 'POST', body: { allowIncomplete } });
        case 'unpublish':
          return api(`/exams/${examId}/unpublish`, { method: 'POST', body: { reason } });
        case 'unlock':
          return api(`/exams/${examId}/unlock`, { method: 'POST', body: { reason } });
        case 'delete':
          return api(`/exams/${examId}`, { method: 'DELETE' });
        default:
          return api(`/exams/${examId}/status`, { method: 'POST', body: { status: kind } });
      }
    },
    onSuccess: async (_d, kind) => {
      close();
      if (kind === 'delete') {
        toast.success('Exam deleted');
        await qc.invalidateQueries({ queryKey: ['exams'] });
        navigate('/exams');
        return;
      }
      toast.success(kind === 'publish' ? 'Results published' : 'Exam updated');
      await refresh();
    },
    onError: (e) => {
      const d = e instanceof ApiError ? (e.details as { total?: number; incomplete?: number; students?: { name: string }[] } | undefined) : undefined;
      if (d?.students) {
        setIncomplete({ total: d.total ?? d.students.length, count: d.incomplete ?? d.students.length, names: d.students.map((s) => s.name) });
      } else toastError(e);
    },
  });

  return (
    <>
      {status === 'DRAFT' && (
        <>
          <Button variant="secondary" onClick={() => setDialog('delete')}><Trash2 className="size-4" /> Delete</Button>
          <Button onClick={() => action.mutate('MARK_ENTRY')} loading={action.isPending}><NotebookPen className="size-4" /> Open mark entry</Button>
        </>
      )}
      {status === 'MARK_ENTRY' && (
        <>
          <Button variant="secondary" onClick={() => action.mutate('DRAFT')} loading={action.isPending}>Back to draft</Button>
          <Link to={`/mark-entry?examId=${examId}`}><Button variant="secondary"><NotebookPen className="size-4" /> Enter marks</Button></Link>
          <Button onClick={() => setDialog('publish')}><Send className="size-4" /> Publish results</Button>
        </>
      )}
      {status === 'PUBLISHED' && (
        <>
          <Button variant="secondary" onClick={() => setDialog('unpublish')}><RotateCcw className="size-4" /> Unpublish</Button>
          <Button onClick={() => setDialog('lock')}><Lock className="size-4" /> Lock</Button>
        </>
      )}
      {status === 'LOCKED' && user?.role === 'SUPER_ADMIN' && (
        <Button variant="secondary" onClick={() => setDialog('unlock')}><Unlock className="size-4" /> Unlock</Button>
      )}

      <ConfirmDialog
        open={dialog === 'publish'}
        title="Publish results?"
        message="Grade sheets are frozen when published. Later changes to marks, subjects or student names will not affect them unless you unpublish and publish again."
        confirmLabel={incomplete && !allowIncomplete ? 'Check again' : 'Publish'}
        loading={action.isPending}
        onConfirm={() => action.mutate('publish')}
        onClose={close}
      >
        {incomplete && (
          <>
            <Alert tone={incomplete.count * 2 > incomplete.total ? 'red' : 'amber'}>
              <p className="font-medium">
                {incomplete.count} of {incomplete.total} students have missing marks.
              </p>
              <p className="mt-1">
                Their grade sheets will print without grades and marked <b>INCOMPLETE</b>. Finish mark entry first unless you
                really mean to publish now.
              </p>
              <p className="mt-2 text-xs">
                {incomplete.names.slice(0, 10).join(', ')}
                {incomplete.count > 10 ? ` and ${incomplete.count - 10} more` : ''}
              </p>
            </Alert>
            <Checkbox
              label={`Publish anyway with ${incomplete.count} incomplete grade sheet(s)`}
              checked={allowIncomplete}
              onChange={(e) => setAllowIncomplete(e.target.checked)}
            />
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'lock'}
        title="Lock exam?"
        message="A locked exam cannot be unpublished or edited. Only a super admin can unlock it."
        confirmLabel="Lock"
        loading={action.isPending}
        onConfirm={() => action.mutate('LOCKED')}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        danger
        title="Delete exam?"
        message="Only draft exams without marks can be deleted."
        confirmLabel="Delete"
        loading={action.isPending}
        onConfirm={() => action.mutate('delete')}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog === 'unpublish' || dialog === 'unlock'}
        danger={dialog === 'unpublish'}
        title={dialog === 'unpublish' ? 'Unpublish results?' : 'Unlock exam?'}
        message={dialog === 'unpublish' ? 'Published grade sheets are discarded and mark entry reopens.' : 'The exam returns to Published.'}
        confirmLabel={dialog === 'unpublish' ? 'Unpublish' : 'Unlock'}
        loading={action.isPending}
        onConfirm={() => reason.trim() && action.mutate(dialog === 'unpublish' ? 'unpublish' : 'unlock')}
        onClose={close}
      >
        <Field label="Reason (recorded in the audit log)" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </ConfirmDialog>
    </>
  );
}

function ProgressPanel({ examId, status }: { examId: number; status: ExamStatus }) {
  const q = useQuery({ queryKey: ['exam-progress', examId], queryFn: () => api<ExamProgressItem[]>(`/exams/${examId}/progress`) });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} />;
  if (q.data.length === 0) return <Card><EmptyState title="No students are enrolled for this class yet" /></Card>;
  return (
    <Card>
      <Table>
        <thead className="bg-slate-50">
          <tr><Th>Code</Th><Th>Subject</Th><Th>Component</Th><Th>Entered</Th><Th className="w-1/3">Progress</Th><Th /></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {q.data.map((p) => {
            const pct = p.expected ? Math.round((Math.min(p.entered, p.expected) / p.expected) * 100) : 0;
            return (
              <tr key={p.subjectComponentId}>
                <Td className="font-mono text-xs">{p.nebCode}</Td>
                <Td>{p.subjectName}</Td>
                <Td>{p.type === 'TH' ? 'Theory' : 'Internal'}</Td>
                <Td>{p.entered} / {p.expected}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-slate-100"><div className={`h-2 rounded-full ${pct === 100 ? 'bg-green-600' : 'bg-brand-600'}`} style={{ width: `${pct}%` }} /></div>
                    {pct === 100 && <CheckCircle2 className="size-4 text-green-600" />}
                  </div>
                </Td>
                <Td className="text-right">
                  {status === 'MARK_ENTRY' && (
                    <Link className="text-sm font-medium text-brand-700" to={`/mark-entry?examId=${examId}&componentId=${p.subjectComponentId}`}>Enter</Link>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

function ComponentsPanel({ examId, editable }: { examId: number; editable: boolean }) {
  const q = useQuery({ queryKey: ['exam-components', examId], queryFn: () => api<EffectiveExamComponent[]>(`/exams/${examId}/components`) });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} />;
  return <ComponentsEditor key={q.dataUpdatedAt} examId={examId} editable={editable} initial={q.data} />;
}

function ComponentsEditor({ examId, editable, initial }: { examId: number; editable: boolean; initial: EffectiveExamComponent[] }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState(initial);

  const save = useMutation({
    mutationFn: () =>
      api<EffectiveExamComponent[]>(`/exams/${examId}/components`, {
        method: 'PUT',
        body: { items: rows.map((r) => ({ subjectComponentId: r.subjectComponentId, fullMark: r.fullMark, passPercent: r.passPercent, included: r.included })) },
      }),
    onSuccess: async () => {
      toast.success('Components saved');
      await qc.invalidateQueries({ queryKey: ['exam-components', examId] });
      await qc.invalidateQueries({ queryKey: ['exam-progress', examId] });
    },
    onError: toastError,
  });

  const update = (id: number, patch: Partial<EffectiveExamComponent>) =>
    setRows((rs) => rs.map((r) => (r.subjectComponentId === id ? { ...r, ...patch } : r)));

  return (
    <Card>
      <CardHeader
        title="Full marks for this exam"
        description="Defaults come from the subject setup. Terminal exams can use different full marks or leave out internal marks."
        actions={editable && <Button loading={save.isPending} onClick={() => save.mutate()}>Save changes</Button>}
      />
      <Table>
        <thead className="bg-slate-50">
          <tr><Th>Code</Th><Th>Subject</Th><Th>Component</Th><Th>Credit hr</Th><Th>Full mark</Th><Th>Pass %</Th><Th>Included</Th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.subjectComponentId} className={r.included ? '' : 'opacity-50'}>
              <Td className="font-mono text-xs">{r.nebCode}</Td>
              <Td>{r.subjectName}</Td>
              <Td>{r.type === 'TH' ? 'Theory' : 'Internal'}</Td>
              <Td>{r.creditHour.toFixed(2)}</Td>
              <Td><Input type="number" className="w-24 py-1" disabled={!editable} value={r.fullMark} min={1} onChange={(e) => update(r.subjectComponentId, { fullMark: Number(e.target.value) })} /></Td>
              <Td><Input type="number" className="w-20 py-1" disabled={!editable} value={r.passPercent} min={0} max={100} onChange={(e) => update(r.subjectComponentId, { passPercent: Number(e.target.value) })} /></Td>
              <Td><input type="checkbox" className="size-4" disabled={!editable} checked={r.included} onChange={(e) => update(r.subjectComponentId, { included: e.target.checked })} /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
