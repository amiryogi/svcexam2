import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { qk, useStreams } from '../../api/hooks';
import type { Stream } from '../../api/types';
import { Badge, Button, Card, CardHeader, Checkbox, Field, Input, LoadingBlock, Modal, Table, Td, Th } from '../../components/ui';
import { toastError } from '../../lib/forms';

export function StreamsTab() {
  const qc = useQueryClient();
  const streams = useStreams();
  const [editing, setEditing] = useState<Partial<Stream> | null>(null);

  const save = useMutation({
    mutationFn: (s: Partial<Stream>) => {
      const body = { code: s.code, name: s.name, isActive: s.isActive ?? true };
      return s.id ? api(`/streams/${s.id}`, { method: 'PUT', body }) : api('/streams', { method: 'POST', body });
    },
    onSuccess: async () => {
      toast.success('Stream saved');
      setEditing(null);
      await qc.invalidateQueries({ queryKey: qk.streams });
    },
    onError: toastError,
  });

  return (
    <Card>
      <CardHeader title="Streams" description="Faculties offered by the school." actions={<Button onClick={() => setEditing({ code: '', name: '', isActive: true })}><Plus className="size-4" /> Add stream</Button>} />
      {streams.isPending ? (
        <LoadingBlock />
      ) : (
        <Table>
          <thead className="bg-slate-50"><tr><Th>Code</Th><Th>Name</Th><Th>Status</Th><Th /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {streams.data?.map((s) => (
              <tr key={s.id}>
                <Td className="font-mono text-xs">{s.code}</Td>
                <Td>{s.name}</Td>
                <Td>{s.isActive ? <Badge color="green">Active</Badge> : <Badge>Inactive</Badge>}</Td>
                <Td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditing(s)}>Edit</Button></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit stream' : 'Add stream'}
        size="sm"
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={save.isPending} onClick={() => editing && save.mutate(editing)}>Save</Button></>}
      >
        {editing && (
          <div className="space-y-4">
            <Field label="Code" required><Input value={editing.code ?? ''} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Name" required><Input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Checkbox label="Active" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
          </div>
        )}
      </Modal>
    </Card>
  );
}
