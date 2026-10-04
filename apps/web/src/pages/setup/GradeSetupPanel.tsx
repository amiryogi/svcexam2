import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { GradeSetupPlan, GradeSetupRow } from '@svi/shared';
import { api } from '../../api/client';
import { Alert, Badge, Button, cn, ErrorBlock, LoadingBlock, Table, Td, Th } from '../../components/ui';
import { toastError } from '../../lib/forms';

type Mode = 'auto' | 'manual';
type Comp = GradeSetupRow['components'][number];

const roman = (g: number) => (g === 11 ? 'XI' : 'XII');

export const gradeSetupPlanKey = (from: number, to: number) => ['grade-setup-plan', from, to] as const;

export function useGradeSetupPlan(from: number, to: number) {
  return useQuery({
    queryKey: gradeSetupPlanKey(from, to),
    queryFn: () => api<GradeSetupPlan>('/subjects/grade-setup-plan', { query: { from, to } }),
  });
}

/** True when the next grade still needs subjects or a curriculum before promotion can work. */
export const setupNeeded = (p: GradeSetupPlan | undefined) =>
  Boolean(p && (p.rows.length > 0 || p.curriculumToCopy.length > 0));

function validate(rows: GradeSetupRow[]): string[] {
  const problems: string[] = [];
  const codes = rows.flatMap((r) => r.components.map((c) => c.nebCode.trim()));
  rows.forEach((r) => {
    if (!r.name.trim()) problems.push(`${r.sourceName}: name is required`);
    r.components.forEach((c) => {
      const label = `${r.name || r.sourceName} (${c.type === 'TH' ? 'theory' : 'practical/internal'})`;
      if (!/^\d{3,6}$/.test(c.nebCode.trim())) problems.push(`${label}: NEB code must be 3–6 digits`);
      if (!(c.creditHour > 0 && c.creditHour <= 10)) problems.push(`${label}: credit hours must be between 0.25 and 10`);
      if (!(c.fullMark >= 1 && c.fullMark <= 200)) problems.push(`${label}: full mark must be between 1 and 200`);
    });
  });
  const dup = codes.find((c, i) => codes.indexOf(c) !== i);
  if (dup) problems.push(`NEB code ${dup} is used twice`);
  return problems;
}

/**
 * Sets up the next grade's subjects from the current grade:
 * Auto = official NEB codes from the built-in catalog; Manual = admin enters theory & practical values.
 */
export function GradeSetupPanel({ from = 11, to = 12, onDone, onCancel }: { from?: number; to?: number; onDone?: () => void; onCancel?: () => void }) {
  const plan = useGradeSetupPlan(from, to);
  if (plan.isPending) return <LoadingBlock label="Checking subjects…" />;
  if (plan.isError) return <ErrorBlock error={plan.error} onRetry={() => plan.refetch()} />;
  // Remount the editor when the plan changes so manual edits start from fresh values.
  return <GradeSetupEditor key={plan.dataUpdatedAt} plan={plan.data} onDone={onDone} onCancel={onCancel} />;
}

