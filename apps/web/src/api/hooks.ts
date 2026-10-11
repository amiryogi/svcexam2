import { useQuery } from '@tanstack/react-query';
import type { ExamDto, PublicBranding, SchoolInfo, SubjectDto } from '@svi/shared';
import { api } from './client';
import type { AcademicYear, Stream } from './types';

export const qk = {
  years: ['academic-years'] as const,
  streams: ['streams'] as const,
  subjects: (grade?: number) => ['subjects', grade ?? 'all'] as const,
  settings: ['settings'] as const,
  branding: ['branding'] as const,
  exams: (filters: object = {}) => ['exams', filters] as const,
  exam: (id: number) => ['exam', id] as const,
};

export function useAcademicYears() {
  return useQuery({ queryKey: qk.years, queryFn: () => api<AcademicYear[]>('/academic-years'), staleTime: 60_000 });
}

export function useCurrentYear() {
  const years = useAcademicYears();
  return { ...years, current: years.data?.find((y) => y.isCurrent) ?? years.data?.[0] ?? null };
}

export function useStreams() {
  return useQuery({ queryKey: qk.streams, queryFn: () => api<Stream[]>('/streams'), staleTime: 60_000 });
}

export function useSubjects(grade?: number) {
  return useQuery({
    queryKey: qk.subjects(grade),
    queryFn: () => api<SubjectDto[]>('/subjects', { query: { grade } }),
    staleTime: 60_000,
  });
}

export function useSettings() {
  return useQuery({ queryKey: qk.settings, queryFn: () => api<SchoolInfo>('/settings'), staleTime: 5 * 60_000 });
}

export function useExams(filters: { academicYearId?: number; grade?: number } = {}) {
  return useQuery({ queryKey: qk.exams(filters), queryFn: () => api<ExamDto[]>('/exams', { query: filters }) });
}

export function useExam(id: number) {
  return useQuery({ queryKey: qk.exam(id), queryFn: () => api<ExamDto>(`/exams/${id}`) });
}

/** School name / address / logo flag – public, so it also works on the login page. */
export function useBranding() {
  return useQuery({
    queryKey: qk.branding,
    queryFn: () => api<PublicBranding>('/public/branding'),
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export const logoUrl = (b: PublicBranding | undefined) => (b?.hasLogo ? `/api/v1/public/logo?v=${b.version}` : null);
