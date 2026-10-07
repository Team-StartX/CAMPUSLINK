import { Campus, WorkspaceData, Drive, DriveStatus } from '@/types';

export const campuses: Campus[] = [
  {
    id: 'dtu',
    name: 'Delhi Technological University',
    location: 'Delhi',
    studentPool: 1248,
    courses: ['B.Tech', 'M.Tech'],
    branches: ['CSE', 'IT', 'ECE', 'EE', 'ME'],
  },
  {
    id: 'iit-bbs',
    name: 'IIT Bhubaneswar',
    location: 'Bhubaneswar',
    studentPool: 684,
    courses: ['B.Tech', 'M.Tech'],
    branches: ['CSE', 'ECE', 'EE', 'ME'],
  },
  {
    id: 'nit-rkl',
    name: 'NIT Rourkela',
    location: 'Rourkela',
    studentPool: 912,
    courses: ['B.Tech', 'M.Tech'],
    branches: ['CSE', 'IT', 'ECE', 'ME'],
  },
  {
    id: 'utkal',
    name: 'Utkal University',
    location: 'Bhubaneswar',
    studentPool: 540,
    courses: ['MCA', 'B.Sc', 'MBA'],
    branches: ['Computer Science', 'Management'],
  },
];
export function defaultDrive(d: Partial<Drive>): Drive {
  const date = d.preferredDates?.[0] || '2026-10-18';
  return {
    id: '',
    company: 'Razorpay',
    role: 'Software Engineer',
    location: 'Bengaluru',
    ctc: '10–14 LPA',
    vacancies: 20,
    description: 'Build reliable products with a collaborative engineering team.',
    cgpa: 7,
    skills: 'React, SQL, JavaScript',
    status: 'SUBMITTED',
    applicants: 0,
    campusId: 'dtu',
    campus: campuses[0].name,
    courses: 'B.Tech',
    branches: 'CSE, IT, ECE',
    graduationYear: '2027',
    allowedBacklogs: 0,
    backlogRules: 'No active backlogs',
    preferredSkills: 'AWS, Docker',
    workType: 'Full-time',
    department: 'Engineering',
    preferredDates: [date, '2026-10-19', '2026-10-22'],
    deadline: '2026-10-12',
    teamSize: 4,
    hall: true,
    labs: 1,
    rooms: 3,
    systems: 60,
    otherRequirements: 'Projector and campus Wi-Fi',
    rounds: [
      'Pre-placement talk',
      'Aptitude assessment',
      'Coding assessment',
      'Technical interview',
      'HR interview',
    ].map((name, i) => ({
      id: `round-${i}`,
      name,
      duration: i === 0 ? 30 : 60,
      capacity: 60,
      requirements: i === 2 ? 'Computer lab' : 'Seminar hall / interview rooms',
      cleared: 0,
    })),
    selectionProcess:
      'Pre-placement talk → Aptitude assessment → Coding assessment → Technical interview → HR interview',
    ...d,
  };
}
/** Add the campus workflow to older browser demos without deleting saved profile data. */
export function migratePlacement(data: WorkspaceData) {
  if (data.placementVersion === 1) return;
  data.campuses = campuses;
  data.student.branch ||= data.student.course.split('·')[1]?.trim() || 'CSE';
  data.student.activeBacklogs ??= 0;
  const legacyStatus: Record<string, DriveStatus> = {
    Active: 'ACTIVE',
    Upcoming: 'CONFIRMED',
    Draft: 'DRAFT',
    Completed: 'COMPLETED',
  };
  data.drives = data.drives.map((d) =>
    defaultDrive({ ...d, status: legacyStatus[d.status] || d.status }),
  );
  data.opportunities.forEach((o, i) => {
    let drive = data.drives.find((d) => d.company === o.company && d.role === o.role);
    if (!drive) {
      drive = defaultDrive({
        id: `drive-${o.id}`,
        company: o.company,
        role: o.role,
        location: o.location === 'Remote' ? 'Bengaluru' : o.location,
        ctc: o.ctc,
        skills: o.skills.join(', '),
        status: 'ACTIVE',
        applicants: 48 + i * 12,
      });
      data.drives.push(drive);
    }
    // Existing public opportunities represent already approved campus drives.
    drive.status = 'ACTIVE';
    drive.opportunityId = o.id;
    drive.schedule = {
      date: `2026-10-${String(18 + i).padStart(2, '0')}`,
      reporting: '08:30',
      talk: '09:00',
      assessment: '10:00',
      interviews: '13:00',
      end: '17:00',
      venue: `Placement Block · Hall ${i + 1}`,
      lab: `Computer Lab ${i + 1}`,
      rooms: `Interview Rooms ${i * 3 + 1}–${i * 3 + 3}`,
      systems: 60,
    };
    drive.deadline = `2026-10-${String(12 + i).padStart(2, '0')}`;
    drive.audit = [
      {
        status: 'ACTIVE',
        note: 'Campus approved, recruiter confirmed, and participation opened.',
        date: '2026-10-01',
      },
    ];
    o.driveId = drive.id;
    o.location = drive.location;
  });
  data.drives.push(
    defaultDrive({
      id: 'request-acme',
      company: 'Acme Technologies',
      status: 'SUBMITTED',
      applicants: 0,
    }),
    defaultDrive({
      id: 'request-infosys',
      company: 'Infosys',
      status: 'SCHEDULING',
      preferredDates: ['2026-10-20', '2026-10-21', '2026-10-23'],
    }),
    defaultDrive({
      id: 'request-wipro',
      company: 'Wipro',
      status: 'AWAITING_RECRUITER_CONFIRMATION',
      schedule: {
        date: '2026-10-23',
        reporting: '08:30',
        talk: '09:00',
        assessment: '10:00',
        interviews: '13:00',
        end: '17:00',
        venue: 'Placement Block · Hall 6',
        lab: 'Computer Lab 6',
        rooms: 'Rooms 16–18',
        systems: 60,
      },
    }),
  );
  data.interviews.forEach((i) => {
    i.mode = 'On campus · Placement Block';
  });
  data.placementVersion = 1;
}
