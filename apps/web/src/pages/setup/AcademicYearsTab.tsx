import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from '../../api/client';
import { qk, useAcademicYears } from '../../api/hooks';
import type { AcademicYear } from '../../api/types';
import { Alert, Badge, Button, Card, CardHeader, ConfirmDialog, EmptyState, Field, Input, LoadingBlock, Modal, Table, Td, Th } from '../../components/ui';
import { toastError } from '../../lib/forms';

export function AcademicYearsTab() {
  const qc = useQueryClient();
  const years = useAcademicYears();
  const [editing, setEditing] = useState<Partial<AcademicYear> | null>(null);
  const [renameWarning, setRenameWarning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AcademicYear | null>(null);

  const save = useMutation({
    mutationFn: ({ y, confirmRename }: { y: Partial<AcademicYear>; confirmRename?: boolean }) => {
      const body = { name: y.name, startDateAd: y.startDateAd ?? '', endDateAd: y.endDateAd ?? '', ...(confirmRename && { confirmRename }) };
      return y.id ? api(`/academic-years/${y.id}`, { method: 'PUT', body }) : api('/academic-years', { method: 'POST', body });
    },
    onSuccess: async () => {
      toast.success('Academic year saved');
      setEditing(null);
      setRenameWarning(null);
      // A rename changes printed years and labels everywhere.
      await qc.invalidateQueries();
    },
    onError: (e) => {
      if (e instanceof ApiError && (e.details as { needsConfirmation?: boolean } | undefined)?.needsConfirmation) {
        setRenameWarning(e.message);
      } else toastError(e);
    },
  });
  const setCurrent = useMutation({
    mutationFn: (id: number) => api(`/academic-years/${id}/set-current`, { method: 'POST' }),
    onSuccess: async () => {
      toast.success('Current year changed');
      await qc.invalidateQueries();
    },
    onError: toastError,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/academic-years/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      toast.success('Academic year deleted');
      setDeleting(null);
      await qc.invalidateQueries({ queryKey: qk.years });
    },
    onError: toastError,
  });

  const original = years.data?.find((y) => y.id === editing?.id);
  const renaming = Boolean(original && editing?.name && editing.name.trim() !== original.name);

  return (
    <Card>
      <CardHeader
        title="Academic years"
        description="Name each year by the 4-digit B.S. year in which the session starts, e.g. 2084. Exactly one year is current; new screens and exams default to it."
        actions={<Button onClick={() => setEditing({ name: '' })}><Plus className="size-4" /> Add year</Button>}
      />
      {years.isPending ? (
        <LoadingBlock />
      ) : !years.data?.length ? (
        <EmptyState title="No academic years yet" />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr><Th>Year</Th><Th>Starts (A.D.)</Th><Th>Ends (A.D.)</Th><Th className="text-right">Enrolled</Th><Th className="text-right">Exams</Th><Th /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {years.data.map((y) => {
              const unused = (y.enrollmentCount ?? 0) === 0 && (y.examCount ?? 0) === 0;
              return (
                <tr key={y.id}>
                  <Td className="font-medium">{y.name} {y.isCurrent && <Badge color="green">Current</Badge>}</Td>
                  <Td>{y.startDateAd ?? '—'}</Td>
                  <Td>{y.endDateAd ?? '—'}</Td>
                  <Td className="text-right">{y.enrollmentCount ?? '—'}</Td>
                  <Td className="text-right">
                    {y.examCount ?? '—'}
                    {(y.publishedExamCount ?? 0) > 0 && <span className="ml-1 text-xs text-slate-400">({y.publishedExamCount} published)</span>}
                  </Td>
                  <Td className="text-right">
                    {!y.isCurrent && (
                      <Button size="sm" variant="ghost" onClick={() => setCurrent.mutate(y.id)}><Star className="size-4" /> Make current</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(y)}>Edit</Button>
                    {unused && !y.isCurrent && (
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(y)} aria-label={`Delete ${y.name}`}>
                        <Trash2 className="size-4 text-red-600" />
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit academic year' : 'Add academic year'}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => editing && save.mutate({ y: editing })}>Save</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Name (B.S.)" required hint="The 4-digit B.S. year, e.g. 2084">
              <Input inputMode="numeric" maxLength={4} placeholder="2084" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value.replace(/\D/g, '') })} />
            </Field>
            {renaming && (original?.publishedExamCount ?? 0) > 0 && (
              <Alert>
                {original!.name} has {original!.publishedExamCount} published exam(s). Renaming it changes the year printed on those
                grade sheets (unless an exam has its own "conducted in" year).
              </Alert>
            )}
            <Field label="Start date (A.D.)"><Input type="date" value={editing.startDateAd ?? ''} onChange={(e) => setEditing({ ...editing, startDateAd: e.target.value })} /></Field>
            <Field label="End date (A.D.)"><Input type="date" value={editing.endDateAd ?? ''} onChange={(e) => setEditing({ ...editing, endDateAd: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(renameWarning)}
        title="Rename this academic year?"
        message={renameWarning}
        confirmLabel="Rename anyway"
        loading={save.isPending}
        onConfirm={() => editing && save.mutate({ y: editing, confirmRename: true })}
        onClose={() => setRenameWarning(null)}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title={`Delete academic year ${deleting?.name}?`}
        message="It has no enrollments or exams. This cannot be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        onClose={() => setDeleting(null)}
      />
    </Card>
  );
}
