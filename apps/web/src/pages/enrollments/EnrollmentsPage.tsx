import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Hash, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { api, ApiError } from '../../api/client';
import { useAcademicYears, useStreams, useSubjects } from '../../api/hooks';
import type { Enrollment } from '../../api/types';
import { Alert, Button, Card, cn, ConfirmDialog, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Modal, PageHeader, Select, Table, Td, Th } from '../../components/ui';
import { toastError } from '../../lib/forms';
import { GradeSetupPanel, setupNeeded, useGradeSetupPlan } from '../setup/GradeSetupPanel';
import { EnrollDialog } from './EnrollDialog';

export function EnrollmentsPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const years = useAcademicYears();
  const streams = useStreams();
  const [pickedYearId, setYearId] = useState<number | null>(null);
  const [grade, setGrade] = useState(11);
  const [streamId, setStreamId] = useState('');
  const [section, setSection] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; enrollment: Enrollment | null }>({ open: false, enrollment: null });
  const [deleting, setDeleting] = useState<Enrollment | null>(null);
  const [symbolMode, setSymbolMode] = useState(false);
  const [symbols, setSymbols] = useState<Record<number, string>>({});
  const [promoteOpen, setPromoteOpen] = useState(false);
  const subjects = useSubjects(grade);
  const presetStudentId = params.get('studentId') ? Number(params.get('studentId')) : null;
  const yearId = pickedYearId ?? (years.data?.find((y) => y.isCurrent) ?? years.data?.[0])?.id ?? null;
  // Arriving from a student's page (?studentId=) opens the enroll dialog straight away.
  const dialogOpen = dialog.open || Boolean(presetStudentId);

  const q = useQuery({
    queryKey: ['enrollments', yearId, grade, streamId, section],
    queryFn: () => api<Enrollment[]>('/enrollments', { query: { academicYearId: yearId, grade, streamId, section } }),
    enabled: Boolean(yearId),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/enrollments/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Enrollment removed');
      setDeleting(null);
      await qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: toastError,
  });

  const saveSymbols = useMutation({
    mutationFn: () =>
      api('/enrollments/bulk-symbol-numbers', {
        method: 'POST',
        body: { items: Object.entries(symbols).map(([enrollmentId, symbolNo]) => ({ enrollmentId: Number(enrollmentId), symbolNo })) },
      }),
    onSuccess: async () => {
      toast.success('Symbol numbers saved');
      setSymbolMode(false);
      setSymbols({});
      await qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: toastError,
  });

  const subjectName = new Map(subjects.data?.map((s) => [s.id, s.shortName ?? s.name]) ?? []);

  if (years.isPending) return <LoadingBlock />;
  if (!years.data?.length) {
    return <EmptyState title="No academic years" description="Add an academic year under Setup first." action={<Link to="/setup"><Button>Go to Setup</Button></Link>} />;
  }

  return (
    <>
      <PageHeader
        title="Enrollment"
        description="Assign students to a class and choose their NEB subjects."
        actions={
          <>
            <Button variant="secondary" onClick={() => setPromoteOpen(true)}><ArrowUpRight className="size-4" /> Promote XI → XII</Button>
            {symbolMode ? (
              <>
                <Button variant="secondary" onClick={() => { setSymbolMode(false); setSymbols({}); }}>Cancel</Button>
                <Button loading={saveSymbols.isPending} disabled={!Object.keys(symbols).length} onClick={() => saveSymbols.mutate()}>Save symbol numbers</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => setSymbolMode(true)}><Hash className="size-4" /> Edit symbol nos.</Button>
            )}
            <Button onClick={() => setDialog({ open: true, enrollment: null })}><Plus className="size-4" /> Enroll student</Button>
          </>
        }
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-4">
          <Select value={yearId ?? ''} onChange={(e) => setYearId(Number(e.target.value))}>
            {years.data.map((y) => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' (current)' : ''}</option>)}
          </Select>
          <Select value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
            <option value={11}>Grade XI</option>
            <option value={12}>Grade XII</option>
          </Select>
          <Select value={streamId} onChange={(e) => setStreamId(e.target.value)}>
            <option value="">All streams</option>
            {streams.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Input placeholder="Section (all)" value={section} onChange={(e) => setSection(e.target.value.toUpperCase())} />
        </div>
        {q.isPending ? (
          <LoadingBlock />
        ) : q.isError ? (
          <div className="p-4"><ErrorBlock error={q.error} /></div>
        ) : q.data.length === 0 ? (
          <EmptyState title="No students enrolled in this class" />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr><Th>Roll</Th><Th>Name</Th><Th>Stream</Th><Th>Sec.</Th><Th>Symbol no.</Th><Th>Subjects</Th><Th className="text-right">Actions</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {q.data.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td>{e.rollNo ?? '—'}</Td>
                  <Td><Link className="font-medium text-brand-800 hover:underline" to={`/students/${e.studentId}`}>{e.fullName}</Link></Td>
                  <Td>{e.stream}</Td>
                  <Td>{e.section}</Td>
                  <Td>
                    {symbolMode ? (
                      <Input className="w-36 py-1" value={symbols[e.id] ?? e.symbolNo ?? ''} onChange={(ev) => setSymbols({ ...symbols, [e.id]: ev.target.value })} />
                    ) : (
                      <span className="font-mono text-xs">{e.symbolNo ?? '—'}</span>
                    )}
                  </Td>
                  <Td className="max-w-md truncate text-xs" title={e.subjectIds.map((id) => subjectName.get(id)).join(', ')}>
                    {e.subjectIds.map((id) => subjectName.get(id) ?? id).join(', ')}
                  </Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ open: true, enrollment: e })} aria-label="Edit"><Pencil className="size-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleting(e)} aria-label="Remove"><Trash2 className="size-4 text-red-600" /></Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {q.data && <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">{q.data.length} student(s)</p>}
      </Card>

      {yearId && dialogOpen && (
        <EnrollDialog
          open
          enrollment={dialog.enrollment}
          academicYearId={yearId}
          defaultGrade={grade}
          presetStudentId={presetStudentId}
          onClose={() => {
            setDialog({ open: false, enrollment: null });
            if (presetStudentId) setParams({}, { replace: true });
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="Remove enrollment?"
        message={`Remove ${deleting?.fullName} from this class? Enrollments with marks cannot be removed.`}
        confirmLabel="Remove"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
      {promoteOpen && <PromoteDialog open onClose={() => setPromoteOpen(false)} fromYearId={yearId} />}
    </>
  );
}

function PromoteDialog({ open, onClose, fromYearId }: { open: boolean; onClose: () => void; fromYearId: number | null }) {
  const qc = useQueryClient();
  const years = useAcademicYears();
  const streams = useStreams();
  const [pickedFrom, setFrom] = useState<number | null>(null);
  const [pickedTo, setTo] = useState<number | null>(null);
  // Defaults: promote FROM the year students are leaving INTO the next newer year.
  // Years arrive newest first; if the page shows the newest year, start from the one before it.
  const ordered = years.data ?? [];
  const pageIndex = ordered.findIndex((y) => y.id === fromYearId);
  const defaultFromIndex = pageIndex <= 0 && ordered.length > 1 ? 1 : Math.max(pageIndex, 0);
  const from = pickedFrom ?? ordered[defaultFromIndex]?.id ?? null;
  const fromIndex = ordered.findIndex((y) => y.id === from);
  const to = pickedTo ?? (fromIndex > 0 ? ordered[fromIndex - 1]!.id : null);
  const [streamId, setStreamId] = useState('');
  const [report, setReport] = useState<{ promoted: number; skipped: { name: string; reason: string }[] } | null>(null);
  const [problem, setProblem] = useState<{ message: string; setup?: string } | null>(null);
  const plan = useGradeSetupPlan(11, 12);
  const needsSetup = setupNeeded(plan.data);

  const promote = useMutation({
    mutationFn: () =>
      api<{ promoted: number; skipped: { name: string; reason: string }[] }>('/enrollments/promote', {
        method: 'POST',
        body: { fromAcademicYearId: from, toAcademicYearId: to, streamId: streamId ? Number(streamId) : undefined },
      }),
    onMutate: () => setProblem(null),
    onSuccess: async (r) => {
      setReport(r);
      if (r.promoted > 0) toast.success(`Promoted ${r.promoted} student(s)`);
      else toast.warning('No students were promoted – see the reasons below');
      await qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.status === 409 || e.status === 400)) {
        setProblem({ message: e.message, setup: (e.details as { setup?: string } | undefined)?.setup });
      } else toastError(e);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Promote Grade XI to Grade XII"
      size={needsSetup ? 'xl' : 'md'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {!report && !needsSetup && (
            <Button disabled={!from || !to || from === to || plan.isPending} loading={promote.isPending} onClick={() => promote.mutate()}>Promote</Button>
          )}
        </>
      }
    >
      {needsSetup && !report ? (
        <div className="space-y-4">
          <Steps current={1} />
          <p className="text-sm text-slate-600">
            Grade XII subjects are not set up yet. Students' Grade XI subjects are moved to these Grade XII subjects when they are promoted.
            Choose <b>Auto</b> to use the official NEB codes, or <b>Manual</b> to enter the codes, credit hours and full marks for theory and practical yourself.
          </p>
          <GradeSetupPanel from={11} to={12} />
        </div>
      ) : report ? (
        <div className="space-y-3 text-sm">
          <Alert tone="green">{report.promoted} student(s) enrolled in Grade XII.</Alert>
          {report.skipped.length > 0 && (
            <Alert>
              <p className="font-medium">{report.skipped.length} skipped:</p>
              <ul className="mt-1 max-h-48 list-disc overflow-y-auto pl-5">{report.skipped.map((s, i) => <li key={i}>{s.name}: {s.reason}</li>)}</ul>
            </Alert>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {plan.data && plan.data.from === 11 && <Steps current={2} />}
          <p className="text-sm text-slate-600">
            Active Grade XI students are enrolled in Grade XII of the target year with the same stream, section and roll number.
            Subjects are matched by family code, so Grade XII subjects must be set up first.
          </p>
          {problem && (
            <Alert tone="red">
              <p>{problem.message}</p>
              {problem.setup && (
                <Link className="mt-2 inline-block font-medium underline" to={`/setup?tab=${problem.setup}`} onClick={onClose}>
                  Open Setup → {problem.setup === 'curriculum' ? 'Curriculum' : 'Subjects'}
                </Link>
              )}
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="From year">
              <Select value={from ?? ''} onChange={(e) => setFrom(Number(e.target.value))}>
                {years.data?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </Select>
            </Field>
            <Field label="To year">
              <Select value={to ?? ''} onChange={(e) => setTo(Number(e.target.value))}>
                <option value="">Choose…</option>
                {years.data?.filter((y) => y.id !== from).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </Select>
            </Field>
            <Field label="Stream">
              <Select value={streamId} onChange={(e) => setStreamId(e.target.value)}>
                <option value="">All</option>
                {streams.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Steps({ current }: { current: 1 | 2 }) {
  const step = (n: 1 | 2, label: string) => (
    <div className={cn('flex items-center gap-2 text-sm', current === n ? 'font-semibold text-brand-800' : 'text-slate-400')}>
      <span className={cn('flex size-6 items-center justify-center rounded-full text-xs', current === n ? 'bg-brand-700 text-white' : current > n ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500')}>
        {current > n ? '✓' : n}
      </span>
      {label}
    </div>
  );
  return (
    <div className="flex items-center gap-3">
      {step(1, 'Set up Grade XII subjects')}
      <div className="h-px w-8 bg-slate-300" />
      {step(2, 'Promote students')}
    </div>
  );
}
