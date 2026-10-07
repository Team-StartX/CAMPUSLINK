import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { currentContext, emptyWorkspace, notify, StoredDrive } from './workspace';
import { requireCondition } from './errors';
import type { Account } from './auth';
import type { WorkspaceData } from '../src/types';
import type {
  Relationship,
  Candidate,
  CandidateResult,
  RecruitmentAssignment,
  AssignmentSubmission,
  InterviewSlot,
  CampusAssessment,
  RecruitmentOverview,
} from '../src/types/recruitment';
import { checkEligibility, studentVisible } from '../src/utils/placement';

const text = z.string().trim().max(10000);
const required = text.min(1);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const assignmentSchema = z.object({
  roundId: required,
  title: required,
  description: required,
  tasks: required,
  instructions: text,
  format: required,
  link: text,
  maximumMarks: z.number().positive(),
  deadline: z.string().datetime({ offset: true }),
  allowedTypes: required,
  criteria: required,
});
const slotSchema = z.object({
  roundId: required,
  studentId: required,
  date,
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  duration: z.number().int().min(5).max(480),
  venue: text,
  room: text,
  panel: required,
  mode: z.enum(['Online', 'Offline']),
  meetingLink: text,
  override: z.boolean().optional(),
  reason: text.optional(),
});
const assessmentSchema = z
  .object({
    title: required,
    description: text,
    type: z.enum([
      'Aptitude test',
      'Coding test',
      'Technical quiz',
      'Communication assessment',
      'Custom assessment',
    ]),
    questions: z
      .array(
        z
          .object({
            prompt: required,
            options: z.array(required).min(2).max(10),
            answer: z.number().int().min(0),
          })
          .refine((q) => q.answer < q.options.length),
      )
      .min(1)
      .max(100),
    duration: z.number().int().min(5).max(180),
    start: z.string().datetime({ offset: true }),
    end: z.string().datetime({ offset: true }),
    maximumMarks: z.number().positive(),
    passingMarks: z.number().min(0),
    batch: text,
    branch: text,
    studentIds: z.array(required).max(1000),
    instructions: text,
    visibleResults: z.boolean(),
  })
  .refine((a) => a.end > a.start && a.passingMarks <= a.maximumMarks, {
    message: 'Check assessment dates and passing marks.',
  });
export const recruitmentPolicy: Record<string, string[]> = {
  dashboard: ['campus', 'recruiter'],
  requestSlot: ['recruiter'],
  verifyEligibility: ['campus'],
  relationships: ['campus', 'recruiter'],
  requestCampus: ['recruiter'],
  reviewCampus: ['campus'],
  overview: ['student', 'campus', 'recruiter'],
  interest: ['student'],
  apply: ['student'],
  saveAssignment: ['recruiter'],
  submitAssignment: ['student'],
  saveResults: ['recruiter'],
  publishResults: ['recruiter'],
  scheduleInterview: ['campus', 'recruiter'],
  assessments: ['campus', 'student'],
  createAssessment: ['campus'],
  submitAssessment: ['student'],
  startAssessment: ['student'],
};

