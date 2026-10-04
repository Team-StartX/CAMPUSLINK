import { DomainError } from '@/utils/domain-error';
import { z } from 'zod';
import { mockAdapter } from '@/mocks/adapter';
import { defaultDrive } from '@/mocks/placement';
import { Drive, DriveSchedule, DriveStatus, Role } from '@/types';
import { checkEligibility, driveOpportunity, studentVisible } from '@/utils/placement';
import { fit } from '@/utils/scoring';

export const driveRequestSchema = z.object({
  campusId: z.string().min(1, 'Select a campus.'),
  company: z.string().trim().min(2),
  role: z.string().trim().min(2, 'Enter the role.'),
  location: z.string().trim().min(2),
  ctc: z.string().trim().min(1),
  description: z.string().trim().min(20, 'Add a job description of at least 20 characters.'),
  vacancies: z.number().int().min(1).max(500),
  cgpa: z.number().min(0).max(10),
  courses: z.string().trim().min(1),
  branches: z.string().trim().min(1),
  graduationYear: z
    .string()
    .regex(/^\d{4}(\s*,\s*\d{4})*$/, 'Use graduation years separated by commas.'),
  allowedBacklogs: z.number().int().min(0).max(10),
  skills: z.string().trim().min(1),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(3),
  teamSize: z.number().int().min(1).max(50),
  labs: z.number().int().min(0),
  rooms: z.number().int().min(0),
  systems: z.number().int().min(0).max(1000),
  rounds: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1),
        duration: z.number().int().min(5).max(480),
        capacity: z.number().int().min(1),
        requirements: z.string(),
        cleared: z.number().min(0),
      }),
    )
    .min(1),
});
export const scheduleSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reporting: z.string().regex(/^\d{2}:\d{2}$/),
    talk: z.string().regex(/^\d{2}:\d{2}$/),
    assessment: z.string().regex(/^\d{2}:\d{2}$/),
    interviews: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
    venue: z.string().trim().min(2),
    lab: z.string(),
    rooms: z.string(),
    systems: z.number().int().min(0),
  })
  .refine(
    (s) =>
      s.reporting <= s.talk &&
      s.talk < s.assessment &&
      s.assessment < s.interviews &&
      s.interviews < s.end,
    { message: 'Times must follow reporting → talk → assessment → interviews → end.' },
  );
type Action =
  | 'review'
  | 'changes'
  | 'reject'
  | 'approve'
  | 'confirm'
  | 'request-change'
  | 'finalize'
  | 'activate'
  | 'start'
  | 'complete'
  | 'cancel'
  | 'resubmit';
