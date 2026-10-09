'use client';
import { JobInformation, RecruitmentPanel, CampusRelationships } from './recruitment';
import { roundTypes } from '@/types/recruitment';
import { recruitmentService } from '@/services/recruitment.service';
import { useSession } from '@/store/session';
import { ContestProgress } from '@/components/contest-progress';
import { SkillRequirementsInput } from '@/components/skill-requirements-input';
import { CampusEligibilityPreview } from '@/components/campus-eligibility-preview';
import {
  Badge,
  Button,
  EmptyState,
  FormField,
  PageHeader,
  Progress,
  formatDate,
} from '@/components/ui';
import {
  driveRequestSchema,
  driveService,
  scheduleConflicts,
  scheduleSchema,
} from '@/services/drive.service';
import { aiService } from '@/services/platform.service';
import { skillNames } from '@/utils/skills';
import { WorkspaceData, Drive, DriveSchedule, DriveStatus, Role } from '@/types';
import { contestAchievements } from '@/utils/contest-achievements';
import { checkEligibility, driveStatuses, statusLabel, scheduleFinalized } from '@/utils/placement';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
type Props = {
  data: WorkspaceData;
  role: Role;
  id?: string;
  refresh: () => void;
  notify: (s: string) => void;
};
export function CampusDiscovery({ data }: Props) {
  const [search, setSearch] = useState('');
  const list = (data.campuses || []).filter((c) =>
    `${c.name} ${c.location} ${c.branches}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="PHYSICAL ON-CAMPUS RECRUITMENT"
        title="Meet your next campus."
        description="Explore campus cohorts, then request a visit through the placement cell."
      />
      <CampusRelationships role="recruiter" data={data} />
      <label className="search-input">
        <Search size={18} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search campus, city, or branch…"
        />
      </label>
      <div className="two-columns">
        {list.map((c) => (
          <section className="panel" key={c.id}>
            <div className="panel-header">
              <Building2 />
              <Badge>{'Registered campus'}</Badge>
            </div>
            <h2>{c.name}</h2>
            <p>
              <MapPin size={15} /> {c.location}
            </p>
            <div className="job-chips">
              {c.branches.map((b) => (
                <Badge key={b}>{b}</Badge>
              ))}
            </div>
            <p>
              {c.studentPool.toLocaleString()} students · {c.courses.join(' / ')}
            </p>
            <Link className="button dark" href={`/recruiter/drives/request?campus=${c.id}`}>
              Request campus drive <ArrowUpRight size={16} />
            </Link>
          </section>
        ))}
      </div>
      {!list.length && (
        <EmptyState
          title="No campuses match your search."
          description="Try a city or another branch."
        />
      )}
    </>
  );
}
export function DrivesPage(
  props: Props & {
    requestsOnly?: boolean;
  },
) {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const { data, role, id, requestsOnly } = props;
  if (id === 'request' || id === 'create') return <DriveRequestWizard {...props} />;
  const drive = data.drives.find((d) => d.id === id);
  if (id && !drive)
    return (
      <EmptyState
        title="Drive request not found."
        action={<Link href={`/${role}/drives`}>View drives</Link>}
      />
    );
  if (drive) return <DriveDetail key={drive.id} {...props} drive={drive} />;
  const requests: DriveStatus[] = [
    'SUBMITTED',
    'UNDER_REVIEW',
    'CHANGES_REQUESTED',
    'SCHEDULING',
    'AWAITING_RECRUITER_CONFIRMATION',
    'CONFIRMED',
  ];
  const list = data.drives.filter(
    (d) =>
      (!requestsOnly || requests.includes(d.status)) &&
      (filter === 'All' || d.status === filter) &&
      `${d.company} ${d.role} ${d.campus}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <PageHeader
        eyebrow="CAMPUS VISITS, COORDINATED"
        title={requestsOnly ? 'Campus approval requests.' : 'Every drive. Every next step.'}
        description="Request → campus review → scheduling → recruiter confirmation → activation → physical campus visit."
        action={
          role === 'recruiter' && (
            <Link className="button dark" href="/recruiter/drives/request">
              <Plus size={16} /> Request campus drive
            </Link>
          )
        }
      />
      {requestsOnly && role === 'campus' && (
        <>
          <CampusRelationships role="campus" data={data} />
          <h2>Drive approval requests</h2>
          <p>After campus access is accepted, recruiters can submit their drive for review here.</p>
        </>
      )}
      <div className="info-banner sage">
        <ShieldCheck />
        <div>
          <b>Campus approval comes first.</b>
          <p>
            After activation, all college students receive the schedule and their eligibility
            status, including reasons when they are not eligible.
          </p>
        </div>
      </div>
      <div className="filter-bar">
        <label className="search-input">
          <Search size={18} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, role, or campus…"
          />
        </label>
        <select
          aria-label="Filter drive status"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option>All</option>
          {driveStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
      </div>
      <div className="three-columns">
        {list.map((d) => (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="panel drive-card"
            key={d.id}
          >
            <div className="panel-header">
              <span className="company-logo lavender">{d.company[0]}</span>
              <Badge>{statusLabel(d.status)}</Badge>
            </div>
            <h3>{d.company}</h3>
            <p>{d.role}</p>
            <p className="muted">
              <MapPin size={14} /> {d.campus}
            </p>
            <div className="detail-list">
              <span>
                Campus visit<b>{d.schedule ? formatDate(d.schedule.date) : 'To be scheduled'}</b>
              </span>
              <span>
                CTC<b>₹{d.ctc}</b>
              </span>
              <span>
                Openings / applicants
                <b>
                  {d.vacancies} / {d.applicants}
                </b>
              </span>
            </div>
            <Link
              className="button outline"
              href={`/${role}/${requestsOnly ? 'drive-requests' : 'drives'}/${d.id}`}
            >
              View {requestsOnly ? 'request' : 'drive'} <ArrowUpRight size={16} />
            </Link>
            {role === 'campus' && d.status === 'SCHEDULING' && (
              <Link className="button dark" href={`/campus/drives/${d.id}#placement-schedule`}>
                <CalendarDays size={16} /> Schedule placement
              </Link>
            )}
          </motion.section>
        ))}
      </div>
      {!list.length && (
        <EmptyState
          title="No submitted drive requests in this view."
          description="Try another status or clear your search."
        />
      )}
    </>
  );
}
function DriveRequestWizard({
  data,
  refresh,
  notify,
  existing,
}: Props & {
  existing?: Drive;
}) {
  const router = useRouter();
  const user = useSession((s) => s.user);
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [saved, setSaved] = useState<{ id: string; draft: boolean } | null>(null);
  const access = useQuery({
    queryKey: ['relationships', 'recruiter', user?.id],
    queryFn: recruitmentService.relationships,
    enabled: Boolean(user?.id),
    refetchInterval: 15000,
  });
  const [values, setValues] = useState<Drive>(() => {
    const campusId =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('campus')
        : null;
    const campus = data.campuses?.find((c) => c.id === campusId);
    return (
      existing ||
      driveService.getRequestDefaults({
        company: user?.organization || '',
        role: '',
        description: '',
        campusId: campusId || '',
        campus: campus?.name || '',
        courses: campus?.courses[0] || '',
        branches: campus?.branches.join(', ') || '',
        ctc: '',
        skills: '',
        preferredDates: [],
        deadline: '',
      })
    );
  });
  const set = <K extends keyof Drive>(key: K, value: Drive[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const selectedCampus = data.campuses?.find((campus) => campus.id === values.campusId);
  const toggleCriterion = (key: 'courses' | 'branches', name: string, checked: boolean) => {
    const chosen =
      values[key]
        ?.split(',')
        .map((value) => value.trim())
        .filter(Boolean) || [];
    set(
      key,
      (checked ? [...new Set([...chosen, name])] : chosen.filter((value) => value !== name)).join(
        ', ',
      ),
    );
  };
  const campusAccess = access.data?.find((r) => r.campusId === values.campusId);
  const canSave = campusAccess?.status === 'Accepted';
  const stageNames = [
    'Select campus',
    'Job information',
    'Eligibility & skills',
    'Selection rounds',
    'Campus visit',
    'Preview & submit',
  ];
  const fields: (keyof z.infer<typeof driveRequestSchema>)[][] = [
    ['campusId'],
    ['company', 'role', 'location', 'ctc', 'description', 'vacancies'],
    ['courses', 'branches', 'graduationYear', 'cgpa', 'allowedBacklogs', 'skills'],
    ['rounds'],
    ['preferredDates', 'deadline', 'teamSize', 'labs', 'rooms', 'systems'],
  ];
  const validateStep = () => {
    const parsed = driveRequestSchema.safeParse({
      ...values,
      preferredDates: values.preferredDates?.filter(Boolean),
    });
    if (!parsed.success) {
      const issues = parsed.error.issues.filter(
        (i) =>
          step === 5 ||
          fields[step]?.includes(i.path[0] as keyof z.infer<typeof driveRequestSchema>),
      );
      if (issues.length) {
        setError(issues[0].message);
        return false;
      }
    }
    if (
      step >= 4 &&
      values.preferredDates?.filter(Boolean).some((date) => date <= (values.deadline || ''))
    ) {
      setError('Each preferred visit date must be after the application deadline.');
      return false;
    }
    setError('');
    return true;
  };
  const save = async (draft: boolean) => {
    if (saving.current || saved) return;
    if (!canSave) {
      setError('Request campus access and wait for acceptance before submitting a drive.');
      return;
    }
    if (!draft && !validateStep()) return;
    saving.current = true;
    setBusy(true);
    setError('');
    let savedId = existing?.id || '';
    try {
      const input = { ...values, preferredDates: values.preferredDates?.filter(Boolean) };
      if (existing) {
        const patch = { ...input } as Partial<Drive> & { recruiterId?: string };
        for (const key of [
          'id',
          'status',
          'applicants',
          'schedule',
          'audit',
          'opportunityId',
          'campusId',
          'campus',
          'recruiterId',
          'workflowVersion',
          'companyDetails',
          'eligibilityApprovals',
          'requestedSlot',
        ] as const)
          delete patch[key];
        await driveService.updateDriveRequest(existing.id, patch);
        const result = await driveService.transition(existing.id, 'resubmit', 'recruiter');
        queryClient.setQueryData(['platform', user?.id], result);
      } else {
        const result = await driveService.createDriveRequest(input, draft);
        savedId = result.createdDriveId;
        queryClient.setQueryData(['platform', user?.id], result);
      }
      setSaved({ id: savedId, draft });
    } catch (e) {
      setError(e instanceof z.ZodError ? e.issues[0].message : (e as Error).message);
      return;
    } finally {
      saving.current = false;
      setBusy(false);
    }
    // Refreshing the list is independent of the successful mutation.
    void Promise.resolve()
      .then(refresh)
      .catch(() => undefined);
    notify(
      draft ? 'Draft saved. Students cannot see it.' : 'Request submitted. Awaiting campus review.',
    );
    if (savedId) router.push(`/recruiter/drives/${savedId}`);
  };
  const roundSet = (
    id: string,
    key: keyof import('@/types').DriveRound,
    value: string | number | boolean | undefined,
  ) =>
    set(
      'rounds',
      values.rounds?.map((r) => (r.id === id ? { ...r, [key]: value } : r)),
    );
  return (
    <>
      <PageHeader
        eyebrow="REQUEST AN ON-CAMPUS VISIT"
        title={existing ? 'Refine your drive request.' : 'Bring opportunity to campus.'}
        description="The placement cell reviews your requirements and coordinates the visit. This request does not publish a job to students."
      />
      <div className="drive-steps">
        {stageNames.map((s, i) => (
          <div key={s} className={step === i ? 'current' : step > i ? 'done' : ''}>
            <span>{step > i ? <Check size={13} /> : i + 1}</span>
            <b>{s}</b>
          </div>
        ))}
      </div>
      <form
        className="panel drive-form form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (saving.current || saved) return;
          if (step < 5) {
            if (validateStep()) setStep(step + 1);
          } else void save(false);
        }}
      >
        <Badge>STEP {step + 1} OF 6</Badge>
        <h2>{stageNames[step]}</h2>
        {step === 0 && (
          <>
            <label className="search-input">
              <Search size={18} />
              <input
                placeholder="Search campus or city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="campus-options">
              {data.campuses
                ?.filter((c) =>
                  `${c.name} ${c.location}`.toLowerCase().includes(search.toLowerCase()),
                )
                .map((c) => (
                  <button
                    type="button"
                    aria-pressed={values.campusId === c.id}
                    className={values.campusId === c.id ? 'selected' : ''}
                    key={c.id}
                    onClick={() =>
                      setValues((v) => ({
                        ...v,
                        campusId: c.id,
                        campus: c.name,
                        courses: c.courses[0],
                        branches: c.branches.join(', '),
                      }))
                    }
                  >
                    <Building2 size={21} />
                    <div>
                      <b>{c.name}</b>
                      <small>
                        {c.location} · {c.studentPool} students
                      </small>
                      <span>
                        {c.courses.join(' / ')} · {c.branches.join(', ')}
                      </span>
                    </div>
                    {values.campusId === c.id && <Check size={18} />}
                  </button>
                ))}
            </div>
            {values.campusId && (
              <CampusRelationships role="recruiter" data={data} campusId={values.campusId} />
            )}
          </>
        )}
        {step === 1 && (
          <>
            <FormField label="Work mode">
              <select
                value={values.workMode || 'On-site'}
                onChange={(e) => set('workMode', e.target.value as Drive['workMode'])}
              >
                <option>On-site</option>
                <option>Hybrid</option>
                <option>Remote</option>
              </select>
            </FormField>
            {(
              [
                'responsibilities',
                'stipend',
                'bond',
                'joiningDate',
                'requiredDocuments',
                'additionalEligibility',
              ] as const
            ).map((key) => (
              <FormField
                key={key}
                label={
                  {
                    responsibilities: 'Roles and responsibilities',
                    stipend: 'Internship stipend (if applicable)',
                    bond: 'Bond / service agreement',
                    joiningDate: 'Expected joining date',
                    requiredDocuments: 'Required document types (comma separated)',
                    additionalEligibility: 'Additional eligibility rules (campus must verify)',
                  }[key]
                }
              >
                <input
                  value={values[key] || ''}
                  type={key === 'joiningDate' ? 'date' : 'text'}
                  onChange={(e) => set(key, e.target.value)}
                />
              </FormField>
            ))}
            <div className="form-row">
              <FormField label="Company">
                <input
                  required
                  value={values.company}
                  onChange={(e) => set('company', e.target.value)}
                />
              </FormField>
              <FormField label="Role">
                <input
                  required
                  value={values.role}
                  onChange={(e) => set('role', e.target.value)}
                  placeholder="Software Engineer"
                />
              </FormField>
            </div>
            <div className="form-row">
              <FormField label="Department">
                <input
                  value={values.department}
                  onChange={(e) => set('department', e.target.value)}
                />
              </FormField>
              <FormField label="Employment type">
                <select value={values.workType} onChange={(e) => set('workType', e.target.value)}>
                  <option>Full-time</option>
                  <option>Internship</option>
                </select>
              </FormField>
            </div>
            <div className="form-row">
              <FormField label="CTC">
                <input
                  required
                  value={values.ctc}
                  onChange={(e) => set('ctc', e.target.value)}
                  placeholder="10–14 LPA"
                />
              </FormField>
              <FormField label="Location after hiring">
                <input
                  required
                  value={values.location}
                  onChange={(e) => set('location', e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Openings">
              <input
                required
                type="number"
                min={1}
                max={500}
                value={values.vacancies}
                onChange={(e) => set('vacancies', Number(e.target.value))}
              />
            </FormField>
            <FormField label="Job description">
              <textarea
                required
                rows={5}
                value={values.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </FormField>
            <Button
              kind="outline"
              disabled={busy || values.description.trim().length < 20}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const parsed = await aiService.parseJobDescription(values.description);
                  if (!parsed.skills.length) {
                    setError(
                      'No skill names were found. Enter required skills in the Eligibility & skills step.',
                    );
                    return;
                  }
                  set(
                    'skills',
                    skillNames([values.skills, ...parsed.skills].join(', ')).join(', '),
                  );
                  notify('Skills suggested. Review the requirements before continuing.');
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Extract skills
            </Button>
          </>
        )}
        {step === 2 && (
          <>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={values.requireSkills || false}
                onChange={(e) => set('requireSkills', e.target.checked)}
              />{' '}
              Require all listed skills for eligibility
            </label>
            <div className="info-banner yellow">
              <ShieldCheck />
              <p>
                These are hard eligibility rules. Matching runs only for students who pass every
                rule.
              </p>
            </div>
            <div className="form-row">
              <FormField label="Eligible courses">
                {(selectedCampus?.courses || []).map((course) => (
                  <label className="checkbox-label" key={course}>
                    <input
                      type="checkbox"
                      checked={values.courses
                        ?.split(',')
                        .map((value) => value.trim())
                        .includes(course)}
                      onChange={(e) => toggleCriterion('courses', course, e.target.checked)}
                    />
                    {course}
                  </label>
                ))}
                <p className="muted">Select eligible courses offered by this college.</p>
              </FormField>
              <FormField label="Eligible branches">
                {(selectedCampus?.branches || []).map((branch) => (
                  <label className="checkbox-label" key={branch}>
                    <input
                      type="checkbox"
                      checked={values.branches
                        ?.split(',')
                        .map((value) => value.trim())
                        .includes(branch)}
                      onChange={(e) => toggleCriterion('branches', branch, e.target.checked)}
                    />
                    {branch}
                  </label>
                ))}
                <p className="muted">Select eligible branches offered by this college.</p>
              </FormField>
            </div>
            <div className="form-row">
              <FormField label="Graduation years">
                <input
                  required
                  value={values.graduationYear}
                  onChange={(e) => set('graduationYear', e.target.value)}
                  placeholder="2027, 2028"
                />
              </FormField>
              <FormField label="Minimum CGPA">
                <input
                  required
                  type="number"
                  step="0.1"
                  min={0}
                  max={10}
                  value={values.cgpa}
                  onChange={(e) => set('cgpa', Number(e.target.value))}
                />
              </FormField>
            </div>
            <FormField label="Maximum active backlogs">
              <input
                required
                type="number"
                min={0}
                max={10}
                value={values.allowedBacklogs}
                onChange={(e) => {
                  set('allowedBacklogs', Number(e.target.value));
                  set('backlogRules', `Up to ${e.target.value} active backlogs`);
                }}
              />
            </FormField>
            <FormField label="Required skills">
              <SkillRequirementsInput
                required
                value={values.skills}
                onChange={(value) => set('skills', value)}
              />
            </FormField>
            <FormField label="Preferred skills">
              <SkillRequirementsInput
                value={values.preferredSkills || ''}
                onChange={(value) => set('preferredSkills', value)}
              />
            </FormField>
            <p className="muted">
              Required skills affect eligibility when the requirement checkbox is selected.
              Preferred skills improve the fit score without excluding a student.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <p>
              Define the recruitment process for this job. An assignment is optional and can only be
              added inside an Assignment round.
            </p>
            <p>Build the sequence your team will conduct during the campus visit.</p>
            {values.rounds?.map((r, i) => (
              <div className="round-editor" key={r.id}>
                <b>{String(i + 1).padStart(2, '0')}</b>
                <div>
                  <FormField label="Round name">
                    <input
                      required
                      value={r.name}
                      onChange={(e) => roundSet(r.id, 'name', e.target.value)}
                      list="round-types"
                    />
                  </FormField>
                  <div className="form-row">
                    <FormField label="Duration (minutes)">
                      <input
                        required
                        type="number"
                        min={5}
                        max={480}
                        value={r.duration}
                        onChange={(e) => roundSet(r.id, 'duration', Number(e.target.value))}
                      />
                    </FormField>
                    <FormField label="Capacity">
                      <input
                        required
                        type="number"
                        min={1}
                        value={r.capacity}
                        onChange={(e) => roundSet(r.id, 'capacity', Number(e.target.value))}
                      />
                    </FormField>
                  </div>
                  <div className="form-row">
                    <FormField label="Round type">
                      <select
                        value={r.type || 'Custom Round'}
                        onChange={(e) => roundSet(r.id, 'type', e.target.value)}
                      >
                        {roundTypes.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Mode">
                      <select
                        value={r.mode || 'Offline'}
                        onChange={(e) => roundSet(r.id, 'mode', e.target.value)}
                      >
                        <option>Offline</option>
                        <option>Online</option>
                      </select>
                    </FormField>
                  </div>
                  <FormField label="Description">
                    <textarea
                      value={r.description || ''}
                      onChange={(e) => roundSet(r.id, 'description', e.target.value)}
                    />
                  </FormField>
                  <FormField label="Instructions">
                    <textarea
                      value={r.instructions || ''}
                      onChange={(e) => roundSet(r.id, 'instructions', e.target.value)}
                    />
                  </FormField>
                  <label>
                    <input
                      type="checkbox"
                      checked={r.elimination !== false}
                      onChange={(e) => roundSet(r.id, 'elimination', e.target.checked)}
                    />{' '}
                    Elimination round
                  </label>
                  <div className="form-row">
                    {(['maximumScore', 'passingScore'] as const).map((key) => (
                      <FormField
                        key={key}
                        label={
                          key === 'maximumScore'
                            ? 'Maximum score (optional)'
                            : 'Passing score (optional)'
                        }
                      >
                        <input
                          type="number"
                          min={0}
                          value={r[key] ?? ''}
                          onChange={(e) =>
                            roundSet(
                              r.id,
                              key,
                              e.target.value === '' ? undefined : Number(e.target.value),
                            )
                          }
                        />
                      </FormField>
                    ))}
                  </div>
                  <div className="hero-buttons">
                    <Button
                      kind="outline"
                      disabled={i === 0}
                      onClick={() => {
                        const rounds = [...(values.rounds || [])];
                        [rounds[i - 1], rounds[i]] = [rounds[i], rounds[i - 1]];
                        set('rounds', rounds);
                      }}
                    >
                      Move up
                    </Button>
                    <Button
                      kind="outline"
                      disabled={i === (values.rounds?.length || 0) - 1}
                      onClick={() => {
                        const rounds = [...(values.rounds || [])];
                        [rounds[i + 1], rounds[i]] = [rounds[i], rounds[i + 1]];
                        set('rounds', rounds);
                      }}
                    >
                      Move down
                    </Button>
                  </div>
                  <FormField label="Requirements">
                    <input
                      value={r.requirements}
                      onChange={(e) => roundSet(r.id, 'requirements', e.target.value)}
                    />
                  </FormField>
                </div>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove round ${i + 1}`}
                  onClick={() =>
                    set(
                      'rounds',
                      values.rounds?.filter((round) => round.id !== r.id),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <datalist id="round-types">
              {[
                'Pre-placement talk',
                'Aptitude assessment',
                'Coding assessment',
                'Group discussion',
                'Technical interview',
                'Managerial interview',
                'HR interview',
              ].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </datalist>
            <Button
              kind="outline"
              onClick={() =>
                set('rounds', [
                  ...(values.rounds || []),
                  {
                    id: crypto.randomUUID(),
                    name: 'Interview',
                    type: 'Technical Interview',
                    mode: 'Offline',
                    elimination: true,
                    duration: 30,
                    capacity: 30,
                    requirements: '',
                    cleared: 0,
                  },
                ])
              }
            >
              <Plus size={15} /> Add round
            </Button>
          </>
        )}
        {step === 4 && (
          <>
            <div className="three-columns">
              {[0, 1, 2].map((i) => (
                <FormField
                  key={i}
                  label={`Preferred visit date ${i + 1}${i === 0 ? ' (required)' : ''}`}
                >
                  <input
                    required={i === 0}
                    type="date"
                    value={values.preferredDates?.[i] || ''}
                    onChange={(e) => {
                      const dates = [...(values.preferredDates || [])];
                      dates[i] = e.target.value;
                      set('preferredDates', dates);
                    }}
                  />
                </FormField>
              ))}
            </div>
            <div className="form-row">
              <FormField label="Application deadline">
                <input
                  required
                  type="date"
                  value={values.deadline}
                  onChange={(e) => set('deadline', e.target.value)}
                />
              </FormField>
              <FormField label="Recruiter team size">
                <input
                  required
                  type="number"
                  min={1}
                  max={50}
                  value={values.teamSize}
                  onChange={(e) => set('teamSize', Number(e.target.value))}
                />
              </FormField>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={values.hall}
                onChange={(e) => set('hall', e.target.checked)}
              />{' '}
              Presentation hall required
            </label>
            <div className="three-columns">
              {(['labs', 'rooms', 'systems'] as const).map((key) => (
                <FormField
                  key={key}
                  label={
                    {
                      labs: 'Computer labs',
                      rooms: 'Interview rooms',
                      systems: 'Computer systems',
                    }[key]
                  }
                >
                  <input
                    required
                    type="number"
                    min={0}
                    value={values[key]}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                </FormField>
              ))}
            </div>
            <FormField label="Other requirements">
              <textarea
                value={values.otherRequirements}
                onChange={(e) => set('otherRequirements', e.target.value)}
              />
            </FormField>
          </>
        )}
        {step === 5 && (
          <>
            <JobInformation drive={values} />
            <DriveSummary drive={values} />
            <div className="info-banner sage">
              <ShieldCheck />
              <p>
                The opportunity stays hidden from students until the campus reviews, schedules,
                finalizes, and activates this drive.
              </p>
            </div>
          </>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p role="status">
            {saved.draft ? 'Draft saved.' : 'Request sent. Awaiting campus review.'}{' '}
            <Link href={`/recruiter/drives/${saved.id}`}>
              View {saved.draft ? 'draft' : 'request'}
            </Link>
          </p>
        )}
        {step === 5 && !saved && !canSave && (
          <p role="status">
            {access.isPending
              ? 'Checking campus access…'
              : campusAccess?.status === 'Pending'
                ? 'Campus access request sent. Wait for campus acceptance before submitting the drive.'
                : 'Campus access is required. Request access in the Select campus step.'}
          </p>
        )}
        <div className="wizard-actions">
          <Button
            kind="outline"
            disabled={step === 0 || busy || !!saved}
            onClick={() => {
              setError('');
              setStep(step - 1);
            }}
          >
            Back
          </Button>
          {!existing && (
            <Button
              kind="outline"
              disabled={busy || !!saved || !canSave}
              onClick={() => void save(true)}
            >
              Save draft
            </Button>
          )}
          <Button type="submit" disabled={busy || !!saved || (step === 5 && !canSave)}>
            {saved
              ? saved.draft
                ? 'Draft saved'
                : 'Request sent'
              : busy
                ? 'Saving…'
                : step === 5
                  ? existing
                    ? 'Resubmit request'
                    : 'Submit drive request'
                  : 'Continue'}{' '}
            <ArrowUpRight size={16} />
          </Button>
        </div>
      </form>
    </>
  );
}
function DriveSummary({ drive }: { drive: Drive }) {
  return (
    <div className="drive-summary">
      <div>
        <Badge>COMPANY & ROLE</Badge>
        <h3>
          {drive.company} · {drive.role}
        </h3>
        <p>
          {drive.department} · {drive.workType} · {drive.location} after hiring
        </p>
        <p>
          ₹{drive.ctc} · {drive.vacancies} openings
        </p>
        <p>{drive.description}</p>
      </div>
      <div>
        <Badge>CAMPUS & ELIGIBILITY</Badge>
        <h3>{drive.campus}</h3>
        <p>
          {drive.courses} · {drive.branches} · Graduation {drive.graduationYear}
        </p>
        <p>
          CGPA ≥ {drive.cgpa} · Active backlogs ≤ {drive.allowedBacklogs ?? 0}
        </p>
        <p>Required: {drive.skills}</p>
        <p>Preferred: {drive.preferredSkills || 'None'}</p>
      </div>
      <div>
        <Badge>SELECTION ROUNDS</Badge>
        {drive.rounds?.map((r, i) => (
          <p key={r.id}>
            <b>
              {i + 1}. {r.name}
            </b>{' '}
            · {r.duration} min · Capacity {r.capacity}
            <br />
            <small>{r.requirements}</small>
          </p>
        ))}
      </div>
      <div>
        <Badge>CAMPUS VISIT REQUIREMENTS</Badge>
        <p>Preferred: {drive.preferredDates?.filter(Boolean).map(formatDate).join(' / ')}</p>
        <p>Deadline: {drive.deadline ? formatDate(drive.deadline) : 'Not specified'}</p>
        <p>
          {drive.teamSize} recruiter team members · {drive.hall ? 'Presentation hall' : 'No hall'} ·{' '}
          {drive.labs} labs · {drive.rooms} rooms · {drive.systems} systems
        </p>
        <p>{drive.otherRequirements}</p>
      </div>
    </div>
  );
}
function DriveDetail({
  drive,
  data,
  role,
  refresh,
  notify,
}: Props & {
  drive: Drive;
}) {
  const userId = useSession((s) => s.user?.id);
  const queryClient = useQueryClient();
  const transitioning = useRef(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const run = async (action: Parameters<typeof driveService.transition>[1]) => {
    if (transitioning.current) return;
    transitioning.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await driveService.transition(drive.id, action, role, note);
      queryClient.setQueryData(['platform', userId], result);
      void Promise.resolve()
        .then(refresh)
        .catch(() => undefined);
      notify('Drive updated. The next step is ready.');
      setNote('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      transitioning.current = false;
      setBusy(false);
    }
  };
  if (editing)
    return (
      <DriveRequestWizard
        data={data}
        role={role}
        refresh={refresh}
        notify={notify}
        existing={drive}
      />
    );
  const campus = role === 'campus';
  const finalized = scheduleFinalized(drive);
  const eligibility = checkEligibility(data.student, drive);
  const milestones = [
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'SCHEDULING',
    'AWAITING_RECRUITER_CONFIRMATION',
    'CONFIRMED',
    'ACTIVE',
    'APPLICATIONS_CLOSED',
    'IN_PROGRESS',
    'COMPLETED',
  ];
  const index = milestones.indexOf(drive.status);
  return (
    <>
      <Link className="back-link" href={`/${role}/drives`}>
        ← All drives
      </Link>
      <PageHeader
        eyebrow={`${drive.company} · ON-CAMPUS DRIVE`}
        title={drive.role}
        description={`${drive.campus} · ₹${drive.ctc} · ${drive.vacancies} openings`}
        action={<Badge>{statusLabel(drive.status)}</Badge>}
      />
      <div className="drive-lifecycle" aria-label="Drive lifecycle">
        {milestones.map((m, i) => (
          <div className={i <= index ? 'reached' : ''} key={m}>
            <span>{i < index ? <Check size={12} /> : i + 1}</span>
            <small>{statusLabel(m as DriveStatus)}</small>
          </div>
        ))}
      </div>
      <JobInformation drive={drive} />
      {campus && <CampusEligibilityPreview drive={drive} />}
      {drive.workflowVersion === 2 && (
        <RecruitmentPanel drive={drive} role={role} refresh={refresh} />
      )}
      <div className="drive-detail-layout">
        <div>
          <section className="panel">
            <DriveSummary drive={drive} />
          </section>
          {drive.schedule && (
            <section className="panel sage">
              <Badge>PHYSICAL CAMPUS VISIT</Badge>
              <h2>{formatDate(drive.schedule.date)}</h2>
              <ScheduleSummary schedule={drive.schedule} />
              <p>
                {drive.status === 'AWAITING_RECRUITER_CONFIRMATION'
                  ? 'Proposed by campus · awaiting recruiter confirmation.'
                  : finalized
                    ? 'Finalized by campus.'
                    : 'Recruiter confirmation and campus finalization are separate steps.'}
              </p>
            </section>
          )}
          {['ACTIVE', 'IN_PROGRESS', 'COMPLETED'].includes(drive.status) && (
            <section className="panel">
              <h2>Applications & eligibility</h2>
              <p>{drive.applicants} applications · Hard eligibility runs before matching.</p>
              <Badge kind={eligibility.passed ? 'verified' : ''}>
                {data.student.name}: {eligibility.passed ? 'Eligibility passed' : 'Not eligible'}
              </Badge>
              {eligibility.checks.map((c) => (
                <p key={c.name}>
                  {c.passed ? '✓' : '×'} {c.name}: {c.detail}
                </p>
              ))}
              <Link className="button outline" href={`/${role}/applications`}>
                Review applications <ArrowUpRight size={16} />
              </Link>
            </section>
          )}
          {drive.status === 'IN_PROGRESS' && campus && drive.workflowVersion !== 2 && (
            <LiveTracking drive={drive} refresh={refresh} notify={notify} />
          )}
        </div>
        <aside>
          <section className="panel lavender">
            <h2>The next decision.</h2>
            <p className="drive-status-note">
              {
                (
                  {
                    DRAFT: 'Complete and submit the request to the campus.',
                    SUBMITTED: 'Awaiting campus review. Students cannot see this request.',
                    UNDER_REVIEW: 'The placement cell is reviewing the requirements.',
                    CHANGES_REQUESTED: 'Recruiter revisions are needed before scheduling.',
                    SCHEDULING: 'Campus can propose the date, round times, and resources.',
                    AWAITING_RECRUITER_CONFIRMATION:
                      'Recruiter must confirm the proposed schedule.',
                    CONFIRMED: finalized
                      ? 'Schedule finalized. Campus can open applications.'
                      : 'Recruiter confirmed. Campus must finalize the schedule.',
                    ACTIVE: 'Eligible students can apply. Campus can begin the visit.',
                    APPLICATIONS_CLOSED: 'Applications closed. Campus can begin the drive.',
                    IN_PROGRESS: 'The company is on campus. Track attendance and round results.',
                    COMPLETED: 'Visit complete. Continue with offers, documents, and joining.',
                    REJECTED: 'Campus rejected the request.',
                    CANCELLED: 'The drive has been cancelled.',
                  } as Record<DriveStatus, string>
                )[drive.status]
              }
            </p>
            {drive.reviewNote && (
              <div className="review-note">
                <b>Latest update</b>
                <p>{drive.reviewNote}</p>
              </div>
            )}
            <div className="form-stack">
              {campus && drive.status === 'ACTIVE' && (
                <Button disabled={busy} onClick={() => void run('close')}>
                  Close applications
                </Button>
              )}
              {campus &&
                [
                  'CONFIRMED',
                  'ACTIVE',
                  'APPLICATIONS_CLOSED',
                  'AWAITING_RECRUITER_CONFIRMATION',
                ].includes(drive.status) && (
                  <>
                    <FormField label="Reason for schedule change">
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} />
                    </FormField>
                    <Button kind="outline" disabled={busy} onClick={() => void run('reschedule')}>
                      Propose revised schedule
                    </Button>
                  </>
                )}
              {campus && drive.status === 'SUBMITTED' && (
                <Button disabled={busy} onClick={() => void run('review')}>
                  Begin review
                </Button>
              )}
              {campus && ['SUBMITTED', 'UNDER_REVIEW'].includes(drive.status) && (
                <>
                  <Button disabled={busy} onClick={() => void run('approve')}>
                    Accept placement request & schedule <CalendarDays size={16} />
                  </Button>
                  <p className="muted">
                    Accepting approves the job requirements. Students can view the placement after
                    scheduling and activation.
                  </p>
                  <FormField label="Review note / reason">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Explain what needs to change…"
                    />
                  </FormField>
                  <Button kind="outline" disabled={busy} onClick={() => void run('changes')}>
                    Request changes
                  </Button>
                  <Button kind="outline" disabled={busy} onClick={() => void run('reject')}>
                    Reject request
                  </Button>
                </>
              )}
              {!campus && ['DRAFT', 'CHANGES_REQUESTED'].includes(drive.status) && (
                <Button onClick={() => setEditing(true)}>
                  Edit & {drive.status === 'DRAFT' ? 'submit' : 'resubmit'} request
                </Button>
              )}
              {!campus && ['SUBMITTED', 'UNDER_REVIEW'].includes(drive.status) && (
                <Button disabled>Request sent · Awaiting campus review</Button>
              )}
              {!campus && drive.status === 'AWAITING_RECRUITER_CONFIRMATION' && (
                <>
                  <Button disabled={busy} onClick={() => void run('confirm')}>
                    Confirm proposed schedule <Check size={16} />
                  </Button>
                  <FormField label="Requested schedule change">
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} />
                  </FormField>
                  <Button kind="outline" disabled={busy} onClick={() => void run('request-change')}>
                    Request schedule change
                  </Button>
                </>
              )}
              {campus && drive.status === 'CONFIRMED' && (
                <Button
                  disabled={busy}
                  onClick={() => void run(finalized ? 'activate' : 'finalize')}
                >
                  {finalized ? 'Activate student participation' : 'Finalize confirmed schedule'}
                </Button>
              )}
              {campus && ['ACTIVE', 'APPLICATIONS_CLOSED'].includes(drive.status) && (
                <Button disabled={busy} onClick={() => void run('start')}>
                  Begin campus drive
                </Button>
              )}
              {campus && drive.status === 'IN_PROGRESS' && (
                <Button disabled={busy} onClick={() => void run('complete')}>
                  Complete campus drive
                </Button>
              )}
              {campus &&
                ['SCHEDULING', 'AWAITING_RECRUITER_CONFIRMATION', 'CONFIRMED', 'ACTIVE'].includes(
                  drive.status,
                ) && (
                  <details>
                    <summary>Cancel this drive</summary>
                    <FormField label="Cancellation reason">
                      <textarea value={note} onChange={(e) => setNote(e.target.value)} />
                    </FormField>
                    <Button kind="outline" disabled={busy} onClick={() => void run('cancel')}>
                      Cancel drive
                    </Button>
                  </details>
                )}
              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}
            </div>
          </section>
          <section className="panel">
            <h3>Request history</h3>
            <ol className="drive-audit">
              {(drive.audit || []).map((a, i) => (
                <li key={`${a.date}-${i}`}>
                  <b>{statusLabel(a.status)}</b>
                  <p>{a.note}</p>
                  <small>{formatDate(a.date.slice(0, 10))}</small>
                </li>
              ))}
            </ol>
            {!drive.audit?.length && <p className="muted">Request waiting for its next update.</p>}
          </section>
        </aside>
      </div>
      {!campus && drive.status === 'AWAITING_RECRUITER_CONFIRMATION' && (
        <section className="panel">
          <h2>Request another slot</h2>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setError('');
              try {
                await recruitmentService.requestSlot(drive.id, {
                  date: String(f.get('date')),
                  start: String(f.get('start')),
                  end: String(f.get('end')),
                  reason: String(f.get('reason')),
                });
                refresh();
                notify('Alternative slot sent to campus.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {(['date', 'start', 'end', 'reason'] as const).map((k) => (
              <FormField
                key={k}
                label={
                  {
                    date: 'Suggested date',
                    start: 'Start time',
                    end: 'End time',
                    reason: 'Reason',
                  }[k]
                }
              >
                <input
                  required
                  name={k}
                  type={k === 'date' ? 'date' : k === 'reason' ? 'text' : 'time'}
                />
              </FormField>
            ))}
            <Button type="submit" disabled={busy}>
              Send alternative slot
            </Button>
          </form>
        </section>
      )}
      {campus && drive.requestedSlot && (
        <section className="panel">
          <h2>Recruiter availability</h2>
          <p>
            {drive.requestedSlot.date} · {drive.requestedSlot.start}–{drive.requestedSlot.end} IST
          </p>
          <p>{drive.requestedSlot.reason}</p>
        </section>
      )}
      {campus && drive.status === 'SCHEDULING' && (
        <ScheduleProposal drive={drive} data={data} refresh={refresh} notify={notify} />
      )}
    </>
  );
}
export function ScheduleSummary({ schedule: s }: { schedule: DriveSchedule }) {
  return (
    <div className="detail-list">
      <span>
        Reporting / end
        <b>
          {s.reporting} – {s.end} IST
        </b>
      </span>
      <span>
        Start time
        <b>{s.talk}</b>
      </span>
      <span>
        Venue<b>{s.venue}</b>
      </span>
      <span>
        Computer lab
        <b>
          {s.lab || 'Not required'} · {s.systems} systems
        </b>
      </span>
      <span>
        Interview rooms<b>{s.rooms || 'Not required'}</b>
      </span>
    </div>
  );
}
function ScheduleProposal({
  drive,
  data,
  refresh,
  notify,
}: {
  drive: Drive;
  data: WorkspaceData;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DriveSchedule>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: drive.schedule || {
      date: drive.preferredDates?.[0] || '',
      reporting: '08:30',
      talk: '09:00',
      assessment: '10:00',
      interviews: '13:00',
      end: '17:00',
      venue: '',
      lab: '',
      rooms: '',
      systems: drive.systems || 0,
    },
  });
  const values = watch();
  const conflicts = scheduleConflicts(data.drives, drive.id, values);
  return (
    <section className="panel schedule-proposal" id="placement-schedule">
      <Badge>CAMPUS → RECRUITER</Badge>
      <h2>Propose the campus visit.</h2>
      <p>
        Set the placement date, reporting time and venue, then send the schedule for recruiter
        confirmation. After confirmation, finalize and activate the placement to notify eligible and
        ineligible students with their corresponding requirements.
      </p>
      <form
        className="form-stack"
        onSubmit={handleSubmit(async (s) => {
          setError('');
          try {
            await driveService.proposeSchedule(drive.id, s);
            refresh();
            notify('Proposed schedule sent for recruiter confirmation.');
          } catch (e) {
            setError((e as Error).message);
          }
        })}
      >
        {(['building', 'meetingLink', 'coordinator', 'instructions', 'notes'] as const).map(
          (key) => (
            <FormField
              key={key}
              label={
                {
                  building: 'Building',
                  meetingLink: 'Online meeting link (if applicable)',
                  coordinator: 'Campus coordinator',
                  instructions: 'Instructions',
                  notes: 'Campus notes',
                }[key]
              }
            >
              <input {...register(key)} />
            </FormField>
          ),
        )}
        <input type="hidden" {...register('assessment')} />
        <input type="hidden" {...register('interviews')} />
        <FormField label="Visit date">
          <input type="date" {...register('date')} />
        </FormField>
        <div className="three-columns">
          {(['reporting', 'talk', 'end'] as const).map((key) => (
            <FormField
              key={key}
              label={
                {
                  reporting: 'Reporting',
                  talk: 'Drive start time',
                  assessment: 'Assessment',
                  interviews: 'Interviews',
                  end: 'Visit ends',
                }[key]
              }
            >
              <input type="time" {...register(key)} />
            </FormField>
          ))}
        </div>
        <div className="form-row">
          <FormField label="Presentation venue">
            <input {...register('venue')} />
          </FormField>
          <FormField label="Computer lab">
            <input {...register('lab')} />
          </FormField>
        </div>
        <div className="form-row">
          <FormField label="Interview rooms">
            <input {...register('rooms')} />
          </FormField>
          <FormField label="Computer systems">
            <input type="number" min={0} {...register('systems', { valueAsNumber: true })} />
          </FormField>
        </div>
        {conflicts.length > 0 && (
          <div className="info-banner yellow">
            <CalendarDays />
            <div>
              <b>Scheduling conflict detected</b>
              {conflicts.map((c) => (
                <p key={c.driveId}>
                  {c.company}: {c.reasons.join(', ')}. Choose another date or time to prevent
                  overlap.
                </p>
              ))}
            </div>
          </div>
        )}
        {(error || Object.keys(errors).length > 0) && (
          <p role="alert" className="field-error">
            {error ||
              Object.values(errors)
                .map((e) => e.message)
                .filter(Boolean)
                .join(' ') ||
              'Check the dates, times, and resource fields.'}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting || conflicts.length > 0}>
          {isSubmitting ? 'Sending…' : 'Send proposed schedule'} <ArrowUpRight size={16} />
        </Button>
      </form>
    </section>
  );
}
function LiveTracking({
  drive,
  refresh,
  notify,
}: {
  drive: Drive;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [error, setError] = useState('');
  const update = async (action: Promise<unknown>) => {
    try {
      await action;
      refresh();
      notify('Live campus drive counts updated.');
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="panel">
      <Badge>LIVE ON-CAMPUS TRACKING</Badge>
      <h2>From attendance to selection.</h2>
      <p>{drive.applicants} registered students. Counts are updated by the placement team.</p>
      <form
        className="live-count"
        onSubmit={(e) => {
          e.preventDefault();
          void update(
            driveService.updateAttendance(
              drive.id,
              Number(new FormData(e.currentTarget).get('count')),
            ),
          );
        }}
      >
        <FormField label="Attended">
          <input
            name="count"
            type="number"
            min={0}
            max={drive.applicants}
            defaultValue={drive.attended || 0}
            required
          />
        </FormField>
        <Button type="submit" kind="outline">
          Save attendance
        </Button>
      </form>
      {drive.rounds?.map((r, i) => (
        <div className="live-round" key={r.id}>
          <div className="panel-header">
            <h3>
              {i + 1}. {r.name}
            </h3>
            <Badge>{r.cleared} cleared</Badge>
          </div>
          <Progress value={drive.applicants ? (r.cleared / drive.applicants) * 100 : 0} />
          <form
            className="live-count"
            onSubmit={(e) => {
              e.preventDefault();
              void update(
                driveService.updateRound(
                  drive.id,
                  r.id,
                  Number(new FormData(e.currentTarget).get('count')),
                ),
              );
            }}
          >
            <FormField label="Students cleared">
              <input name="count" type="number" min={0} defaultValue={r.cleared} required />
            </FormField>
            <Button type="submit" kind="outline">
              Update round
            </Button>
          </form>
        </div>
      ))}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </section>
  );
}
export function PlacementCalendar({ data, role }: Props) {
  const [view, setView] = useState('Month');
  const [month, setMonth] = useState(new Date(2026, 9, 1));
  const [day, setDay] = useState(18);
  const monthLabel = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const dateKey = (n: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  const visits = data.drives.filter(
    (d) =>
      d.schedule &&
      !['REJECTED', 'CANCELLED'].includes(d.status) &&
      d.schedule.date.startsWith(dateKey(1).slice(0, 7)),
  );
  const interviews = data.interviews.filter((i) => i.date.startsWith(dateKey(1).slice(0, 7)));
  const events = [
    ...visits.map((d) => ({
      id: d.id,
      date: d.schedule!.date,
      time: d.schedule!.reporting,
      title: `${d.company} · campus visit`,
      detail: `${d.schedule!.venue} · ${statusLabel(d.status)}`,
      href: `/${role}/drives/${d.id}`,
    })),
    ...interviews.map((i) => ({
      id: i.id,
      date: i.date,
      time: i.time,
      title: `${i.company} · ${i.round}`,
      detail: i.mode,
      href: `/${role}/interviews/${i.id}`,
    })),
  ];
  const visible = events.filter(
    (e) =>
      view === 'Month' ||
      (view === 'Day'
        ? e.date === dateKey(day)
        : Number(e.date.slice(-2)) >= day && Number(e.date.slice(-2)) < day + 7),
  );
  return (
    <>
      <PageHeader
        title="The campus visit calendar."
        description="Coordinate physical visits, interview rounds, and reserved resources. Open a scheduling request to propose or revise a visit."
        action={
          <Link href="/campus/drive-requests" className="button dark">
            Review scheduling requests <CalendarDays size={16} />
          </Link>
        }
      />
      <div className="panel calendar">
        <div className="panel-header">
          <div className="calendar-controls">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              ←
            </button>
            <h2>{monthLabel}</h2>
            <button
              className="icon-button"
              aria-label="Next month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              →
            </button>
          </div>
          <div className="filter-pills">
            {['Month', 'Week', 'Day'].map((v) => (
              <button key={v} className={v === view ? 'selected' : ''} onClick={() => setView(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        {view === 'Month' ? (
          <>
            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {Array.from({ length: month.getDay() }, (_, i) => (
                <div key={`blank-${i}`} className="calendar-blank" />
              ))}
              {Array.from(
                { length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() },
                (_, i) => i + 1,
              ).map((n) => (
                <button
                  key={n}
                  aria-label={`View ${n} ${monthLabel}`}
                  onClick={() => {
                    setDay(n);
                    setView('Day');
                  }}
                >
                  <b>{n}</b>
                  {events
                    .filter((e) => e.date === dateKey(n))
                    .map((e) => (
                      <span className="lavender" key={e.id}>
                        {e.time} {e.title}
                      </span>
                    ))}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="calendar-day">
            <h3>
              {view === 'Day' ? `${day} ${monthLabel}` : `Seven days from ${day} ${monthLabel}`}
            </h3>
            {visible.map((e) => (
              <Link className="upcoming-row" key={e.id} href={e.href}>
                <span>
                  {formatDate(e.date)}
                  <br />
                  {e.time}
                </span>
                <div>
                  <b>{e.title}</b>
                  <p>{e.detail}</p>
                </div>
                <ArrowUpRight size={16} />
              </Link>
            ))}
            {!visible.length && <EmptyState title="No campus visits or interviews in this view." />}
          </div>
        )}
      </div>
      <div className="section-header">
        <h2>Physical resource allocations</h2>
        <Badge>{'Placement calendar'}</Badge>
      </div>
      <div className="two-columns">
        {visits.map((d) => (
          <section className="panel" key={d.id}>
            <h3>
              {d.company} · {formatDate(d.schedule!.date)}
            </h3>
            <ScheduleSummary schedule={d.schedule!} />
            <Link className="text-link" href={`/${role}/drives/${d.id}`}>
              View schedule & status <ArrowUpRight size={16} />
            </Link>
          </section>
        ))}
      </div>
    </>
  );
}
export function DriveActivitySummary({ data, role }: { data: WorkspaceData; role: Role }) {
  const needs = data.drives.filter((d) =>
    role === 'campus'
      ? ['SUBMITTED', 'UNDER_REVIEW', 'SCHEDULING', 'CONFIRMED'].includes(d.status)
      : ['DRAFT', 'CHANGES_REQUESTED', 'AWAITING_RECRUITER_CONFIRMATION'].includes(d.status),
  );
  const visits = data.drives.filter(
    (d) => d.schedule && ['CONFIRMED', 'ACTIVE', 'IN_PROGRESS'].includes(d.status),
  );
  return (
    <div className="two-columns">
      <section className="panel yellow">
        <h2>Decisions waiting for you.</h2>
        {needs.slice(0, 4).map((d) => (
          <Link className="upcoming-row" key={d.id} href={`/${role}/drives/${d.id}`}>
            <span className="company-logo">{d.company[0]}</span>
            <div>
              <b>
                {d.company} · {d.role}
              </b>
              <p>
                {statusLabel(d.status)} · {d.campus}
              </p>
            </div>
            <ArrowUpRight size={16} />
          </Link>
        ))}
        {!needs.length && <p>No drive requests need action right now.</p>}
      </section>
      <section className="panel sage">
        <h2>Upcoming campus visits.</h2>
        {visits.slice(0, 3).map((d) => (
          <Link className="upcoming-row" key={d.id} href={`/${role}/drives/${d.id}`}>
            <CalendarDays size={22} />
            <div>
              <b>
                {d.company} · {formatDate(d.schedule!.date)}
              </b>
              <p>
                {d.schedule!.reporting} reporting · {d.schedule!.venue}
              </p>
            </div>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </section>
    </div>
  );
}
export function CareerPointsPage({ data }: Props) {
  const sources = [
    ['Skill verification & assessments', data.pointsSummary?.assessments || 0],
    ['Contests & interview practice', data.pointsSummary?.participation || 0],
  ] as const;
  return (
    <>
      <PageHeader
        title="Consistency, made visible."
        description="Career Points show your preparation and participation. They support your profile and never determine hiring outcomes."
      />
      <div className="panel lavender">
        <Badge>CAREER POINTS</Badge>
        <h2>{data.student.xp.toLocaleString()} XP</h2>
        {sources.map(([name, value]) => (
          <div className="detail-list" key={name}>
            <span>
              {name}
              <b>{value.toLocaleString()} XP</b>
            </span>
          </div>
        ))}
      </div>
      <section className="panel">
        <h2>Recent points activity</h2>
        {data.history.map((h) => (
          <div className="upcoming-row" key={h.id}>
            <div>
              <b>{h.name}</b>
              <p>
                {formatDate(h.date)} · {h.type}
              </p>
            </div>
            <Badge>+{h.points} XP</Badge>
          </div>
        ))}
      </section>
      <ContestProgress achievements={contestAchievements(data)} />
    </>
  );
}
