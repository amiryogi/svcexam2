import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Paginated, StudentListItem } from '@svi/shared';
import { api, ApiError } from '../../api/client';
import { useStreams } from '../../api/hooks';
import type { Enrollment } from '../../api/types';
import { Alert, Button, Field, Input, Modal, Select } from '../../components/ui';
import { toastError } from '../../lib/forms';
import { SubjectPicker } from './SubjectPicker';

interface Props {
  open: boolean;
  onClose: () => void;
  academicYearId: number;
  /** Edit an existing enrollment instead of creating one. */
  enrollment?: Enrollment | null;
  presetStudentId?: number | null;
  defaultGrade?: number;
}

export function EnrollDialog({ open, onClose, academicYearId, enrollment, presetStudentId, defaultGrade = 11 }: Props) {
  const qc = useQueryClient();
  const streams = useStreams();
  const editing = Boolean(enrollment);
  // The parent mounts this dialog fresh each time it opens, so props seed the initial state.
  const [studentId, setStudentId] = useState<number | null>(enrollment?.studentId ?? presetStudentId ?? null);
  const [search, setSearch] = useState('');
  const [grade, setGrade] = useState(enrollment?.grade ?? defaultGrade);
  const [streamId, setStreamId] = useState<number | null>(enrollment?.streamId ?? null);
  const [section, setSection] = useState(enrollment?.section ?? 'A');
  const [rollNo, setRollNo] = useState(enrollment?.rollNo?.toString() ?? '');
  const [symbolNo, setSymbolNo] = useState(enrollment?.symbolNo ?? '');
  const [subjectIds, setSubjectIds] = useState<number[]>(enrollment?.subjectIds ?? []);
  const [problems, setProblems] = useState<string[]>([]);

  const students = useQuery({
    queryKey: ['students', 'picker', search],
    queryFn: () => api<Paginated<StudentListItem>>('/students', { query: { q: search, pageSize: 10, status: 'ACTIVE' } }),
    enabled: open && !editing && search.trim().length >= 2,
  });
  const preset = useQuery({
    queryKey: ['student', studentId],
    queryFn: () => api<{ id: number; fullName: string; admissionNo: string }>(`/students/${studentId}`),
    enabled: open && Boolean(studentId),
  });

  const onSubjects = useCallback((ids: number[]) => setSubjectIds(ids), []);

  const save = useMutation({
    mutationFn: async () => {
      if (editing && enrollment) {
        await api(`/enrollments/${enrollment.id}`, {
          method: 'PATCH',
          body: { streamId, section, rollNo: rollNo ? Number(rollNo) : null, symbolNo },
        });
        return api(`/enrollments/${enrollment.id}/subjects`, { method: 'PUT', body: { subjectIds } });
      }
      return api('/enrollments', {
        method: 'POST',
        body: { studentId, academicYearId, grade, streamId, section, rollNo: rollNo ? Number(rollNo) : null, symbolNo, subjectIds },
      });
    },
    onSuccess: async () => {
      toast.success(editing ? 'Enrollment updated' : 'Student enrolled');
      await qc.invalidateQueries({ queryKey: ['enrollments'] });
      await qc.invalidateQueries({ queryKey: ['student'] });
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === 'BAD_REQUEST' && Object.keys(e.fieldErrors).length) {
        const fields = (e.details as { fields: { message: string }[] }).fields;
        setProblems(fields.map((f) => f.message));
      } else toastError(e);
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? `Edit enrollment · ${enrollment?.fullName}` : 'Enroll student'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button disabled={!studentId || !streamId || subjectIds.length === 0} loading={save.isPending} onClick={() => save.mutate()}>
            {editing ? 'Save' : 'Enroll'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {!editing && (
          <Field label="Student" required>
            {studentId ? (
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                <span>{preset.data ? `${preset.data.fullName} (${preset.data.admissionNo})` : `#${studentId}`}</span>
                <button className="text-xs font-medium text-brand-700" onClick={() => setStudentId(null)}>Change</button>
              </div>
            ) : (
              <div>
                <Input placeholder="Type at least 2 letters of the name or admission no." value={search} onChange={(e) => setSearch(e.target.value)} />
                {students.data && (
                  <ul className="mt-1 max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-md ring-1 ring-slate-200">
                    {students.data.items.map((s) => (
                      <li key={s.id}>
                        <button className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => setStudentId(s.id)}>
                          {s.fullName} <span className="text-slate-400">· {s.admissionNo}</span>
                          {s.currentEnrollment && <span className="text-xs text-slate-400"> · {s.currentEnrollment.academicYear} G{s.currentEnrollment.grade}</span>}
                        </button>
                      </li>
                    ))}
                    {students.data.items.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No match</li>}
                  </ul>
                )}
              </div>
            )}
          </Field>
        )}
        <div className="grid gap-4 sm:grid-cols-5">
          <Field label="Grade" required>
            <Select value={grade} disabled={editing} onChange={(e) => { setGrade(Number(e.target.value)); setSubjectIds([]); }}>
              <option value={11}>XI</option>
              <option value={12}>XII</option>
            </Select>
          </Field>
          <Field label="Stream" required className="sm:col-span-2">
            <Select value={streamId ?? ''} onChange={(e) => { setStreamId(e.target.value ? Number(e.target.value) : null); if (!editing) setSubjectIds([]); }}>
              <option value="">Choose…</option>
              {streams.data?.filter((s) => s.isActive || s.id === streamId).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Section"><Input value={section} maxLength={10} onChange={(e) => setSection(e.target.value.toUpperCase())} /></Field>
          <Field label="Roll no."><Input type="number" min={1} value={rollNo} onChange={(e) => setRollNo(e.target.value)} /></Field>
        </div>
        <Field label="NEB symbol number" hint="Can be added later in bulk">
          <Input value={symbolNo} onChange={(e) => setSymbolNo(e.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Subjects</p>
          <SubjectPicker streamId={streamId} grade={grade} value={subjectIds} onChange={onSubjects} />
        </div>
        {problems.length > 0 && (
          <Alert tone="red">
            <ul className="list-disc pl-5">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          </Alert>
        )}
      </div>
    </Modal>
  );
}
