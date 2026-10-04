import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import type { GradeScale } from '../../api/types';
import { Alert, Button, Card, CardHeader, Checkbox, ErrorBlock, Input, LoadingBlock, Table, Td, Th } from '../../components/ui';
import { toastError } from '../../lib/forms';

export function GradeScaleTab() {
  const q = useQuery({ queryKey: ['grade-scales'], queryFn: () => api<GradeScale[]>('/grade-scales') });
  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} />;
  const initial = q.data.find((s) => s.isDefault) ?? q.data[0];
  if (!initial) return <Alert>No grade scale found. Run the database seed.</Alert>;
  // Remount the editor whenever fresh data arrives so local edits start from the saved values.
  return <GradeScaleEditor key={q.dataUpdatedAt} initial={initial} />;
}

function GradeScaleEditor({ initial }: { initial: GradeScale }) {
  const qc = useQueryClient();
  const [scale, setScale] = useState<GradeScale>(() => structuredClone(initial));

  const save = useMutation({
    mutationFn: (s: GradeScale) =>
      api(`/grade-scales/${s.id}`, {
        method: 'PUT',
        body: { name: s.name, withholdGpaOnNg: s.withholdGpaOnNg, gradeBands: s.gradeBands, finalGradeBands: s.finalGradeBands },
      }),
    onSuccess: async () => {
      toast.success('Grade scale saved');
      await qc.invalidateQueries({ queryKey: ['grade-scales'] });
    },
    onError: toastError,
  });

  const setBand = (i: number, patch: Partial<GradeScale['gradeBands'][number]>) =>
    setScale({ ...scale, gradeBands: scale.gradeBands.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const setFinal = (i: number, patch: Partial<GradeScale['finalGradeBands'][number]>) =>
    setScale({ ...scale, finalGradeBands: scale.finalGradeBands.map((b, j) => (j === i ? { ...b, ...patch } : b)) });

  return (
    <div className="space-y-6">
      <Alert tone="blue">
        These values follow the NEB letter grading system. Change them only when NEB publishes a new directive.
        Published grade sheets are not affected; unpublished results are recalculated immediately.
      </Alert>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Component grades" description="Percentage of full mark → grade and grade point. Below the pass percentage a component is NG." />
          <Table>
            <thead className="bg-slate-50"><tr><Th>From %</Th><Th>Grade</Th><Th>Grade point</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {scale.gradeBands.map((b, i) => (
                <tr key={i}>
                  <Td><Input type="number" className="w-24 py-1" value={b.minPercent} onChange={(e) => setBand(i, { minPercent: Number(e.target.value) })} /></Td>
                  <Td><Input className="w-20 py-1" value={b.letter} onChange={(e) => setBand(i, { letter: e.target.value })} /></Td>
                  <Td><Input type="number" step="0.1" className="w-24 py-1" value={b.gradePoint} onChange={(e) => setBand(i, { gradePoint: Number(e.target.value) })} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHeader title="Final grade" description="Weighted grade point of a subject → final grade. 'Above' means strictly greater." />
          <Table>
            <thead className="bg-slate-50"><tr><Th>Rule</Th><Th>Grade point</Th><Th>Final grade</Th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {scale.finalGradeBands.map((b, i) => (
                <tr key={i}>
                  <Td>
                    <select className="rounded-md py-1 text-sm ring-1 ring-slate-300" value={b.inclusive ? 'gte' : 'gt'} onChange={(e) => setFinal(i, { inclusive: e.target.value === 'gte' })}>
                      <option value="gt">Above</option>
                      <option value="gte">At least</option>
                    </select>
                  </Td>
                  <Td><Input type="number" step="0.1" className="w-24 py-1" value={b.minGp} onChange={(e) => setFinal(i, { minGp: Number(e.target.value) })} /></Td>
                  <Td><Input className="w-20 py-1" value={b.letter} onChange={(e) => setFinal(i, { letter: e.target.value })} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <Checkbox
          label="Withhold GPA when any subject is NG (printed as —)"
          checked={scale.withholdGpaOnNg}
          onChange={(e) => setScale({ ...scale, withholdGpaOnNg: e.target.checked })}
        />
        <Button loading={save.isPending} onClick={() => save.mutate(scale)}>Save grade scale</Button>
      </Card>
    </div>
  );
}
