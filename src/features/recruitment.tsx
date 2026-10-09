'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/store/session';
import { Badge, Button, EmptyState, FormField, Modal } from '@/components/ui';
import { recruitmentService as service } from '@/services/recruitment.service';
import { documentService } from '@/services/platform.service';
import type { Drive, Role, WorkspaceData } from '@/types';
import type { CandidateResult, RecruitmentAssignment, Relationship } from '@/types/recruitment';
import { ScheduleSummary } from './drives';
import { isInterviewRound } from '@/utils/placement';
import { CandidateEligibility } from '@/components/candidate-eligibility';
import { InterviewScheduleFields } from '@/components/interview-schedule-fields';
const fieldLabel = (key: string) =>
  key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
const localDateInput = (value: string) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ''
    : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function JobInformation({
  drive,
  student = false,
  initialTab = 'Overview',
}: {
  drive: Drive;
  student?: boolean;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  const company = drive.companyDetails;
  return (
    <section className="panel">
      <div className="filter-bar" role="tablist">
        {['Overview', 'Company', 'Eligibility', 'Recruitment Process', 'Schedule'].map((t) => (
          <Button key={t} kind={tab === t ? 'dark' : 'outline'} onClick={() => setTab(t)}>
            {t}
          </Button>
        ))}
      </div>
      {tab === 'Overview' && (
        <>
          <h2>{drive.role}</h2>
          <p>{drive.description}</p>
          <h3>Roles and responsibilities</h3>
          <p>{drive.responsibilities || 'Not specified'}</p>
          <div className="detail-list">
            {Object.entries({
              'Employment type': drive.workType,
              'Work mode': drive.workMode,
              Location: drive.location,
              'Salary / CTC': drive.ctc,
              'Internship stipend': drive.stipend || 'Not applicable',
              'Bond / service agreement': drive.bond || 'None specified',
              Openings: drive.vacancies,
              'Expected joining': drive.joiningDate || 'Not specified',
              'Application deadline': drive.deadline,
              'Documents required': drive.requiredDocuments || 'Resume',
            }).map(([k, v]) => (
              <span key={k}>
                {k}
                <b>{v}</b>
              </span>
            ))}
          </div>
          <h3>Required skills</h3>
          <p>{drive.skills}</p>
          <h3>Preferred skills</h3>
          <p>{drive.preferredSkills || 'None specified'}</p>
        </>
      )}
      {tab === 'Company' && (
        <>
          <h2>{drive.company}</h2>
          {company?.logo && (
            <Image
              unoptimized
              src={company.logo}
              alt={`${drive.company} logo`}
              width={80}
              height={80}
            />
          )}
          <p>{company?.description || 'Company description has not been provided.'}</p>
          {company?.website && /^https:\/\//.test(company.website) && (
            <a href={company.website} target="_blank" rel="noreferrer">
              Company website
            </a>
          )}
          <p>Industry: {company?.industry || 'Not specified'}</p>
          <p>Headquarters: {company?.headquarters || 'Not specified'}</p>
          <p>Company size: {company?.size || 'Not specified'}</p>
        </>
      )}
      {tab === 'Eligibility' && (
        <>
          <h2>Eligibility criteria</h2>
          <p>
            {drive.campus} · {drive.courses} · {drive.branches}
          </p>
          <p>Graduation batch: {drive.graduationYear}</p>
          <p>
            Minimum CGPA: {drive.cgpa} · Maximum active backlogs: {drive.allowedBacklogs ?? 0}
          </p>
          <p>
            {drive.requireSkills
              ? 'All required skills must be on your profile.'
              : 'Skills inform matching; academic eligibility is checked separately.'}
          </p>
          <p>Additional rules: {drive.additionalEligibility || 'None specified'}</p>
        </>
      )}
      {tab === 'Recruitment Process' && (
        <>
          <h2>Recruitment Process</h2>
          {!drive.rounds?.length && <p>No rounds defined yet.</p>}
          <ol className="drive-audit">
            {drive.rounds?.map((r) => (
              <li key={r.id}>
                <h3>{r.name}</h3>
                <Badge>{r.type || 'Custom Round'}</Badge>
                <p>{r.description}</p>
                <p>
                  {r.duration} min · {r.mode || 'Offline'} ·{' '}
                  {r.elimination === false ? 'Non-elimination' : 'Elimination'} round
                </p>
                <p>{r.instructions}</p>
                {r.maximumScore !== undefined && (
                  <p>
                    Maximum score {r.maximumScore} · Passing score{' '}
                    {r.passingScore ?? 'Not specified'}
                  </p>
                )}
              </li>
            ))}
          </ol>
          {student && (
            <p>Assignments and interview slots appear only after you reach their round.</p>
          )}
        </>
      )}
      {tab === 'Schedule' &&
        (drive.schedule ? (
          <>
            <h2>{drive.schedule.date}</h2>
            <ScheduleSummary schedule={drive.schedule} />
            <p>Building: {drive.schedule.building || 'Not specified'}</p>
            <p>Coordinator: {drive.schedule.coordinator || 'Not specified'}</p>
            <p>{drive.schedule.instructions}</p>
            {drive.schedule.meetingLink && /^https:\/\//.test(drive.schedule.meetingLink) && (
              <a href={drive.schedule.meetingLink}>Online meeting</a>
            )}
          </>
        ) : (
          <p>Campus scheduling is pending.</p>
        ))}
    </section>
  );
}

