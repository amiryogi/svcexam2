import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileDown, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import type { ExamDto } from '@svi/shared';
import { api, downloadFile } from '../../api/client';
import type { StudentDetail } from '../../api/types';
import { Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Table, Td, Th } from '../../components/ui';
import { EXAM_STATUS_COLOR, EXAM_STATUS_LABEL, gradeLabel, titleCase } from '../../lib/format';
import { toastError } from '../../lib/forms';

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value || '—'}</dd>
    </div>
  );
}

function EnrollmentExams({ enrollment }: { enrollment: StudentDetail['enrollments'][number] }) {
  const exams = useQuery({
    queryKey: ['exams', { academicYearId: enrollment.academicYearId, grade: enrollment.grade }],
    queryFn: () => api<ExamDto[]>('/exams', { query: { academicYearId: enrollment.academicYearId, grade: enrollment.grade } }),
  });
  if (!exams.data?.length) return <p className="text-xs text-slate-400">No exams yet</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {exams.data.map((e) => (
        <Button
          key={e.id}
          size="sm"
          variant="secondary"
          title={e.status === 'PUBLISHED' || e.status === 'LOCKED' ? 'Download grade sheet' : 'Provisional grade sheet'}
          onClick={() =>
            downloadFile(`/reports/exams/${e.id}/gradesheets.pdf`, { enrollmentId: enrollment.id }).catch(toastError)
          }
        >
          <FileDown className="size-3.5" /> {e.name}
          <Badge color={EXAM_STATUS_COLOR[e.status]}>{EXAM_STATUS_LABEL[e.status]}</Badge>
        </Button>
      ))}
    </div>
  );
}

export function StudentDetailPage() {
  const id = Number(useParams().id);
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const q = useQuery({ queryKey: ['student', id], queryFn: () => api<StudentDetail>(`/students/${id}`) });

  const toggleDelete = useMutation({
    mutationFn: (deleted: boolean) =>
      deleted ? api(`/students/${id}`, { method: 'DELETE' }) : api(`/students/${id}/restore`, { method: 'POST' }),
    onSuccess: async (_d, deleted) => {
      toast.success(deleted ? 'Student moved to deleted records' : 'Student restored');
      setConfirm(false);
      await qc.invalidateQueries({ queryKey: ['student', id] });
      await qc.invalidateQueries({ queryKey: ['students'] });
    },
    onError: toastError,
  });

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;

  return (
    <>
      <PageHeader
        title={s.fullName}
        description={`Admission no. ${s.admissionNo}`}
        actions={
          s.deletedAt ? (
            <Button variant="secondary" onClick={() => toggleDelete.mutate(false)} loading={toggleDelete.isPending}>
              <RotateCcw className="size-4" /> Restore
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Delete</Button>
              <Link to={`/students/${id}/edit`}><Button><Pencil className="size-4" /> Edit</Button></Link>
            </>
          )
        }
      />
      {s.deletedAt && <div className="mb-4"><Badge color="red">This record is deleted</Badge></div>}

      <Card className="p-6">
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Gender" value={titleCase(s.gender)} />
          <Info label="Date of birth" value={s.dobBs ? `${s.dobBs} B.S. (${s.dobAd} A.D.)` : s.dobAd} />
          <Info label="NEB registration no." value={s.nebRegistrationNo} />
          <Info label="Status" value={titleCase(s.status)} />
          <Info label="Guardian" value={[s.guardianName, s.guardianPhone].filter(Boolean).join(' · ')} />
          <Info label="Phone" value={s.phone} />
          <Info label="Email" value={s.email} />
          <Info label="Address" value={s.address} />
        </dl>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Enrollments & grade sheets"
          actions={<Link to={`/enrollments?studentId=${s.id}`}><Button size="sm" variant="secondary">Manage enrollment</Button></Link>}
        />
        {s.enrollments.length === 0 ? (
          <EmptyState title="Not enrolled yet" description="Enroll the student in a class from the Enrollment page." />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr><Th>Year</Th><Th>Class</Th><Th>Roll</Th><Th>Symbol no.</Th><Th>Subjects</Th><Th>Grade sheets</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {s.enrollments.map((e) => (
                <tr key={e.id} className="align-top">
                  <Td>{e.academicYear}</Td>
                  <Td>{gradeLabel(e.grade)} · {e.stream} · {e.section}</Td>
                  <Td>{e.rollNo ?? '—'}</Td>
                  <Td className="font-mono text-xs">{e.symbolNo ?? '—'}</Td>
                  <Td className="text-xs whitespace-normal">{e.subjects.map((x) => x.name).join(', ')}</Td>
                  <Td className="whitespace-normal"><EnrollmentExams enrollment={e} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={confirm}
        danger
        title="Delete student?"
        message="The record is hidden from lists but kept for audit. You can restore it later."
        confirmLabel="Delete"
        loading={toggleDelete.isPending}
        onConfirm={() => toggleDelete.mutate(true)}
        onClose={() => setConfirm(false)}
      />
    </>
  );
}
