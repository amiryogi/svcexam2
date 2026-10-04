import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { SUBJECT_CATEGORIES, subjectSchema, type SubjectDto, type SubjectFormInput } from '@svi/shared';
import { api } from '../../api/client';
import { useSubjects } from '../../api/hooks';
import { Alert, Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, LoadingBlock, Modal, Select, Table, Td, Th } from '../../components/ui';
import { titleCase } from '../../lib/format';
import { applyServerErrors } from '../../lib/forms';

type Output = z.output<typeof subjectSchema>;

export function SubjectsTab() {
  const [grade, setGrade] = useState(11);
  const subjects = useSubjects(grade);
  const [editing, setEditing] = useState<SubjectDto | 'new' | null>(null);

  return (
    <Card>
      <CardHeader
        title="Subjects"
        description="NEB subjects with theory (TH) and internal (IN) components. Use the same family code for a Grade XI subject and its Grade XII continuation."
        actions={
          <>
            <Select className="w-36" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              <option value={11}>Grade XI</option>
              <option value={12}>Grade XII</option>
            </Select>
            <Button onClick={() => setEditing('new')}><Plus className="size-4" /> Add subject</Button>
          </>
        }
      />
      {grade === 12 && subjects.data?.length === 0 && (
        <div className="px-5 pt-4"><Alert tone="blue">Add Grade XII subjects from the official NEB subject code list before promoting students.</Alert></div>
      )}
      {subjects.isPending ? (
        <LoadingBlock />
      ) : !subjects.data?.length ? (
        <EmptyState title="No subjects for this grade" />
      ) : (
        <Table>
          <thead className="bg-slate-50"><tr><Th>Family</Th><Th>Name</Th><Th>Category</Th><Th>TH code · CH · FM</Th><Th>IN code · CH · FM</Th><Th>Total CH</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {subjects.data.map((s) => {
              const th = s.components.find((c) => c.type === 'TH');
              const inn = s.components.find((c) => c.type === 'IN');
              return (
                <tr key={s.id} className={s.isActive ? '' : 'opacity-50'}>
                  <Td className="font-mono text-xs">{s.familyCode}</Td>
                  <Td className="font-medium">{s.name}</Td>
                  <Td><Badge color={s.category === 'COMPULSORY' ? 'blue' : 'gray'}>{titleCase(s.category)}</Badge></Td>
                  <Td className="font-mono text-xs">{th ? `${th.nebCode} · ${th.creditHour} · ${th.fullMark}` : '—'}</Td>
                  <Td className="font-mono text-xs">{inn ? `${inn.nebCode} · ${inn.creditHour} · ${inn.fullMark}` : '—'}</Td>
                  <Td>{s.components.reduce((a, c) => a + c.creditHour, 0).toFixed(2)}</Td>
                  <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit</Button></Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
      <SubjectDialog subject={editing} grade={grade} onClose={() => setEditing(null)} />
    </Card>
  );
}

function SubjectDialog({ subject, grade, onClose }: { subject: SubjectDto | 'new' | null; grade: number; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useForm<SubjectFormInput, unknown, Output>({ resolver: zodResolver(subjectSchema) });
  const components = useFieldArray({ control: form.control, name: 'components' });
  const err = form.formState.errors;
  const existing = subject && subject !== 'new' ? subject : null;

  useEffect(() => {
    if (!subject) return;
    form.reset(
      existing
        ? { ...existing, shortName: existing.shortName ?? '', components: existing.components }
        : {
            grade: grade as 11 | 12,
            name: '',
            shortName: '',
            category: 'OPTIONAL',
            familyCode: '',
            isActive: true,
            components: [
              { type: 'TH', nebCode: '', creditHour: 3.75, fullMark: 75, passPercent: 35 },
              { type: 'IN', nebCode: '', creditHour: 1.25, fullMark: 25, passPercent: 35 },
            ],
          },
    );
  }, [subject, existing, grade, form]);

  const save = useMutation({
    mutationFn: (v: Output) => (existing ? api(`/subjects/${existing.id}`, { method: 'PUT', body: v }) : api('/subjects', { method: 'POST', body: v })),
    onSuccess: async () => {
      toast.success('Subject saved');
      await qc.invalidateQueries({ queryKey: ['subjects'] });
      onClose();
    },
    onError: (e) => applyServerErrors(e, form.setError),
  });
  const r = form.register;

  return (
    <Modal
      open={Boolean(subject)}
      onClose={onClose}
      title={existing ? `Edit ${existing.name}` : 'Add subject'}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>Save</Button></>}
    >
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Name" required className="sm:col-span-2" error={err.name?.message}><Input {...r('name')} /></Field>
          <Field label="Short name" error={err.shortName?.message}><Input {...r('shortName')} /></Field>
          <Field label="Grade" error={err.grade?.message}>
            <Select {...r('grade')} disabled={Boolean(existing)}><option value={11}>XI</option><option value={12}>XII</option></Select>
          </Field>
          <Field label="Category" error={err.category?.message}>
            <Select {...r('category')}>{SUBJECT_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</Select>
          </Field>
          <Field label="Family code" required error={err.familyCode?.message} hint="e.g. PHY"><Input {...r('familyCode')} /></Field>
          <div className="flex items-end pb-2 sm:col-span-2"><Checkbox label="Active" {...r('isActive')} /></div>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Components</p>
          {err.components?.message && <p className="mb-2 text-xs text-red-600">{err.components.message}</p>}
          <div className="space-y-2">
            {components.fields.map((f, i) => (
              <div key={f.id} className="grid grid-cols-12 items-end gap-2 rounded-md bg-slate-50 p-2">
                <Field label="Type" className="col-span-2">
                  <Select {...r(`components.${i}.type`)}><option value="TH">TH</option><option value="IN">IN</option></Select>
                </Field>
                <Field label="NEB code" className="col-span-3" error={err.components?.[i]?.nebCode?.message}><Input {...r(`components.${i}.nebCode`)} /></Field>
                <Field label="Credit hr" className="col-span-2" error={err.components?.[i]?.creditHour?.message}><Input type="number" step="0.25" {...r(`components.${i}.creditHour`)} /></Field>
                <Field label="Full mark" className="col-span-2" error={err.components?.[i]?.fullMark?.message}><Input type="number" {...r(`components.${i}.fullMark`)} /></Field>
                <Field label="Pass %" className="col-span-2" error={err.components?.[i]?.passPercent?.message}><Input type="number" {...r(`components.${i}.passPercent`)} /></Field>
                <div className="col-span-1 pb-1">
                  <Button variant="ghost" size="sm" disabled={components.fields.length <= 1} onClick={() => components.remove(i)} aria-label="Remove component"><Trash2 className="size-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          {components.fields.length < 2 && (
            <Button className="mt-2" size="sm" variant="secondary" onClick={() => components.append({ type: 'IN', nebCode: '', creditHour: 1.25, fullMark: 25, passPercent: 35 })}>
              <Plus className="size-4" /> Add component
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
}
