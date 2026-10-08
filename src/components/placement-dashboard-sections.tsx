'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { recruitmentService } from '@/services/recruitment.service';
import { apiClient } from '@/services/api/client';
import { useSession } from '@/store/session';
import type { WorkspaceData } from '@/types';
import { Badge } from './ui';

export type RecruitmentOverview = Awaited<ReturnType<typeof recruitmentService.dashboard>>;
export function useRecruitmentOverview(role: 'campus' | 'recruiter') {
  const userId = useSession((s) => s.user?.id);
  return useQuery({
    queryKey: ['recruitment-dashboard', role, userId],
    queryFn: recruitmentService.dashboard,
    enabled: Boolean(userId),
    refetchInterval: 15000,
  });
}

export function PlacementWorkflow({
  steps,
}: {
  steps: { title: string; detail: string; href: string }[];
}) {
  return (
    <section className="panel" aria-label="Placement management workflow">
      <h2>Your placement workflow</h2>
      <div className="metrics-grid">
        {steps.map((step, index) => (
          <Link className="metric-card" href={step.href} key={step.title}>
            <span>
              {index + 1}. {step.title}
            </span>
            <p>{step.detail}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RecruitmentMetrics({
  overview,
  labels,
  titles = {},
}: {
  overview: RecruitmentOverview;
  labels: string[];
  titles?: Record<string, string>;
}) {
  return (
    <div className="metrics-grid">
      {labels.map((label) => (
        <div className="metric-card" key={label}>
          <span>{titles[label] || label}</span>
          <b>{overview.metrics[label] ?? 0}</b>
        </div>
      ))}
    </div>
  );
}

export function ApplicationsSummary({
  overview,
  href,
}: {
  overview: RecruitmentOverview;
  href: string;
}) {
  return (
    <section className="panel">
      <h2>Recent applications</h2>
      {overview.applications.map((a) => (
        <p key={a.id}>
          <Link href={`${href}/${a.driveId}`}>
            {a.name} · {a.company} · {a.role}
          </Link>{' '}
          <Badge>{a.stage}</Badge>
        </p>
      ))}
      {!overview.applications.length && <p>No student applications yet.</p>}
    </section>
  );
}

export function OffersSummary({ overview, href }: { overview: RecruitmentOverview; href: string }) {
  return (
    <section className="panel">
      <h2>Offer tracking</h2>
      {overview.offers.map((o) => (
        <p key={o.id}>
          {o.name} · {o.company} · {o.role} <Badge>{o.status}</Badge>
        </p>
      ))}
      {!overview.offers.length && <p>No offers released yet.</p>}
      <Link href={href}>Manage offers</Link>
    </section>
  );
}

export function NotificationsSummary({ data, href }: { data: WorkspaceData; href: string }) {
  return (
    <section className="panel">
      <h2>Latest notifications</h2>
      {data.notifications.slice(0, 5).map((n) => (
        <p key={n.id}>
          <b>{n.title}</b>
          <br />
          {n.body}
        </p>
      ))}
      {!data.notifications.length && <p>No new notifications.</p>}
      <Link href={href}>All notifications</Link>
    </section>
  );
}

export function CampusReadinessSummary() {
  const userId = useSession((s) => s.user?.id);
  const query = useQuery<{
    registered: number;
    ready: number;
    placed: number;
    support: { id: string; name: string; score: number; factors: string[] }[];
  }>({
    queryKey: ['server-analytics', userId],
    queryFn: async () => (await apiClient.get('/analytics')).data,
    enabled: Boolean(userId),
    refetchInterval: 15000,
  });
  return (
    <section className="panel lavender">
      <h2>Student readiness and preparation support</h2>
      {query.isLoading && <p role="status">Loading campus readiness…</p>}
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.data && (
        <>
          <p>
            {query.data.ready} of {query.data.registered} students are placement ready ·{' '}
            {query.data.placed} placed
          </p>
          {query.data.support.slice(0, 3).map((student) => (
            <p key={student.id}>
              <Link href={`/campus/students/${student.id}`}>
                {student.name} · Readiness {student.score}/100
              </Link>
              <br />
              {student.factors.join(' · ')}
            </p>
          ))}
          {!query.data.support.length && <p>No current preparation support flags.</p>}
        </>
      )}
      <Link href="/campus/analytics">View placement analytics and skill insights</Link>
    </section>
  );
}
