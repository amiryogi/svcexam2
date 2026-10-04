import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { changePasswordSchema, type ChangePasswordInput } from '@svi/shared';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Button, Card, CardHeader, Field, Input, PageHeader } from '../components/ui';
import { titleCase } from '../lib/format';
import { applyServerErrors } from '../lib/forms';

export function ProfilePage() {
  const { user } = useAuth();
  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });
  const err = form.formState.errors;
  const change = useMutation({
    mutationFn: (v: ChangePasswordInput) => api('/auth/change-password', { method: 'POST', body: v }),
    onSuccess: () => {
      toast.success('Password changed. Other devices were signed out.');
      form.reset();
    },
    onError: (e) => applyServerErrors(e, form.setError),
  });

  return (
    <>
      <PageHeader title="My account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <dl className="space-y-3 text-sm">
            <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{user?.fullName}</dd></div>
            <div><dt className="text-slate-500">Username</dt><dd className="font-mono">{user?.username}</dd></div>
            <div><dt className="text-slate-500">Role</dt><dd>{user && titleCase(user.role)}</dd></div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Change password" />
          <form className="space-y-4 p-5" onSubmit={form.handleSubmit((v) => change.mutate(v))} noValidate>
            <Field label="Current password" error={err.currentPassword?.message}>
              <Input type="password" autoComplete="current-password" {...form.register('currentPassword')} />
            </Field>
            <Field label="New password" error={err.newPassword?.message} hint="At least 10 characters with upper and lower case letters and a number">
              <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
            </Field>
            <Field label="Confirm new password" error={err.confirmPassword?.message}>
              <Input type="password" autoComplete="new-password" {...form.register('confirmPassword')} />
            </Field>
            <div className="flex justify-end"><Button type="submit" loading={change.isPending}>Change password</Button></div>
          </form>
        </Card>
      </div>
    </>
  );
}
