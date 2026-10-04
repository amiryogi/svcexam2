import { useSearchParams } from 'react-router';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader, Tabs } from '../../components/ui';
import { AcademicYearsTab } from './AcademicYearsTab';
import { CurriculumTab } from './CurriculumTab';
import { GradeScaleTab } from './GradeScaleTab';
import { SchoolTab } from './SchoolTab';
import { StreamsTab } from './StreamsTab';
import { SubjectsTab } from './SubjectsTab';
import { UsersTab } from './UsersTab';

type Tab = 'school' | 'years' | 'streams' | 'subjects' | 'curriculum' | 'scale' | 'users';

export function SetupPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'school';
  const tabs: { id: Tab; label: string }[] = [
    { id: 'school', label: 'School' },
    { id: 'years', label: 'Academic years' },
    { id: 'streams', label: 'Streams' },
    { id: 'subjects', label: 'Subjects' },
    { id: 'curriculum', label: 'Curriculum' },
    { id: 'scale', label: 'Grade scale' },
    ...(user?.role === 'SUPER_ADMIN' ? [{ id: 'users' as const, label: 'Users' }] : []),
  ];
  return (
    <>
      <PageHeader title="Setup" description="School details, academic structure and NEB grading rules." />
      <Tabs tabs={tabs} value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} />
      {tab === 'school' && <SchoolTab />}
      {tab === 'years' && <AcademicYearsTab />}
      {tab === 'streams' && <StreamsTab />}
      {tab === 'subjects' && <SubjectsTab />}
      {tab === 'curriculum' && <CurriculumTab />}
      {tab === 'scale' && <GradeScaleTab />}
      {tab === 'users' && user?.role === 'SUPER_ADMIN' && <UsersTab />}
    </>
  );
}
