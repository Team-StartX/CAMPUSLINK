'use client';
import { PreparationOverview } from '@/components/preparation-overview';
import Link from 'next/link';
import { CareerID } from '@/components/student-id';
import { DashboardActivity } from '@/components/dashboard-activity';
import { ContestProgress } from '@/components/contest-progress';
import { contestAchievements } from '@/utils/contest-achievements';
export { CareerID } from '@/components/student-id';

import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CircleCheck,
  Sparkles,
  Trophy,
  CalendarDays,
  ChevronRight,
  X,
  Code2,
  Plus,
  Zap,
  Target,
  Mic,
} from 'lucide-react';

import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  YAxis,
} from 'recharts';
import { DemoData, Opportunity, Role } from '@/types';
import { aiService, studentService, campusService } from '@/services/platform.service';
import { Badge, Progress, PageHeader, formatDate } from '@/components/ui';
import { DriveActivitySummary } from './drives';
import { statusLabel } from '@/utils/placement';
import { backendEnabled } from '@/services/api/remote';
import { ConnectedAnalytics } from '@/components/backend-tools';
export function OpportunityCard({ job, compact = false }: { job: Opportunity; compact?: boolean }) {
  return (
    <Link
      href={`/student/opportunities/${job.id}`}
      className={`opportunity-card ${compact ? 'compact' : ''}`}
    >
      <div className="opportunity-top">
        <span className={`company-logo ${job.color}`}>
          {job.company === 'Atlassian' ? '▲' : job.company === 'Google' ? 'G' : job.company[0]}
          {job.company === 'Razorpay' && <ArrowUpRight size={17} />}
        </span>
        <span className="match-tag">
          <Sparkles size={12} /> {job.match}%{' '}
          <small>{backendEnabled ? 'Evidence fit' : 'Demo match'}</small>
        </span>
      </div>
      <p className="company-name">{job.company}</p>
      <Badge>ON-CAMPUS · Eligibility passed</Badge>
      <h3>{job.role}</h3>
      <p className="muted job-meta">
        {job.visitDate ? formatDate(job.visitDate) : 'Campus visit'} <span>·</span> {job.campus}
      </p>
      <div className="job-chips">
        {job.skills.map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="opportunity-bottom">
        <strong>₹{job.ctc}</strong>
        <span>
          View campus drive <ArrowUpRight size={15} />
        </span>
      </div>
    </Link>
  );
}
export function ReadinessCard({ full = false }: { full?: boolean }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['readiness'],
    queryFn: aiService.getReadinessScore,
  });
  if (backendEnabled)
    return (
      <section className="panel connected-readiness">
        <PreparationOverview
          score={data?.score}
          categories={data?.categories}
          loading={isPending}
          error={isError}
        />
        <Link className="text-link" href="/student/readiness">
          Explore your next steps <ArrowUpRight size={15} />
        </Link>
      </section>
    );
  return (
    <div className={`readiness-card panel ${full ? 'full-readiness' : ''}`}>
      <div className="panel-header">
        <h3>Placement readiness</h3>
        <Badge>Rule-based score</Badge>
      </div>
      <div className="readiness-inner">
        <div className="gauge">
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e2da" strokeWidth="9" />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="#9380c8"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray="314"
              strokeDashoffset={314 * (1 - (data?.score ?? 0) / 100)}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div>
            <b>{data?.score ?? '…'}</b>
            <span>{data?.label || 'Loading'}</span>
          </div>
        </div>
        <div className="readiness-categories">
          {(data?.categories || []).map((c) => (
            <div key={c.name}>
              <span>{c.name}</span>
              <Progress value={c.score} />
              <b>{c.score}</b>
            </div>
          ))}
        </div>
      </div>
      <div className="readiness-foot">
        <p>A little progress makes a big difference.</p>
        <Link href="/student/readiness" aria-label="View readiness details">
          <ArrowUpRight size={19} />
        </Link>
      </div>
      {full && (
        <p className="muted">
          Based on recorded evidence: verified skills 30%, academics 20%, projects 15%, aptitude
          15%, communication 10%, and interviews 10%. Missing assessments count as zero. This
          prototype uses explainable rules; the score is not a hiring prediction.
        </p>
      )}
    </div>
  );
}
export function StudentDashboard({ data, refresh }: { data: DemoData; refresh: () => void }) {
  const { student } = data;
  const nextSkill = student.skills.find((s) => !s.verified);
  const nextAssessment = data.assessments.find((a) => a.skill === nextSkill?.name);
  const currentStage = data.offers.length
    ? 5
    : data.interviews.length
      ? 4
      : data.applications.length
        ? 3
        : data.history.length
          ? 2
          : student.skills.length
            ? 1
            : 0;
  const upcoming = backendEnabled
    ? [
        ...data.interviews
          .filter((i) => i.status === 'Scheduled')
          .map((i) => ({
            date: i.date,
            day: i.date.slice(-2),
            month: new Date(i.date + 'T12:00:00').toLocaleString('en', { month: 'short' }),
            name: `${i.company} ${i.round}`,
            sub: `${i.time} · ${i.mode}`,
            color: 'lavender',
            href: '/student/interviews',
          })),
        ...data.opportunities.map((o) => ({
          date: o.deadline,
          day: o.deadline.slice(-2),
          month: new Date(o.deadline + 'T12:00:00').toLocaleString('en', { month: 'short' }),
          name: `${o.company} application deadline`,
          sub: o.role,
          color: 'pink',
          href: `/student/opportunities/${o.id}`,
        })),
      ]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 3)
    : undefined;
  return (
    <div className="student-dashboard">
      <PageHeader
        eyebrow="YOUR NEXT CHAPTER"
        title="Career dashboard"
        description={`Welcome back, ${student.name.split(' ')[0]}. Let's make a little progress today.`}
        action={
          <div className="dashboard-header-actions">
            <span className="dashboard-date">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <Link className="button outline" href="/student/profile">
              My career profile <ArrowUpRight size={16} />
            </Link>
          </div>
        }
      />
      <div className="dashboard-snapshot">
        {[
          {
            label: 'Verified skills',
            value: student.skills.filter((skill) => skill.verified).length,
            detail: `${student.skills.length} skills in your toolkit`,
            href: '/student/skills',
            color: 'sage',
            Icon: CircleCheck,
          },
          {
            label: 'Applications',
            value: data.applications.length,
            detail: 'Your next chapter in motion',
            href: '/student/applications',
            color: 'lavender',
            Icon: ArrowUpRight,
          },
          {
            label: 'Upcoming interviews',
            value: data.interviews.filter((interview) => interview.status === 'Scheduled').length,
            detail: 'A chance to show your potential',
            href: '/student/interviews',
            color: 'yellow',
            Icon: CalendarDays,
          },
          {
            label: 'Career points',
            value: student.xp.toLocaleString(),
            detail: 'Every effort adds up',
            href: '/student/career-points',
            color: 'pink',
            Icon: Trophy,
          },
        ].map(({ label, value, detail, href, color, Icon }) => (
          <Link className="snapshot-card" href={href} key={label}>
            <span className="snapshot-label">
              <span className={`snapshot-icon ${color}`}>
                <Icon size={16} />
              </span>
              {label}
              <ArrowUpRight size={14} />
            </span>
            <strong>{value}</strong>
            <small>{detail}</small>
          </Link>
        ))}
      </div>
      {!data.onboardingDismissed && (
        <div className="onboarding-strip">
          <span className="onboarding-icon">
            <Sparkles size={21} />
          </span>
          <div>
            <b>Your story is coming together.</b>
            <span>
              You’re {student.profileCompletion ?? 0}% there. Add evidence to help your profile
              stand out.
            </span>
          </div>
          <Link href="/student/profile" className="text-link">
            Complete profile <ArrowRight size={15} />
          </Link>
          <button
            className="icon-button"
            onClick={async () => {
              await studentService.dismissOnboarding();
              refresh();
            }}
            aria-label="Dismiss onboarding"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className="dashboard-hero-grid">
        <ReadinessCard />
        <DashboardActivity history={data.history} />
        <div className="next-action panel yellow">
          <div className="tiny-label">
            <Zap size={16} /> YOUR NEXT BEST ACTION
          </div>
          <div className="action-graphic">
            <span>{nextSkill?.name || 'Aptitude'}</span>
            <div>✳</div>
            <CircleCheck size={29} />
          </div>
          <h3>
            Know it?
            <br />
            Now prove it.
          </h3>
          <p>
            {nextSkill
              ? `Verify your ${nextSkill.name} skills and turn your potential into a trusted credential.`
              : 'Build your aptitude confidence with a placement assessment.'}
          </p>
          <Link
            className="button dark"
            href={`/student/assessments/${nextAssessment?.id || 'aptitude'}`}
          >
            {nextSkill ? 'Take verification' : 'Take assessment'} <ArrowUpRight size={16} />
          </Link>
          <span className="action-meta">10 questions · 10 min · +120 XP</span>
        </div>
      </div>
      <ContestProgress achievements={contestAchievements(data)} compact />
      <div className="career-progress panel">
        <div>
          <h3>Your career, in motion.</h3>
          <p>Every step brings you closer.</p>
        </div>
        <div className="career-stages">
          {['Profile', 'Skills', 'Assessments', 'Applications', 'Interviews', 'Offer'].map(
            (s, i) => (
              <Link
                href={`/student/${['profile', 'skills', 'assessments', 'applications', 'interviews', 'offers'][i]}`}
                className={i < currentStage ? 'done' : i === currentStage ? 'current' : ''}
                key={s}
              >
                <span>{i < currentStage ? <Check size={13} /> : i + 1}</span>
                <b>{s}</b>
                {i === currentStage && <small>YOU ARE HERE</small>}
              </Link>
            ),
          )}
        </div>
      </div>
      <Link href="/student/communication" className="communication-dashboard-link">
        <span className="communication-icon">
          <Mic size={23} />
        </span>
        <div>
          <strong>Find your voice.</strong>
          <p>Practice speaking and get feedback on your wording, fillers, and answer structure.</p>
        </div>
        <span>
          Practice communication <ArrowUpRight size={16} />
        </span>
      </Link>
      <div className="dashboard-middle">
        <section>
          <div className="section-header">
            <div>
              <h2>A good fit for your next step.</h2>
              <p>Opportunities aligned with your skills and ambition.</p>
            </div>
            <Link href="/student/opportunities" className="text-link">
              View all <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="opportunity-grid">
            {data.opportunities.slice(0, 3).map((job) => (
              <OpportunityCard job={job} compact key={job.id} />
            ))}
          </div>
        </section>
        <section className="upcoming panel">
          <div className="panel-header">
            <h3>On your horizon</h3>
            <CalendarDays size={19} />
          </div>
          {(
            upcoming || [
              {
                day: '06',
                month: 'OCT',
                name: 'Google technical interview',
                sub: '11:00 AM · Placement Block',
                color: 'lavender',
                href: '/student/interviews/google',
              },
              {
                day: '08',
                month: 'OCT',
                name: 'Weekly coding contest',
                sub: '6:00 PM · 60 minutes',
                color: 'yellow',
                href: '/student/contests/weekly',
              },
              {
                day: '18',
                month: 'OCT',
                name: 'Razorpay application deadline',
                sub: 'Frontend Engineer',
                color: 'pink',
                href: '/student/opportunities/razorpay',
              },
            ]
          ).map((e) => (
            <Link href={e.href} className="upcoming-row" key={`${e.href}-${e.name}`}>
              <span className={`date-tile ${e.color}`}>
                <b>{e.day}</b>
                <small>{e.month}</small>
              </span>
              <div>
                <strong>{e.name}</strong>
                <p>{e.sub}</p>
              </div>
              <ChevronRight size={16} />
            </Link>
          ))}
          <Link className="text-link" href="/student/interviews">
            Plan your next move <ArrowRight size={15} />
          </Link>
        </section>
      </div>
      <div className="dashboard-lower">
        <section className="panel skill-overview">
          <div className="panel-header">
            <div>
              <h3>Your skills. Your edge.</h3>
              <p>Keep growing. Keep proving.</p>
            </div>
            <Link href="/student/skills" className="text-link">
              Manage skills <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="skill-overview-list">
            {student.skills.slice(0, 4).map((s) => (
              <div key={s.id}>
                <span
                  className={`skill-square ${s.name === 'React' ? 'blue' : s.name === 'JavaScript' ? 'yellow' : 'sage'}`}
                >
                  <Code2 size={18} />
                </span>
                <div>
                  <b>{s.name}</b>
                  <small>{s.level}</small>
                </div>
                <Badge kind={s.verified ? 'verified' : ''}>
                  {s.verified ? (
                    <>
                      <CircleCheck size={12} /> Verified
                    </>
                  ) : (
                    'Verification pending'
                  )}
                </Badge>
                {!s.verified && (
                  <Link href="/student/assessments/react" aria-label="Verify React">
                    <ArrowUpRight size={16} />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="points-card lavender">
          <div className="panel-header">
            <h3>Consistency looks good on you.</h3>
            <Trophy size={22} />
          </div>
          <div className="xp-total">
            {student.xp.toLocaleString()}
            <span>CAREER POINTS</span>
            <span className="xp-star">✳</span>
          </div>
          <div className="xp-details">
            <span>
              <i /> Assessments & verified skills
            </span>
            <b>{(data.pointsSummary?.assessments ?? 0).toLocaleString()} XP</b>
            <span>
              <i /> Contests & interview practice
            </span>
            <b>{(data.pointsSummary?.participation ?? 0).toLocaleString()} XP</b>
          </div>
          <div className="points-foot">
            <span>
              <Trophy size={14} />{' '}
              {backendEnabled ? 'Keep building your preparation' : 'Demo weekly rank #14'}
            </span>
            <Link href="/student/contests">
              Keep the momentum <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
      </div>
      <div className="dashboard-note">
        <Sparkles size={15} /> Your potential isn’t a number. These insights help you decide what to
        do next.
      </div>
      <section className="dashboard-identity panel">
        <div>
          <span className="eyebrow">YOUR CAMPUSLINK IDENTITY</span>
          <h2>
            Your potential.
            <br />
            All in one place.
          </h2>
          <p>
            Your skills, your progress, your next chapter. Keep your career ID up to date as you
            grow.
          </p>
          <Link className="button outline" href="/student/profile">
            View your profile <ArrowUpRight size={16} />
          </Link>
        </div>
        <CareerID student={student} refresh={refresh} />
      </section>
    </div>
  );
}
const activity = [
  { name: 'May', value: 34 },
  { name: 'Jun', value: 45 },
  { name: 'Jul', value: 41 },
  { name: 'Aug', value: 63 },
  { name: 'Sep', value: 72 },
  { name: 'Oct', value: 86 },
];
export function AnalyticsChart({ bar = false }: { bar?: boolean }) {
  const { data } = useQuery({
    queryKey: ['analytics'],
    queryFn: campusService.getPlacementAnalytics,
  });
  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={240}>
        {bar ? (
          <BarChart data={data}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="ready" fill="#b5a2db" radius={[5, 5, 0, 0]} />
            <Bar dataKey="placed" fill="#b5c68b" radius={[5, 5, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={activity}>
            <defs>
              <linearGradient id="fillProgress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b7a3dd" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#b7a3dd" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              name="Progress"
              stroke="#9270bf"
              strokeWidth={3}
              fill="url(#fillProgress)"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
export function TeamDashboard({ data, role }: { data: DemoData; role: Role }) {
  if (backendEnabled)
    return (
      <>
        <PageHeader
          title={
            role === 'campus' ? 'Your campus placement overview.' : 'Your recruitment overview.'
          }
          description="Current records from your authorized placement workspace."
          action={
            <Link
              href={role === 'campus' ? '/campus/drive-requests' : '/recruiter/drives/request'}
              className="button dark"
            >
              {role === 'campus' ? 'Review drive requests' : 'Request campus drive'}
            </Link>
          }
        />
        <DriveActivitySummary data={data} role={role} />
        <ConnectedAnalytics />
      </>
    );
  const campus = role === 'campus';
  return (
    <>
      <PageHeader
        eyebrow="YOUR PLACEMENT ECOSYSTEM"
        title={campus ? 'Potential, moving forward.' : 'Great talent. Next chapter.'}
        description={
          campus
            ? 'A clear view of your students’ placement journey.'
            : 'Your hiring pipeline, with the next steps that matter.'
        }
        action={
          <Link
            href={campus ? '/campus/drive-requests' : '/recruiter/drives/request'}
            className="button dark"
          >
            <Plus size={17} />
            {campus ? 'Review drive requests' : 'Request campus drive'}
          </Link>
        }
      />
      <div className="metrics-grid">
        {(campus
          ? [
              ['Eligible students', '1,248', 'Ready for the next step', 'lavender'],
              ['Placement ready', '842', '67% of eligible students', 'sage'],
              [
                'New drive requests',
                `${data.drives.filter((d) => ['SUBMITTED', 'UNDER_REVIEW'].includes(d.status)).length}`,
                'Review before scheduling',
                'yellow',
              ],
              ['Offers received', '328', '26% placement conversion', 'pink'],
            ]
          : [
              [
                'Active drives',
                `${data.drives.filter((d) => ['ACTIVE', 'IN_PROGRESS'].includes(d.status)).length}`,
                'Open for student participation',
                'lavender',
              ],
              [
                'Drive requests',
                `${data.drives.filter((d) => !['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'].includes(d.status)).length}`,
                'Awaiting campus coordination',
                'yellow',
              ],
              ['Shortlisted', '86', 'Ready for a conversation', 'sage'],
              [
                'Upcoming interviews',
                `${data.interviews.length}`,
                'Give potential a chance',
                'pink',
              ],
            ]
        ).map(([label, value, sub, color]) => (
          <div className={`metric-card ${color}`} key={label}>
            <span>
              {label}
              <ArrowUpRight size={16} />
            </span>
            <b>{value}</b>
            <p>{sub}</p>
          </div>
        ))}
      </div>
      <DriveActivitySummary data={data} role={role} />
      <div className="two-columns">
        <section className="panel">
          <div className="panel-header">
            <h3>{campus ? 'Branch performance' : 'Hiring momentum'}</h3>
            <Badge>Demo analytics</Badge>
          </div>
          <AnalyticsChart bar={campus} />
          <p className="muted">
            {campus
              ? 'Lavender: readiness · Sage: placements'
              : 'Applications progressing through your pipeline'}
          </p>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h3>{campus ? 'Placement funnel' : 'Your recruitment funnel'}</h3>
            <Target size={20} />
          </div>
          {[
            ['Applications', 404],
            ['Eligible', 312],
            ['Shortlisted', 86],
            ['Interviewed', 42],
            ['Offered', 18],
          ].map(([name, value], i) => (
            <div className="funnel-row" key={name}>
              <span>{name}</span>
              <div
                style={{ width: `${100 - i * 15}%` }}
                className={['lavender', 'blue', 'yellow', 'sage', 'pink'][i]}
              >
                <b>{value}</b>
              </div>
            </div>
          ))}
        </section>
      </div>
      <div className="section-header">
        <div>
          <h2>Drives moving possibility forward.</h2>
          <p>Give the right opportunity the right attention.</p>
        </div>
        <Link className="text-link" href={`/${role}/drives`}>
          View all <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="table-wrap panel">
        <table>
          <thead>
            <tr>
              <th>Company & role</th>
              <th>Location</th>
              <th>Applicants</th>
              <th>Status</th>
              <th>Next step</th>
            </tr>
          </thead>
          <tbody>
            {data.drives.map((d) => (
              <tr key={d.id}>
                <td>
                  <b>{d.company}</b>
                  <small>{d.role}</small>
                </td>
                <td>{d.location}</td>
                <td>{d.applicants}</td>
                <td>
                  <Badge kind="verified">{statusLabel(d.status)}</Badge>
                </td>
                <td>
                  <Link className="text-link" href={`/${role}/drives/${d.id}`}>
                    Manage drive <ArrowUpRight size={14} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="section-header">
        <h2>Conversations on the horizon.</h2>
        <Link href={`/${role}/interviews`} className="text-link">
          View interviews <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="three-columns">
        {data.interviews.map((i) => (
          <Link key={i.id} href={`/${role}/interviews/${i.id}`} className="panel">
            <Badge>{i.round}</Badge>
            <h3>{i.company}</h3>
            <p>{i.role}</p>
            <span className="muted">
              {formatDate(i.date)} · {i.time} · {i.mode}
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
