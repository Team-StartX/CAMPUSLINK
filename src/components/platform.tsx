'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ArrowUpRight, Bell, Check, CheckCheck } from 'lucide-react';
import { Landing, PublicPage } from '@/components/public';
import { AppShell } from '@/components/app-shell';
import { AuthPage } from '@/features/auth';
import { usePlatform } from '@/hooks/use-platform';
import { StudentDashboard, TeamDashboard } from '@/features/dashboard';
import { AssessmentsPage, AssessmentSession, ContestsPage } from '@/features/assessments';
import {
  ProfilePage,
  SkillsPage,
  ReadinessPage,
  LearningPage,
  DocumentsPage,
} from '@/features/profile';
import { OpportunitiesPage, ApplicationsPage, OffersPage } from '@/features/opportunities';
import { InterviewsPage, AIInterview } from '@/features/interviews';
import { PeoplePage, AnalyticsPage, RecruitersPage, CompanyPage } from '@/features/team';
import {
  DrivesPage,
  CampusDiscovery,
  PlacementCalendar,
  CareerPointsPage,
} from '@/features/drives';
import { Badge, Button, EmptyState, FormField, Modal, PageHeader, Toast } from '@/components/ui';
import { notificationService, studentService, demoService } from '@/services/platform.service';

import { DemoData, Role } from '@/types';
import { motion } from 'framer-motion';
import { BackendTools, AuthLinkPage } from './backend-tools';
import { backendEnabled } from '@/services/api/remote';
import { PublicSessionProvider } from './public-session';
export function Platform() {
  const path = usePathname();
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
  if (isLoading)
    content = (
      <div className="loading-layout">
        <div className="skeleton heading-skeleton" />
        <div className="three-columns">
          {[1, 2, 3].map((i) => (
            <div className="skeleton panel" key={i} />
          ))}
        </div>
        <p>Opening your next chapter…</p>
      </div>
    );
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
        content = <Membership notify={notify} />;
        break;
      case 'notifications':
        content = <Notifications {...props} />;
        break;
      case 'settings':
        content = <SettingsPage {...props} />;
        break;
      case 'company':
        content = <CompanyPage notify={notify} />;
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
  data: DemoData;
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
  data,
  refresh,
  notify,
}: {
  data: DemoData;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [reset, setReset] = useState(false);
  const [email, setEmail] = useState(data.student.email);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('campuslink-preferences') || '{}');
      setEmailUpdates(saved.emailUpdates !== false);
      setReduced(!!saved.reduced);
    } catch {}
  }, []);
  return (
    <>
      <PageHeader
        title="Make this space yours."
        description="Your account, preferences, and local demo data."
      />
      <form
        className="panel form-stack settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          await studentService.updateStudent({ email });
          localStorage.setItem('campuslink-preferences', JSON.stringify({ emailUpdates, reduced }));
          refresh();
          notify('Your preferences are saved.');
        }}
      >
        <h3>Account & preferences</h3>
        <FormField label="Email address">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <label className="setting-toggle">
          <span>
            <b>Email updates</b>
            <small>Future notifications about applications and interviews.</small>
          </span>
          <input
            type="checkbox"
            checked={emailUpdates}
            onChange={(e) => setEmailUpdates(e.target.checked)}
          />
        </label>
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
      {!backendEnabled && (
        <section className="panel">
          <h3>Local demo data</h3>
          <p>
            This workspace uses mock data stored in this browser. Resetting restores the sample
            profile, drives, and assessment history.
          </p>
          <Button kind="outline" onClick={() => setReset(true)}>
            Reset demo data
          </Button>
        </section>
      )}
      {reset && (
        <Modal title="Start a fresh demo?" onClose={() => setReset(false)}>
          <p>
            Your local profile changes, assessments, and applications will be replaced by the sample
            data.
          </p>
          <Button
            onClick={() => {
              demoService.reset();
              refresh();
              setReset(false);
              notify('Demo restored to a fresh start.');
            }}
          >
            Reset local data
          </Button>
        </Modal>
      )}
    </>
  );
}
function Membership({ notify }: { notify: (s: string) => void }) {
  const [selected, setSelected] = useState('Free');
  return (
    <>
      <PageHeader
        title="A little more support for your future."
        description="Core placement access is always included. Choose the support that fits you."
      />
      <div className="pricing-grid">
        {['Free', 'Premium'].map((tier, i) => (
          <section className={`panel ${i ? 'lavender' : ''}`} key={tier}>
            <Badge>{selected === tier ? 'YOUR DEMO PLAN' : 'EXTRA PREPARATION'}</Badge>
            <h2>{tier}</h2>
            <div className="plan-price">
              {i ? '₹499' : '₹0'}
              <small>{i ? '/ month' : 'forever'}</small>
            </div>
            <p>
              {i
                ? 'Go a little further with your preparation.'
                : 'Everything you need to start your journey.'}
            </p>
            <div className="check-list">
              {[
                'Career profile',
                'Skill verification & assessments',
                'Opportunity access',
                'Basic mock interviews',
                ...(i
                  ? [
                      'Advanced preparation material',
                      'Additional practice interviews',
                      'Detailed demo career insights',
                    ]
                  : []),
              ].map((s) => (
                <span key={s}>
                  <Check size={16} />
                  {s}
                </span>
              ))}
            </div>
            <Button
              disabled={selected === tier}
              onClick={() => {
                setSelected(tier);
                notify(`${tier} selected for this demo. No payment has been taken.`);
              }}
            >
              {selected === tier ? 'Your current plan' : `Try ${tier} in demo`}{' '}
              <ArrowUpRight size={16} />
            </Button>
          </section>
        ))}
      </div>
      <p className="muted">
        Demo plans only. No payment processing is connected, and opportunity access stays available
        on every plan.
      </p>
    </>
  );
}
