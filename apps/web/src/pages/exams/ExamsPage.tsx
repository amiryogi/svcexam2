import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { useAcademicYears, useExams } from '../../api/hooks';
import { Badge, Button, Card, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Select, Table, Td, Th } from '../../components/ui';
import { EXAM_STATUS_COLOR, EXAM_STATUS_LABEL, gradeLabel, titleCase } from '../../lib/format';
import { ExamFormDialog } from './ExamFormDialog';

export function ExamsPage() {
  const years = useAcademicYears();
  const [yearId, setYearId] = useState('');
  const [grade, setGrade] = useState('');
  const [open, setOpen] = useState(false);
  const exams = useExams({ academicYearId: yearId ? Number(yearId) : undefined, grade: grade ? Number(grade) : undefined });

  return (
    <>
      <PageHeader
        title="Exams & results"
        description="Terminal and final exams, mark entry status, results and grade sheets."
        actions={<Button onClick={() => setOpen(true)} disabled={!years.data?.length}><Plus className="size-4" /> New exam</Button>}
      />
      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-4">
          <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
            <option value="">All years</option>
            {years.data?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
          <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">All grades</option>
            <option value="11">Grade XI</option>
            <option value="12">Grade XII</option>
          </Select>
        </div>
        {exams.isPending ? (
          <LoadingBlock />
        ) : exams.isError ? (
          <div className="p-4"><ErrorBlock error={exams.error} /></div>
        ) : exams.data.length === 0 ? (
          <EmptyState title="No exams" description="Create an exam to start entering marks." />
        ) : (
          <Table>
            <thead className="bg-slate-50">
              <tr><Th>Exam</Th><Th>Year</Th><Th>Class</Th><Th>Type</Th><Th>Conducted</Th><Th>Status</Th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exams.data.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td><Link to={`/exams/${e.id}`} className="font-medium text-brand-800 hover:underline">{e.name}</Link></Td>
                  <Td>{e.academicYear}</Td>
                  <Td>{gradeLabel(e.grade)}</Td>
                  <Td><span className="flex flex-wrap items-center gap-2">{titleCase(e.type)}{!e.includeInternal && <Badge>Theory only</Badge>}</span></Td>
                  <Td>{e.effectiveYearBs} B.S. ({e.effectiveYearAd})</Td>
                  <Td><Badge color={EXAM_STATUS_COLOR[e.status]}>{EXAM_STATUS_LABEL[e.status]}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <ExamFormDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
