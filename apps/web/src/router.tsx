import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './auth/AuthProvider';
import { AppShell } from './components/AppShell';
import { LoadingBlock } from './components/ui';
import { AuditPage } from './pages/AuditPage';
import { DashboardPage } from './pages/DashboardPage';
import { EnrollmentsPage } from './pages/enrollments/EnrollmentsPage';
import { ExamDetailPage } from './pages/exams/ExamDetailPage';
import { ExamsPage } from './pages/exams/ExamsPage';
import { MarkEntryPage } from './pages/exams/MarkEntryPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { SetupPage } from './pages/setup/SetupPage';
import { StudentDetailPage } from './pages/students/StudentDetailPage';
import { StudentFormPage } from './pages/students/StudentFormPage';
import { StudentsPage } from './pages/students/StudentsPage';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingBlock label="Checking session…" />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'students', element: <StudentsPage /> },
          { path: 'students/new', element: <StudentFormPage /> },
          { path: 'students/:id', element: <StudentDetailPage /> },
          { path: 'students/:id/edit', element: <StudentFormPage /> },
          { path: 'enrollments', element: <EnrollmentsPage /> },
          { path: 'exams', element: <ExamsPage /> },
          { path: 'exams/:id', element: <ExamDetailPage /> },
          { path: 'mark-entry', element: <MarkEntryPage /> },
          { path: 'setup', element: <SetupPage /> },
          { path: 'audit', element: <AuditPage /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
