import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { CurriculumGroupDto } from '@svi/shared';
import { api } from '../../api/client';
import { useSubjects } from '../../api/hooks';
import { Alert, Spinner } from '../../components/ui';

/**
 * Subject selection driven by the curriculum groups of a stream & grade.
 * Groups where every subject is required are pre-selected and locked.
 */
export function SubjectPicker({
  streamId,
  grade,
  value,
  onChange,
}: {
  streamId: number | null;
  grade: number;
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const subjects = useSubjects(grade);
  const curriculum = useQuery({
    queryKey: ['curriculum', streamId, grade],
    queryFn: () => api<CurriculumGroupDto[]>('/curriculum', { query: { streamId, grade } }),
    enabled: Boolean(streamId),
  });

  // Auto-select locked (all-required) groups.
  useEffect(() => {
    if (!curriculum.data) return;
    const required = curriculum.data
      .filter((g) => g.minSelect === g.subjectIds.length)
      .flatMap((g) => g.subjectIds);
    const missing = required.filter((id) => !value.includes(id));
    if (missing.length) onChange([...value, ...missing]);
  }, [curriculum.data, value, onChange]);

  if (!streamId) return <p className="text-sm text-slate-500">Choose a stream first.</p>;
  if (curriculum.isPending || subjects.isPending) return <Spinner />;
  if (!curriculum.data?.length) {
    return <Alert>No curriculum is set up for this stream and grade. Configure it under Setup → Curriculum.</Alert>;
  }
  const byId = new Map(subjects.data?.map((s) => [s.id, s]) ?? []);
  const creditHours = value.reduce(
    (sum, id) => sum + (byId.get(id)?.components.reduce((s, c) => s + c.creditHour, 0) ?? 0),
    0,
  );

  const toggle = (group: CurriculumGroupDto, id: number, checked: boolean) => {
    let next = value.filter((v) => v !== id);
    if (checked) {
      if (group.maxSelect === 1) next = next.filter((v) => !group.subjectIds.includes(v));
      next.push(id);
    }
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {curriculum.data.map((g) => {
        const locked = g.minSelect === g.subjectIds.length;
        const picked = g.subjectIds.filter((id) => value.includes(id)).length;
        const ok = picked >= g.minSelect && picked <= g.maxSelect;
        return (
          <fieldset key={g.id} className="rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-600">
              {g.name}{' '}
              <span className={ok ? 'text-green-700' : 'text-amber-700'}>
                ({locked ? 'required' : g.minSelect === g.maxSelect ? `choose ${g.minSelect}` : `choose ${g.minSelect}–${g.maxSelect}`})
              </span>
            </legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {g.subjectIds.map((id) => {
                const s = byId.get(id);
                const checked = value.includes(id);
                return (
                  <label key={id} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type={g.maxSelect === 1 && !locked ? 'radio' : 'checkbox'}
                      name={`group-${g.id}`}
                      checked={checked}
                      disabled={locked || (!checked && g.maxSelect > 1 && picked >= g.maxSelect)}
                      onChange={(e) => toggle(g, id, e.target.checked)}
                      className="size-4 text-brand-700"
                    />
                    {s?.name ?? `#${id}`}
                    <span className="text-xs text-slate-400">{s?.components.map((c) => c.nebCode).join('/')}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      <p className="text-right text-xs text-slate-500">Total credit hours: <b>{creditHours.toFixed(2)}</b></p>
    </div>
  );
}