export async function recruitmentDispatch(method: string, args: unknown[]) {
  const { db, actor } = currentContext();
  requireCondition(
    recruitmentPolicy[method]?.includes(actor.role),
    403,
    'Your role cannot perform this action.',
  );
  requireCondition(actor.approved, 403, 'Account approval is required.');
  let auditCampusId = actor.campusId;
  const log = async (
    action: string,
    entity: string,
    entityId: string,
    oldValue?: unknown,
    newValue?: unknown,
  ) => {
    const id = randomUUID();
    await db.put(
      'audit',
      id,
      {
        id,
        user_id: actor.id,
        role: actor.role,
        action,
        entity,
        entity_id: entityId,
        timestamp: new Date().toISOString(),
        old_value: oldValue,
        new_value: newValue,
      },
      auditCampusId,
      actor.id,
    );
  };
  const accounts = await db.list<Account>('account');
  const announce = async (ids: string[], title: string, body: string) => {
    for (const a of accounts.filter((a) => ids.includes(a.id)))
      await notify(db, a, title, body, 'Recruitment');
  };
  if (method === 'dashboard') {
    const drives = (await db.list<StoredDrive>('drive')).filter((d) =>
      actor.role === 'campus' ? d.campusId === actor.campusId : d.recruiterId === actor.id,
    );
    const driveFor = (opportunityId: string) =>
      drives.find((d) => (d.opportunityId || d.id) === opportunityId);
    const profiles = await db.list<WorkspaceData>(
      'workspace',
      actor.role === 'campus' ? actor.campusId : undefined,
    );
    const applications = profiles.flatMap((w) =>
      w.applications
        .filter((a) => driveFor(a.opportunityId))
        .map((a) => ({
          id: a.id,
          studentId: w.student.id,
          name: w.student.name,
          stage: a.stage,
          driveId: driveFor(a.opportunityId)!.id,
          company: driveFor(a.opportunityId)!.company,
          role: driveFor(a.opportunityId)!.role,
        })),
    );
    const offers = profiles.flatMap((w) =>
      w.offers
        .filter(
          (o) =>
            actor.role === 'campus' ||
            (o as typeof o & { recruiterId?: string }).recruiterId === actor.id,
        )
        .map((o) => ({
          id: o.id,
          company: o.company,
          role: o.role,
          status: o.status,
          studentId: w.student.id,
          name: w.student.name,
        })),
    );
    const today = new Date().toISOString().slice(0, 10);
    const relationships = (await db.list<Relationship>('campus-recruiter')).filter((r) =>
      actor.role === 'campus' ? r.campusId === actor.campusId : r.recruiterId === actor.id,
    );
    const pool = profiles.filter((w) =>
      accounts.some((a) => a.id === w.student.id && a.approved && a.role === 'student'),
    );
    const placed = new Set(
      offers.filter((o) => ['Accepted', 'Joined'].includes(o.status)).map((o) => o.studentId),
    ).size;
    const metrics: Record<string, number> = {
      'Active jobs': drives.filter((d) =>
        ['ACTIVE', 'APPLICATIONS_CLOSED', 'IN_PROGRESS'].includes(d.status),
      ).length,
      'Pending approvals': drives.filter((d) => ['SUBMITTED', 'UNDER_REVIEW'].includes(d.status))
        .length,
      'Upcoming drives': drives.filter(
        (d) =>
          d.schedule &&
          d.schedule.date >= today &&
          ['CONFIRMED', 'ACTIVE', 'APPLICATIONS_CLOSED'].includes(d.status),
      ).length,
      'Total applicants': new Set(applications.map((a) => a.studentId)).size,
      'Eligible students': pool.filter((w) =>
        drives.some(
          (d) =>
            ![
              'DRAFT',
              'SUBMITTED',
              'UNDER_REVIEW',
              'CHANGES_REQUESTED',
              'REJECTED',
              'CANCELLED',
            ].includes(d.status) && checkEligibility(w.student, d).passed,
        ),
      ).length,
      'Shortlisted candidates': new Set(
        applications
          .filter((a) => !['Applied', 'Rejected', 'Absent'].includes(a.stage))
          .map((a) => a.studentId),
      ).size,
      'Selected candidates': new Set(
        applications.filter((a) => ['Selected', 'Offer'].includes(a.stage)).map((a) => a.studentId),
      ).size,
      'Pending actions':
        drives.filter((d) =>
          (actor.role === 'campus'
            ? ['SUBMITTED', 'UNDER_REVIEW', 'SCHEDULING', 'CONFIRMED']
            : ['DRAFT', 'CHANGES_REQUESTED', 'AWAITING_RECRUITER_CONFIRMATION']
          ).includes(d.status),
        ).length +
        (actor.role === 'campus' ? relationships.filter((r) => r.status === 'Pending').length : 0),
      'Offers received': offers.length,
    };
    if (actor.role === 'campus') {
      metrics['Students placed'] = placed;
      metrics['Active recruiters'] = relationships.filter((r) => r.status === 'Accepted').length;
      metrics['Placement rate (%)'] = Math.round((100 * placed) / Math.max(1, pool.length));
    }
    const results = (await db.list<CandidateResult>('candidate-round'))
      .filter((r) => r.published && drives.some((d) => d.id === r.driveId))
      .slice(-8)
      .map((r) => ({
        name: applications.find((a) => a.id === r.applicationId)?.name || 'Candidate',
        company: drives.find((d) => d.id === r.driveId)!.company,
        round:
          drives.find((d) => d.id === r.driveId)?.rounds?.find((round) => round.id === r.roundId)
            ?.name || '',
        status: r.status,
      }));
    return { metrics, applications: applications.slice(-8), offers: offers.slice(-8), results };
  }
  if (method === 'relationships')
    return (await db.list<Relationship>('campus-recruiter')).filter((r) =>
      actor.role === 'campus' ? r.campusId === actor.campusId : r.recruiterId === actor.id,
    );
  if (method === 'requestCampus') {
    const campusId = required.parse(args[0]);
    auditCampusId = campusId;
    requireCondition(await db.get('campus', campusId), 404, 'Campus not found.');
    const id = `${campusId}:${actor.id}`;
    const previous = await db.get<Relationship>('campus-recruiter', id);
    requireCondition(
      !previous || previous.status === 'Rejected',
      409,
      'A pending or accepted request already exists.',
    );
    const row: Relationship = {
      id,
      campusId,
      recruiterId: actor.id,
      company: actor.organization,
      status: 'Pending',
      reason: '',
    };
    await db.put('campus-recruiter', id, row, campusId, actor.id);
    await log(method, 'campus-recruiter', id, previous, row);
    await announce(
      accounts.filter((a) => a.role === 'campus' && a.campusId === campusId).map((a) => a.id),
      'New recruiter request',
      `${actor.organization} requests recruitment access.`,
    );
    return row;
  }
  if (method === 'reviewCampus') {
    const row = await db.get<Relationship>('campus-recruiter', required.parse(args[0]));
    requireCondition(
      row && row.campusId === actor.campusId && row.status === 'Pending',
      403,
      'Request unavailable in this campus.',
    );
    const status = z.enum(['Accepted', 'Rejected']).parse(args[1]);
    const reason = text.parse(args[2] || '');
    requireCondition(
      status !== 'Rejected' || reason.length >= 5,
      400,
      'A rejection reason is required.',
    );
    await db.put(
      'campus-recruiter',
      row.id,
      { ...row, status, reason },
      actor.campusId,
      row.recruiterId,
    );
    await log(method, 'campus-recruiter', row.id, row, { status, reason });
    await announce(
      [row.recruiterId],
      `Campus request ${status.toLowerCase()}`,
      reason || 'You can now submit job opportunities for this campus.',
    );
    return;
  }
  if (['assessments', 'createAssessment', 'startAssessment', 'submitAssessment'].includes(method)) {
    const targeted = (a: CampusAssessment, w: WorkspaceData) =>
      (!a.batch || a.batch === w.student.year) &&
      (!a.branch || a.branch.toLowerCase() === (w.student.branch || '').toLowerCase()) &&
      (!a.studentIds.length || a.studentIds.includes(actor.id));
    const own = (await db.get<WorkspaceData>('workspace', actor.id)) || emptyWorkspace(actor);
    if (method === 'assessments') {
      const attempts = await db.list<{
        assessmentId: string;
        studentId: string;
        score: number;
        date: string;
      }>('campus-assessment-attempt', actor.campusId);
      return (await db.list<CampusAssessment>('campus-assessment', actor.campusId))
        .filter((a) => actor.role === 'campus' || targeted(a, own))
        .map((a) => ({
          ...a,
          attempts: attempts
            .filter(
              (t) =>
                t.assessmentId === a.id && (actor.role === 'campus' || t.studentId === actor.id),
            )
            .map((t) => ({
              studentId: t.studentId,
              name: accounts.find((s) => s.id === t.studentId)?.name || 'Student',
              date: t.date,
              ...(actor.role === 'campus' || a.visibleResults ? { score: t.score } : {}),
            })),
          questions: a.questions.map(({ answer: _answer, ...q }) =>
            actor.role === 'campus' ? { ...q, answer: _answer } : q,
          ),
        }));
    }
    if (method === 'createAssessment') {
      const input = assessmentSchema.parse(args[0]);
      requireCondition(
        input.studentIds.every((id) =>
          accounts.some(
            (a) => a.id === id && a.campusId === actor.campusId && a.role === 'student',
          ),
        ),
        400,
        'Target students must belong to your campus.',
      );
      const row = { ...input, id: randomUUID(), campusId: actor.campusId };
      await db.put('campus-assessment', row.id, row, actor.campusId, actor.id);
      await log(method, 'campus-assessment', row.id, undefined, row);
      const profiles = await db.list<WorkspaceData>('workspace', actor.campusId);
      await announce(
        profiles
          .filter(
            (w) =>
              (!row.batch || row.batch === w.student.year) &&
              (!row.branch ||
                row.branch.toLowerCase() === (w.student.branch || '').toLowerCase()) &&
              (!row.studentIds.length || row.studentIds.includes(w.student.id)),
          )
          .map((w) => w.student.id),
        'Campus assessment published',
        row.title,
      );
      return row;
    }
    const assessment = await db.get<CampusAssessment>('campus-assessment', required.parse(args[0]));
    requireCondition(
      assessment && assessment.campusId === actor.campusId && targeted(assessment, own),
      403,
      'Assessment unavailable.',
    );
    requireCondition(
      Date.now() >= Date.parse(assessment.start) && Date.now() <= Date.parse(assessment.end),
      409,
      'Assessment is outside its availability window.',
    );
    const attemptId = `${assessment.id}:${actor.id}`;
    requireCondition(
      !(await db.get('campus-assessment-attempt', attemptId)),
      409,
      'Assessment already submitted.',
    );
    const session = await db.get<{ started: number }>('campus-assessment-session', attemptId);
    if (method === 'startAssessment') {
      if (!session)
        await db.put(
          'campus-assessment-session',
          attemptId,
          { started: Date.now() },
          actor.campusId,
          actor.id,
        );
      return {
        expiresAt: new Date(
          Math.min(
            Date.parse(assessment.end),
            (session?.started || Date.now()) + assessment.duration * 60000,
          ),
        ).toISOString(),
      };
    }
    requireCondition(
      session && Date.now() <= session.started + assessment.duration * 60000,
      409,
      'Start this assessment first; expired sessions cannot be submitted.',
    );
    const answers = z.array(z.number().int().min(-1).max(9)).parse(args[1]);
    requireCondition(
      answers.length === assessment.questions.length,
      400,
      'Provide an answer for every question.',
    );
    const id = `${assessment.id}:${actor.id}`;
    requireCondition(
      !(await db.get('campus-assessment-attempt', id)),
      409,
      'Assessment already submitted.',
    );
    const score =
      (assessment.maximumMarks *
        answers.filter((v, i) => v === assessment.questions[i].answer).length) /
      answers.length;
    await db.put(
      'campus-assessment-attempt',
      id,
      {
        id,
        assessmentId: assessment.id,
        studentId: actor.id,
        score,
        answers,
        date: new Date().toISOString(),
      },
      actor.campusId,
      actor.id,
    );
    await log(method, 'campus-assessment-attempt', id);
    return assessment.visibleResults
      ? { score, passed: score >= assessment.passingMarks }
      : { message: 'Submitted. Results are private to the campus team.' };
  }
  const drive = await db.get<StoredDrive>('drive', required.parse(args[0]));
  requireCondition(
    drive &&
      (actor.role === 'recruiter'
        ? drive.recruiterId === actor.id
        : drive.campusId === actor.campusId),
    403,
    'Drive outside your authorized scope.',
  );
  auditCampusId = drive.campusId || actor.campusId;
  if (method === 'requestSlot') {
    requireCondition(
      drive.status === 'AWAITING_RECRUITER_CONFIRMATION',
      409,
      'Wait for a campus schedule proposal.',
    );
    const requestedSlot = z
      .object({
        date,
        start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        reason: required.min(5),
      })
      .refine(
        (s) => s.start < s.end && (!drive.deadline || s.date > drive.deadline),
        'Requested slot must follow the application deadline and have valid times.',
      )
      .parse(args[1]);
    const note = `Recruiter requested ${requestedSlot.date}, ${requestedSlot.start}–${requestedSlot.end} IST. ${requestedSlot.reason}`;
    const next = {
      ...drive,
      requestedSlot,
      status: 'SCHEDULING' as const,
      reviewNote: note,
      audit: [
        ...(drive.audit || []),
        { status: 'SCHEDULING' as const, note, date: new Date().toISOString() },
      ],
    };
    await db.put('drive', drive.id, next, drive.campusId, drive.recruiterId);
    await log(method, 'drive-schedule', drive.id, drive, next);
    await announce(
      accounts.filter((a) => a.role === 'campus' && a.campusId === drive.campusId).map((a) => a.id),
      'Recruiter requested schedule change',
      note,
    );
    return;
  }
  const profiles = await db.list<WorkspaceData>('workspace', drive.campusId);
  const students = accounts.filter(
    (a) => a.campusId === drive.campusId && a.role === 'student' && a.approved,
  );
  const own = profiles.find((w) => w.student.id === actor.id);
  if (method === 'verifyEligibility') {
    const studentId = required.parse(args[1]);
    requireCondition(
      students.some((a) => a.id === studentId),
      403,
      'Student belongs to another campus.',
    );
    const approved = z.boolean().parse(args[2]);
    const reason = required.min(5).parse(args[3]);
    const approvals = (drive.eligibilityApprovals || []).filter((id) => id !== studentId);
    if (approved) approvals.push(studentId);
    await db.put(
      'drive',
      drive.id,
      { ...drive, eligibilityApprovals: approvals },
      drive.campusId,
      drive.recruiterId,
    );
    await log(method, 'drive-eligibility', `${drive.id}:${studentId}`, drive.eligibilityApprovals, {
      approved,
      reason,
    });
    await announce(
      [studentId],
      'Eligibility reviewed',
      `${drive.company}: ${approved ? 'Additional conditions verified' : 'Additional conditions not met'}. ${reason}`,
    );
    return;
  }
  if (actor.role === 'student')
    requireCondition(
      own && studentVisible(drive) && checkEligibility(own.student, drive).passed,
      403,
      'Opportunity unavailable or you are not eligible.',
    );
  const candidates: Candidate[] = profiles.flatMap((w) =>
    w.applications
      .filter((a) => a.opportunityId === (drive.opportunityId || drive.id))
      .map((a) => ({
        studentId: w.student.id,
        name: w.student.name,
        applicationId: a.id,
        stage: a.stage,
        currentRoundId: (a as typeof a & { currentRoundId?: string }).currentRoundId,
      })),
  );
  const scoped = async <T extends { driveId: string }>(kind: string) =>
    (await db.list<T>(kind, drive.campusId)).filter((r) => r.driveId === drive.id);
  const results = await scoped<CandidateResult>('candidate-round');
  const assignments = await scoped<RecruitmentAssignment>('assignment');
  const interests = (
    await db.list<{ driveId: string; studentId: string; value: string }>('interest', drive.campusId)
  ).filter((i) => i.driveId === drive.id);
  if (method === 'overview') {
    const visibleCandidates =
      actor.role === 'student' ? candidates.filter((c) => c.studentId === actor.id) : candidates;
    const reached = new Set(results.filter((r) => r.studentId === actor.id).map((r) => r.roundId));
    const submissions = (
      await db.list<AssignmentSubmission>('assignment-submission', drive.campusId)
    ).filter(
      (s) =>
        assignments.some((a) => a.id === s.assignmentId) &&
        (actor.role !== 'student' || s.studentId === actor.id),
    );
    const overview: RecruitmentOverview = {
      eligibleCandidates:
        actor.role === 'student' ||
        ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CHANGES_REQUESTED', 'REJECTED'].includes(
          drive.status,
        )
          ? []
          : profiles
              .filter(
                (w) =>
                  students.some((a) => a.id === w.student.id) &&
                  checkEligibility(w.student, drive).passed,
              )
              .map((w) => ({
                studentId: w.student.id,
                name: w.student.name,
                branch: w.student.branch || '',
              })),
      eligibilityReviews:
        actor.role === 'campus' && drive.additionalEligibility
          ? profiles
              .filter((w) => students.some((a) => a.id === w.student.id))
              .map((w) => ({
                studentId: w.student.id,
                name: w.student.name,
                approved: Boolean(drive.eligibilityApprovals?.includes(w.student.id)),
              }))
          : [],
      candidates: visibleCandidates,
      results: results.filter(
        (r) => actor.role !== 'student' || (r.studentId === actor.id && r.published),
      ),
      assignments: assignments.filter((a) => actor.role !== 'student' || reached.has(a.roundId)),
      submissions,
      slots: (await scoped<InterviewSlot>('interview-slot')).filter(
        (s) => actor.role !== 'student' || s.studentId === actor.id,
      ),
      counts: {
        total: students.length,
        eligible: profiles.filter(
          (w) =>
            students.some((a) => a.id === w.student.id) &&
            checkEligibility(w.student, drive).passed,
        ).length,
        interested: interests.filter((i) => i.value === 'Interested').length,
        applicants: candidates.length,
        shortlisted: candidates.filter((c) => !['Applied', 'Rejected', 'Absent'].includes(c.stage))
          .length,
        selected: candidates.filter((c) => c.stage === 'Selected').length,
      },
      interest: interests.find((i) => i.studentId === actor.id)?.value,
    };
    if (actor.role === 'student')
      overview.counts = {
        total: 0,
        eligible: 0,
        interested: 0,
        applicants: 0,
        shortlisted: 0,
        selected: 0,
      };
    return overview;
  }
  if (method === 'interest' || method === 'apply') {
    requireCondition(
      drive.status === 'ACTIVE' &&
        drive.deadline &&
        drive.deadline >= new Date().toISOString().slice(0, 10),
      409,
      'Applications are closed.',
    );
    const id = `${drive.id}:${actor.id}`;
    if (method === 'interest') {
      const value = z.enum(['Interested', 'Not Interested']).parse(args[1]);
      await db.put(
        'interest',
        id,
        { id, driveId: drive.id, studentId: actor.id, value },
        drive.campusId,
        actor.id,
      );
      await log(method, 'interest', id, undefined, value);
      return;
    }
    requireCondition(
      args[1] === true,
      400,
      'Review and agree to the recruitment process before applying.',
    );
    requireCondition(
      interests.some((i) => i.studentId === actor.id && i.value === 'Interested'),
      409,
      'Show interest before applying.',
    );
    requireCondition(
      !candidates.some((c) => c.studentId === actor.id),
      409,
      'You already applied.',
    );
    const requiredDocs = (drive.requiredDocuments || 'Resume')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    requireCondition(
      own &&
        requiredDocs.every((type) =>
          own.documents.some((d) => d.type.toLowerCase() === type && d.status !== 'Rejected'),
        ),
      409,
      'Upload all required documents before applying.',
    );
    const resumeId = args[2]
      ? required.parse(args[2])
      : own.documents.find((d) => d.type.toLowerCase() === 'resume')?.id;
    requireCondition(
      own.documents.some((d) => d.id === resumeId && d.type.toLowerCase() === 'resume'),
      400,
      'Select your uploaded resume.',
    );
    const application = {
      resumeId,
      id: randomUUID(),
      opportunityId: drive.opportunityId || drive.id,
      stage: 'Applied',
      date: new Date().toISOString().slice(0, 10),
      currentRoundId: drive.rounds?.[0]?.id,
    };
    own.applications.push(application);
    await db.put('workspace', actor.id, own, actor.campusId, actor.id);
    await db.put(
      'application',
      application.id,
      { ...application, driveId: drive.id, studentId: actor.id },
      drive.campusId,
      actor.id,
    );
    await db.put(
      'drive',
      drive.id,
      { ...drive, applicants: candidates.length + 1 },
      drive.campusId,
      drive.recruiterId,
    );
    if (application.currentRoundId) {
      const result: CandidateResult = {
        id: `${application.id}:${application.currentRoundId}`,
        driveId: drive.id,
        applicationId: application.id,
        studentId: actor.id,
        roundId: application.currentRoundId,
        status: 'Pending',
        feedback: '',
        published: false,
      };
      await db.put('candidate-round', result.id, result, drive.campusId, actor.id);
    }
    await log(method, 'application', application.id, undefined, application);
    await announce(
      [actor.id, drive.recruiterId],
      'New application',
      `${actor.name} applied for ${drive.role}.`,
    );
    return application;
  }
  const round = drive.rounds?.find(
    (r) => r.id === args[1] || r.id === (args[1] as { roundId?: string })?.roundId,
  );
  if (method === 'saveAssignment') {
    const input = assignmentSchema.parse(args[1]);
    requireCondition(
      round?.type === 'Assignment',
      409,
      'Assignments belong only to Assignment rounds.',
    );
    requireCondition(
      !results.some((r) => r.roundId === round.id && r.published),
      409,
      'This round has already published results.',
    );
    const row = { ...input, id: `${drive.id}:${round.id}`, driveId: drive.id };
    const old = await db.get('assignment', row.id);
    await db.put('assignment', row.id, row, drive.campusId, actor.id);
    await log(method, 'assignment', row.id, old, row);
    await announce(
      candidates
        .filter((c) => c.currentRoundId === round.id && !['Rejected', 'Absent'].includes(c.stage))
        .map((c) => c.studentId),
      'Assignment available',
      row.title,
    );
    return row;
  }
  if (method === 'submitAssignment') {
    const assignment = assignments.find((a) => a.id === args[1]);
    const candidate = candidates.find((c) => c.studentId === actor.id);
    requireCondition(
      drive.status === 'IN_PROGRESS' &&
        assignment &&
        candidate?.currentRoundId === assignment.roundId &&
        !['Rejected', 'Absent'].includes(candidate.stage),
      403,
      'You have not reached this assignment round.',
    );
    requireCondition(
      Date.now() <= Date.parse(assignment.deadline),
      409,
      'Assignment deadline passed.',
    );
    const documentId = args[3] ? required.parse(args[3]) : undefined;
    const document = documentId ? own?.documents.find((d) => d.id === documentId) : undefined;
    if (documentId) {
      requireCondition(
        document && (document as typeof document & { storageKey?: string }).storageKey,
        403,
        'Choose a file uploaded to your own documents.',
      );
      const extension = document.name.split('.').at(-1)?.toLowerCase() || '';
      const allowed = assignment.allowedTypes
        .toLowerCase()
        .split(/[,;\s]+/)
        .map((t) => t.replace(/^\./, ''));
      requireCondition(
        allowed.includes(extension),
        400,
        'This file type is not allowed for the assignment.',
      );
    }
    const row: AssignmentSubmission = {
      documentId,
      documentName: document?.name,
      id: `${assignment.id}:${actor.id}`,
      assignmentId: assignment.id,
      applicationId: candidate.applicationId,
      studentId: actor.id,
      content: required.parse(args[2] || (documentId ? 'Attached submission' : '')),
      submittedAt: new Date().toISOString(),
    };
    await db.put('assignment-submission', row.id, row, drive.campusId, actor.id);
    await log(method, 'assignment-submission', row.id, undefined, row);
    return row;
  }
  if (method === 'saveResults' || method === 'publishResults') {
    requireCondition(
      round && drive.status === 'IN_PROGRESS',
      409,
      'Start the drive and choose a recruitment round.',
    );
    if (method === 'saveResults') {
      const rows = z
        .array(
          z.object({
            applicationId: required,
            status: z.enum(['Pending', 'Qualified', 'Rejected', 'Absent', 'Under Review']),
            score: z.number().min(0).optional(),
            feedback: text,
          }),
        )
        .min(1)
        .max(1000)
        .parse(args[2]);
      for (const row of rows) {
        const candidate = candidates.find((c) => c.applicationId === row.applicationId);
        requireCondition(
          candidate?.currentRoundId === round.id &&
            !['Selected', 'Rejected', 'Absent'].includes(candidate.stage),
          409,
          'Candidate is not participating in this round.',
        );
        requireCondition(
          !results.some(
            (r) => r.applicationId === row.applicationId && r.roundId === round.id && r.published,
          ),
          409,
          'Published results cannot be edited.',
        );
        const previous = results.find(
          (r) => r.applicationId === row.applicationId && r.roundId === round.id,
        );
        row.score ??= previous?.score;
        const maximumScore =
          round.maximumScore ?? assignments.find((a) => a.roundId === round.id)?.maximumMarks;
        requireCondition(
          row.score === undefined || (maximumScore !== undefined && row.score <= maximumScore),
          400,
          'Score exceeds the round maximum.',
        );
        requireCondition(
          row.status !== 'Qualified' ||
            round.passingScore === undefined ||
            (row.score !== undefined && row.score >= round.passingScore),
          400,
          'Qualified score is below passing score.',
        );
        const result = {
          ...row,
          id: `${row.applicationId}:${round.id}`,
          driveId: drive.id,
          studentId: candidate.studentId,
          roundId: round.id,
          published: false,
        };
        await db.put('candidate-round', result.id, result, drive.campusId, candidate.studentId);
        await log(
          method,
          'candidate-round',
          result.id,
          results.find((r) => r.id === result.id),
          result,
        );
      }
      return;
    }
    const participating = candidates.filter(
      (c) => c.currentRoundId === round.id && !['Selected', 'Rejected', 'Absent'].includes(c.stage),
    );
    requireCondition(participating.length > 0, 409, 'No unpublished participants in this round.');
    requireCondition(
      participating.every((c) =>
        results.some(
          (r) =>
            r.applicationId === c.applicationId &&
            r.roundId === round.id &&
            ['Qualified', 'Rejected', 'Absent'].includes(r.status) &&
            !r.published,
        ),
      ),
      409,
      'Resolve all participating candidates before publishing.',
    );
    const next = drive.rounds![drive.rounds!.findIndex((r) => r.id === round.id) + 1];
    for (const candidate of participating) {
      const result = results.find(
        (r) => r.applicationId === candidate.applicationId && r.roundId === round.id,
      )!;
      const profile = profiles.find((w) => w.student.id === candidate.studentId)!;
      const application = profile.applications.find((a) => a.id === candidate.applicationId)!;
      // Non-elimination rounds are informational, but only an explicit Qualified decision advances.
      application.stage = result.status === 'Qualified' ? next?.name || 'Selected' : result.status;
      Object.assign(application, {
        currentRoundId: result.status === 'Qualified' ? next?.id : undefined,
      });
      await db.put('workspace', candidate.studentId, profile, drive.campusId, candidate.studentId);
      await db.put(
        'application',
        application.id,
        { ...application, driveId: drive.id, studentId: candidate.studentId },
        drive.campusId,
        candidate.studentId,
      );
      await db.put(
        'candidate-round',
        result.id,
        { ...result, published: true },
        drive.campusId,
        candidate.studentId,
      );
      if (result.status === 'Qualified' && next) {
        const row = {
          id: `${application.id}:${next.id}`,
          driveId: drive.id,
          studentId: candidate.studentId,
          applicationId: application.id,
          roundId: next.id,
          status: 'Pending',
          feedback: '',
          published: false,
        };
        await db.put('candidate-round', row.id, row, drive.campusId, candidate.studentId);
      }
      await announce(
        [candidate.studentId],
        next && result.status === 'Qualified'
          ? next.type === 'Assignment'
            ? 'Assignment available'
            : 'New recruitment round'
          : 'Round result published',
        `${round.name}: ${result.status}. ${application.stage}`,
      );
    }
    await log(
      method,
      'recruitment-round',
      round.id,
      undefined,
      participating.map((c) => c.applicationId),
    );
    return;
  }
  if (method === 'scheduleInterview') {
    const input = slotSchema.parse(args[1]);
    const candidate = candidates.find((c) => c.studentId === input.studentId);
    requireCondition(
      round &&
        round.type?.includes('Interview') &&
        candidate?.currentRoundId === round.id &&
        !['Rejected', 'Absent'].includes(candidate.stage),
      409,
      'Choose a candidate in an interview round.',
    );
    requireCondition(
      !input.override || (actor.role === 'campus' && (input.reason?.trim().length || 0) >= 5),
      403,
      'Only campus staff can override conflicts with a reason.',
    );
    requireCondition(
      input.mode !== 'Online' || /^https:\/\//.test(input.meetingLink),
      400,
      'Online interviews require an HTTPS meeting link.',
    );
    const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    const id = `${drive.id}:${round.id}:${input.studentId}`;
    const slots = await db.list<InterviewSlot & { recruiterId: string }>('interview-slot');
    const allDrives = await db.list<StoredDrive>('drive');
    const overlap = slots.some(
      (s) =>
        s.id !== id &&
        !['CANCELLED', 'REJECTED', 'COMPLETED'].includes(
          allDrives.find((d) => d.id === s.driveId)?.status || '',
        ) &&
        s.date === input.date &&
        minutes(s.time) < minutes(input.time) + input.duration &&
        minutes(input.time) < minutes(s.time) + s.duration &&
        (s.studentId === input.studentId ||
          (s.recruiterId === drive.recruiterId && s.panel === input.panel) ||
          (allDrives.find((d) => d.id === s.driveId)?.campusId === drive.campusId &&
            s.venue &&
            s.venue === input.venue &&
            s.room === input.room)),
    );
    const legacy = profiles
      .find((w) => w.student.id === input.studentId)
      ?.interviews.some(
        (i) =>
          i.status === 'Scheduled' &&
          i.date === input.date &&
          minutes(i.time) < minutes(input.time) + input.duration &&
          minutes(input.time) < minutes(i.time) + 60,
      );
    requireCondition(
      input.override || (!overlap && !legacy),
      409,
      'Schedule Conflict: candidate, room, or panel overlaps an existing interview.',
    );
    const row = { ...input, id, driveId: drive.id, recruiterId: drive.recruiterId };
    await log(method, 'interview-slot', id, await db.get('interview-slot', id), row);
    await db.put('interview-slot', id, row, drive.campusId, input.studentId);
    await announce(
      [input.studentId],
      'Interview scheduled',
      `${round.name}: ${input.date}, ${input.time} IST, ${input.venue || input.meetingLink}`,
    );
    return row;
  }
  throw new Error('Recruitment method not found.');
}