export function StudentCompanyPage({ data, id }: { data: WorkspaceData; id?: string }) {
  const drive = data.drives.find((d) => d.id === id);
  if (!drive) return <EmptyState title="Company details are unavailable for this opportunity." />;
  const jobs = data.drives.filter((d) => d.company === drive.company);
  return (
    <>
      <Link
        className="back-link"
        href={`/student/opportunities/${drive.opportunityId || drive.id}`}
      >
        ← Job details
      </Link>
      <JobInformation drive={drive} student initialTab="Company" />
      <section className="panel">
        <h2>Active job openings</h2>
        {jobs
          .filter((d) => d.status === 'ACTIVE')
          .map((d) => (
            <p key={d.id}>
              <Link href={`/student/opportunities/${d.opportunityId || d.id}`}>{d.role}</Link> ·{' '}
              {d.location} · {d.ctc}
            </p>
          ))}
        <h2>Previous drives in your campus</h2>
        {jobs
          .filter((d) => d.status === 'COMPLETED')
          .map((d) => (
            <p key={d.id}>
              {d.role} · {d.schedule?.date}
            </p>
          ))}
      </section>
    </>
  );
}

export function RecruitmentPanel({
  drive,
  role,
  refresh,
}: {
  drive: Drive;
  role: Role;
  refresh: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [roundId, setRoundId] = useState(drive.rounds?.[0]?.id || '');
  const [checked, setChecked] = useState<string[]>([]);
  const [assignment, setAssignment] = useState(false);
  const [interview, setInterview] = useState(false);
  const [interviewAudience, setInterviewAudience] = useState('round');
  const [publish, setPublish] = useState(false);
  const query = useQuery({
    queryKey: ['recruitment', drive.id, role],
    queryFn: () => service.overview(drive.id),
  });
  const run = async (fn: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
      await query.refetch();
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  const overview = query.data;
  const round = drive.rounds?.find((r) => r.id === roundId);
  const roundSchedule = overview?.slots.find(
    (s) =>
      s.roundId === roundId &&
      (interviewAudience === 'round' ? s.audience === 'round' : s.studentId === interviewAudience),
  );
  const current =
    overview?.candidates.filter(
      (c) => c.currentRoundId === roundId && !['Selected', 'Rejected', 'Absent'].includes(c.stage),
    ) || [];
  return (
    <section className="panel">
      <h2>{role === 'student' ? 'My recruitment progress' : 'Candidates & round results'}</h2>
      {(error || query.error) && (
        <p role="alert" className="field-error">
          {error || query.error?.message}
        </p>
      )}
      {query.isLoading && <p>Loading recruitment records…</p>}
      {overview && (
        <>
          {role !== 'student' && (
            <div className="detail-list">
              {Object.entries(overview.counts).map(([key, count]) => (
                <span key={key}>
                  {key}
                  <b>{count}</b>
                </span>
              ))}
            </div>
          )}
          {role === 'student' &&
            overview.candidates.map((c) => (
              <p key={c.applicationId}>
                Current stage: <b>{c.stage}</b>
                {c.currentRoundId && (
                  <> · {drive.rounds?.find((r) => r.id === c.currentRoundId)?.name}</>
                )}
              </p>
            ))}
          {role !== 'student' && (
            <>
              <h3>Recruitment timeline</h3>
              <div className="filter-bar">
                {drive.rounds?.map((r, i) => (
                  <Button
                    kind={r.id === roundId ? 'dark' : 'outline'}
                    key={r.id}
                    onClick={() => {
                      setRoundId(r.id);
                      setInterviewAudience('round');
                      setChecked([]);
                    }}
                  >
                    {String(i + 1).padStart(2, '0')} {r.name}
                  </Button>
                ))}
              </div>
              {round && (
                <>
                  <h3>{round.name}</h3>
                  <p>{round.description}</p>
                  {role === 'recruiter' && round.type === 'Assignment' && (
                    <Button kind="outline" onClick={() => setAssignment(true)}>
                      Add / edit assignment
                    </Button>
                  )}
                  {isInterviewRound(round) && (
                    <Button kind="outline" onClick={() => setInterview(true)}>
                      Schedule interview round
                    </Button>
                  )}
                  {current.length ? (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Select</th>
                            <th>Candidate</th>
                            <th>Status</th>
                            <th>Score</th>
                            <th>Feedback</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {current.map((c) => {
                            const result = overview.results.find(
                              (r) => r.applicationId === c.applicationId && r.roundId === roundId,
                            );
                            return (
                              <tr key={c.applicationId}>
                                <td>
                                  <input
                                    aria-label={`Select ${c.name}`}
                                    type="checkbox"
                                    checked={checked.includes(c.applicationId)}
                                    onChange={(e) =>
                                      setChecked((v) =>
                                        e.target.checked
                                          ? [...v, c.applicationId]
                                          : v.filter((id) => id !== c.applicationId),
                                      )
                                    }
                                  />
                                </td>
                                <td>{c.name}</td>
                                <td colSpan={4}>
                                  <form
                                    key={`${c.applicationId}:${JSON.stringify(result)}`}
                                    className="form-row"
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const f = new FormData(e.currentTarget);
                                      void run(() =>
                                        service.saveResults(drive.id, roundId, [
                                          {
                                            applicationId: c.applicationId,
                                            status: String(
                                              f.get('status'),
                                            ) as CandidateResult['status'],
                                            score: f.get('score')
                                              ? Number(f.get('score'))
                                              : undefined,
                                            feedback: String(f.get('feedback')),
                                            strengths: String(f.get('strengths') || ''),
                                            gaps: String(f.get('gaps') || ''),
                                            nextSteps: String(f.get('nextSteps') || ''),
                                          },
                                        ]),
                                      );
                                    }}
                                  >
                                    <select
                                      name="status"
                                      defaultValue={result?.status || 'Pending'}
                                    >
                                      {[
                                        'Pending',
                                        'Qualified',
                                        'Rejected',
                                        'Absent',
                                        'Under Review',
                                      ].map((s) => (
                                        <option key={s}>{s}</option>
                                      ))}
                                    </select>
                                    <input
                                      name="score"
                                      aria-label="Score"
                                      type="number"
                                      min={0}
                                      max={
                                        round.maximumScore ??
                                        (isInterviewRound(round) ? 100 : undefined)
                                      }
                                      step="any"
                                      defaultValue={result?.score}
                                      placeholder="Score"
                                    />
                                    <input
                                      name="feedback"
                                      aria-label="Feedback"
                                      defaultValue={result?.feedback}
                                      placeholder="Feedback"
                                    />
                                    {isInterviewRound(round) && (
                                      <>
                                        <input
                                          name="strengths"
                                          aria-label="Interview strengths"
                                          placeholder="Strengths"
                                          defaultValue={result?.strengths}
                                        />
                                        <input
                                          name="gaps"
                                          aria-label="Interview skill gaps"
                                          placeholder="Problems / skills to improve"
                                          defaultValue={result?.gaps}
                                        />
                                        <input
                                          name="nextSteps"
                                          aria-label="Interview next steps"
                                          placeholder="Recommended next steps"
                                          defaultValue={result?.nextSteps}
                                        />
                                      </>
                                    )}
                                    <Button
                                      type="submit"
                                      disabled={
                                        busy ||
                                        drive.status !== 'IN_PROGRESS' ||
                                        role !== 'recruiter'
                                      }
                                    >
                                      Save
                                    </Button>
                                  </form>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No candidates currently participating in this round.</p>
                  )}
                  {role === 'recruiter' && current.length > 0 && (
                    <div className="hero-buttons">
                      {(['Qualified', 'Rejected', 'Absent'] as const).map((status) => (
                        <Button
                          key={status}
                          kind="outline"
                          disabled={busy || !checked.length || drive.status !== 'IN_PROGRESS'}
                          onClick={() =>
                            void run(() =>
                              service.saveResults(
                                drive.id,
                                roundId,
                                checked.map((applicationId) => ({
                                  applicationId,
                                  status,
                                  feedback: '',
                                })),
                              ),
                            )
                          }
                        >
                          Mark {status}
                        </Button>
                      ))}
                      <Button
                        disabled={busy || drive.status !== 'IN_PROGRESS'}
                        onClick={() => setPublish(true)}
                      >
                        Publish results
                      </Button>
                    </div>
                  )}
                </>
              )}
              <h3>Candidate pipeline</h3>
              {overview.candidates.map((c) => (
                <p key={c.applicationId}>
                  {c.name} <Badge>{c.stage}</Badge>
                </p>
              ))}
            </>
          )}
          {role !== 'student' && (
            <CandidateEligibility
              overview={overview}
              conditions={drive.additionalEligibility}
              canReview={role === 'campus'}
              busy={busy}
              onReview={(studentId, approved, reason) =>
                void run(() => service.verifyEligibility(drive.id, studentId, approved, reason))
              }
            />
          )}
          <h3>Published results</h3>
          {overview.results
            .filter((r) => r.published)
            .map((r) => (
              <p key={r.id}>
                {role !== 'student' && (
                  <>
                    {overview.candidates.find((c) => c.applicationId === r.applicationId)?.name}{' '}
                    ·{' '}
                  </>
                )}
                {drive.rounds?.find((round) => round.id === r.roundId)?.name}:{' '}
                <Badge>{r.status}</Badge> {r.score !== undefined && <>Score {r.score}</>}{' '}
                {r.feedback}
              </p>
            ))}
          {overview.assignments
            .filter((a) => role === 'student' || a.roundId === roundId)
            .map((a) => (
              <section key={a.id} className="panel">
                <h3>{a.title}</h3>
                <p>{a.description}</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{a.tasks}</p>
                <p>{a.instructions}</p>
                <p>
                  Submission: {a.format} · {a.allowedTypes} · Maximum marks {a.maximumMarks}
                </p>
                <p>
                  Deadline: {a.deadline} · Evaluation: {a.criteria}
                </p>
                {a.link && /^https:\/\//.test(a.link) && (
                  <a href={a.link}>Assignment attachment / link</a>
                )}
                {role === 'student' &&
                  overview.candidates.some((c) => c.currentRoundId === a.roundId) && (
                    <form
                      className="form-stack"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        const content = String(form.get('content') || '');
                        const file = form.get('file') as File | null;
                        void run(async () => {
                          let documentId: string | undefined;
                          if (file?.size) {
                            const uploaded = (await documentService.upload(
                              file,
                              'Other',
                            )) as WorkspaceData;
                            documentId = uploaded.documents.at(-1)?.id;
                          }
                          await service.submitAssignment(drive.id, a.id, content, documentId);
                        });
                      }}
                    >
                      <FormField label="Submission text or HTTPS document link">
                        <textarea name="content" />
                      </FormField>
                      <FormField label="Submission file (PDF or image, matching allowed types)">
                        <input type="file" name="file" accept=".pdf,.png,.jpg,.jpeg,.webp" />
                      </FormField>
                      <Button type="submit" disabled={busy || drive.status !== 'IN_PROGRESS'}>
                        Submit assignment
                      </Button>
                    </form>
                  )}
                {overview.submissions
                  .filter((s) => s.assignmentId === a.id)
                  .map((s) => (
                    <p key={s.id}>
                      Submitted {s.submittedAt}: {s.content}
                      {s.documentId && (
                        <Button
                          kind="outline"
                          onClick={() =>
                            void run(async () => {
                              const url = await documentService.download(
                                s.documentId!,
                                s.studentId,
                              );
                              const link = document.createElement('a');
                              link.href = url;
                              link.download = s.documentName || 'submission';
                              link.click();
                              URL.revokeObjectURL(url);
                            })
                          }
                        >
                          Download {s.documentName}
                        </Button>
                      )}
                    </p>
                  ))}
              </section>
            ))}
          <h3>Interview schedules</h3>
          {!overview.slots.length && <p>No interview rounds have been scheduled yet.</p>}
          {overview.slots.map((s) => (
            <p key={s.id}>
              {role !== 'student' && (
                <>
                  {s.audience === 'round'
                    ? 'All students in this round'
                    : overview.candidates.find((c) => c.studentId === s.studentId)?.name}{' '}
                  ·{' '}
                </>
              )}
              {drive.rounds?.find((r) => r.id === s.roundId)?.name} · {s.date} · {s.time} IST ·{' '}
              {s.duration} min · {s.mode} · {s.venue} / {s.room} · Panel {s.panel}{' '}
              {s.meetingLink && /^https:\/\//.test(s.meetingLink) && (
                <a href={s.meetingLink}>Join meeting</a>
              )}
            </p>
          ))}
        </>
      )}
      {publish && (
        <Modal title="Publish round results?" onClose={() => setPublish(false)}>
          <p>Only qualified candidates advance. Published decisions cannot be edited.</p>
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await service.publishResults(drive.id, roundId);
                setPublish(false);
              })
            }
          >
            Confirm publication
          </Button>
        </Modal>
      )}
      {assignment && round && (
        <Modal title="Assignment for this round" onClose={() => setAssignment(false)}>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const input = Object.fromEntries(f.entries());
              void run(async () => {
                await service.saveAssignment(drive.id, {
                  ...input,
                  roundId,
                  maximumMarks: Number(f.get('maximumMarks')),
                  deadline: new Date(String(f.get('deadline'))).toISOString(),
                } as unknown as Omit<RecruitmentAssignment, 'id' | 'driveId'>);
                setAssignment(false);
              });
            }}
          >
            {[
              'title',
              'description',
              'tasks',
              'instructions',
              'format',
              'link',
              'maximumMarks',
              'deadline',
              'allowedTypes',
              'criteria',
            ].map((key) => {
              const value =
                overview?.assignments.find((a) => a.roundId === roundId)?.[
                  key as keyof RecruitmentAssignment
                ] || '';
              return (
                <FormField key={key} label={fieldLabel(key)}>
                  {['description', 'tasks', 'instructions', 'criteria'].includes(key) ? (
                    <textarea
                      required={key !== 'instructions'}
                      name={key}
                      defaultValue={String(value)}
                      rows={4}
                    />
                  ) : (
                    <input
                      required={key !== 'link'}
                      name={key}
                      type={
                        key === 'maximumMarks'
                          ? 'number'
                          : key === 'deadline'
                            ? 'datetime-local'
                            : 'text'
                      }
                      defaultValue={key === 'deadline' ? localDateInput(String(value)) : value}
                    />
                  )}
                </FormField>
              );
            })}
            <Button type="submit" disabled={busy}>
              Save assignment
            </Button>
          </form>
        </Modal>
      )}
      {interview && (
        <Modal title="Schedule interview round" onClose={() => setInterview(false)}>
          <p>
            Schedule all participants in {round?.name || 'this round'}, or choose one student. An
            individual appointment replaces the shared time for that student.
          </p>
          {!current.length && (
            <p>No students have reached this round yet. You can still schedule it in advance.</p>
          )}
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await service.scheduleInterview(drive.id, {
                  roundId,
                  ...(interviewAudience === 'round'
                    ? { audience: 'round' as const }
                    : { studentId: interviewAudience }),
                  date: String(f.get('date')),
                  time: String(f.get('time')),
                  duration: Number(f.get('duration')),
                  venue: String(f.get('venue')),
                  room: String(f.get('room')),
                  panel: String(f.get('panel')),
                  mode: String(f.get('mode')),
                  meetingLink: String(f.get('meetingLink')),
                  override: f.get('override') === 'on',
                  reason: String(f.get('reason') || ''),
                });
                setInterview(false);
              });
            }}
          >
            <FormField label="Interview audience">
              <select
                value={interviewAudience}
                onChange={(event) => setInterviewAudience(event.target.value)}
              >
                <option value="round">All students in this round</option>
                {current.map((candidate) => (
                  <option key={candidate.studentId} value={candidate.studentId}>
                    {candidate.name}
                  </option>
                ))}
              </select>
            </FormField>
            <InterviewScheduleFields
              key={roundId + ':' + interviewAudience}
              schedule={roundSchedule}
              duration={round?.duration || 60}
              canOverride={role === 'campus'}
            />
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save interview schedule'}
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}

