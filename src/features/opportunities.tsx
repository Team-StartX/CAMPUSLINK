'use client';
import { backendEnabled } from '@/services/api/remote';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ArrowLeft, Check, Search, Sparkles, CircleCheck, Gift } from 'lucide-react';
import { DemoData, Role } from '@/types';
import { applicationService, matchingService, offerService } from '@/services/platform.service';
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  Modal,
  PageHeader,
  Progress,
  formatDate,
} from '@/components/ui';
import { OpportunityCard } from './dashboard';
import { checkEligibility, driveOpportunity } from '@/utils/placement';
type Props = {
  data: DemoData;
  refresh: () => void;
  notify: (s: string) => void;
  id?: string;
  role?: Role;
};
export function OpportunitiesPage({ data, id, refresh, notify }: Props) {
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('All locations');
  const [type, setType] = useState('All types');
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const job = data.opportunities.find((j) => j.id === id);
  const drive = data.drives.find((d) => d.id === job?.driveId);
  const { data: match } = useQuery({
    queryKey: ['match', id],
    queryFn: () => matchingService.getMatchExplanation(id!),
    enabled: !!job,
  });
  if (id && !job)
    return (
      <EmptyState
        title="Opportunity not found"
        action={<Link href="/student/opportunities">Explore opportunities</Link>}
      />
    );
  if (job) {
    const applied = data.applications.some((a) => a.opportunityId === job.id);
    return (
      <>
        <Link href="/student/opportunities" className="back-link">
          <ArrowLeft size={15} /> All opportunities
        </Link>
        <PageHeader
          eyebrow={job.company.toUpperCase()}
          title={job.role}
          description={`${job.location} · ${job.type} · ₹${job.ctc}`}
          action={
            <Button disabled={applied} onClick={() => setConfirm(true)}>
              {applied ? (
                <>
                  <Check size={16} /> Applied
                </>
              ) : (
                <>
                  Apply for campus drive <ArrowUpRight size={16} />
                </>
              )}
            </Button>
          }
        />
        <div className="opportunity-detail-grid">
          <div>
            <section className="panel">
              <Badge>ON-CAMPUS DRIVE · Campus approved & activated</Badge>
              <h3>{job.campus}</h3>
              <p>
                {job.visitDate ? formatDate(job.visitDate) : 'Visit date pending'} · {job.venue} ·
                Company physically visits campus
              </p>
              <h2>Build something that matters.</h2>
              <p>
                Join {job.company} and help create thoughtful, reliable products used by people
                every day. We’re looking for curious graduates who enjoy solving problems and
                learning with a team.
              </p>
              <h3>What you’ll do</h3>
              <ul>
                <li>
                  Collaborate with designers and engineers to deliver accessible, high-quality
                  products.
                </li>
                <li>
                  Write maintainable code, review changes, and contribute to technical decisions.
                </li>
                <li>Learn from experienced teammates and take ownership of meaningful projects.</li>
              </ul>
              <h3>What you’ll bring</h3>
              <p>
                Strong fundamentals in {job.skills.join(', ')}, problem solving, and communication.
                A portfolio of projects and a desire to keep growing.
              </p>
              <div className="job-chips">
                {job.skills.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
              <h3>Eligibility</h3>
              <Badge kind="verified">✓ Your profile meets hard eligibility</Badge>
              {drive &&
                checkEligibility(data.student, drive).checks.map((c) => (
                  <p key={c.name}>
                    ✓ {c.name}: {c.detail}
                  </p>
                ))}
              <h3>Your selection journey</h3>
              <div className="selection-flow">
                {(
                  drive?.rounds?.map((r) => r.name) || [
                    'Pre-placement talk',
                    'Assessment',
                    'Technical interview',
                    'HR interview',
                    'Selection',
                  ]
                ).map((s, i) => (
                  <span key={s}>
                    <b>{i + 1}</b>
                    {s}
                  </span>
                ))}
              </div>
            </section>
            <section className="panel">
              <h3>Your skills, compared.</h3>
              <div className="skill-comparison">
                {job.skills.map((s) => (
                  <div key={s}>
                    <b>{s}</b>
                    {data.student.skills.some((sk) => sk.name === s) ? (
                      <Badge kind="verified">
                        <Check size={13} /> On your profile
                      </Badge>
                    ) : (
                      <Link href="/student/skills" className="text-link">
                        Add this skill <ArrowUpRight size={14} />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
          <aside>
            <section className={`panel ${job.color}`}>
              <div className="panel-header">
                <Sparkles size={20} />
                <Badge>{backendEnabled ? 'Evidence-based fit' : 'Demo match'}</Badge>
              </div>
              <div className="match-large">
                {job.match}
                <span>%</span>
              </div>
              <h3>A promising alignment.</h3>
              <p>See how your recorded profile aligns with this role.</p>
              {match?.explanation.map((x) => (
                <div className="match-factor" key={x.name}>
                  <span>
                    {x.name}
                    <b>{x.score}%</b>
                  </span>
                  <Progress value={x.score} />
                </div>
              ))}
              <small className="muted">
                {backendEnabled
                  ? 'Computed from eligibility, skills, academics and recorded evidence. Placement teams make selection decisions.'
                  : 'Mock matching data shown for the standalone demonstration.'}
              </small>
            </section>
            <section className="panel">
              <h3>The details</h3>
              <div className="detail-list">
                <span>
                  Location<b>{job.location}</b>
                </span>
                <span>
                  Compensation<b>₹{job.ctc}</b>
                </span>
                <span>
                  Work type<b>{job.type}</b>
                </span>
                <span>
                  Apply before<b>{formatDate(job.deadline)}</b>
                </span>
              </div>
            </section>
          </aside>
        </div>
        {confirm && (
          <Modal title="Take the next step." onClose={() => setConfirm(false)}>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await applicationService.apply(job.id);
                  refresh();
                  setConfirm(false);
                  notify(`Application submitted to ${job.company}. Good luck!`);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <h3>
                {job.role} · {job.company}
              </h3>
              <p>
                Your profile and recorded resume will be available to the recruiter for this
                application.
              </p>
              <FormField label="Resume">
                <select required>
                  <option value="">Choose a resume</option>
                  {data.documents
                    .filter((d) => d.type === 'Resume')
                    .map((d) => (
                      <option key={d.id}>{d.name}</option>
                    ))}
                </select>
              </FormField>
              <label className="checkbox-label">
                <input type="checkbox" required /> I confirm that my information is accurate.
              </label>
              {error && <p className="field-error">{error}</p>}
              <Button type="submit">
                Submit application <ArrowUpRight size={16} />
              </Button>
            </form>
          </Modal>
        )}
      </>
    );
  }
  const jobs = data.opportunities.filter(
    (j) =>
      `${j.company} ${j.role} ${j.skills.join(' ')}`.toLowerCase().includes(search.toLowerCase()) &&
      (location === 'All locations' || j.location === location) &&
      (type === 'All types' || j.type === type),
  );
  return (
    <>
      <PageHeader
        eyebrow="POTENTIAL MEETS POSSIBILITY"
        title="Your campus. Your next opportunity."
        description="Only activated campus drives that pass your campus, course, branch, year, CGPA, and backlog eligibility appear here."
      />
      <div className="filter-bar">
        <label className="search-input">
          <Search size={18} />
          <input
            placeholder="Search roles, companies, or skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          {['All locations', 'Bengaluru', 'Hyderabad', 'Remote', 'Mumbai'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter work type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {['All types', 'Full-time', 'Internship'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <p className="muted">
        {jobs.length} opportunities ·{' '}
        {backendEnabled ? 'Evidence-based fit estimates' : 'Demo match insights'}
      </p>
      <div className="three-columns">
        {jobs.map((j) => (
          <OpportunityCard job={j} key={j.id} />
        ))}
      </div>
      {jobs.length === 0 && (
        <EmptyState
          title="A different search might open a door."
          description="Try another location, company, or skill."
          action={
            <Button
              kind="outline"
              onClick={() => {
                setSearch('');
                setLocation('All locations');
                setType('All types');
              }}
            >
              Clear filters
            </Button>
          }
        />
      )}
    </>
  );
}
export function ApplicationsPage({ data, role = 'student', refresh, notify }: Props) {
  const [filter, setFilter] = useState('Active');
  const stages = ['Applied', 'Eligibility', 'Shortlisted', 'Assessment', 'Interview', 'Offer'];
  const apps = data.applications.filter(
    (a) =>
      filter === 'All' ||
      (filter === 'Active' && !['Offer', 'Rejected'].includes(a.stage)) ||
      (filter === 'Offers' && a.stage === 'Offer') ||
      (filter === 'Rejected' && a.stage === 'Rejected'),
  );
  return (
    <>
      <PageHeader
        title="Your possibilities, in progress."
        description="Every application is a step forward. Keep track of what comes next."
      />
      <div className="filter-pills">
        {['Active', 'All', 'Offers', 'Rejected'].map((f) => (
          <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="application-list">
        {apps.map((a) => {
          const archivedDrive = data.drives.find(
            (d) => (d.opportunityId || d.id) === a.opportunityId,
          );
          const job =
            data.opportunities.find((j) => j.id === a.opportunityId) ||
            (archivedDrive ? driveOpportunity(archivedDrive) : undefined);
          if (!job) return null;
          return (
            <div className="panel" key={a.id}>
              <div className="panel-header">
                <div className="application-company">
                  <span className={`company-logo ${job.color}`}>{job.company[0]}</span>
                  <div>
                    <h3>{job.role}</h3>
                    <p>
                      {job.company} · Applied {formatDate(a.date)}
                    </p>
                  </div>
                </div>
                <Badge kind="verified">{a.stage}</Badge>
              </div>
              <div className="application-pipeline">
                {stages.map((s, i) => (
                  <div key={s} className={i <= stages.indexOf(a.stage) ? 'reached' : ''}>
                    <span>{i < stages.indexOf(a.stage) ? <Check size={13} /> : i + 1}</span>
                    <b>{s}</b>
                  </div>
                ))}
              </div>
              <Link
                className="text-link"
                href={
                  role === 'student'
                    ? `/student/opportunities/${job.id}`
                    : `/${role}/drives/${job.driveId}`
                }
              >
                View campus drive <ArrowUpRight size={15} />
              </Link>
              {role !== 'student' && (
                <div className="hero-buttons">
                  <Button
                    kind="outline"
                    disabled={['Offer', 'Rejected'].includes(a.stage)}
                    onClick={async () => {
                      try {
                        await applicationService.advance(a.id);
                        refresh();
                        notify('Application moved to the next placement stage.');
                      } catch (e) {
                        notify((e as Error).message);
                      }
                    }}
                  >
                    Advance to {stages[stages.indexOf(a.stage) + 1] || 'next stage'}
                  </Button>
                  <Button
                    kind="outline"
                    disabled={['Offer', 'Rejected'].includes(a.stage)}
                    onClick={async () => {
                      await applicationService.reject(a.id);
                      refresh();
                      notify('Application marked not selected.');
                    }}
                  >
                    Mark not selected
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!apps.length && (
        <EmptyState
          title="Your next opportunity is waiting."
          description="Apply to a role and follow its journey here."
          action={
            <Link className="button dark" href="/student/opportunities">
              Explore opportunities
            </Link>
          }
        />
      )}
    </>
  );
}
export function OffersPage({ data, refresh, notify, role = 'student' }: Props) {
  const [pending, setPending] = useState<{ id: string; status: string } | null>(null);
  const [creating, setCreating] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="YOU’VE WORKED FOR THIS"
        title="A new chapter, offered."
        description="Review offers and follow the next step in the placement journey."
        action={
          role === 'recruiter' && (
            <Button onClick={() => setCreating(true)}>
              Create offer <Gift size={16} />
            </Button>
          )
        }
      />
      <div className="two-columns">
        {data.offers.map((o) => (
          <section key={o.id} className="panel offer-card sage">
            <div className="panel-header">
              <span className="result-symbol">
                <Gift size={29} />
              </span>
              <Badge>
                {o.kind || 'Full-time'} · {o.status}
              </Badge>
            </div>
            <h2>{o.company}</h2>
            <h3>{o.role}</h3>
            <div className="offer-ctc">{o.ctc}</div>
            <div className="detail-list">
              <span>
                Offer date<b>{formatDate(o.date)}</b>
              </span>
              <span>
                Joining date<b>{formatDate(o.joining)}</b>
              </span>
            </div>
            {['Received', 'Deferred'].includes(o.status) && role === 'student' ? (
              <div className="hero-buttons">
                <Button onClick={() => setPending({ id: o.id, status: 'Accepted' })}>
                  Accept offer <Check size={16} />
                </Button>
                <Button kind="outline" onClick={() => setPending({ id: o.id, status: 'Declined' })}>
                  Decline
                </Button>
                <Button
                  kind="outline"
                  disabled={o.status === 'Deferred'}
                  onClick={() => setPending({ id: o.id, status: 'Deferred' })}
                >
                  Defer
                </Button>
              </div>
            ) : (
              <p>
                <CircleCheck size={16} />{' '}
                {role === 'student'
                  ? 'Your response has been recorded.'
                  : `Offer tracking · ${o.status}`}
              </p>
            )}
            {o.status === 'Accepted' && role !== 'student' && (
              <Button
                kind="outline"
                onClick={async () => {
                  await offerService.respond(o.id, 'Joined');
                  refresh();
                  notify('Joining recorded.');
                }}
              >
                Mark joined <Check size={16} />
              </Button>
            )}
            {o.status === 'Accepted' && role === 'student' && (
              <Button kind="outline" onClick={() => setPending({ id: o.id, status: 'Withdrawn' })}>
                Withdraw acceptance
              </Button>
            )}
            {role !== 'recruiter' && ['Received', 'Accepted', 'Deferred'].includes(o.status) && (
              <Link className="text-link" href={`/${role}/documents`}>
                Placement documentation <ArrowUpRight size={15} />
              </Link>
            )}
          </section>
        ))}
      </div>
      {!data.offers.length && (
        <EmptyState
          title="Good things are in progress."
          description="Your offers will appear here after your interviews."
        />
      )}
      {creating && (
        <Modal title="Offer a new possibility." onClose={() => setCreating(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await offerService.create({
                company: String(f.get('company')),
                role: String(f.get('role')),
                ctc: String(f.get('ctc')),
                date: new Date().toISOString().slice(0, 10),
                joining: String(f.get('joining')),
                kind: String(f.get('kind')) as 'Full-time' | 'PPO' | 'Internship conversion',
              });
              refresh();
              setCreating(false);
              notify('Offer created and student notified.');
            }}
          >
            <FormField label="Candidate">
              <select>
                <option>
                  {data.student.name} · {data.student.id}
                </option>
              </select>
            </FormField>
            <FormField label="Company">
              <input name="company" required defaultValue="Razorpay" />
            </FormField>
            <FormField label="Role">
              <input name="role" required placeholder="Frontend Engineer" />
            </FormField>
            <FormField label="Compensation">
              <input name="ctc" required placeholder="₹14 LPA" />
            </FormField>
            <FormField label="Joining date">
              <input name="joining" required type="date" min="2026-10-02" />
            </FormField>
            <FormField label="Offer type">
              <select name="kind">
                <option>Full-time</option>
                <option>PPO</option>
                <option>Internship conversion</option>
              </select>
            </FormField>
            <p className="muted">Local preview only. No real offer letter is issued.</p>
            <Button type="submit">
              Create offer <Check size={16} />
            </Button>
          </form>
        </Modal>
      )}
      {pending && (
        <Modal
          title={`${pending.status === 'Accepted' ? 'Accept' : pending.status === 'Declined' ? 'Decline' : pending.status === 'Withdrawn' ? 'Withdraw acceptance of' : 'Defer'} this offer?`}
          onClose={() => setPending(null)}
        >
          <p>
            This records your offer response. You can review the company and compensation before
            deciding.
          </p>
          <Button
            onClick={async () => {
              await offerService.respond(pending.id, pending.status);
              refresh();
              setPending(null);
              notify('Your offer response has been recorded.');
            }}
          >
            Confirm response <Check size={16} />
          </Button>
        </Modal>
      )}
    </>
  );
}
