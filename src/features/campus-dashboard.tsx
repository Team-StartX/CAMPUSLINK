'use client';
import Link from 'next/link';
import type { WorkspaceData } from '@/types';
import { PageHeader } from '@/components/ui';
import { CampusStudentOverview } from '@/components/student-cohort-overview';
import { ActionCenter } from './action-center';
import { SmartMatchingSummary } from '@/components/smart-matching-summary';
import { DriveActivitySummary } from './drives';
import {
  ApplicationsSummary,
  CampusReadinessSummary,
  NotificationsSummary,
  OffersSummary,
  PlacementWorkflow,
  RecruitmentMetrics,
  RecruitmentCharts,
  useRecruitmentOverview,
} from '@/components/placement-dashboard-sections';

export function CampusDashboard({ data }: { data: WorkspaceData }) {
  const query = useRecruitmentOverview('campus');
  return (
    <div className="role-dashboard">
      <PageHeader
        eyebrow="CAMPUS PLACEMENT TEAM"
        title="Coordinate your campus placements."
        description="Monitor student readiness, approve recruiter requests and coordinate placement drives."
        action={
          <Link href="/campus/drive-requests" className="button dark">
            Review approval requests
          </Link>
        }
      />

      {query.isLoading && <p role="status">Loading campus placement metrics…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data && (
        <RecruitmentMetrics
          overview={query.data}
          labels={[
            'Pending approvals',
            'Active recruiters',
            'Eligible students',
            'Students placed',
            'Placement rate (%)',
          ]}
        />
      )}
      {query.data && <SmartMatchingSummary overview={query.data} role="campus" />}
      {query.data && <RecruitmentCharts overview={query.data} />}
      <CampusStudentOverview />
      <div className="two-columns">
        <CampusReadinessSummary />
        <ActionCenter data={data} role="campus" compact />
      </div>
      <DriveActivitySummary data={data} role="campus" />
      <div className="two-columns">
        {query.data && (
          <>
            <ApplicationsSummary overview={query.data} href="/campus/drives" />
            <OffersSummary overview={query.data} href="/campus/offers" />
          </>
        )}
      </div>
      <NotificationsSummary data={data} href="/campus/notifications" />
      <PlacementWorkflow
        steps={[
          {
            title: 'Profiling',
            detail: 'Review student skills and academic evidence',
            href: '/campus/students',
          },
          {
            title: 'Matching',
            detail: 'Review eligible students for campus drives',
            href: '/campus/drives',
          },
          {
            title: 'Scheduling',
            detail: 'Reserve venues and finalize campus visits',
            href: '/campus/scheduling',
          },
          {
            title: 'Notification',
            detail: 'Follow placement updates and decisions',
            href: '/campus/notifications',
          },
          {
            title: 'Offer tracking',
            detail: 'Verify offers and joining progress',
            href: '/campus/offers',
          },
          {
            title: 'Analytics',
            detail: 'Review readiness gaps and placement outcomes',
            href: '/campus/analytics',
          },
        ]}
      />
    </div>
  );
}
