'use client';

import Link from 'next/link';
import type { WorkspaceData } from '@/types';
import { fit } from '@/utils/scoring';
import type { RecruitmentOverview } from './placement-dashboard-sections';
import { Badge } from './ui';
import { ComparisonChart } from './analytics-charts';

export function SmartMatchingSummary({
  overview,
  role,
}: {
  overview: RecruitmentOverview;
  role: 'campus' | 'recruiter';
}) {
  const matching = overview.matching || [];
  return (
    <section className="panel smart-matching-section">
      <div className="section-header">
        <div>
          <h2>Scheduled jobs · smart matching</h2>
          <p>Automatically updated from current student profiles and job requirements.</p>
        </div>
      </div>
      {matching.length > 0 && (
        <ComparisonChart
          title="Eligibility across scheduled jobs"
          description="Students can qualify for multiple drives. Each row shows one drive's matching pool."
          rows={matching.map((job) => ({
            name: `${job.company} · ${job.role}`,
            eligible: job.eligible,
            remaining: Math.max(0, job.total - job.eligible),
          }))}
          series={[
            { key: 'eligible', label: 'Eligible' },
            { key: 'remaining', label: 'Not eligible' },
          ]}
          stacked
        />
      )}
      <div className="smart-match-grid">
        {matching.slice(0, 6).map((job) => (
          <article className="smart-match-card" key={job.driveId}>
            <span className="eyebrow">{job.company}</span>
            <h3>{job.role}</h3>
            <div className="match-counts">
              <Badge kind="verified">{job.eligible} eligible</Badge>
              <Badge>{job.total - job.eligible} not eligible</Badge>
            </div>
            <p>{job.needsPreparation} students have eligibility or skill evidence gaps.</p>
            <h4>Most common skill gaps</h4>
            {job.skillGaps.length ? (
              <ul>
                {job.skillGaps.map((gap) => (
                  <li key={gap.name}>
                    {gap.name} <span>· {gap.students} students</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No required skill gaps recorded.</p>
            )}
            <Link className="text-link" href={`/${role}/drives/${job.driveId}`}>
              Review matches and requirements →
            </Link>
          </article>
        ))}
      </div>
      {!matching.length && (
        <p className="muted">
          Schedule a placement drive to see its matched cohort and skill gaps here.
        </p>
      )}
    </section>
  );
}

export function StudentMatchingSummary({ data }: { data: WorkspaceData }) {
  const jobs = data.drives
    .filter(
      (drive) =>
        drive.schedule && ['ACTIVE', 'APPLICATIONS_CLOSED', 'IN_PROGRESS'].includes(drive.status),
    )
    .map((drive) => ({ drive, match: fit(data.student, drive, data.history) }))
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, 3);
  return (
    <section className="panel smart-matching-section">
      <div className="section-header">
        <div>
          <h2>Your job matches & skill gaps</h2>
          <p>
            Personalised for published campus placements. Updating your profile refreshes these
            results.
          </p>
        </div>
        <Link href="/student/opportunities" className="text-link">
          All placements →
        </Link>
      </div>
      <div className="smart-match-grid">
        {jobs.map(({ drive, match }) => (
          <article className="smart-match-card" key={drive.id}>
            <span className="eyebrow">{drive.company}</span>
            <h3>{drive.role}</h3>
            <Badge kind={match.eligibility.passed ? 'verified' : ''}>
              {match.eligibility.passed
                ? `Eligible · ${match.score}% evidence fit`
                : 'Not eligible yet'}
            </Badge>
            {match.eligibility.checks
              .filter((check) => !check.passed)
              .map((check) => (
                <p key={check.name}>
                  {check.name}: {check.detail}
                </p>
              ))}
            <h4>Your next preparation steps</h4>
            {match.gaps.length ? (
              <ul>
                {match.gaps.map((gap) => (
                  <li key={gap.name}>
                    <b>{gap.name}</b> · {gap.action}
                  </li>
                ))}
              </ul>
            ) : (
              <p>All required skills are recorded and verified.</p>
            )}
            <div className="match-card-links">
              <Link href={`/student/opportunities/${drive.opportunityId || drive.id}`}>
                View placement
              </Link>
              {!!match.gaps.length && <Link href="/student/skills">Update skills</Link>}
            </div>
          </article>
        ))}
      </div>
      {!jobs.length && (
        <p className="muted">
          Your automatic matches will appear when your college publishes a scheduled placement.
        </p>
      )}
    </section>
  );
}
