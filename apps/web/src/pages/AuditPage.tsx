import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { Paginated } from '@svi/shared';
import { api } from '../api/client';
import type { AuditRow } from '../api/types';
import { Card, EmptyState, ErrorBlock, Input, LoadingBlock, Modal, PageHeader, Pagination, Select, Table, Td, Th } from '../components/ui';
import { formatDateTime, titleCase } from '../lib/format';

const ENTITIES = ['student', 'enrollment', 'exam', 'subject', 'curriculum', 'grade_scale', 'academic_year', 'stream', 'settings', 'user'];

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const filters = { page, pageSize: 50, entity: entity || undefined, from: from || undefined, to: to || undefined };
  const q = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => api<Paginated<AuditRow>>('/audit', { query: filters }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader title="Audit log" description="Every change, sign-in and print is recorded here." />
      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-4">
          <Select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(1); }}>
            <option value="">All records</option>
            {ENTITIES.map((e) => <option key={e} value={e}>{titleCase(e)}</option>)}
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From" />
          <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To" />
        </div>
        {q.isPending ? (
          <LoadingBlock />
        ) : q.isError ? (
          <div className="p-4"><ErrorBlock error={q.error} /></div>
        ) : q.data.items.length === 0 ? (
          <EmptyState title="No entries" />
        ) : (
          <>
            <Table>
              <thead className="bg-slate-50"><tr><Th>When</Th><Th>User</Th><Th>Action</Th><Th>Record</Th><Th>IP</Th><Th /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {q.data.items.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <Td className="text-xs">{formatDateTime(a.createdAt)}</Td>
                    <Td>{a.user ?? 'System'}</Td>
                    <Td>{titleCase(a.action)}</Td>
                    <Td>{a.entity.replace('_', ' ')}{a.entityId ? ` #${a.entityId}` : ''}</Td>
                    <Td className="font-mono text-xs">{a.ip ?? ''}</Td>
                    <Td className="text-right">
                      {(a.before !== null || a.after !== null) && (
                        <button className="text-sm font-medium text-brand-700" onClick={() => setSelected(a)}>Details</button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onPage={setPage} />
          </>
        )}
      </Card>
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Change details" size="xl">
        {selected && (
          <div className="grid gap-4 md:grid-cols-2">
            {(['before', 'after'] as const).map((k) => (
              <div key={k}>
                <p className="mb-1 text-xs font-semibold text-slate-500 uppercase">{k}</p>
                <pre className="max-h-[60vh] overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{JSON.stringify(selected[k], null, 2) ?? '—'}</pre>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
