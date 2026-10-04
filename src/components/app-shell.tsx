'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  UserRound,
  ShieldCheck,
  ClipboardCheck,
  Trophy,
  BriefcaseBusiness,
  Files,
  Video,
  Sparkles,
  BookOpen,
  Gift,
  Bell,
  Settings,
  Search,
  Menu,
  X,
  ArrowUpRight,
  ChevronDown,
  LogOut,
  Building2,
  Users,
  CalendarDays,
  BarChart3,
} from 'lucide-react';
import { Logo } from './public';
import { Modal } from './ui';
import { useSession, authService } from '@/store/session';
import { usePlatform } from '@/hooks/use-platform';
import { Role } from '@/types';
import { canAccess } from '@/utils/permissions';
import { backendEnabled } from '@/services/api/remote';
import { useQueryClient } from '@tanstack/react-query';
import { AccountOnboarding } from './account-onboarding';
const studentNav = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['actions', 'Action center', ClipboardCheck],
  ['profile', 'My career profile', UserRound],
  ['skills', 'Skills & verification', ShieldCheck],
  ['assessments', 'Assessments', ClipboardCheck],
  ['contests', 'Contests', Trophy],
  ['opportunities', 'Campus opportunities', BriefcaseBusiness],
  ['applications', 'My applications', Files],
  ['interviews', 'Interview hub', Video],
  ['readiness', 'Placement readiness', Sparkles],
  ['learning', 'Learning paths', BookOpen],
  ['offers', 'My offers', Gift],
  ['documents', 'Documents', Files],
  ['career-points', 'Career Points', Trophy],
] as const;
const recruiterNav = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['actions', 'Action center', ClipboardCheck],
  ['company', 'Company profile', Building2],
  ['campuses', 'Explore campuses', Building2],
  ['drives', 'Placement drives', BriefcaseBusiness],
  ['candidates', 'Candidate discovery', Users],
  ['interviews', 'Interviews', Video],
  ['mock-interviews', 'Practice interviews', Video],
  ['assessments', 'Assessments', ClipboardCheck],
  ['offers', 'Offers', Gift],
  ['analytics', 'Hiring analytics', BarChart3],
] as const;
const campusNav = [
  ['dashboard', 'Overview', LayoutDashboard],
  ['actions', 'Action center', ClipboardCheck],
  ['students', 'Students', Users],
  ['recruiters', 'Recruiters', Building2],
  ['drive-requests', 'New drive requests', BriefcaseBusiness],
  ['drives', 'Placement drives', BriefcaseBusiness],
  ['scheduling', 'Scheduling', CalendarDays],
  ['assessments', 'Assessments', ClipboardCheck],
  ['contests', 'Contests', Trophy],
  ['applications', 'Applications', Files],
  ['interviews', 'Interviews', Video],
  ['offers', 'Offers', Gift],
  ['documents', 'Documents', Files],
  ['analytics', 'Analytics', BarChart3],
  ['reports', 'Reports', Files],
] as const;
export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const path = usePathname(),
    router = useRouter();
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();
  const { data } = usePlatform();
  const displayName =
    role === 'student'
      ? data?.student.name || user?.name || 'Student'
      : user?.name || (role === 'recruiter' ? 'Recruiter' : 'Campus team');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0])
    .join('');
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [term, setTerm] = useState('');
  const [ready, setReady] = useState(false);
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [path]);
  useEffect(() => {
    const media = window.matchMedia('(max-width:768px)');
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const nav = role === 'student' ? studentNav : role === 'recruiter' ? recruiterNav : campusNav;
  useEffect(() => {
    if (backendEnabled) void authService.restore().finally(() => setReady(true));
    else setReady(true);
  }, []);
  useEffect(() => {
    if (ready && !user) router.replace('/login');
    else if (ready && user && !canAccess(user, role)) router.replace(`/${user.role}/dashboard`);
  }, [user, role, router, ready]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const closeSearch = useCallback(() => setSearch(false), []);
  if (!ready || !canAccess(user, role))
    return (
      <div className="empty-state">
        <h2>Opening your workspace…</h2>
        <p>Checking your session.</p>
      </div>
    );
  const unread = data?.notifications.filter((n) => !n.read).length || 0;
  const links = nav.filter(([, label]) => label.toLowerCase().includes(term.toLowerCase()));
  return (
    <div className="app-shell">
      <aside
        className={`sidebar ${drawer ? 'sidebar-open' : ''}`}
        aria-hidden={mobile && !drawer}
        inert={mobile && !drawer}
      >
        <div className="sidebar-brand">
          <Logo dark />
          <button
            className="mobile-toggle"
            onClick={() => setDrawer(false)}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>
        {user?.isAdmin && (
          <Link href="/admin/dashboard" className="text-link">
            Admin dashboard <ShieldCheck size={15} />
          </Link>
        )}
        <div className="workspace-picker">
          <span className="workspace-icon">
            <GraduationIcon role={role} />
          </span>
          <span>
            {role === 'student'
              ? 'Student workspace'
              : role === 'recruiter'
                ? 'Recruiter workspace'
                : 'Campus workspace'}
            <small>
              {role === 'student'
                ? 'Your future, in progress.'
                : role === 'recruiter'
                  ? `${user?.organization || 'Your organization'} · Talent team`
                  : `${user?.organization || 'Your campus'} · Placement cell`}
            </small>
          </span>
          <ChevronDown size={14} />
        </div>
        <span className="sidebar-label">YOUR {role === 'student' ? 'JOURNEY' : 'WORKSPACE'}</span>
        <nav>
          {nav.map(([slug, label, Icon]) => (
            <Link
              key={slug}
              href={`/${role}/${slug}`}
              prefetch={true}
              scroll={false}
              onClick={() => setDrawer(false)}
              className={
                path === `/${role}/${slug}` || path.startsWith(`/${role}/${slug}/`) ? 'active' : ''
              }
            >
              <Icon size={18} />
              {label}
              {slug === 'opportunities' && (
                <span className="nav-count">{data?.opportunities.length || 0}</span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {role === 'student' && (
            <Link href="/student/membership" className="sidebar-promo">
              <Sparkles size={20} />
              <strong>Give your future a boost.</strong>
              <p>
                A little more practice.
                <br />A lot more confidence.
              </p>
              <span>
                Explore Premium <ArrowUpRight size={14} />
              </span>
            </Link>
          )}
          <Link href={`/${role}/notifications`}>
            <Bell size={17} /> Notifications{' '}
            {unread > 0 && <span className="nav-count">{unread}</span>}
          </Link>
          <Link href={`/${role}/settings`}>
            <Settings size={17} /> Settings
          </Link>
          <button
            onClick={async () => {
              await authService.logout();
              queryClient.clear();
              router.push('/login');
            }}
          >
            <LogOut size={17} /> {user ? 'Sign out' : 'Sign in'}
          </button>
          <div className="sidebar-user">
            <span className="avatar-circle lavender">{initials}</span>
            <div>
              <strong>{displayName}</strong>
              <small>
                {role === 'student'
                  ? `Class of ${data?.student.year || '—'}`
                  : role === 'recruiter'
                    ? 'Talent acquisition'
                    : 'Placement coordinator'}
              </small>
            </div>
            <ChevronDown size={14} />
          </div>
        </div>
      </aside>
      {drawer && <div className="drawer-overlay" onClick={() => setDrawer(false)} />}
      <div className="app-main">
        <header className="topbar">
          <div>
            <button
              className="mobile-toggle"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{' '}
              <b>{nav.find(([slug]) => path.includes(`/${slug}`))?.[1] || 'Overview'}</b>
            </span>
          </div>
          <div className="topbar-actions">
            <button
              aria-label="Search workspace"
              className="top-search"
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Search anything...</span>
              <kbd>Ctrl K</kbd>
            </button>
            <span className="demo-label">
              <i /> {backendEnabled ? 'CONNECTED WORKSPACE' : 'DEMO WORKSPACE'}
            </span>
            <Link
              href={`/${role}/notifications`}
              className="notification-button"
              aria-label={`${unread} unread notifications`}
            >
              <Bell size={19} />
              {unread > 0 && <i />}
            </Link>
            <Link
              href={`/${role}/${role === 'student' ? 'profile' : 'settings'}`}
              className="avatar-circle lavender"
            >
              {initials}
            </Link>
          </div>
        </header>
        <main className="dashboard-content">
          {backendEnabled && user?.onboardingComplete === false ? <AccountOnboarding /> : children}
        </main>
        <footer className="app-footer">
          <span>CampusLink · Made for what comes next.</span>
          <span>
            {backendEnabled
              ? 'Connected workspace · Changes are saved on the server'
              : 'Mock workspace · Your changes are saved in this browser'}
          </span>
        </footer>
      </div>
      {search && (
        <Modal title="Find your next step" onClose={closeSearch}>
          <label className="search-input">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Search pages, opportunities, assessments…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </label>
          <div className="search-results">
            {links.map(([slug, label, Icon]) => (
              <Link key={slug} href={`/${role}/${slug}`} onClick={closeSearch}>
                <Icon size={17} />
                {label}
                <ArrowUpRight size={14} />
              </Link>
            ))}
            {role === 'student' &&
              data?.opportunities
                .filter((j) => `${j.company} ${j.role}`.toLowerCase().includes(term.toLowerCase()))
                .map((j) => (
                  <Link key={j.id} href={`/student/opportunities/${j.id}`} onClick={closeSearch}>
                    <BriefcaseBusiness size={17} />
                    {j.company} · {j.role}
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
function GraduationIcon({ role }: { role: Role }) {
  return role === 'student' ? (
    <BookOpen size={19} />
  ) : role === 'recruiter' ? (
    <BriefcaseBusiness size={19} />
  ) : (
    <Building2 size={19} />
  );
}
