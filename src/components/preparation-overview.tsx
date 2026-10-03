'use client';
import Link from 'next/link';
import {
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  GraduationCap,
  MessageCircle,
  Mic,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

export interface PreparationCategory {
  name: string;
  score: number;
  recorded: boolean;
}
const guides: Record<string, { icon: typeof BookOpen; href: string; action: string }> = {
  'Verified skills': { icon: ShieldCheck, href: '/student/skills', action: 'Verify a skill' },
  Academics: { icon: GraduationCap, href: '/student/profile', action: 'Complete your profile' },
  Projects: { icon: BriefcaseBusiness, href: '/student/profile', action: 'Add a project' },
  Aptitude: { icon: BookOpen, href: '/student/assessments', action: 'Take an assessment' },
  Communication: {
    icon: MessageCircle,
    href: '/student/assessments',
    action: 'Practice communication',
  },
  Interview: { icon: Mic, href: '/student/interviews/ai', action: 'Try a mock interview' },
};
export function PreparationOverview({
  score,
  categories,
  loading = false,
  error = false,
  interactive = true,
}: {
  score?: number;
  categories?: PreparationCategory[];
  loading?: boolean;
  error?: boolean;
  interactive?: boolean;
}) {
  const rows =
    categories ?? Object.keys(guides).map((name) => ({ name, score: 0, recorded: false }));
  const recorded = rows.filter((row) => row.recorded).length;
  const ready = !loading && !error;
  const boundedScore = Math.min(100, Math.max(0, score || 0));
  const circumference = 2 * Math.PI * 54;
  return (
    <div className="preparation-overview" aria-busy={loading}>
      <div className="preparation-heading">
        <span className="preparation-eyebrow">
          <Sparkles size={14} /> YOUR NEXT STEPS
        </span>
        <h2>Preparation at a glance</h2>
      </div>
      <div className="preparation-summary">
        <div
          className="preparation-ring"
          aria-label={
            ready && recorded
              ? `Preparation score ${boundedScore} out of 100`
              : 'Preparation score not available'
          }
        >
          <svg viewBox="0 0 128 128" aria-hidden="true">
            <circle className="preparation-ring-track" cx="64" cy="64" r="54" />
            <circle
              className="preparation-ring-fill"
              cx="64"
              cy="64"
              r="54"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - (ready && recorded ? boundedScore : 0) / 100)}
            />
          </svg>
          <div>
            <strong>{ready && recorded ? boundedScore : '—'}</strong>
            <span>{ready && recorded ? 'out of 100' : 'Start here'}</span>
          </div>
        </div>
        <div className="preparation-summary-copy">
          <span className="preparation-state">
            {loading
              ? 'Loading your progress'
              : error
                ? 'Temporarily unavailable'
                : !recorded
                  ? 'Getting started'
                  : boundedScore >= 70
                    ? 'Building momentum'
                    : 'Room to grow'}
          </span>
          <h3>
            {loading
              ? 'Your preparation overview is on its way.'
              : error
                ? 'Try again in a moment'
                : !recorded
                  ? 'Your progress starts with one step.'
                  : `${recorded} of ${rows.length} areas have evidence`}
          </h3>
          <p>
            {loading
              ? 'Gathering your recorded preparation.'
              : error
                ? 'We couldn’t load your preparation records.'
                : !recorded
                  ? 'Add a project or take an assessment to build your preparation profile.'
                  : 'Fill the gaps below and keep building on your strengths.'}
          </p>
        </div>
      </div>
      {ready && (
        <div className="preparation-metrics">
          {rows.map((row) => {
            const guide = guides[row.name];
            const Icon = guide?.icon || BookOpen;
            const value = Math.min(100, Math.max(0, row.score));
            return (
              <div
                key={row.name}
                className={`preparation-metric ${row.recorded ? 'has-evidence' : 'needs-evidence'}`}
              >
                <div className="preparation-metric-title">
                  <span>
                    <Icon size={16} />
                    {row.name}
                  </span>
                  <strong>{row.recorded ? `${value}/100` : 'Not added'}</strong>
                </div>
                {row.recorded ? (
                  <div
                    className="preparation-meter"
                    role="meter"
                    aria-label={row.name}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={value}
                  >
                    <span style={{ width: `${value}%` }} />
                  </div>
                ) : (
                  <div className="preparation-meter preparation-meter-empty" aria-hidden="true" />
                )}
                {!row.recorded && interactive && guide && (
                  <Link href={guide.href}>
                    {guide.action}
                    <ArrowUpRight size={12} />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
