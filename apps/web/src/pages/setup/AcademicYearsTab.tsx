import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { qk, useAcademicYears } from '../../api/hooks';
import type { AcademicYear } from '../../api/types';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, LoadingBlock, Modal, Table, Td, Th } from '../../components/ui';
import { toastError } from '../../lib/forms';

export function AcademicYearsTab() {
  const qc = useQueryClient();
  const years = useAcademicYears();
  const [editing, setEditing] = useState<Partial<AcademicYear> | null>(null);

  const save = useMutation({
    mutationFn: (y: Partial<AcademicYear>) => {
      const body = { name: y.name, startDateAd: y.startDateAd ?? '', endDateAd: y.endDateAd ?? '' };
      return y.id ? api(`/academic-years/${y.id}`, { method: 'PUT', body }) : api('/academic-years', { method: 'POST', body });
    },
    onSuccess: async () => {
      toast.success('Academic year saved');
      setEditing(null);
      await qc.invalidateQueries({ queryKey: qk.years });
    },
    onError: toastError,
  });
  const setCurrent = useMutation({
    mutationFn: (id: number) => api(`/academic-years/${id}/set-current`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success('Current year changed');
      await qc.invalidateQueries();
    },
    onError: toastError,
  });

  return (
    <Card>
      <CardHeader
        title="Academic years"
        description="Use the B.S. year in which the session starts, e.g. 2082. Exactly one year is current."
        actions={<Button onClick={() => setEditing({ name: '' })}><Plus className="size-4" /> Add year</Button>}
      />
      {years.isPending ? (
        <LoadingBlock />
      ) : !years.data?.length ? (
        <EmptyState title="No academic years yet" />
      ) : (
        <Table>
          <thead className="bg-slate-50"><tr><Th>Year</Th><Th>Starts (A.D.)</Th><Th>Ends (A.D.)</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {years.data.map((y) => (
              <tr key={y.id}>
                <Td className="font-medium">{y.name} {y.isCurrent && <Badge color="green">Current</Badge>}</Td>
                <Td>{y.startDateAd ?? '—'}</Td>
                <Td>{y.endDateAd ?? '—'}</Td>
                <Td className="text-right">
                  {!y.isCurrent && (
                    <Button size="sm" variant="ghost" onClick={() => setCurrent.mutate(y.id)}><Star className="size-4" /> Make current</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(y)}>Edit</Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit academic year' : 'Add academic year'}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => editing && save.mutate(editing)}>Save</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Name (B.S.)" required hint="e.g. 2082"><Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field label="Start date (A.D.)"><Input type="date" value={editing.startDateAd ?? ''} onChange={(e) => setEditing({ ...editing, startDateAd: e.target.value })} /></Field>
            <Field label="End date (A.D.)"><Input type="date" value={editing.endDateAd ?? ''} onChange={(e) => setEditing({ ...editing, endDateAd: e.target.value })} /></Field>
          </div>
        )}
      </Modal>
    </Card>
  );
}
