import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { z } from 'zod';
import { EXAM_TYPES, examSchema, examYears, type ExamDto, type ExamInput } from '@svi/shared';
import { api } from '../../api/client';
import { useAcademicYears } from '../../api/hooks';
import type { Enrollment } from '../../api/types';
import { Alert, Button, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { gradeLabel, titleCase } from '../../lib/format';
import { applyServerErrors } from '../../lib/forms';

type Output = z.output<typeof examSchema>;

export function ExamFormDialog({ open, onClose, exam }: { open: boolean; onClose: () => void; exam?: ExamDto | null }) {
  const qc = useQueryClient();
  const years = useAcademicYears();
  const form = useForm<ExamInput, unknown, Output>({ resolver: zodResolver(examSchema) });
  const { register, formState, reset, control } = form;
  const err = formState.errors;
  // After publishing only the print details (conducted year, dates, remarks) can change.
  const published = exam?.status === 'PUBLISHED';
  const selectedYearId = useWatch({ control, name: 'academicYearId' });
  const yearName = years.data?.find((y) => y.id === Number(selectedYearId))?.name ?? exam?.academicYear ?? '';
  const derived = examYears(null, null, yearName);
  const selectedGrade = Number(useWatch({ control, name: 'grade' }));

  // Students per grade in the chosen year, so an exam is never created for an empty class.
  const enrolled = useQuery({
    queryKey: ['enrollments', 'per-grade', Number(selectedYearId)],
    queryFn: () => api<Enrollment[]>('/enrollments', { query: { academicYearId: Number(selectedYearId) } }),
    enabled: open && Number(selectedYearId) > 0,
  });
  const countFor = (g: number) => enrolled.data?.filter((e) => e.grade === g).length;
  const otherGrade = selectedGrade === 11 ? 12 : 11;

  // New exams default to the grade that actually has students in that year.
  const { setValue, getFieldState } = form;
  useEffect(() => {
    if (exam || !enrolled.data || getFieldState('grade').isDirty) return;
    const c11 = enrolled.data.filter((e) => e.grade === 11).length;
    const c12 = enrolled.data.filter((e) => e.grade === 12).length;
    if (c12 > c11) setValue('grade', 12);
    else if (c11 > 0) setValue('grade', 11);
  }, [exam, enrolled.data, setValue, getFieldState]);

  useEffect(() => {
    if (!open) return;
    const current = years.data?.find((y) => y.isCurrent) ?? years.data?.[0];
    reset(
      exam
        ? {
            academicYearId: exam.academicYearId,
            grade: exam.grade,
            name: exam.name,
            type: exam.type,
            examYearBs: exam.examYearBs ?? '',
            examYearAd: exam.examYearAd ?? '',
            resultDateBs: exam.resultDateBs ?? '',
            issueDateBs: exam.issueDateBs ?? '',
            remarks: exam.remarks ?? '',
          }
        : {
            academicYearId: current?.id ?? 0,
            grade: 11,
            name: '',
            type: 'TERMINAL',
            examYearBs: '',
            examYearAd: '',
            resultDateBs: '',
            issueDateBs: '',
            remarks: '',
          },
    );
  }, [open, exam, years.data, reset]);

  const save = useMutation({
    mutationFn: (v: Output) => {
      if (exam) {
        // Year and grade only change before publishing (and only while the exam has no marks).
        const { academicYearId: _y, grade: _g, ...rest } = v;
        return api<ExamDto>(`/exams/${exam.id}`, { method: 'PUT', body: published ? rest : v });
      }
      return api<ExamDto>('/exams', { method: 'POST', body: v });
    },
    onSuccess: async () => {
      toast.success(exam ? 'Exam updated' : 'Exam created');
      await qc.invalidateQueries({ queryKey: ['exams'] });
      await qc.invalidateQueries({ queryKey: ['exam'] });
      onClose();
    },
    onError: (e) => applyServerErrors(e, form.setError),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exam ? (published ? 'Edit print details' : 'Edit exam') : 'New exam'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} onClick={form.handleSubmit((v) => save.mutate(v))}>{exam ? 'Save' : 'Create exam'}</Button>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()} noValidate>
        <Field label="Academic year" required error={err.academicYearId?.message}>
          <Select disabled={published} {...register('academicYearId')}>
            {years.data?.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
          </Select>
        </Field>
        <Field label="Grade" required error={err.grade?.message}>
          <Select disabled={published} {...register('grade')}>
            {[11, 12].map((g) => {
              const n = countFor(g);
              return (
                <option key={g} value={g}>
                  {gradeLabel(g)}
                  {n === undefined ? '' : ` – ${n} student${n === 1 ? '' : 's'}`}
                </option>
              );
            })}
          </Select>
        </Field>
        {!published && countFor(selectedGrade) === 0 && (
          <div className="sm:col-span-2">
            <Alert>
              No {gradeLabel(selectedGrade)} students are enrolled in {yearName}, so there would be nobody to enter marks for.
              {(countFor(otherGrade) ?? 0) > 0 && (
                <> Did you mean <b>{gradeLabel(otherGrade)}</b> ({countFor(otherGrade)} students)?</>
              )}
            </Alert>
          </div>
        )}
        <Field label="Exam name" required error={err.name?.message} hint="e.g. First Terminal, Final">
          <Input disabled={published} {...register('name')} />
        </Field>
        <Field label="Type" required error={err.type?.message}>
          <Select disabled={published} {...register('type')}>{EXAM_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</Select>
        </Field>
        <Field label="Conducted in (B.S. year)" error={err.examYearBs?.message} hint={`Leave blank to use the academic year (${derived.bs})`}>
          <Input placeholder={derived.bs} {...register('examYearBs')} />
        </Field>
        <Field label="Conducted in (A.D. year)" error={err.examYearAd?.message} hint={`Leave blank for ${derived.ad || 'B.S. − 57'}`}>
          <Input placeholder={derived.ad} {...register('examYearAd')} />
        </Field>
        <Field label="Result date (B.S.)" error={err.resultDateBs?.message}><Input placeholder="YYYY-MM-DD" {...register('resultDateBs')} /></Field>
        <Field label="Date of issue (B.S.)" error={err.issueDateBs?.message} hint="Printed on grade sheets"><Input placeholder="YYYY-MM-DD" {...register('issueDateBs')} /></Field>
        <Field label="Remarks" className="sm:col-span-2" error={err.remarks?.message}><Textarea rows={2} {...register('remarks')} /></Field>
      </form>
    </Modal>
  );
}
