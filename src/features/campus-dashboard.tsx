'use client';
import Link from 'next/link';
import type { WorkspaceData } from '@/types';
import { PageHeader } from '@/components/ui';
import { ActionCenter } from './action-center';
import { DriveActivitySummary } from './drives';
import {
  ApplicationsSummary,
  CampusReadinessSummary,
  NotificationsSummary,
  OffersSummary,
  PlacementWorkflow,
  RecruitmentMetrics,
  useRecruitmentOverview,
} from '@/components/placement-dashboard-sections';

export function CampusDashboard({ data }: { data: WorkspaceData }) {
  const query = useRecruitmentOverview('campus');
  return (
    <>
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
      <CampusReadinessSummary />
      <DriveActivitySummary data={data} role="campus" />
      <ActionCenter data={data} role="campus" compact />
      <div className="two-columns">
        {query.data && (
          <>
            <ApplicationsSummary overview={query.data} href="/campus/drives" />
            <OffersSummary overview={query.data} href="/campus/offers" />
          </>
        )}
        <NotificationsSummary data={data} href="/campus/notifications" />
      </div>
    </>
  );
}
