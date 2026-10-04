import { zodResolver } from '@hookform/resolvers/zod';
import { ClipboardList, Lock } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { loginSchema, type LoginInput } from '@svi/shared';
import { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthProvider';
import { Alert, Button, Field, Input } from '../components/ui';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { username: '', password: '' } });

  // Only allow same-app relative redirects.
  const next = params.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  if (user) return <Navigate to={target} replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.username, values.password);
      navigate(target, { replace: true });
    } catch (e) {
      setError(errorMessage(e));
      form.resetField('password');
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-white">
          <ClipboardList className="size-12" />
          <h1 className="mt-3 text-xl font-semibold">+2 Exam Management</h1>
          <p className="text-sm text-brand-100">Administrator sign in</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-white p-6 shadow-xl" noValidate>
          {error && <Alert tone="red">{error}</Alert>}
          <Field label="Username" error={form.formState.errors.username?.message}>
            <Input autoComplete="username" autoFocus {...form.register('username')} />
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            <Input type="password" autoComplete="current-password" {...form.register('password')} />
          </Field>
          <Button type="submit" className="w-full" loading={form.formState.isSubmitting}>
            <Lock className="size-4" /> Sign in
          </Button>
          <p className="text-center text-xs text-slate-500">Authorised staff only. All activity is logged.</p>
        </form>
      </div>
    </div>
  );
}
