import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Plus, Search, Upload } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { Paginated, StudentListItem } from '@svi/shared';
import { api } from '../../api/client';
import { useAcademicYears, useStreams } from '../../api/hooks';
import { Badge, Button, Card, EmptyState, ErrorBlock, Input, LoadingBlock, PageHeader, Pagination, Select, Table, Td, Th } from '../../components/ui';
import { gradeLabel, titleCase } from '../../lib/format';
import { StudentImportDialog } from './StudentImportDialog';

export function StudentsPage() {
  const [params, setParams] = useSearchParams();
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const years = useAcademicYears();
  const streams = useStreams();

  const filters = {
    q: params.get('q') ?? undefined,
    academicYearId: params.get('academicYearId') ?? undefined,
    grade: params.get('grade') ?? undefined,
    streamId: params.get('streamId') ?? undefined,
    status: params.get('status') ?? undefined,
    deleted: params.get('deleted') ?? undefined,
    page: Number(params.get('page') ?? 1),
    pageSize: 25,
  };
  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const q = useQuery({
    queryKey: ['students', filters],
    queryFn: () => api<Paginated<StudentListItem>>('/students', { query: filters }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Students"
        description="Student records, NEB registration numbers and current class."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import CSV
            </Button>
            <Link to="/students/new">
              <Button>
                <Plus className="size-4" /> Add student
              </Button>
            </Link>
          </>
        }
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <form
            className="relative sm:col-span-2"
            onSubmit={(e) => {
              e.preventDefault();
              set('q', search.trim() || undefined);
            }}
          >
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
            <Input className="pl-9" placeholder="Name, admission, reg. or symbol no." value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => set('q', search.trim() || undefined)} />
          </form>
          <Select value={filters.academicYearId ?? ''} onChange={(e) => set('academicYearId', e.target.value)}>
            <option value="">All years</option>
            {years.data?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
          <Select value={filters.grade ?? ''} onChange={(e) => set('grade', e.target.value)}>
            <option value="">All grades</option>
            <option value="11">Grade XI</option>
            <option value="12">Grade XII</option>
          </Select>
          <Select value={filters.streamId ?? ''} onChange={(e) => set('streamId', e.target.value)}>
            <option value="">All streams</option>
            {streams.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select
            value={filters.deleted === 'true' ? 'deleted' : (filters.status ?? '')}
            onChange={(e) => {
              const v = e.target.value;
              const next = new URLSearchParams(params);
              next.delete('page');
              next.delete('status');
              next.delete('deleted');
              if (v === 'deleted') next.set('deleted', 'true');
              else if (v) next.set('status', v);
              setParams(next, { replace: true });
            }}
          >
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="PASSED_OUT">Passed out</option>
            <option value="LEFT">Left</option>
            <option value="deleted">Deleted</option>
          </Select>
        </div>

        {q.isPending ? (
          <LoadingBlock />
        ) : q.isError ? (
          <div className="p-4"><ErrorBlock error={q.error} onRetry={() => q.refetch()} /></div>
        ) : q.data.items.length === 0 ? (
          <EmptyState title="No students found" description="Try changing the filters, or add a student." />
        ) : (
          <>
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Admission</Th><Th>Name</Th><Th>Gender</Th><Th>DOB (B.S.)</Th><Th>NEB Reg. No.</Th><Th>Class</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {q.data.items.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td className="font-mono text-xs">{s.admissionNo}</Td>
                    <Td>
                      <Link to={`/students/${s.id}`} className="font-medium text-brand-800 hover:underline">{s.fullName}</Link>
                    </Td>
                    <Td>{titleCase(s.gender)}</Td>
                    <Td>{s.dobBs ?? '—'}</Td>
                    <Td className="font-mono text-xs">{s.nebRegistrationNo ?? '—'}</Td>
                    <Td>
                      {s.currentEnrollment
                        ? `${gradeLabel(s.currentEnrollment.grade)} ${s.currentEnrollment.stream} · ${s.currentEnrollment.section} (${s.currentEnrollment.academicYear})`
                        : <span className="text-slate-400">Not enrolled</span>}
                    </Td>
                    <Td>
                      {s.deletedAt ? <Badge color="red">Deleted</Badge> : <Badge color={s.status === 'ACTIVE' ? 'green' : 'gray'}>{titleCase(s.status)}</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={(p) => set('page', String(p))} />
          </>
        )}
      </Card>
      <StudentImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
