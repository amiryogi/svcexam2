import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import { GENDERS, STUDENT_STATUSES, studentSchema, type StudentInput } from '@svi/shared';
import { api } from '../../api/client';
import type { Student } from '../../api/types';
import { Button, Card, ErrorBlock, Field, Input, LoadingBlock, PageHeader, Select, Textarea } from '../../components/ui';
import { adToBs, bsToAd } from '../../lib/bsDate';
import { titleCase } from '../../lib/format';
import { applyServerErrors, nullsToEmpty } from '../../lib/forms';

type Output = z.output<typeof studentSchema>;

const EMPTY: StudentInput = {
  admissionNo: '',
  firstName: '',
  middleName: '',
  lastName: '',
  gender: 'MALE',
  dobBs: '',
  dobAd: '',
  nebRegistrationNo: '',
  guardianName: '',
  guardianPhone: '',
  phone: '',
  email: '',
  address: '',
  status: 'ACTIVE',
};

export function StudentFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const existing = useQuery({
    queryKey: ['student', Number(id)],
    queryFn: () => api<Student>(`/students/${id}`),
    enabled: editing,
  });

  const form = useForm<StudentInput, unknown, Output>({ resolver: zodResolver(studentSchema), defaultValues: EMPTY });
  const { register, formState, setValue, getValues, reset } = form;
  const err = formState.errors;

  useEffect(() => {
    if (existing.data) {
      const s = existing.data;
      reset(
        nullsToEmpty({
          admissionNo: s.admissionNo,
          firstName: s.firstName,
          middleName: s.middleName,
          lastName: s.lastName,
          gender: s.gender,
          dobBs: s.dobBs,
          dobAd: s.dobAd,
          nebRegistrationNo: s.nebRegistrationNo,
          guardianName: s.guardianName,
          guardianPhone: s.guardianPhone,
          phone: s.phone,
          email: s.email,
          address: s.address,
          status: s.status,
        }) as StudentInput,
      );
    }
  }, [existing.data, reset]);

  const save = useMutation({
    mutationFn: (values: Output) =>
      editing
        ? api<Student>(`/students/${id}`, { method: 'PUT', body: values })
        : api<Student>('/students', { method: 'POST', body: values }),
    onSuccess: async (s) => {
      toast.success(editing ? 'Student updated' : 'Student added');
      await qc.invalidateQueries({ queryKey: ['students'] });
      await qc.invalidateQueries({ queryKey: ['student', s.id] });
      navigate(`/students/${s.id}`);
    },
    onError: (e) => applyServerErrors(e, form.setError),
  });

  if (editing && existing.isPending) return <LoadingBlock />;
  if (editing && existing.isError) return <ErrorBlock error={existing.error} />;

  // Fill the other calendar when one date of birth is typed.
  const syncFromBs = () => {
    const bs = getValues('dobBs');
    const ad = bs ? bsToAd(bs) : null;
    if (ad) setValue('dobAd', ad, { shouldValidate: true });
  };
  const syncFromAd = () => {
    const ad = getValues('dobAd');
    const bs = ad ? adToBs(ad) : null;
    if (bs) setValue('dobBs', bs, { shouldValidate: true });
  };

  return (
    <>
      <PageHeader title={editing ? 'Edit student' : 'Add student'} />
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        <Card className="space-y-8 p-6">
          <section>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Personal details</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="First name" required error={err.firstName?.message}><Input {...register('firstName')} /></Field>
              <Field label="Middle name" error={err.middleName?.message}><Input {...register('middleName')} /></Field>
              <Field label="Last name (surname)" required error={err.lastName?.message}><Input {...register('lastName')} /></Field>
              <Field label="Gender" required error={err.gender?.message}>
                <Select {...register('gender')}>{GENDERS.map((g) => <option key={g} value={g}>{titleCase(g)}</option>)}</Select>
              </Field>
              <Field label="Date of birth (B.S.)" hint="YYYY-MM-DD, A.D. fills in automatically" error={err.dobBs?.message}>
                <Input placeholder="2065-12-26" {...register('dobBs', { onBlur: syncFromBs })} />
              </Field>
              <Field label="Date of birth (A.D.)" error={err.dobAd?.message}>
                <Input type="date" {...register('dobAd', { onBlur: syncFromAd })} />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">School &amp; NEB</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Admission number" required error={err.admissionNo?.message}><Input {...register('admissionNo')} /></Field>
              <Field label="NEB registration number" error={err.nebRegistrationNo?.message}><Input inputMode="numeric" {...register('nebRegistrationNo')} /></Field>
              <Field label="Status" error={err.status?.message}>
                <Select {...register('status')}>{STUDENT_STATUSES.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
              </Field>
            </div>
          </section>

          <section>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Contact</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Guardian name" error={err.guardianName?.message}><Input {...register('guardianName')} /></Field>
              <Field label="Guardian phone" error={err.guardianPhone?.message}><Input {...register('guardianPhone')} /></Field>
              <Field label="Student phone" error={err.phone?.message}><Input {...register('phone')} /></Field>
              <Field label="Email" error={err.email?.message}><Input type="email" {...register('email')} /></Field>
              <Field label="Address" className="sm:col-span-2" error={err.address?.message}><Textarea rows={2} {...register('address')} /></Field>
            </div>
          </section>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5">
            <Link to={editing ? `/students/${id}` : '/students'}><Button variant="secondary">Cancel</Button></Link>
            <Button type="submit" loading={save.isPending}>{editing ? 'Save changes' : 'Add student'}</Button>
          </div>
        </Card>
      </form>
    </>
  );
}