export function CampusRelationships({
  role,
  data,
  campusId,
}: {
  role: Role;
  data: WorkspaceData;
  campusId?: string;
}) {
  const userId = useSession((s) => s.user?.id);
  const client = useQueryClient();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const query = useQuery({
    queryKey: ['relationships', role, userId],
    queryFn: service.relationships,
    enabled: Boolean(userId),
    refetchInterval: 15000,
  });
  const run = async (fn: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      setError('');
      await fn();
      void client.invalidateQueries({ queryKey: ['recruitment-dashboard'] });
      await query.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <section className="panel">
      <h2>{role === 'campus' ? 'Recruiter access approval' : 'Campus recruitment access'}</h2>
      <p>
        Campus acceptance is required before a recruiter can submit a job. Student records remain
        private until application.
      </p>
      {(error || (!query.data && query.error)) && (
        <p role="alert">{error || query.error?.message}</p>
      )}
      {query.isPending && <p role="status">Loading campus access requests…</p>}
      {role === 'campus' && query.data?.length === 0 && (
        <p>No recruiter access requests have been sent to this campus yet.</p>
      )}
      {role === 'recruiter' &&
        data.campuses
          ?.filter((c) => !campusId || c.id === campusId)
          .map((c) => {
            const row = query.data?.find((r) => r.campusId === c.id);
            return (
              <div className="panel-header" key={c.id}>
                <span>
                  {c.name} · {row?.status || 'No request'}
                </span>
                <Button
                  disabled={
                    busy || query.isPending || !!query.error || (!!row && row.status !== 'Rejected')
                  }
                  onClick={() =>
                    void run(async () => {
                      const sent = await service.requestCampus(c.id);
                      client.setQueryData<Relationship[]>(
                        ['relationships', role, userId],
                        (rows = []) => [...rows.filter((r) => r.id !== sent.id), sent],
                      );
                    })
                  }
                >
                  {row?.status === 'Pending'
                    ? 'Request sent'
                    : row?.status === 'Accepted'
                      ? 'Access accepted'
                      : row?.status === 'Rejected'
                        ? 'Request again'
                        : 'Request access'}
                </Button>
              </div>
            );
          })}
      {role === 'campus' &&
        query.data?.map((r) => (
          <form
            key={r.id}
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const submitter = (e.nativeEvent as SubmitEvent)
                .submitter as HTMLButtonElement | null;
              const status = submitter?.value as Relationship['status'];
              if (!['Accepted', 'Rejected'].includes(status)) return;
              const reason = String(f.get('reason') || '').trim();
              if (status === 'Rejected' && reason.length < 5) {
                setError('Give a rejection reason of at least five characters.');
                return;
              }
              void run(async () => {
                await service.reviewCampus(r.id, status, reason);
                client.setQueryData<Relationship[]>(['relationships', role, userId], (rows = []) =>
                  rows.map((row) => (row.id === r.id ? { ...row, status, reason } : row)),
                );
              });
            }}
          >
            <h3>
              {r.company} <Badge>{r.status}</Badge>
            </h3>
            {r.status === 'Pending' && (
              <>
                <p>
                  Accept to let this recruiter submit placement requests to your college. Each
                  placement will still need your review and scheduling.
                </p>
                <input
                  name="reason"
                  aria-label="Review reason"
                  placeholder="Reason (required for rejection)"
                />
                <div className="hero-buttons">
                  <Button type="submit" name="status" value="Accepted" disabled={busy}>
                    Accept recruiter
                  </Button>
                  <Button
                    type="submit"
                    name="status"
                    value="Rejected"
                    kind="outline"
                    disabled={busy}
                  >
                    Reject request
                  </Button>
                </div>
              </>
            )}
            {r.reason && <p>Review note: {r.reason}</p>}
          </form>
        ))}
    </section>
  );
}

