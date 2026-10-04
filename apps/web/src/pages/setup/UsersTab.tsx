import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ROLES } from '@svi/shared';
import { api } from '../../api/client';
import type { UserRow } from '../../api/types';
import { useAuth } from '../../auth/AuthProvider';
import { Badge, Button, Card, CardHeader, ErrorBlock, Field, Input, LoadingBlock, Modal, Select, Table, Td, Th } from '../../components/ui';
import { formatDateTime, titleCase } from '../../lib/format';
import { toastError } from '../../lib/forms';

export function UsersTab() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const q = useQuery({ queryKey: ['users'], queryFn: () => api<UserRow[]>('/users') });
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [form, setForm] = useState({ username: '', fullName: '', email: '', role: 'ADMIN', password: '' });
  const [newPassword, setNewPassword] = useState('');

  const refresh = () => qc.invalidateQueries({ queryKey: ['users'] });
  const create = useMutation({
    mutationFn: () => api('/users', { method: 'POST', body: form }),
    onSuccess: async () => {
      toast.success('User created');
      setCreating(false);
      setForm({ username: '', fullName: '', email: '', role: 'ADMIN', password: '' });
      await refresh();
    },
    onError: toastError,
  });
  const toggle = useMutation({
    mutationFn: (u: UserRow) => api(`/users/${u.id}`, { method: 'PATCH', body: { isActive: !u.isActive } }),
    onSuccess: refresh,
    onError: toastError,
  });
  const reset = useMutation({
    mutationFn: () => api(`/users/${resetting!.id}/reset-password`, { method: 'POST', body: { password: newPassword } }),
    onSuccess: () => {
      toast.success('Password reset; the user was signed out everywhere');
      setResetting(null);
      setNewPassword('');
    },
    onError: toastError,
  });

  if (q.isPending) return <LoadingBlock />;
  if (q.isError) return <ErrorBlock error={q.error} />;

  return (
    <Card>
      <CardHeader title="Administrators" description="Only administrators can sign in. Super admins can manage users and unlock exams." actions={<Button onClick={() => setCreating(true)}><Plus className="size-4" /> Add user</Button>} />
      <Table>
        <thead className="bg-slate-50"><tr><Th>Username</Th><Th>Name</Th><Th>Role</Th><Th>Status</Th><Th>Last sign in</Th><Th /></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {q.data.map((u) => (
            <tr key={u.id}>
              <Td className="font-mono text-xs">{u.username}</Td>
              <Td>{u.fullName}</Td>
              <Td><Badge color={u.role === 'SUPER_ADMIN' ? 'purple' : 'blue'}>{titleCase(u.role)}</Badge></Td>
              <Td>
                {!u.isActive ? <Badge>Inactive</Badge> : u.lockedUntil && new Date(u.lockedUntil) > new Date() ? <Badge color="amber">Locked</Badge> : <Badge color="green">Active</Badge>}
              </Td>
              <Td>{formatDateTime(u.lastLoginAt)}</Td>
              <Td className="text-right">
                <Button size="sm" variant="ghost" onClick={() => setResetting(u)}><KeyRound className="size-4" /> Reset password</Button>
                {u.id !== me?.id && (
                  <Button size="sm" variant="ghost" onClick={() => toggle.mutate(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add administrator"
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setCreating(false)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Create</Button></>}
      >
        <div className="space-y-4">
          <Field label="Username" required><Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></Field>
          <Field label="Full name" required><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Role">
            <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</Select>
          </Field>
          <Field label="Initial password" required hint="At least 10 characters with upper and lower case letters and a number">
            <Input type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={Boolean(resetting)}
        onClose={() => setResetting(null)}
        title={`Reset password · ${resetting?.username}`}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setResetting(null)}>Cancel</Button><Button loading={reset.isPending} onClick={() => reset.mutate()}>Reset</Button></>}
      >
        <Field label="New password" required hint="At least 10 characters with upper and lower case letters and a number">
          <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </Field>
      </Modal>
    </Card>
  );
}
