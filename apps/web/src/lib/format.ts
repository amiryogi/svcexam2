import type { ExamStatus } from '@svi/shared';
import type { BadgeColor } from '../components/ui';

export const EXAM_STATUS_LABEL: Record<ExamStatus, string> = {
  DRAFT: 'Draft',
  MARK_ENTRY: 'Mark entry',
  PUBLISHED: 'Published',
  LOCKED: 'Locked',
};

export const EXAM_STATUS_COLOR: Record<ExamStatus, BadgeColor> = {
  DRAFT: 'gray',
  MARK_ENTRY: 'blue',
  PUBLISHED: 'green',
  LOCKED: 'purple',
};

export const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');

export const formatDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const gradeLabel = (g: number) => (g === 11 ? 'Grade XI' : g === 12 ? 'Grade XII' : `Grade ${g}`);