export function CampusAssessments({ role }: { role: Role }) {
  const [creating, setCreating] = useState(false);
  const [questions, setQuestions] = useState<
    { prompt: string; options: string[]; answer: number }[]
  >([{ prompt: '', options: ['', ''], answer: 0 }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [sessions, setSessions] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ['campus-assessments', role], queryFn: service.assessments });
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      await query.refetch();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="panel">
        <h2>Campus Assessments</h2>
        <p>Preparation tests for students in your campus, separate from recruiter rounds.</p>
        {role === 'campus' && <Button onClick={() => setCreating(true)}>Create assessment</Button>}
        {(error || query.error) && <p role="alert">{error || query.error?.message}</p>}
        {message && <p role="status">{message}</p>}
        {query.isLoading && <p>Loading assessments…</p>}
        {query.data?.length === 0 && <EmptyState title="No campus assessments yet." />}
      </section>
      {query.data?.map((a) => (
        <section className="panel" key={a.id}>
          <h3>{a.title}</h3>
          <Badge>{a.type}</Badge>
          <p>{a.description}</p>
          <p>
            {a.start} – {a.end} · {a.duration} minutes · {a.maximumMarks} marks
          </p>
          <p>{a.instructions}</p>
          {!!a.attempts?.length && (
            <>
              <h3>Results</h3>
              {a.attempts.map((t) => (
                <p key={t.studentId}>
                  {t.name} ·{' '}
                  {t.score === undefined ? 'Result withheld by campus' : `${t.score} marks`} ·{' '}
                  {new Date(t.date).toLocaleDateString()}
                </p>
              ))}
            </>
          )}
          {role === 'student' && !a.attempts?.length && !sessions[a.id] && (
            <Button
              disabled={
                busy ||
                Date.now() < Date.parse(a.start) ||
                Date.now() > Date.parse(a.end) ||
                (!!sessions[a.id] && Date.now() > Date.parse(sessions[a.id]))
              }
              onClick={() =>
                void run(async () => {
                  const session = await service.startAssessment(a.id);
                  setSessions((v) => ({ ...v, [a.id]: session.expiresAt }));
                })
              }
            >
              Start assessment
            </Button>
          )}
          {role === 'student' && !a.attempts?.length && sessions[a.id] && (
            <form
              className="form-stack"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  const result = await service.submitAssessment(
                    a.id,
                    a.questions.map((_, i) => Number(f.get(`q${i}`))),
                  );
                  setMessage(
                    result.message ||
                      `Score: ${result.score} · ${result.passed ? 'Passed' : 'Needs preparation'}`,
                  );
                });
              }}
            >
              <p>Submit before {new Date(sessions[a.id]).toLocaleTimeString()}.</p>
              {a.questions.map((q, i) => (
                <FormField key={i} label={q.prompt}>
                  <select name={`q${i}`} required>
                    <option value="">Choose answer</option>
                    {q.options.map((o, j) => (
                      <option key={j} value={j}>
                        {o}
                      </option>
                    ))}
                  </select>
                </FormField>
              ))}
              <Button
                type="submit"
                disabled={
                  busy ||
                  Date.now() < Date.parse(a.start) ||
                  Date.now() > Date.parse(a.end) ||
                  (!!sessions[a.id] && Date.now() > Date.parse(sessions[a.id]))
                }
              >
                Submit assessment
              </Button>
            </form>
          )}
        </section>
      ))}
      {creating && (
        <Modal title="Create campus assessment" onClose={() => setCreating(false)}>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await service.createAssessment({
                  title: String(f.get('title')),
                  description: String(f.get('description')),
                  type: String(f.get('type')),
                  questions,
                  duration: Number(f.get('duration')),
                  start: new Date(String(f.get('start'))).toISOString(),
                  end: new Date(String(f.get('end'))).toISOString(),
                  maximumMarks: Number(f.get('maximumMarks')),
                  passingMarks: Number(f.get('passingMarks')),
                  batch: String(f.get('batch')),
                  branch: String(f.get('branch')),
                  studentIds: String(f.get('studentIds'))
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                  instructions: String(f.get('instructions')),
                  visibleResults: f.get('visibleResults') === 'on',
                });
                setCreating(false);
              });
            }}
          >
            {[
              'title',
              'description',
              'duration',
              'start',
              'end',
              'maximumMarks',
              'passingMarks',
              'batch',
              'branch',
              'studentIds',
              'instructions',
            ].map((key) => (
              <FormField
                key={key}
                label={
                  fieldLabel(key) +
                  (['batch', 'branch', 'studentIds'].includes(key) ? ' (blank = all students)' : '')
                }
              >
                <input
                  name={key}
                  required={[
                    'title',
                    'duration',
                    'start',
                    'end',
                    'maximumMarks',
                    'passingMarks',
                  ].includes(key)}
                  type={
                    ['duration', 'maximumMarks', 'passingMarks'].includes(key)
                      ? 'number'
                      : ['start', 'end'].includes(key)
                        ? 'datetime-local'
                        : 'text'
                  }
                />
              </FormField>
            ))}
            <select name="type">
              {[
                'Aptitude test',
                'Coding test',
                'Technical quiz',
                'Communication assessment',
                'Custom assessment',
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <h3>Questions</h3>
            {questions.map((q, i) => (
              <section className="panel" key={i}>
                <FormField label={`Question ${i + 1}`}>
                  <textarea
                    required
                    value={q.prompt}
                    onChange={(e) =>
                      setQuestions((v) =>
                        v.map((r, j) => (j === i ? { ...r, prompt: e.target.value } : r)),
                      )
                    }
                  />
                </FormField>
                <FormField label="Answer choices (one per line)">
                  <textarea
                    required
                    value={q.options.join('\n')}
                    onChange={(e) =>
                      setQuestions((v) =>
                        v.map((r, j) =>
                          j === i ? { ...r, options: e.target.value.split('\n') } : r,
                        ),
                      )
                    }
                  />
                </FormField>
                <FormField label="Correct answer">
                  <select
                    value={q.answer}
                    onChange={(e) =>
                      setQuestions((v) =>
                        v.map((r, j) => (j === i ? { ...r, answer: Number(e.target.value) } : r)),
                      )
                    }
                  >
                    {q.options.map((o, j) => (
                      <option key={j} value={j}>
                        {o || `Choice ${j + 1}`}
                      </option>
                    ))}
                  </select>
                </FormField>
                <Button
                  kind="outline"
                  disabled={questions.length === 1}
                  onClick={() => setQuestions((v) => v.filter((_, j) => j !== i))}
                >
                  Remove question
                </Button>
              </section>
            ))}
            <Button
              kind="outline"
              onClick={() =>
                setQuestions((v) => [...v, { prompt: '', options: ['', ''], answer: 0 }])
              }
            >
              Add question
            </Button>
            <label>
              <input type="checkbox" name="visibleResults" /> Show results to students
            </label>
            <Button type="submit" disabled={busy}>
              Publish campus assessment
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
