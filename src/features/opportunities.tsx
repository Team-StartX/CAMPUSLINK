'use client';
import { JobInformation, RecruitmentPanel } from './recruitment';
import { recruitmentService } from '@/services/recruitment.service';
import { AnalysisSource } from '@/components/external-analysis-setting';
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
import { applicationService, matchingService, offerService } from '@/services/platform.service';
import { WorkspaceData, Role } from '@/types';
import type { MlAnnotation } from '@/types/ml';
import { checkEligibility, driveOpportunity } from '@/utils/placement';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowUpRight, Check, CircleCheck, Gift, Search, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { OpportunityCard } from './student-dashboard';
type Props = {
  data: WorkspaceData;
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
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [error, setError] = useState('');
  const job = data.opportunities.find((j) => j.id === id);
  const drive = data.drives.find((d) => d.id === job?.driveId);
  const interestQuery = useQuery({
    queryKey: ['interest', drive?.id],
    queryFn: () => recruitmentService.overview(drive!.id),
    enabled: !!drive && drive.workflowVersion === 2,
  });
  const interested = interestQuery.data?.interest === 'Interested';
  const showInterest = async (value: string) => {
    setBusy(true);
    setError('');
    try {
      await recruitmentService.interest(drive!.id, value);
      await interestQuery.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const { data: match } = useQuery<
    Awaited<ReturnType<typeof matchingService.getMatchExplanation>> & MlAnnotation
  >({
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
            <Button
              disabled={
                busy ||
                applied ||
                (drive?.workflowVersion === 2 && !interested) ||
                drive?.status !== 'ACTIVE'
              }
              onClick={() => setConfirm(true)}
            >
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
              {drive && (
                <Link className="button outline" href={`/student/company/${drive.id}`}>
                  View company page
                </Link>
              )}
              <Button kind="outline" onClick={() => setCompanyOpen(true)}>
                {job.company} · Company details
              </Button>
              {drive && <JobInformation drive={drive} student />}
              {drive?.workflowVersion === 2 && !applied && (
                <div className="hero-buttons">
                  <Button disabled={busy} onClick={() => void showInterest('Interested')}>
                    {interested ? 'Interested ✓' : 'Interested'}
                  </Button>
                  <Button
                    kind="outline"
                    disabled={busy}
                    onClick={() => void showInterest('Not Interested')}
                  >
                    Not Interested
                  </Button>
                </div>
              )}
              {error && <p role="alert">{error}</p>}
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
                <Badge>{'Evidence-based fit'}</Badge>
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
                {
                  'Computed from eligibility, skills, academics and recorded evidence. Placement teams make selection decisions.'
                }
              </small>
            </section>
            <section className="panel">
              {match?.ml && <AnalysisSource status={match.ml.status} />}
              {match?.lexicalMatch && (
                <div>
                  <h3>Keyword relevance · {match.lexicalMatch.relevanceScore}%</h3>
                  <p>
                    Matched skills:{' '}
                    {match.lexicalMatch.matchedSkills.join(', ') || 'None identified'}
                  </p>
                  <p>Skill gaps: {match.lexicalMatch.skillGaps.join(', ') || 'None identified'}</p>
                  <small>
                    TF-IDF keyword guidance; this does not change eligibility or the evidence-based
                    fit score.
                  </small>
                </div>
              )}
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
        {drive?.workflowVersion === 2 && (
          <RecruitmentPanel drive={drive} role="student" refresh={refresh} />
        )}
        {companyOpen && drive && (
          <Modal title={job.company} onClose={() => setCompanyOpen(false)}>
            <p>
              {drive.companyDetails?.description || 'Company description has not been provided.'}
            </p>
            <p>
              {drive.companyDetails?.industry} · {drive.companyDetails?.headquarters} ·{' '}
              {drive.companyDetails?.size}
            </p>
            {drive.companyDetails?.website && /^https:\/\//.test(drive.companyDetails.website) && (
              <a href={drive.companyDetails.website}>Company website</a>
            )}
            <h3>Active opportunities</h3>
            {data.opportunities
              .filter((o) => o.company === job.company)
              .map((o) => (
                <p key={o.id}>
                  <Link href={`/student/opportunities/${o.id}`}>{o.role}</Link>
                </p>
              ))}
          </Modal>
        )}
        {confirm && (
          <Modal title="Take the next step." onClose={() => setConfirm(false)}>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setBusy(true);
                  if (drive?.workflowVersion === 2) {
                    await recruitmentService.apply(
                      drive.id,
                      agree,
                      String(new FormData(e.currentTarget).get('resumeId')),
                    );
                    await interestQuery.refetch();
                  } else await applicationService.apply(job.id);
                  refresh();
                  setConfirm(false);
                  notify(`Application submitted to ${job.company}. Good luck!`);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <p>
                Profile completeness:{' '}
                {data.student.profileCompletion ??
                  Math.round(
                    ([
                      data.student.bio,
                      data.student.course,
                      data.student.year,
                      data.student.skills.length,
                      data.student.projects.length,
                      data.documents.some((d) => d.type === 'Resume'),
                    ].filter(Boolean).length /
                      6) *
                      100,
                  )}
                %
              </p>
              <p>
                Resume:{' '}
                {data.documents.find((d) => d.type === 'Resume')?.name ||
                  'Upload a resume in Documents'}
              </p>
              <p>Required documents: {drive?.requiredDocuments || 'Resume'}</p>
              <p>
                Eligibility:{' '}
                {drive && checkEligibility(data.student, drive).passed ? 'Passed' : 'Not eligible'}
              </p>
              <p>Recruitment rounds: {drive?.rounds?.map((r) => r.name).join(' → ')}</p>
              <label className="checkbox-label">
                <input
                  required
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />{' '}
                I have reviewed the job details and agree to participate in the recruitment process.
              </label>
              <h3>
                {job.role} · {job.company}
              </h3>
              <p>
                Your profile and recorded resume will be available to the recruiter for this
                application.
              </p>
              <FormField label="Resume">
                <select required name="resumeId">
                  <option value="">Choose a resume</option>
                  {data.documents
                    .filter((d) => d.type === 'Resume')
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </FormField>
              <label className="checkbox-label">
                <input type="checkbox" required /> I confirm that my information is accurate.
              </label>
              {error && <p className="field-error">{error}</p>}
              <Button type="submit" disabled={busy || !agree}>
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
        {jobs.length} opportunities · {'Evidence-based fit estimates'}
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
      (filter === 'Active' && !['Offer', 'Selected', 'Rejected', 'Absent'].includes(a.stage)) ||
      (filter === 'Offers' && ['Offer', 'Selected'].includes(a.stage)) ||
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
              <p>
                Current round:{' '}
                {archivedDrive?.rounds?.find((r) => r.id === a.currentRoundId)?.name || a.stage}
              </p>
              <div className="application-pipeline">
                {(archivedDrive?.workflowVersion === 2
                  ? ['Applied', ...(archivedDrive.rounds || []).map((r) => r.name), 'Selected']
                  : stages
                ).map((s, i, pipeline) => (
                  <div key={s} className={i <= pipeline.indexOf(a.stage) ? 'reached' : ''}>
                    <span>{i < pipeline.indexOf(a.stage) ? <Check size={13} /> : i + 1}</span>
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
              {role !== 'student' && archivedDrive?.workflowVersion !== 2 && (
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
  const [pending, setPending] = useState<{
    id: string;
    status: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const [offerError, setOfferError] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const runOffer = async (fn: () => Promise<unknown>) => {
    setOfferBusy(true);
    setOfferError('');
    try {
      await fn();
      refresh();
      return true;
    } catch (e) {
      setOfferError((e as Error).message);
      return false;
    } finally {
      setOfferBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="YOU’VE WORKED FOR THIS"
        title="A new chapter, offered."
        description="Review offers and follow the next step in the placement journey."
        action={
          role === 'recruiter' && (
            <Button
              disabled={!data.applications.some((a) => ['Selected', 'Offer'].includes(a.stage))}
              onClick={() => setCreating(true)}
            >
              Create offer <Gift size={16} />
            </Button>
          )
        }
      />
      {offerError && (
        <p className="field-error" role="alert">
          {offerError}
        </p>
      )}
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
            <p>
              Location: {o.location || 'Not specified'} · Acceptance deadline:{' '}
              {o.deadline || 'Not specified'}
            </p>
            {o.letterUrl && /^https:\/\//.test(o.letterUrl) && (
              <a
                className="button outline"
                href={o.letterUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (role === 'student' && o.status === 'Offer Sent')
                    void runOffer(() => offerService.respond(o.id, 'Viewed'));
                }}
              >
                View offer letter
              </a>
            )}
            <div className="detail-list">
              <span>
                Offer date<b>{formatDate(o.date)}</b>
              </span>
              <span>
                Joining date<b>{formatDate(o.joining)}</b>
              </span>
            </div>
            {['Offer Sent', 'Viewed', 'Received', 'Deferred'].includes(o.status) &&
            role === 'student' ? (
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
                  if (await runOffer(() => offerService.respond(o.id, 'Joined')))
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
              const success = await runOffer(() =>
                offerService.create({
                  company: String(f.get('company')),
                  role: String(f.get('role')),
                  ctc: String(f.get('ctc')),
                  date: new Date().toISOString().slice(0, 10),
                  joining: String(f.get('joining')),
                  applicationId: String(f.get('applicationId')),
                  deadline: String(f.get('deadline')),
                  location: String(f.get('location')),
                  letterUrl: String(f.get('letterUrl')),
                  kind: String(f.get('kind')) as 'Full-time' | 'PPO' | 'Internship conversion',
                }),
              );
              if (success) {
                setCreating(false);
                notify('Offer created and student notified.');
              }
            }}
          >
            <FormField label="Candidate">
              <select>
                <option>
                  {data.student.name} · {data.student.id}
                </option>
              </select>
            </FormField>
            <FormField label="Selected application">
              <select required name="applicationId">
                {data.applications
                  .filter((a) => ['Selected', 'Offer'].includes(a.stage))
                  .map((a) => {
                    const d = data.drives.find(
                      (d) => (d.opportunityId || d.id) === a.opportunityId,
                    );
                    return (
                      <option key={a.id} value={a.id}>
                        {d?.company} · {d?.role}
                      </option>
                    );
                  })}
              </select>
            </FormField>
            <FormField label="Acceptance deadline">
              <input name="deadline" required type="date" />
            </FormField>
            <FormField label="Job location">
              <input name="location" required />
            </FormField>
            <FormField label="Offer letter (HTTPS link)">
              <input name="letterUrl" type="url" pattern="https://.*" required />
            </FormField>
            <FormField label="Company">
              <input name="company" required />
            </FormField>
            <FormField label="Role">
              <input name="role" required placeholder="Frontend Engineer" />
            </FormField>
            <FormField label="Compensation">
              <input name="ctc" required placeholder="₹14 LPA" />
            </FormField>
            <FormField label="Joining date">
              <input name="joining" required type="date" />
            </FormField>
            <FormField label="Offer type">
              <select name="kind">
                <option>Full-time</option>
                <option>PPO</option>
                <option>Internship conversion</option>
              </select>
            </FormField>

            {offerError && <p role="alert">{offerError}</p>}
            <Button type="submit" disabled={offerBusy}>
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
          {offerError && <p role="alert">{offerError}</p>}
          <Button
            disabled={offerBusy}
            onClick={async () => {
              if (await runOffer(() => offerService.respond(pending.id, pending.status))) {
                setPending(null);
                notify('Your offer response has been recorded.');
              }
            }}
          >
            Confirm response <Check size={16} />
          </Button>
        </Modal>
      )}
    </>
  );
}
