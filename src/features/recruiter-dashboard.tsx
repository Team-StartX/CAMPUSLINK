'use client';
import Link from 'next/link';
import type { WorkspaceData } from '@/types';
import { Badge, PageHeader } from '@/components/ui';
import { DriveActivitySummary } from './drives';
import { SmartMatchingSummary } from '@/components/smart-matching-summary';
import {
  ApplicationsSummary,
  NotificationsSummary,
  OffersSummary,
  PlacementWorkflow,
  RecruitmentMetrics,
  RecruitmentCharts,
  useRecruitmentOverview,
} from '@/components/placement-dashboard-sections';

export function RecruiterDashboard({ data }: { data: WorkspaceData }) {
  const query = useRecruitmentOverview('recruiter');
  return (
    <div className="role-dashboard">
      <PageHeader
        eyebrow="RECRUITER WORKSPACE"
        title="Build your campus hiring pipeline."
        description="Find eligible applicants, confirm campus visits and move candidates through selection to offers."
        action={
          <Link href="/recruiter/drives/request" className="button dark">
            Request a campus drive
          </Link>
        }
      />

      {query.isLoading && <p role="status">Loading your hiring pipeline…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data && (
        <RecruitmentMetrics
          overview={query.data}
          labels={[
            'Active jobs',
            'Total applicants',
            'Shortlisted candidates',
            'Selected candidates',
            'Offers received',
          ]}
          titles={{ 'Offers received': 'Offers released' }}
        />
      )}
      <DriveActivitySummary data={data} role="recruiter" />
      {query.data && <RecruitmentCharts overview={query.data} />}
      {query.data && <SmartMatchingSummary overview={query.data} role="recruiter" />}
      <div className="two-columns">
        {query.data && (
          <>
            <ApplicationsSummary overview={query.data} href="/recruiter/drives" />
            <section className="panel">
              <h2>Selection round results</h2>
              {query.data.results.map((r, index) => (
                <p key={index}>
                  {r.name} · {r.company} · {r.round} <Badge>{r.status}</Badge>
                </p>
              ))}
              {!query.data.results.length && <p>No published round results yet.</p>}
              <Link href="/recruiter/candidates">Review candidate matches</Link>
            </section>
            <OffersSummary overview={query.data} href="/recruiter/offers" />
          </>
        )}
        <NotificationsSummary data={data} href="/recruiter/notifications" />
      </div>
      <PlacementWorkflow
        steps={[
          {
            title: 'Profiling',
            detail: 'Review applicant skills and project evidence',
            href: '/recruiter/candidates',
          },
          {
            title: 'Matching',
            detail: 'Rank eligible applicants against your drive',
            href: '/recruiter/candidates',
          },
          {
            title: 'Scheduling',
            detail: 'Confirm campus dates and schedule interviews',
            href: '/recruiter/drives',
          },
          {
            title: 'Notification',
            detail: 'Track campus decisions and hiring updates',
            href: '/recruiter/notifications',
          },
          {
            title: 'Offer tracking',
            detail: 'Release offers and track responses',
            href: '/recruiter/offers',
          },
          {
            title: 'Analytics',
            detail: 'Review hiring conversions and outcomes',
            href: '/recruiter/analytics',
          },
        ]}
      />
    </div>
  );
}
