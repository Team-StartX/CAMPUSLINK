'use client';
import { AppShell } from '@/components/app-shell';
import { Loader } from '@/components/loader';
import { Landing, PublicPage } from '@/components/public';
import { Badge, Button, EmptyState, PageHeader, Toast } from '@/components/ui';
import { AssessmentSession, AssessmentsPage, ContestsPage } from '@/features/assessments';
import { AuthPage } from '@/features/auth';
import { StudentDashboard, TeamDashboard } from '@/features/dashboard';
import {
  CampusDiscovery,
  CareerPointsPage,
  DrivesPage,
  PlacementCalendar,
} from '@/features/drives';
import { AIInterview, InterviewsPage } from '@/features/interviews';
import { ApplicationsPage, OffersPage, OpportunitiesPage } from '@/features/opportunities';
import {
  DocumentsPage,
  LearningPage,
  ProfilePage,
  ReadinessPage,
  SkillsPage,
} from '@/features/profile';
import { AnalyticsPage, CompanyPage, PeoplePage, RecruitersPage } from '@/features/team';
import { usePlatform } from '@/hooks/use-platform';
import { notificationService } from '@/services/platform.service';
import { ArrowUpRight, Bell, Check, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ActionCenter } from '@/features/action-center';
import { AdminDashboard } from '@/features/admin';
import { CommunicationPractice } from '@/features/communication';
import { useSession } from '@/store/session';
import { WorkspaceData, Role } from '@/types';
import { motion } from 'framer-motion';
import { AuthLinkPage, BackendTools } from './backend-tools';
import { PublicSessionProvider } from './public-session';
export function Platform() {
  const path = usePathname();
  if (path === '/admin' || path.startsWith('/admin/')) return <AdminDashboard />;
  if (path === '/')
    return (
      <PublicSessionProvider>
        <Landing />
      </PublicSessionProvider>
    );
  if (path === '/reset-password' || path === '/verify-email')
    return <AuthLinkPage verify={path === '/verify-email'} />;
  if (path === '/login' || path === '/register')
    return <AuthPage registering={path === '/register'} />;
  const [, role, section, id] = path.split('/');
  if (!['student', 'recruiter', 'campus'].includes(role))
    return (
      <PublicSessionProvider>
        <PublicPage slug={role} />
      </PublicSessionProvider>
    );
  return <Workspace role={role as Role} section={section || 'dashboard'} id={id} />;
}
function Workspace({ role, section, id }: { role: Role; section: string; id?: string }) {
  const { data, isLoading, error, refresh } = usePlatform();
  const [toast, setToast] = useState('');
  const notify = (s: string) => setToast(s);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  const props = data ? { data, role, id, refresh, notify } : null;
  let content: React.ReactNode;
  if (isLoading) content = <Loader label="Loading your workspace…" />;
  else if (error || !props)
    content = (
      <EmptyState
        title="Let’s try that again."
        description={error?.message || 'We couldn’t load your workspace.'}
        action={<Button onClick={() => void refresh()}>Retry</Button>}
      />
    );
  else
    switch (section) {
      case 'actions':
        content = <ActionCenter {...props} />;
        break;
      case 'dashboard':
        content =
          role === 'student' ? <StudentDashboard {...props} /> : <TeamDashboard {...props} />;
        break;
      case 'profile':
        content = <ProfilePage {...props} />;
        break;
      case 'skills':
        content = <SkillsPage {...props} />;
        break;
      case 'assessments':
        content = id ? (
          <AssessmentSession key={id} id={id} onComplete={refresh} role={role} />
        ) : (
          <AssessmentsPage {...props} />
        );
        break;
      case 'contests':
        content = <ContestsPage {...props} />;
        break;
      case 'opportunities':
        content = <OpportunitiesPage {...props} />;
        break;
      case 'applications':
        content = <ApplicationsPage {...props} />;
        break;
      case 'interviews':
        content =
          id === 'ai' ? (
            <AIInterview refresh={refresh} notify={notify} />
          ) : (
            <InterviewsPage {...props} />
          );
        break;
      case 'readiness':
        content = <ReadinessPage data={props.data} />;
        break;
      case 'communication':
        content =
          role === 'student' ? (
            <CommunicationPractice />
          ) : (
            <EmptyState title="Communication practice is available in the student workspace." />
          );
        break;
      case 'learning':
        content = <LearningPage {...props} />;
        break;
      case 'offers':
        content = <OffersPage {...props} />;
        break;
      case 'documents':
        content = <DocumentsPage {...props} />;
        break;
      case 'membership':
        content = <Membership />;
        break;
      case 'notifications':
        content = <Notifications {...props} />;
        break;
      case 'settings':
        content = <SettingsPage {...props} />;
        break;
      case 'company':
        content = <CompanyPage />;
        break;
      case 'drives':
        content = <DrivesPage {...props} />;
        break;
      case 'drive-requests':
        content = <DrivesPage {...props} requestsOnly />;
        break;
      case 'campuses':
        content = <CampusDiscovery {...props} />;
        break;
      case 'career-points':
        content = <CareerPointsPage {...props} />;
        break;
      case 'mock-interviews':
        content = <InterviewsPage {...props} practiceOnly />;
        break;
      case 'candidates':
      case 'students':
        content = <PeoplePage {...props} />;
        break;
      case 'recruiters':
        content = <RecruitersPage />;
        break;
      case 'scheduling':
        content = <PlacementCalendar {...props} />;
        break;
      case 'analytics':
      case 'reports':
        content = <AnalyticsPage data={props.data} role={role} reports={section === 'reports'} />;
        break;
      default:
        content = (
          <EmptyState
            title="Your next step is this way."
            action={
              <Link className="button dark" href={`/${role}/dashboard`}>
                Back to overview
              </Link>
            }
          />
        );
    }
  return (
    <AppShell role={role}>
      <BackendTools role={role} />
      <motion.div
        key={`${role}/${section}/${id || ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16 }}
        className="workspace-page"
      >
        {content}
      </motion.div>
      <Toast message={toast} />
    </AppShell>
  );
}
function Notifications({
  data,
  refresh,
  notify,
}: {
  data: WorkspaceData;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [filter, setFilter] = useState('All');
  return (
    <>
      <PageHeader
        title="A little news for your next step."
        description="Your applications, assessments, interviews, and campus updates."
        action={
          <Button
            kind="outline"
            onClick={async () => {
              await notificationService.markRead();
              refresh();
              notify('All notifications marked as read.');
            }}
          >
            <CheckCheck size={16} /> Mark all as read
          </Button>
        }
      />
      <div className="filter-pills">
        {['All', 'Unread'].map((f) => (
          <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="panel notification-list">
        {data.notifications
          .filter((n) => filter === 'All' || !n.read)
          .map((n) => (
            <button
              key={n.id}
              className={n.read ? 'read' : ''}
              onClick={async () => {
                await notificationService.markRead(n.id);
                refresh();
              }}
            >
              <span className="notification-icon lavender">
                <Bell size={20} />
              </span>
              <div>
                <Badge>{n.type}</Badge>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </div>
              {!n.read && <span className="unread-dot" />}
              <Check size={16} />
            </button>
          ))}
        {!data.notifications.some((n) => filter === 'All' || !n.read) && (
          <EmptyState
            title="You’re all caught up."
            description="We’ll keep your next steps here."
          />
        )}
      </div>
    </>
  );
}
function SettingsPage({
  refresh,
  notify,
}: {
  data: WorkspaceData;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('campuslink-preferences') || '{}');
      setReduced(!!saved.reduced);
    } catch {}
  }, []);
  return (
    <>
      <PageHeader
        title="Make this space yours."
        description="Your account and display preferences."
      />
      <form
        className="panel form-stack settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          localStorage.setItem('campuslink-preferences', JSON.stringify({ reduced }));
          refresh();
          notify('Your preferences are saved.');
        }}
      >
        <h3>Account & preferences</h3>
        <p>Signed in as {useSession.getState().user?.email}</p>
        <label className="setting-toggle">
          <span>
            <b>Reduce motion</b>
            <small>Your operating system preference is also respected.</small>
          </span>
          <input
            type="checkbox"
            checked={reduced}
            onChange={(e) => {
              setReduced(e.target.checked);
              document.documentElement.classList.toggle('reduce-motion', e.target.checked);
              window.dispatchEvent(
                new CustomEvent('campuslink-motion', { detail: { reduced: e.target.checked } }),
              );
            }}
          />
        </label>
        <Button type="submit">
          Save preferences <Check size={16} />
        </Button>
      </form>
    </>
  );
}
function Membership() {
  return (
    <>
      <PageHeader
        title="Your CampusLink access."
        description="Manage your career profile, preparation, and campus placement applications."
      />
      <section className="panel settings-form">
        <Badge>INCLUDED ACCESS</Badge>
        <h2>Career and placement workspace</h2>
        <p>
          Profile, skill assessments, interview practice, campus opportunities, and application
          tracking are available through your account.
        </p>
        <Link href="/student/dashboard" className="button dark">
          Open your workspace <ArrowUpRight size={16} />
        </Link>
      </section>
    </>
  );
}
