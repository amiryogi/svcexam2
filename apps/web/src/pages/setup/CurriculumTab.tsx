import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CurriculumGroupDto, SubjectDto } from '@svi/shared';
import { api, ApiError } from '../../api/client';
import { useStreams, useSubjects } from '../../api/hooks';
import { Alert, Button, Card, CardHeader, EmptyState, ErrorBlock, Field, Input, LoadingBlock, Select } from '../../components/ui';
import { toastError } from '../../lib/forms';

interface Group {
  key: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  subjectIds: number[];
}

let keySeq = 0;
const newKey = () => `g${++keySeq}`;

export function CurriculumTab() {
  const streams = useStreams();
  const [pickedStreamId, setStreamId] = useState<number | null>(null);
  const [grade, setGrade] = useState(11);
  const subjects = useSubjects(grade);
  const streamId = pickedStreamId ?? (streams.data?.find((s) => s.isActive) ?? streams.data?.[0])?.id ?? null;

  const curriculum = useQuery({
    queryKey: ['curriculum', streamId, grade],
    queryFn: () => api<CurriculumGroupDto[]>('/curriculum', { query: { streamId, grade } }),
    enabled: Boolean(streamId),
  });

  return (
    <Card>
      <CardHeader
        title="Curriculum"
        description="Subject groups per stream and grade. Enrollment checks that students choose between the minimum and maximum number of subjects in every group."
        actions={
          <>
            <Select className="w-44" value={streamId ?? ''} onChange={(e) => setStreamId(Number(e.target.value))}>
              {streams.data?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select className="w-32" value={grade} onChange={(e) => setGrade(Number(e.target.value))}>
              <option value={11}>Grade XI</option>
              <option value={12}>Grade XII</option>
            </Select>
          </>
        }
      />
      <div className="space-y-4 p-5">
        {curriculum.isError ? (
          <ErrorBlock error={curriculum.error} />
        ) : curriculum.isPending || subjects.isPending ? (
          <LoadingBlock />
        ) : !subjects.data?.length ? (
          <EmptyState title={`No Grade ${grade === 11 ? 'XI' : 'XII'} subjects`} description="Add subjects first." />
        ) : (
          streamId && (
            <GroupsEditor
              key={`${streamId}-${grade}-${curriculum.dataUpdatedAt}`}
              streamId={streamId}
              grade={grade}
              initial={curriculum.data}
              subjects={subjects.data}
            />
          )
        )}
      </div>
    </Card>
  );
}

function GroupsEditor({ streamId, grade, initial, subjects }: { streamId: number; grade: number; initial: CurriculumGroupDto[]; subjects: SubjectDto[] }) {
  const qc = useQueryClient();
  const [groups, setGroups] = useState<Group[]>(() =>
    initial.map((g) => ({ key: newKey(), name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, subjectIds: g.subjectIds })),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const save = useMutation({
    mutationFn: () => api('/curriculum', { method: 'PUT', body: { streamId, grade, groups: groups.map(({ key: _k, ...g }) => g) } }),
    onSuccess: async () => {
      toast.success('Curriculum saved');
      await qc.invalidateQueries({ queryKey: ['curriculum', streamId, grade] });
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrors(Object.entries(e.fieldErrors).map(([k, v]) => `${k}: ${v}`));
      else toastError(e);
    },
  });

  const update = (key: string, patch: Partial<Group>) => setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  const moveGroup = (i: number, d: number) =>
    setGroups((gs) => {
      const next = [...gs];
      const [g] = next.splice(i, 1);
      next.splice(i + d, 0, g!);
      return next;
    });
  const credit = (ids: number[]) =>
    ids.reduce((s, id) => s + (subjects.find((x) => x.id === id)?.components.reduce((a, c) => a + c.creditHour, 0) ?? 0), 0);

  return (
    <>
      {errors.length > 0 && <Alert tone="red"><ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul></Alert>}
      {groups.length === 0 && <EmptyState title="No groups yet" description="Add a 'Compulsory' group and one group per optional choice." />}
      {groups.map((g, i) => (
        <div key={g.key} className="rounded-lg border border-slate-200 p-4">
          <div className="grid items-end gap-3 sm:grid-cols-12">
            <Field label="Group name" className="sm:col-span-5"><Input value={g.name} onChange={(e) => update(g.key, { name: e.target.value })} /></Field>
            <Field label="Min" className="sm:col-span-2"><Input type="number" min={0} value={g.minSelect} onChange={(e) => update(g.key, { minSelect: Number(e.target.value) })} /></Field>
            <Field label="Max" className="sm:col-span-2"><Input type="number" min={1} value={g.maxSelect} onChange={(e) => update(g.key, { maxSelect: Number(e.target.value) })} /></Field>
            <div className="flex gap-1 pb-1 sm:col-span-3 sm:justify-end">
              <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => moveGroup(i, -1)} aria-label="Move up"><ArrowUp className="size-4" /></Button>
              <Button variant="ghost" size="sm" disabled={i === groups.length - 1} onClick={() => moveGroup(i, 1)} aria-label="Move down"><ArrowDown className="size-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => setGroups(groups.filter((x) => x.key !== g.key))} aria-label="Remove group"><Trash2 className="size-4 text-red-600" /></Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            {subjects.filter((s) => s.isActive || g.subjectIds.includes(s.id)).map((s) => (
              <label key={s.id} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={g.subjectIds.includes(s.id)}
                  onChange={(e) => update(g.key, { subjectIds: e.target.checked ? [...g.subjectIds, s.id] : g.subjectIds.filter((x) => x !== s.id) })}
                />
                {s.name}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {g.subjectIds.length} subject(s) · {g.minSelect === g.maxSelect ? `choose ${g.minSelect}` : `choose ${g.minSelect}–${g.maxSelect}`}
            {g.minSelect === g.subjectIds.length && g.subjectIds.length > 0 ? ` · all required (${credit(g.subjectIds).toFixed(2)} CH)` : ''}
          </p>
        </div>
      ))}
      <div className="flex justify-between">
        <Button variant="secondary" onClick={() => setGroups([...groups, { key: newKey(), name: '', minSelect: 1, maxSelect: 1, subjectIds: [] }])}>
          <Plus className="size-4" /> Add group
        </Button>
        <Button loading={save.isPending} disabled={!groups.length} onClick={() => save.mutate()}>Save curriculum</Button>
      </div>
    </>
  );
}