function GradeSetupEditor({ plan, onDone, onCancel }: { plan: GradeSetupPlan; onDone?: () => void; onCancel?: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('auto');
  const [rows, setRows] = useState<GradeSetupRow[]>(() => structuredClone(plan.rows));
  const allCatalog = plan.rows.every((r) => r.source === 'catalog');

  const apply = useMutation({
    mutationFn: () =>
      api<{ createdSubjects: string[]; copiedCurricula: string[] }>('/subjects/copy-grade', {
        method: 'POST',
        body: {
          from: plan.from,
          to: plan.to,
          ...(mode === 'manual' && {
            items: rows.map((r) => ({
              familyCode: r.familyCode,
              name: r.name.trim(),
              components: r.components.map((c) => ({ ...c, nebCode: c.nebCode.trim() })),
            })),
          }),
        },
      }),
    onSuccess: async (r) => {
      toast.success(
        `Grade ${roman(plan.to)}: ${r.createdSubjects.length} subject(s) created` +
          (r.copiedCurricula.length ? `, curriculum set up for ${r.copiedCurricula.join(', ')}` : ''),
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['subjects'] }),
        qc.invalidateQueries({ queryKey: ['curriculum'] }),
        qc.invalidateQueries({ queryKey: ['grade-setup-plan'] }),
      ]);
      onDone?.();
    },
    onError: toastError,
  });

  if (plan.rows.length === 0 && plan.curriculumToCopy.length === 0) {
    return (
      <div className="space-y-3">
        <Alert tone="green">
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="size-4" /> All Grade {roman(plan.from)} subjects already have a Grade {roman(plan.to)} version.
          </span>
        </Alert>
        {plan.curriculumMissing.length > 0 && (
          <Alert>No Grade {roman(plan.to)} curriculum yet for {plan.curriculumMissing.join(', ')}. Set it up under Setup → Curriculum.</Alert>
        )}
      </div>
    );
  }

  const shown = mode === 'auto' ? plan.rows : rows;
  const problems = mode === 'manual' ? validate(rows) : [];
  const setComp = (ri: number, type: Comp['type'], patch: Partial<Comp>) => {
    setRows((rs) =>
      rs.map((r, i) => (i === ri ? { ...r, components: r.components.map((c) => (c.type === type ? { ...c, ...patch } : c)) } : r)),
    );
  };

  const modeCard = (m: Mode, icon: React.ReactNode, title: string, text: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className={cn(
        'flex flex-1 items-start gap-3 rounded-lg p-3 text-left ring-1 transition',
        mode === m ? 'bg-brand-50 ring-2 ring-brand-600' : 'bg-white ring-slate-200 hover:bg-slate-50',
      )}
      aria-pressed={mode === m}
    >
      <span className={cn('mt-0.5', mode === m ? 'text-brand-700' : 'text-slate-400')}>{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{text}</span>
      </span>
    </button>
  );

  const cell = (ri: number, c: Comp | undefined, field: 'nebCode' | 'creditHour' | 'fullMark') => {
    if (!c) return <Td className="text-slate-300">—</Td>;
    const value = c[field];
    if (mode === 'auto') return <Td className={field === 'nebCode' ? 'font-mono text-xs' : ''}>{field === 'creditHour' ? Number(value).toFixed(2) : value}</Td>;
    return (
      <Td className="px-2 py-1.5">
        <input
          type={field === 'nebCode' ? 'text' : 'number'}
          inputMode={field === 'nebCode' ? 'numeric' : 'decimal'}
          step={field === 'creditHour' ? '0.25' : '1'}
          value={value}
          onChange={(e) => setComp(ri, c.type, { [field]: field === 'nebCode' ? e.target.value : Number(e.target.value) })}
          className={cn(
            'no-spin w-full rounded-md border-0 px-2 py-1 text-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-brand-600 focus:outline-none',
            field === 'nebCode' ? 'w-20 font-mono' : 'w-16 text-right',
          )}
          aria-label={`${field} ${c.type}`}
        />
      </Td>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        {modeCard('auto', <Sparkles className="size-5" />, 'Auto – official NEB codes', allCatalog
          ? `Uses the NEB Grade ${roman(plan.to)} subject codes, credit hours and full marks built into the system.`
          : 'Uses the NEB codes built into the system; subjects not in the NEB list get a suggested code.')}
        {modeCard('manual', <Pencil className="size-5" />, 'Manual – enter yourself', 'Type the NEB code, credit hours and full marks for theory and practical of each subject.')}
      </div>

      <Table className="rounded-md ring-1 ring-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <Th rowSpan={2}>Grade {roman(plan.to)} subject</Th>
            <Th colSpan={3} className="border-l border-slate-200 text-center">Theory (TH)</Th>
            <Th colSpan={3} className="border-l border-slate-200 text-center">Practical / Internal (IN)</Th>
            <Th rowSpan={2} className="border-l border-slate-200">Source</Th>
          </tr>
          <tr>
            <Th className="border-l border-slate-200">Code</Th><Th>CH</Th><Th>FM</Th>
            <Th className="border-l border-slate-200">Code</Th><Th>CH</Th><Th>FM</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {shown.map((r, ri) => {
            const th = r.components.find((c) => c.type === 'TH');
            const inn = r.components.find((c) => c.type === 'IN');
            return (
              <tr key={r.familyCode}>
                <Td>
                  {mode === 'manual' ? (
                    <input
                      value={r.name}
                      onChange={(e) => {
                        setRows((rs) => rs.map((x, i) => (i === ri ? { ...x, name: e.target.value } : x)));
                      }}
                      className="w-56 rounded-md border-0 px-2 py-1 text-sm ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-brand-600 focus:outline-none"
                      aria-label="Subject name"
                    />
                  ) : (
                    <span className="font-medium">{r.name}</span>
                  )}
                  <span className="block text-xs text-slate-400">from {r.sourceName} ({r.familyCode})</span>
                </Td>
                {cell(ri, th, 'nebCode')}{cell(ri, th, 'creditHour')}{cell(ri, th, 'fullMark')}
                {cell(ri, inn, 'nebCode')}{cell(ri, inn, 'creditHour')}{cell(ri, inn, 'fullMark')}
                <Td>
                  {mode === 'manual' && JSON.stringify(r) !== JSON.stringify(plan.rows[ri]) ? (
                    <Badge color="purple">Edited</Badge>
                  ) : r.source === 'catalog' ? (
                    <Badge color="green">NEB list</Badge>
                  ) : (
                    <Badge color="amber">Suggested</Badge>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {plan.curriculumToCopy.length > 0 && (
        <p className="text-sm text-slate-600">
          The subject groups of {plan.curriculumToCopy.join(' and ')} will also be set up for Grade {roman(plan.to)} (same choices as Grade {roman(plan.from)}).
        </p>
      )}
      {mode === 'auto' && !allCatalog && (
        <Alert>Rows marked <b>Suggested</b> are not in the NEB list; their codes follow the usual pattern. Check them, or switch to Manual.</Alert>
      )}
      {problems.length > 0 && (
        <Alert tone="red">
          <ul className="list-disc pl-5">{problems.slice(0, 6).map((p) => <li key={p}>{p}</li>)}</ul>
        </Alert>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button loading={apply.isPending} disabled={problems.length > 0} onClick={() => apply.mutate()}>
          {plan.rows.length > 0
            ? `Create ${plan.rows.length} Grade ${roman(plan.to)} subject${plan.rows.length === 1 ? '' : 's'}`
            : `Set up Grade ${roman(plan.to)} curriculum`}
        </Button>
      </div>
    </div>
  );
}
