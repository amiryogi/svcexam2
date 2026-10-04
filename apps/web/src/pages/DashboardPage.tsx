import { useQuery } from '@tanstack/react-query';
import { BookOpenCheck, GraduationCap, Users } from 'lucide-react';
import { Link } from 'react-router';
import type { DashboardSummary } from '@svi/shared';
import { api } from '../api/client';
import { Alert, Badge, Card, CardHeader, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Table, Td, Th } from '../components/ui';
import { EXAM_STATUS_COLOR, EXAM_STATUS_LABEL, formatDateTime, gradeLabel, titleCase } from '../lib/format';

function Stat({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof Users }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="rounded-lg bg-brand-50 p-3 text-brand-700">
        <Icon className="size-6" />
      </div>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
      </div>
    </Card>
  );
}

export function DashboardPage() {
  const q = useQuery({ queryKey: ['dashboard'], queryFn: () => api<DashboardSummary>('/dashboard/summary') });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;

  return (
    <>
      <PageHeader title="Dashboard" description={d.currentAcademicYear ? `Academic year ${d.currentAcademicYear.name}` : undefined} />
      {!d.currentAcademicYear && (
        <div className="mb-6">
          <Alert>
            No academic year is set up yet. <Link className="font-medium underline" to="/setup">Go to Setup</Link> to add one.
          </Alert>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Active students" value={d.totals.students} icon={Users} />
        <Stat label="Enrolled this year" value={d.totals.enrolled} icon={GraduationCap} />
        <Stat label="Exams this year" value={d.exams.length} icon={BookOpenCheck} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Enrollment by class" />
          {d.byGrade.length === 0 ? (
            <EmptyState title="No enrollments yet" />
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr><Th>Class</Th><Th>Stream</Th><Th className="text-right">Male</Th><Th className="text-right">Female</Th><Th className="text-right">Other</Th><Th className="text-right">Total</Th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {d.byGrade.map((g) => (
                  <tr key={`${g.grade}-${g.stream}`}>
                    <Td>{gradeLabel(g.grade)}</Td>
                    <Td>{g.stream}</Td>
                    <Td className="text-right">{g.male}</Td>
                    <Td className="text-right">{g.female}</Td>
                    <Td className="text-right">{g.other}</Td>
                    <Td className="text-right font-medium">{g.male + g.female + g.other}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Exams" actions={<Link to="/exams" className="text-sm font-medium text-brand-700">View all</Link>} />
          {d.exams.length === 0 ? (
            <EmptyState title="No exams this year" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.exams.map((e) => (
                <li key={e.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/exams/${e.id}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {e.name} · {gradeLabel(e.grade)}
                    </Link>
                    <Badge color={EXAM_STATUS_COLOR[e.status]}>{EXAM_STATUS_LABEL[e.status]}</Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-2 flex-1 rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-brand-600" style={{ width: `${e.progressPercent}%` }} />
                    </div>
                    <span className="w-24 text-right text-xs text-slate-500">{e.progressPercent}% marks</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent activity" actions={<Link to="/audit" className="text-sm font-medium text-brand-700">Audit log</Link>} />
        <ul className="divide-y divide-slate-100 text-sm">
          {d.recentActivity.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <span>
                <span className="font-medium text-slate-800">{a.user ?? 'System'}</span>{' '}
                <span className="text-slate-600">{titleCase(a.action)} · {a.entity.replace('_', ' ')}{a.entityId ? ` #${a.entityId}` : ''}</span>
              </span>
              <span className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
            </li>
          ))}
          {d.recentActivity.length === 0 && <li className="px-5 py-4 text-slate-500">No activity yet.</li>}
        </ul>
      </Card>
    </>
  );
}
