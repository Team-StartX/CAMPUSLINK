'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useScroll, useSpring, useTransform } from 'framer-motion';
import {
  ArrowUpRight,
  Bell,
  Building2,
  Check,
  FileCheck2,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

const stages = [
  {
    title: 'Company requests a campus drive.',
    role: 'Recruiter',
    color: 'recruiter',
    description:
      'Choose an institution and share the role, eligibility, skills, package, selection rounds and preferred visit dates.',
    status: 'Request sent',
  },
  {
    title: 'Campus reviews the request.',
    role: 'Placement cell',
    color: 'campus',
    description:
      'The placement cell checks the company, role, student pool and campus requirements. Approval moves the request into scheduling, before it is visible to students.',
    status: 'Approved for scheduling',
  },
  {
    title: 'The right student pool is identified.',
    role: 'System + campus',
    color: 'system',
    description:
      'Campus, branch, graduation year, CGPA and backlog rules come first. Only eligible profiles continue to role matching.',
    status: 'Eligibility checked',
  },
  {
    title: 'Relevant students are matched.',
    role: 'Matching engine',
    color: 'system',
    description:
      'Verified skills, projects and assessment evidence explain the fit. These illustrative scores demonstrate the experience, not a real ML prediction.',
    status: 'Demo matching complete',
  },
  {
    title: 'Relevant students get the opportunity.',
    role: 'Student',
    color: 'student',
    description:
      'Once the campus confirms the schedule and activates the drive, eligible students receive the opportunity in their placement dashboard.',
    status: 'Drive activated',
  },
  {
    title: 'Student reviews and applies.',
    role: 'Student',
    color: 'student',
    description:
      'Review the role, selection process, eligibility and campus schedule. Apply before the deadline and receive a clear confirmation.',
    status: 'Application received',
  },
  {
    title: 'Candidates are shortlisted.',
    role: 'Recruiter + campus',
    color: 'recruiter',
    description:
      'Recruiters review eligible applicants and their evidence while the campus coordinates the approved candidate pool.',
    status: 'Shortlisted',
  },
  {
    title: 'Campus coordinates every round.',
    role: 'Placement cell',
    color: 'campus',
    description:
      'The confirmed visit brings a shared agenda, reserved venues and allocated interview rooms. This schedule is agreed before the drive is activated.',
    status: 'Schedule confirmed',
  },
  {
    title: 'Everyone stays informed.',
    role: 'Campus',
    color: 'campus',
    description:
      'Students get the reporting time, venue, required documents and round instructions. In this preview, reminders stay inside the platform.',
    status: 'Reminder delivered',
  },
  {
    title: 'The company arrives on campus.',
    role: 'Campus + recruiter',
    color: 'recruiter',
    description:
      'The placement cell coordinates check-in and round progression. Recruiters conduct the actual assessment and interviews in person.',
    status: 'On-campus drive live',
  },
  {
    title: 'Every stage is tracked.',
    role: 'Campus + student',
    color: 'student',
    description:
      'Students can follow their own selection status while campus teams monitor attendance and the complete recruitment funnel.',
    status: 'Progress updated',
  },
  {
    title: 'Every attempt shows the next step.',
    role: 'Career intelligence',
    color: 'system',
    description:
      'An attempt becomes preparation insight. See strengths, identify evidence gaps and connect them to a useful improvement plan.',
    status: 'Demo insights ready',
  },
  {
    title: 'From campus drive to offer.',
    role: 'Student + campus + recruiter',
    color: 'student',
    description:
      'Review the offer, record a response, complete document verification and follow joining. One connected journey, from request to outcome.',
    status: 'Offer received',
  },
] as const;

function usePreviewSequence(active: boolean, reduced: boolean) {
  const [phase, setPhase] = useState(reduced ? 3 : 0),
    [replay, setReplay] = useState(0);
  useEffect(() => {
    if (reduced) {
      setPhase(3);
      return;
    }
    if (!active) return;
    setPhase(0);
    const timers = [1, 2, 3].map((value) => setTimeout(() => setPhase(value), value * 650));
    return () => timers.forEach(clearTimeout);
  }, [active, reduced, replay]);
  return { phase, replay: () => setReplay((value) => value + 1) };
}
function PreviewRow({
  label,
  value,
  ready = true,
}: {
  label: string;
  value: string;
  ready?: boolean;
}) {
  return (
    <div className={`journey-preview-row ${ready ? 'ready' : ''}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}
function PreviewHeader({
  title,
  icon: Icon = Building2,
}: {
  title: string;
  icon?: typeof Building2;
}) {
  return (
    <div className="journey-preview-header">
      <Icon size={15} />
      <span>{title}</span>
      <i />
      <i />
      <i />
    </div>
  );
}
function CompanyTitle() {
  return (
    <div className="journey-company">
      <span className="journey-company-mark">a.</span>
      <div>
        <small>ACME TECHNOLOGIES</small>
        <h4>Software Engineer</h4>
      </div>
    </div>
  );
}
function PreviewButton({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className="journey-demo-button" onClick={onClick} disabled={disabled}>
      {children}
      <ArrowUpRight size={14} />
    </button>
  );
}
type PreviewProps = { phase: number; replay: () => void };
function RecruiterRequestPreview({ phase, replay }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="New campus request" />
      <CompanyTitle />
      <PreviewRow label="Campus" value="XYZ Institute of Technology" ready={phase >= 1} />
      <PreviewRow label="CTC" value="₹10–14 LPA" ready={phase >= 2} />
      <PreviewRow label="Preferred visit" value="18 October" ready={phase >= 2} />
      <PreviewButton onClick={replay} disabled={phase < 2}>
        {phase === 3 ? 'Request sent ✓ · Replay' : 'Submit drive request'}
      </PreviewButton>
    </>
  );
}
function CampusApprovalPreview({ phase, replay }: PreviewProps) {
  const [changes, setChanges] = useState(false);
  return (
    <>
      <PreviewHeader title="Campus review queue" />
      <CompanyTitle />
      <PreviewRow label="Eligible pool" value="184 students" />
      <PreviewRow label="Requested visit" value="18 October" />
      <div className="journey-status-line">
        <ShieldCheck size={18} />
        {changes ? 'Changes requested' : phase === 3 ? 'Approved ✓' : 'Under review'}
      </div>
      <div className="journey-preview-actions">
        <button onClick={() => setChanges(true)} type="button">
          Request changes
        </button>
        <PreviewButton
          onClick={() => {
            setChanges(false);
            replay();
          }}
        >
          Proceed
        </PreviewButton>
      </div>
      <small className="journey-note">
        {changes
          ? 'Update the request details, then proceed with review.'
          : 'Next: scheduling. This is not a public listing yet.'}
      </small>
    </>
  );
}
function CandidatePoolPreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Eligibility before matching" icon={Users} />
      <div className="journey-pool-dots" aria-hidden="true">
        {Array.from({ length: 30 }, (_, i) => (
          <motion.i
            key={i}
            animate={{
              x: phase > 1 ? (i % 4 === 0 ? -7 : 7) : 0,
              opacity: phase > 1 && i % 4 === 0 ? 0.25 : 1,
            }}
            transition={{ duration: 0.3, delay: i * 0.008 }}
            className={i % 4 === 0 ? 'excluded' : ''}
          />
        ))}
      </div>
      <div className="journey-pool-counts">
        <div>
          <b>840</b>
          <span>Campus students</span>
        </div>
        <span>→</span>
        <div>
          <b>{phase >= 1 ? 184 : '—'}</b>
          <span>Eligible</span>
        </div>
        <span>→</span>
        <div>
          <b>{phase === 3 ? 136 : '—'}</b>
          <span>Relevant profiles</span>
        </div>
      </div>
      <div className="journey-mini-tags">
        <span>CGPA ≥ 7.0</span>
        <span>CSE / IT</span>
        <span>No active backlogs</span>
      </div>
    </>
  );
}
function MatchingPreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Explainable demo matching" icon={Sparkles} />
      <div className="journey-mini-tags">
        {['React', 'Node.js', 'SQL', 'DSA'].map((s) => (
          <span key={s}>{s}</span>
        ))}
      </div>
      <div className="journey-match-nodes">
        {['Skills', 'Projects', 'Assessments'].map((s, i) => (
          <motion.span
            key={s}
            animate={{ opacity: phase > i ? 1 : 0.4, scale: phase > i ? 1 : 0.94 }}
          >
            {s}
          </motion.span>
        ))}
        <b>
          {phase === 3 ? '92%' : '…'}
          <small>Demo fit</small>
        </b>
      </div>
      {['Eligible profile 01', 'Eligible profile 02', 'Eligible profile 03'].map((s, i) => (
        <PreviewRow key={s} label={s} value={phase === 3 ? `${[92, 89, 86][i]}%` : 'Comparing…'} />
      ))}
      <small className="journey-note">Illustrative scores · eligibility already passed</small>
    </>
  );
}
function OpportunityPreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Student placement dashboard" icon={GraduationCap} />
      <div className={`journey-notification ${phase > 0 ? 'arrived' : ''}`}>
        <Bell size={17} /> New campus drive
      </div>
      <CompanyTitle />
      <PreviewRow label="Confirmed visit" value="18 October" />
      <PreviewRow label="Package" value="₹10–14 LPA" />
      <div className="journey-mini-tags">
        <span>✓ Eligibility passed</span>
        <span>92% demo fit</span>
        <span>Campus activated</span>
      </div>
      <Link className="journey-demo-button" href="/for-students">
        View drive <ArrowUpRight size={14} />
      </Link>
    </>
  );
}
function ApplicationPreview({ phase, replay }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Apply to the campus drive" />
      <CompanyTitle />
      <PreviewRow label="Eligibility" value="✓ Passed" />
      <PreviewRow label="Application deadline" value="12 October" />
      <PreviewButton onClick={replay}>
        {phase === 3
          ? 'Application received ✓ · Replay'
          : phase === 2
            ? 'Submitting…'
            : 'Apply for drive'}
      </PreviewButton>
      <PreviewRow label="Applied students" value={phase === 3 ? '85' : '84'} />
    </>
  );
}
function ShortlistPreview({ phase, replay }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Candidate pipeline" icon={Users} />
      <div className="journey-shortlist-board">
        {['Applied', 'Eligibility', 'Shortlisted'].map((s, i) => (
          <div key={s}>
            <small>{s}</small>
            <motion.div animate={{ opacity: phase >= i ? 1 : 0.35, y: phase >= i ? 0 : 8 }}>
              <span className="journey-profile-token">
                <GraduationCap size={18} />
              </span>
              <b>Applicant {String(i + 1).padStart(2, '0')}</b>
              <span>92% demo fit</span>
              <span>5 verified skills</span>
              {phase === 3 && <Check size={15} />}
            </motion.div>
          </div>
        ))}
      </div>
      <PreviewButton onClick={replay}>Replay shortlisting</PreviewButton>
    </>
  );
}
function SchedulePreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Confirmed campus schedule" />
      <div className="journey-calendar-date">
        <b>18</b>
        <div>
          <span>OCTOBER</span>
          <strong>Acme campus drive</strong>
        </div>
        <Check size={20} />
      </div>
      <div className="journey-agenda">
        {[
          ['08:30', 'Recruiter reporting'],
          ['09:00', 'Pre-placement talk'],
          ['10:00', 'Assessment'],
          ['12:00', 'Technical interviews'],
          ['15:30', 'HR interviews'],
        ].map(([time, label], i) => (
          <div key={time} className={phase >= Math.min(i, 3) ? 'ready' : ''}>
            <time>{time}</time>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="journey-mini-tags">
        <span>Hall A</span>
        <span>Computer Lab 2</span>
        <span>Rooms 101–104</span>
      </div>
    </>
  );
}
function ReminderPreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Campus placement cell" icon={Bell} />
      <div className="journey-reminder">
        <Bell size={24} />
        <h4>Interview tomorrow.</h4>
        <p>Acme Technologies · 8:30 AM</p>
        <span>
          <MapPin size={14} /> Placement Block
        </span>
      </div>
      <div className="journey-mini-tags">
        <span>✓ College ID</span>
        <span>✓ Resume</span>
      </div>
      <PreviewRow
        label="Latest update"
        value={
          [
            'Drive confirmed ✓',
            'Application accepted ✓',
            'Interview tomorrow',
            'Reporting: 8:30 AM',
          ][phase]
        }
      />
      <Link className="journey-demo-button" href="#journey-step-8">
        View schedule <ArrowUpRight size={14} />
      </Link>
    </>
  );
}
const funnel = [
  ['Registered', 180],
  ['Checked in', 156],
  ['Assessment', 104],
  ['Technical', 62],
  ['HR', 38],
  ['Selected', 20],
] as const;
function LiveDrivePreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="On-campus recruitment · Live" />
      <div className="journey-live-heading">
        <span className="journey-live-dot" /> ACME CAMPUS DRIVE <b>LIVE</b>
      </div>
      <div className="journey-live-counts">
        {funnel.map(([name, count], i) => (
          <motion.div key={name} animate={{ opacity: phase >= Math.floor(i / 2) ? 1 : 0.35 }}>
            <span>{name}</span>
            <b>{phase >= Math.floor(i / 2) ? count : '—'}</b>
          </motion.div>
        ))}
      </div>
      <div className="journey-mini-tags">
        <span>Check-in → Assessment → Interview → Offer</span>
      </div>
    </>
  );
}
function TrackingPreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Your application journey" />
      <div className="journey-tracking">
        {[
          'Applied',
          'Eligibility',
          'Shortlisted',
          'Assessment · 82%',
          'Technical · Cleared',
          'HR · Waiting',
          'Offer · Pending',
        ].map((s, i) => (
          <div key={s}>
            <span className={i < Math.min(phase + 2, 5) ? 'done' : ''}>
              {i < Math.min(phase + 2, 5) ? <Check size={12} /> : i === 5 ? '●' : '○'}
            </span>
            <b>{s}</b>
          </div>
        ))}
      </div>
      <small className="journey-note">Campus view: 180 applied → 156 attended → 20 selected</small>
    </>
  );
}
function GapAnalysisPreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Placement gap insights · Demo" icon={Sparkles} />
      <div className="journey-readiness">
        <span>Overall readiness</span>
        <b>78%</b>
      </div>
      <div className="journey-mini-tags">
        <span>✓ React</span>
        <span>✓ SQL</span>
        <span>✓ Aptitude</span>
      </div>
      {[
        ['DSA', 64],
        ['Communication', 68],
        ['Technical interview', 71],
        ['System design', 58],
      ].map(([s, value]) => (
        <div className="journey-gap" key={s}>
          <span>{s}</span>
          <div>
            <motion.i initial={false} animate={{ scaleX: phase > 0 ? Number(value) / 100 : 0 }} />
          </div>
          <b>{value}%</b>
        </div>
      ))}
      <p className="journey-note">
        Next: practise DSA → learn system design → take a mock interview → verify AWS.
      </p>
      <Link className="journey-demo-button" href="/for-students">
        Start improvement plan <ArrowUpRight size={14} />
      </Link>
    </>
  );
}
function OfferPreview({ phase }: PreviewProps) {
  return (
    <>
      <PreviewHeader title="Your next chapter" icon={FileCheck2} />
      <CompanyTitle />
      <div className="journey-offer-success">
        <Check size={24} />
        <h4>{phase === 3 ? 'Selected. A new beginning.' : 'Your offer is ready.'}</h4>
      </div>
      <PreviewRow label="CTC" value="₹12 LPA" />
      <PreviewRow label="Joining" value="15 July" />
      <Link className="journey-demo-button" href="/for-students">
        View offer <ArrowUpRight size={14} />
      </Link>
      <div className="journey-mini-tags">
        <span>✓ Response</span>
        <span>✓ Documents</span>
        <span>Joining tracked</span>
      </div>
    </>
  );
}
const previews = [
  RecruiterRequestPreview,
  CampusApprovalPreview,
  CandidatePoolPreview,
  MatchingPreview,
  OpportunityPreview,
  ApplicationPreview,
  ShortlistPreview,
  SchedulePreview,
  ReminderPreview,
  LiveDrivePreview,
  TrackingPreview,
  GapAnalysisPreview,
  OfferPreview,
];

function JourneyCheckpoint({ index, activated }: { index: number; activated: boolean }) {
  return (
    <span
      className={`journey-checkpoint ${activated ? 'activated' : ''}`}
      aria-label={`Step ${index + 1}`}
    >
      {String(index + 1).padStart(2, '0')}
    </span>
  );
}
function JourneyStep({ index, reduced }: { index: number; reduced: boolean }) {
  const ref = useRef<HTMLElement>(null),
    visible = useInView(ref, { amount: 0.25 }),
    [visited, setVisited] = useState(false);
  useEffect(() => {
    if (visible) setVisited(true);
  }, [visible]);
  const { phase, replay } = usePreviewSequence(visible, reduced),
    stage = stages[index],
    Preview = previews[index],
    active = reduced || visited;
  return (
    <article
      ref={ref}
      className={`journey-step ${index % 2 ? 'reversed' : ''} ${stage.color}`}
      id={`journey-step-${index + 1}`}
    >
      <motion.div
        className="journey-step-copy"
        initial={false}
        animate={{ opacity: active ? 1 : 0.6, y: active ? 0 : 18 }}
        transition={{ duration: reduced ? 0 : 0.45 }}
      >
        <span className="journey-role-badge">{stage.role}</span>
        <h3>{stage.title}</h3>
        <p>{stage.description}</p>
        <span className="journey-stage-status">
          <Check size={13} />
          {active ? (phase === 3 ? stage.status : 'Demo in progress') : 'Coming up'}
        </span>
      </motion.div>
      <JourneyCheckpoint index={index} activated={active} />
      <motion.div
        className="journey-ui-preview"
        initial={false}
        animate={{
          opacity: active ? 1 : 0.55,
          y: active ? 0 : 22,
          scale: active ? 1 : 0.98,
          filter: active ? 'blur(0px) saturate(1)' : 'blur(1px) saturate(.7)',
        }}
        transition={{ duration: reduced ? 0 : 0.4 }}
        aria-label={`Illustrative preview: ${stage.title}`}
      >
        <Preview phase={phase} replay={replay} />
      </motion.div>
    </article>
  );
}
function JourneyPath({
  progress,
  reduced,
}: {
  progress: ReturnType<typeof useSpring>;
  reduced: boolean;
}) {
  const d = Array.from({ length: 13 }, (_, i) => {
    const y = i * 440;
    return `${i === 0 ? 'M 500 0 ' : ''}C ${i % 2 ? 535 : 465} ${y + 70}, ${i % 2 ? 535 : 465} ${y + 160}, 500 ${y + 220} C ${i % 2 ? 465 : 535} ${y + 280}, ${i % 2 ? 465 : 535} ${y + 370}, 500 ${y + 440}`;
  }).join(' ');
  const packetY = useTransform(progress, [0, 1], [0, 5720]);
  const packetX = useTransform(progress, (value) => -26 * Math.sin(value * 13 * 2 * Math.PI));
  return (
    <div className="journey-path" aria-hidden="true">
      <svg className="journey-path-desktop" viewBox="0 0 1000 5720" preserveAspectRatio="none">
        <path d={d} className="journey-path-base" />
        <motion.path
          d={d}
          className="journey-path-fill"
          style={{ pathLength: reduced ? 1 : progress }}
        />
        {!reduced && (
          <motion.g style={{ y: packetY, x: packetX }}>
            <rect x="489" y="-10" width="22" height="20" rx="4" fill="#232c39" />
            <path d="M495 -3h10m-10 5h7" stroke="#fff" strokeWidth="1.5" />
          </motion.g>
        )}
      </svg>
      <svg className="journey-path-mobile" viewBox="0 0 40 5720" preserveAspectRatio="none">
        <path d="M20 0V5720" className="journey-path-base" />
        <motion.path
          d="M20 0V5720"
          className="journey-path-fill"
          style={{ pathLength: reduced ? 1 : progress }}
        />
      </svg>
    </div>
  );
}
export function PlacementJourney() {
  const ref = useRef<HTMLDivElement>(null),
    reduced = !!useHydratedReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.75', 'end 0.75'] });
  const progress = useSpring(scrollYProgress, { stiffness: 100, damping: 30 });
  return (
    <section
      className="placement-journey"
      id="placement-journey"
      aria-labelledby="placement-journey-title"
    >
      <div className="content-width">
        <header className="journey-heading">
          <span className="campus-kicker">THE CAMPUS PLACEMENT JOURNEY</span>
          <h2 id="placement-journey-title">
            From company request
            <br />
            <em>to student placement.</em>
          </h2>
          <p>
            One coordinated journey connecting recruiters, the campus placement cell, and the right
            students.
          </p>
          <span className="journey-demo-label">Interactive story · illustrative demo data</span>
        </header>
        <div className="journey-stages" ref={ref}>
          <JourneyPath progress={progress} reduced={reduced} />
          {stages.map((_, index) => (
            <JourneyStep key={index} index={index} reduced={reduced} />
          ))}
        </div>
        <footer className="journey-complete">
          <span>
            <Check size={28} />
          </span>
          <h3>Every step, connected.</h3>
          <p>Request → Match → Apply → Shortlist → Schedule → Interview → Offer</p>
          <Link className="campus-button" href="/register">
            Start your journey <ArrowUpRight size={16} />
          </Link>
        </footer>
      </div>
    </section>
  );
}
