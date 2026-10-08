'use client';
import Image from 'next/image';
import { StudentMatchingSummary } from '@/components/smart-matching-summary';
import { ContestProgress } from '@/components/contest-progress';
import { DashboardActivity } from '@/components/dashboard-activity';
import { PreparationOverview } from '@/components/preparation-overview';
import { NotificationsSummary, PlacementWorkflow } from '@/components/placement-dashboard-sections';
import { CareerID } from '@/components/student-id';
import { Badge, PageHeader, formatDate } from '@/components/ui';
import { aiService, studentService } from '@/services/platform.service';
import { WorkspaceData, Opportunity } from '@/types';
import { contestAchievements } from '@/utils/contest-achievements';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  CircleCheck,
  Code2,
  Mic,
  Sparkles,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
export { CareerID } from '@/components/student-id';
export function OpportunityCard({ job, compact = false }: { job: Opportunity; compact?: boolean }) {
  return (
    <Link
      href={`/student/opportunities/${job.id}`}
      className={`opportunity-card ${compact ? 'compact' : ''}`}
    >
      <div className="opportunity-top">
        <span className={`company-logo ${job.color}`}>
          {job.logo ? (
            <Image unoptimized src={job.logo} alt={job.company} width={44} height={44} />
          ) : (
            job.company[0]
          )}
          {job.company === 'Razorpay' && <ArrowUpRight size={17} />}
        </span>
        <span className="match-tag">
          <Sparkles size={12} /> {job.match}% <small>{'Evidence fit'}</small>
        </span>
      </div>
      <p className="company-name">{job.company}</p>
      <Badge kind={job.eligibility?.passed ? 'verified' : ''}>
        {job.eligibility?.passed === false ? 'Not eligible' : 'Eligible'}
      </Badge>
      {job.eligibility?.passed === false && (
        <ul className="muted">
          {job.eligibility.checks
            .filter((check) => !check.passed)
            .map((check) => (
              <li key={check.name}>
                {check.name}: {check.detail}
              </li>
            ))}
        </ul>
      )}
      <p>
        {job.location} · {job.workMode || 'On-site'}
      </p>
      <p>Apply before {formatDate(job.deadline)}</p>
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
export function ReadinessCard({ full: _full = false }: { full?: boolean }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['readiness'],
    queryFn: aiService.getReadinessScore,
  });
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
}
export function StudentDashboard({ data, refresh }: { data: WorkspaceData; refresh: () => void }) {
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
  const upcoming = [
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
    .slice(0, 3);
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
      <StudentMatchingSummary data={data} />
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
          {upcoming.map((e) => (
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
              <Trophy size={14} /> {'Keep building your preparation'}
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
      <div className="two-columns">
        <section className="panel">
          <h2>Your offer progress</h2>
          {data.offers.map((offer) => (
            <p key={offer.id}>
              {offer.company} · {offer.role} <Badge>{offer.status}</Badge>
            </p>
          ))}
          {!data.offers.length && <p>No offers received yet. Keep tracking your applications.</p>}
          <Link href="/student/offers">Review your offers</Link>
        </section>
        <NotificationsSummary data={data} href="/student/notifications" />
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
      <PlacementWorkflow
        steps={[
          {
            title: 'Profiling',
            detail: 'Keep your skills and career profile current',
            href: '/student/profile',
          },
          {
            title: 'Matching',
            detail: 'Find eligible drives and understand skill gaps',
            href: '/student/opportunities',
          },
          {
            title: 'Scheduling',
            detail: 'Review campus visits and upcoming interviews',
            href: '/student/interviews',
          },
          {
            title: 'Notification',
            detail: 'Follow applications and placement updates',
            href: '/student/notifications',
          },
          {
            title: 'Offer tracking',
            detail: 'Review offers and update your response',
            href: '/student/offers',
          },
          {
            title: 'Analytics',
            detail: 'See your readiness evidence and preparation insights',
            href: '/student/readiness',
          },
        ]}
      />
    </div>
  );
}
