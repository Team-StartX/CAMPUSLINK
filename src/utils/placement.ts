import { Drive, DriveStatus, Opportunity, Student } from '@/types';

export const driveStatuses: DriveStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'SCHEDULING',
  'AWAITING_RECRUITER_CONFIRMATION',
  'CONFIRMED',
  'ACTIVE',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];
export const statusLabel = (status: DriveStatus) =>
  status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (s) => s.toUpperCase());
export const studentVisible = (drive: Drive) => ['ACTIVE', 'IN_PROGRESS'].includes(drive.status);
const values = (s = '') =>
  s
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
const branchCode = (s: string) =>
  ({
    'computer science': 'cse',
    'information technology': 'it',
    electronics: 'ece',
    mechanical: 'me',
    electrical: 'ee',
  })[s.toLowerCase()] || s.toLowerCase();
export function checkEligibility(student: Student, drive: Drive) {
  const branch = branchCode(student.branch || student.course.split('·')[1]?.trim() || '');
  const checks = [
    {
      name: 'Campus',
      passed: student.campus === drive.campus,
      detail: drive.campus || 'Campus not selected',
    },
    {
      name: 'Course',
      passed: values(drive.courses).includes(student.course.split('·')[0].trim().toLowerCase()),
      detail: drive.courses || 'No eligible courses',
    },
    {
      name: 'Branch',
      passed: values(drive.branches).map(branchCode).includes(branch),
      detail: drive.branches || 'No eligible branches',
    },
    {
      name: 'Graduation year',
      passed: values(drive.graduationYear).includes(student.year),
      detail: drive.graduationYear || 'Not specified',
    },
    {
      name: 'CGPA',
      passed: student.cgpa >= drive.cgpa,
      detail: `Minimum ${drive.cgpa}; your CGPA ${student.cgpa}`,
    },
    {
      name: 'Active backlogs',
      passed: (student.activeBacklogs ?? 0) <= (drive.allowedBacklogs ?? 0),
      detail: `Up to ${drive.allowedBacklogs ?? 0} allowed; yours ${student.activeBacklogs ?? 0}`,
    },
  ];
  return { passed: checks.every((c) => c.passed), checks };
}
export function driveOpportunity(drive: Drive, existing?: Opportunity): Opportunity {
  return {
    id: drive.opportunityId || drive.id,
    driveId: drive.id,
    company: drive.company,
    role: drive.role,
    location: drive.location,
    ctc: drive.ctc,
    skills: drive.skills
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    match: existing?.match ?? 86,
    deadline: drive.deadline || drive.schedule?.date || '2026-10-12',
    color: existing?.color || 'sage',
    type: drive.workType || 'Full-time',
    campus: drive.campus,
    visitDate: drive.schedule?.date,
    venue: drive.schedule?.venue,
  };
}
