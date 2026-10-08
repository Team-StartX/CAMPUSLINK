import { Drive, DriveStatus, Opportunity, Student } from '@/types';
import { normalizeSkill, skillNames } from './skills';

export const driveStatuses: DriveStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'SCHEDULING',
  'AWAITING_RECRUITER_CONFIRMATION',
  'CONFIRMED',
  'ACTIVE',
  'APPLICATIONS_CLOSED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];
export const statusLabel = (status: DriveStatus) =>
  (
    ({
      SUBMITTED: 'Pending Campus Approval',
      UNDER_REVIEW: 'Campus Review',
      ACTIVE: 'Applications Open',
      CONFIRMED: 'Schedule Confirmed',
    }) as Partial<Record<DriveStatus, string>>
  )[status] ||
  status
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (s) => s.toUpperCase());
export const studentVisible = (drive: Drive) =>
  ['ACTIVE', 'APPLICATIONS_CLOSED', 'IN_PROGRESS', 'COMPLETED'].includes(drive.status) &&
  (drive.workflowVersion !== 2 ||
    Boolean(
      drive.schedule &&
      drive.audit?.some((a) => a.status === 'SCHEDULING') &&
      drive.audit?.some((a) => a.status === 'CONFIRMED') &&
      drive.audit?.some((a) => a.status === 'ACTIVE'),
    ));
const values = (s = '') =>
  s
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
export const branchCode = (s: string) =>
  ({
    'computer science': 'cse',
    'computer science engineering': 'cse',
    'computer science and engineering': 'cse',
    'information technology': 'it',
    electronics: 'ece',
    mechanical: 'me',
    electrical: 'ee',
  })[s.trim().toLowerCase()] || s.trim().toLowerCase();
export function checkEligibility(student: Student, drive: Drive) {
  const branch = branchCode(student.branch || student.course.split('·')[1]?.trim() || '');
  const missingSkills = skillNames(drive.skills).filter(
    (name) => !student.skills.some((skill) => normalizeSkill(skill.name) === normalizeSkill(name)),
  );
  const checks = [
    ...(drive.additionalEligibility?.trim()
      ? [
          {
            name: 'Additional recruiter conditions',
            passed: Boolean(drive.eligibilityApprovals?.includes(student.id)),
            detail: drive.additionalEligibility,
          },
        ]
      : []),
    ...(drive.requireSkills
      ? [
          {
            name: 'Required skills',
            passed: missingSkills.length === 0,
            detail: missingSkills.length
              ? `Missing skills: ${missingSkills.join(', ')}`
              : `All required skills recorded: ${drive.skills}`,
          },
        ]
      : []),
    {
      name: 'Campus',
      passed:
        Boolean(drive.campus) &&
        student.campus.trim().toLowerCase() === drive.campus?.trim().toLowerCase(),
      detail: `Required: ${drive.campus || 'Campus not selected'}; yours: ${student.campus || 'Not recorded'}`,
    },
    {
      name: 'Course',
      passed: values(drive.courses).includes(student.course.split('·')[0].trim().toLowerCase()),
      detail: `Allowed: ${drive.courses || 'None'}; yours: ${student.course.split('·')[0].trim() || 'Not recorded'}`,
    },
    {
      name: 'Branch',
      passed: values(drive.branches).map(branchCode).includes(branch),
      detail: `Allowed: ${drive.branches || 'None'}; yours: ${student.branch || student.course.split('·')[1]?.trim() || 'Not recorded'}`,
    },
    {
      name: 'Graduation year',
      passed: values(drive.graduationYear).includes(student.year),
      detail: `Allowed: ${drive.graduationYear || 'None'}; yours: ${student.year || 'Not recorded'}`,
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
    workMode: drive.workMode,
    logo: drive.companyDetails?.logo,
    driveId: drive.id,
    company: drive.company,
    role: drive.role,
    location: drive.location,
    ctc: drive.ctc,
    skills: skillNames(drive.skills),
    match: existing?.match ?? 0,
    deadline: drive.deadline || drive.schedule?.date || '',
    color: existing?.color || 'sage',
    type: drive.workType || 'Full-time',
    campus: drive.campus,
    visitDate: drive.schedule?.date,
    venue: drive.schedule?.venue,
  };
}

export function scheduleFinalized(drive: Drive) {
  const history = drive.audit || [];
  const proposal = history.findLastIndex((a) => a.status === 'AWAITING_RECRUITER_CONFIRMATION');
  return (
    history.findLastIndex(
      (a) => a.status === 'CONFIRMED' && a.note === 'Schedule finalized by campus.',
    ) > proposal
  );
}