const transitions: Record<Action, { role: Role; from: DriveStatus[]; to: DriveStatus }> = {
  review: { role: 'campus', from: ['SUBMITTED'], to: 'UNDER_REVIEW' },
  changes: { role: 'campus', from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'CHANGES_REQUESTED' },
  reject: { role: 'campus', from: ['SUBMITTED', 'UNDER_REVIEW', 'SCHEDULING'], to: 'REJECTED' },
  approve: { role: 'campus', from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'SCHEDULING' },
  confirm: { role: 'recruiter', from: ['AWAITING_RECRUITER_CONFIRMATION'], to: 'CONFIRMED' },
  'request-change': {
    role: 'recruiter',
    from: ['AWAITING_RECRUITER_CONFIRMATION'],
    to: 'SCHEDULING',
  },
  finalize: { role: 'campus', from: ['CONFIRMED'], to: 'CONFIRMED' },
  activate: { role: 'campus', from: ['CONFIRMED'], to: 'ACTIVE' },
  start: { role: 'campus', from: ['ACTIVE'], to: 'IN_PROGRESS' },
  complete: { role: 'campus', from: ['IN_PROGRESS'], to: 'COMPLETED' },
  cancel: {
    role: 'campus',
    from: ['SCHEDULING', 'AWAITING_RECRUITER_CONFIRMATION', 'CONFIRMED', 'ACTIVE'],
    to: 'CANCELLED',
  },
  resubmit: { role: 'recruiter', from: ['DRAFT', 'CHANGES_REQUESTED'], to: 'SUBMITTED' },
};
function audit(drive: Drive, status: DriveStatus, note: string) {
  drive.status = status;
  drive.reviewNote = note;
  drive.audit = [...(drive.audit || []), { status, note, date: new Date().toISOString() }];
}
export function scheduleConflicts(drives: Drive[], id: string, schedule: DriveSchedule) {
  const current = drives.find((d) => d.id === id);
  return drives
    .filter(
      (d) =>
        d.id !== id &&
        d.campusId === current?.campusId &&
        d.schedule?.date === schedule.date &&
        !['DRAFT', 'REJECTED', 'CANCELLED', 'COMPLETED'].includes(d.status) &&
        d.schedule.reporting < schedule.end &&
        schedule.reporting < d.schedule.end,
    )
    .flatMap((d) => {
      const reasons = ['venue', 'lab', 'rooms'].filter((key) => {
        const k = key as 'venue' | 'lab' | 'rooms';
        return (
          schedule[k].trim() &&
          schedule[k].trim().toLowerCase() === d.schedule?.[k].trim().toLowerCase()
        );
      });
      if (d.company === current?.company) reasons.push('recruiter availability');
      if (
        (d.branches || '').split(',').some((b) =>
          (current?.branches || '')
            .split(',')
            .map((v) => v.trim().toLowerCase())
            .includes(b.trim().toLowerCase()),
        )
      )
        reasons.push('student cohort overlap');
      return reasons.length
        ? [{ driveId: d.id, company: d.company, reasons, date: d.schedule!.date }]
        : [];
    });
}
export const driveService = {
  getRequestDefaults: (patch: Partial<Drive> = {}) => defaultDrive(patch),
  getCampuses: async () => (await mockAdapter.read()).campuses || [],
  getDriveRequests: async () => (await mockAdapter.read()).drives,
  getDrive: async (id: string) => (await mockAdapter.read()).drives.find((d) => d.id === id),
  createDriveRequest: async (input: Partial<Drive>, draft = false) => {
    const candidate = defaultDrive(input);
    if (!draft) driveRequestSchema.parse(candidate);
    return mockAdapter.update((data) => {
      const campus = data.campuses?.find((c) => c.id === candidate.campusId);
      if (!campus) throw new DomainError('Select an available campus.');
      if (candidate.preferredDates?.filter(Boolean).some((date) => candidate.deadline! >= date))
        throw new DomainError('The application deadline must be before the campus visit.');
      const drive = {
        ...candidate,
        id: crypto.randomUUID(),
        campus: campus.name,
        applicants: 0,
        status: (draft ? 'DRAFT' : 'SUBMITTED') as DriveStatus,
      };
      audit(
        drive,
        drive.status,
        draft
          ? 'Draft saved by recruiter.'
          : 'Recruiter requested an on-campus visit. Awaiting campus review.',
      );
      data.drives.push(drive);
      return drive;
    });
  },
  updateDriveRequest: async (id: string, patch: Partial<Drive>) =>
    mockAdapter.update((data) => {
      const drive = data.drives.find((d) => d.id === id);
      if (!drive || !['DRAFT', 'CHANGES_REQUESTED'].includes(drive.status))
        throw new DomainError('Only drafts or requests needing changes can be edited.');
      const candidate = { ...drive, ...patch, id: drive.id, status: drive.status };
      driveRequestSchema.parse(candidate);
      Object.assign(drive, candidate);
    }),
  transition: async (id: string, action: Action, role: Role, note = '') =>
    mockAdapter.update((data) => {
      const drive = data.drives.find((d) => d.id === id);
      const rule = transitions[action];
      if (!drive || rule.role !== role || !rule.from.includes(drive.status))
        throw new DomainError('This action is not available at the current drive stage.');
      if (
        ['changes', 'reject', 'request-change', 'cancel'].includes(action) &&
        note.trim().length < 5
      )
        throw new DomainError('Add a reason of at least 5 characters.');
      if (['confirm', 'activate', 'finalize'].includes(action) && !drive.schedule)
        throw new DomainError('A campus schedule is required.');
      if (
        action === 'activate' &&
        !drive.audit?.some(
          (a) => a.status === 'CONFIRMED' && a.note === 'Schedule finalized by campus.',
        )
      )
        throw new DomainError('Finalize the confirmed schedule before activation.');
      if (action === 'resubmit') driveRequestSchema.parse(drive);
      audit(
        drive,
        rule.to,
        action === 'finalize'
          ? 'Schedule finalized by campus.'
          : note || `${action[0].toUpperCase()}${action.slice(1)} completed by ${role}.`,
      );
      if (action === 'activate') {
        data.opportunities = data.opportunities.filter(
          (o) => o.driveId !== drive.id && o.id !== drive.opportunityId,
        );
        data.opportunities.push(driveOpportunity(drive));
        if (checkEligibility(data.student, drive).passed)
          data.notifications.unshift({
            id: crypto.randomUUID(),
            title: `${drive.company} campus drive is open.`,
            body: `You meet the eligibility criteria for ${drive.role}. Apply before ${drive.deadline}.`,
            read: false,
            type: 'Campus Drive',
          });
      }
    }),
  proposeSchedule: async (id: string, input: DriveSchedule) => {
    const schedule = scheduleSchema.parse(input);
    return mockAdapter.update((data) => {
      const drive = data.drives.find((d) => d.id === id);
      if (!drive || drive.status !== 'SCHEDULING')
        throw new DomainError('The drive must be approved for scheduling first.');
      const conflicts = scheduleConflicts(data.drives, id, schedule);
      if (conflicts.length)
        throw new DomainError(
          `Scheduling conflict with ${conflicts.map((c) => `${c.company}: ${c.reasons.join(', ')}`).join('; ')}. Choose another date or allocate different resources.`,
        );
      if (schedule.systems < (drive.systems || 0))
        throw new DomainError(`Allocate at least ${drive.systems} computer systems.`);
      if (drive.deadline && drive.deadline > schedule.date)
        throw new DomainError('Visit must follow the application deadline.');
      drive.schedule = schedule;
      audit(
        drive,
        'AWAITING_RECRUITER_CONFIRMATION',
        'Campus proposed a date, round times, and physical resources.',
      );
    });
  },
  getCampusOpportunities: async () => {
    const data = await mockAdapter.read();
    return data.drives
      .filter((d) => studentVisible(d) && checkEligibility(data.student, d).passed)
      .map((d) => ({
        ...driveOpportunity(
          d,
          data.opportunities.find((o) => o.id === d.opportunityId),
        ),
        match: fit(data.student, d, data.history).score,
      }))
      .sort((a, b) => b.match - a.match);
  },
  updateAttendance: async (id: string, attended: number) =>
    mockAdapter.update((data) => {
      const drive = data.drives.find((d) => d.id === id);
      if (
        !drive ||
        drive.status !== 'IN_PROGRESS' ||
        !Number.isInteger(attended) ||
        attended < 0 ||
        attended > drive.applicants
      )
        throw new DomainError('Attendance must be between zero and registered applicants.');
      drive.attended = attended;
    }),
  updateRound: async (id: string, roundId: string, cleared: number) =>
    mockAdapter.update((data) => {
      const drive = data.drives.find((d) => d.id === id);
      const index = drive?.rounds?.findIndex((r) => r.id === roundId) ?? -1;
      const round = drive?.rounds?.[index];
      const previous = index === 0 ? drive?.attended || 0 : drive?.rounds?.[index - 1].cleared || 0;
      if (
        !drive ||
        drive.status !== 'IN_PROGRESS' ||
        !round ||
        !Number.isInteger(cleared) ||
        cleared < 0 ||
        cleared > previous
      )
        throw new DomainError(
          'Round results cannot exceed attendees or the previous cleared round.',
        );
      if (drive.rounds?.slice(index + 1).some((r) => r.cleared > cleared))
        throw new DomainError('Update later rounds first before reducing this count.');
      round.cleared = cleared;
    }),
};
