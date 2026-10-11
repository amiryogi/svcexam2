import clsx from 'clsx';
import {
  BookOpenCheck,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Settings,
  UserCog,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useBranding, useCurrentYear } from '../api/hooks';
import { useAuth } from '../auth/AuthProvider';
import { initials, SchoolLogo } from './SchoolLogo';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/enrollments', label: 'Enrollment', icon: GraduationCap },
  { to: '/exams', label: 'Exams & results', icon: BookOpenCheck },
  { to: '/mark-entry', label: 'Mark entry', icon: NotebookPen },
  { to: '/setup', label: 'Setup', icon: Settings },
  { to: '/audit', label: 'Audit log', icon: FileClock },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const branding = useBranding();
  const schoolName = branding.data?.name ?? 'School';
  const { current } = useCurrentYear();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <nav className="flex h-full flex-col bg-brand-900 text-brand-100">
      <NavLink to="/" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-5">
        <SchoolLogo size="md" />
        <div className="min-w-0 leading-tight">
          <p className="text-sm font-semibold text-white">{schoolName}</p>
          <p className="text-xs text-brand-100/70">+2 Exam Management</p>
        </div>
      </NavLink>
      <div className="flex-1 space-y-0.5 px-3">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                isActive ? 'bg-brand-800 text-white' : 'text-brand-100/80 hover:bg-brand-800/60 hover:text-white',
              )
            }
          >
            <Icon className="size-4.5" />
            {label}
          </NavLink>
        ))}
      </div>
      <div className="border-t border-brand-800 p-3 text-xs text-brand-100/60">NEB Grade 11–12 · v1.0</div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="fixed inset-y-0 w-60">{sidebar}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button className="rounded p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          {/* On small screens the sidebar is hidden, so show the school here. */}
          <NavLink to="/" className="flex min-w-0 items-center gap-2 lg:hidden">
            <SchoolLogo size="sm" />
            <span className="truncate text-sm font-semibold text-slate-800">{initials(schoolName)}</span>
          </NavLink>
          <div className="hidden text-sm text-slate-500 sm:block">
            Academic year{' '}
            <span className="font-semibold text-slate-800">{current?.name ?? 'not set'}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NavLink to="/profile" className="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-slate-100">
              <UserCog className="size-4" />
              <span className="hidden sm:inline">{user?.fullName}</span>
            </NavLink>
            <button
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="size-4" /> <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
