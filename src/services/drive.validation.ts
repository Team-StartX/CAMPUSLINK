import { z } from 'zod';
import type { Drive, DriveSchedule } from '@/types';

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
