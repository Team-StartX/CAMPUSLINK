import { z } from 'zod';
import type { Drive, DriveSchedule } from '@/types';
import { roundTypes } from '@/types/recruitment';
import { skillNames } from '@/utils/skills';
import { branchCode } from '@/utils/placement';
const skillList = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (value) => skillNames(value).every((name) => name.length <= 80),
    'Each skill name must be at most 80 characters.',
  );
const criteriaList = z
  .string()
  .trim()
  .min(1)
  .refine(
    (value) => value.split(',').every((item) => item.trim().length > 0),
    'Enter names separated by commas, without empty entries.',
  );
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, 'Enter a valid calendar date.');
const clockTime = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time.');

export const driveRequestSchema = z.object({
  workMode: z.enum(['On-site', 'Hybrid', 'Remote']).optional(),
  responsibilities: z.string().max(10000).optional(),
  stipend: z.string().max(300).optional(),
  bond: z.string().max(3000).optional(),
  joiningDate: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional(),
  requiredDocuments: z.string().max(1000).optional(),
  additionalEligibility: z.string().max(3000).optional(),
  requireSkills: z.boolean().optional(),
  campusId: z.string().min(1, 'Select a campus.'),
  company: z.string().trim().min(2),
  role: z.string().trim().min(2, 'Enter the role.'),
  location: z.string().trim().min(2),
  ctc: z.string().trim().min(1),
  description: z.string().trim().min(20, 'Add a job description of at least 20 characters.'),
  vacancies: z.number().int().min(1).max(500),
  cgpa: z.number().min(0).max(10),
  courses: criteriaList,
  branches: criteriaList,
  graduationYear: z
    .string()
    .regex(/^\d{4}(\s*,\s*\d{4})*$/, 'Use graduation years separated by commas.'),
  allowedBacklogs: z.number().int().min(0).max(10),
  skills: skillList.refine(
    (value) => skillNames(value).length > 0,
    'Enter at least one required skill, such as Python or SQL.',
  ),
  preferredSkills: skillList.optional(),
  deadline: calendarDate,
  preferredDates: z.array(calendarDate).min(1).max(3),
  teamSize: z.number().int().min(1).max(50),
  labs: z.number().int().min(0),
  rooms: z.number().int().min(0),
  systems: z.number().int().min(0).max(1000),
  rounds: z
    .array(
      z
        .object({
          type: z.enum(roundTypes).optional(),
          description: z.string().max(5000).optional(),
          mode: z.enum(['Online', 'Offline']).optional(),
          elimination: z.boolean().optional(),
          maximumScore: z.number().min(0).optional(),
          passingScore: z.number().min(0).optional(),
          instructions: z.string().max(5000).optional(),
          id: z.string().min(1).max(100),
          name: z.string().trim().min(1),
          duration: z.number().int().min(5).max(480),
          capacity: z.number().int().min(1),
          requirements: z.string(),
          cleared: z.number().min(0),
        })
        .refine(
          (r) =>
            r.passingScore === undefined ||
            (r.maximumScore !== undefined && r.passingScore <= r.maximumScore),
          { message: 'Passing score must not exceed maximum score.' },
        ),
    )
    .min(1)
    .max(30)
    .refine(
      (rounds) => new Set(rounds.map((r) => r.id)).size === rounds.length,
      'Each round must have a unique identifier.',
    ),
});
export const scheduleSchema = z
  .object({
    building: z.string().max(300).optional(),
    meetingLink: z.string().max(1000).optional(),
    coordinator: z.string().max(300).optional(),
    instructions: z.string().max(3000).optional(),
    notes: z.string().max(3000).optional(),
    date: calendarDate,
    reporting: clockTime,
    talk: clockTime,
    assessment: clockTime,
    interviews: clockTime,
    end: clockTime,
    venue: z.string().trim().min(2),
    lab: z.string(),
    rooms: z.string(),
    systems: z.number().int().min(0),
  })
  .refine(
    (s) =>
      s.reporting <= s.talk &&
      s.talk <= s.assessment &&
      s.assessment <= s.interviews &&
      s.interviews < s.end,
    {
      message:
        'Use chronological times: reporting, presentation, assessment, interviews, then end.',
    },
  );
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
        const booked = (d.schedule?.[k] || '')
          .toLowerCase()
          .split(/[,;]/)
          .map((name) => name.trim())
          .filter(Boolean);
        return schedule[k]
          .toLowerCase()
          .split(/[,;]/)
          .some((name) => name.trim() && booked.includes(name.trim()));
      });
      if (d.company === current?.company) reasons.push('recruiter availability');
      if (
        (d.branches || '')
          .split(',')
          .some((b) => (current?.branches || '').split(',').map(branchCode).includes(branchCode(b)))
      )
        reasons.push('student cohort overlap');
      return reasons.length
        ? [{ driveId: d.id, company: d.company, reasons, date: d.schedule!.date }]
        : [];
    });
}
