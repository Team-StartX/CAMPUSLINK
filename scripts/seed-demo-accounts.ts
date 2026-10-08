import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Database } from '../server/db';
import { hashPassword, verifyPassword, type Account } from '../server/auth';
import { emptyWorkspace, runWorkspace, type StoredDrive } from '../server/workspace';
import { dispatch } from '../server/services';
import { defaultDrive } from '../src/services/drive.defaults';
import { checkEligibility, studentVisible } from '../src/utils/placement';
import { readiness } from '../src/utils/scoring';
import type { Campus, WorkspaceData } from '../src/types';

// Inserts only this named fixture. A repeat run refuses to reset accounts or test progress.
const prefix = 'demo-oct08';
const db = process.argv.includes('--preview') ? new Database('', ':memory:') : new Database();
const password = `Campus!${randomBytes(9).toString('hex')}`;
const date = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const at = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const campuses: Campus[] = ['A', 'B'].map((suffix, index) => ({
  id: `${prefix}-college-${suffix.toLowerCase()}`,
  name: `Demo College ${suffix}`,
  location: index ? 'Bhubaneswar' : 'Cuttack',
  studentPool: index ? 4 : 1,
  courses: ['B.Tech'],
  branches: ['CSE', 'IT'],
}));
const specs = [
  {
    name: 'Aarav Demo',
    campus: 0,
    skills: ['React', 'TypeScript', 'SQL', 'Git'],
    cgpa: 9.2,
    verified: 4,
    projects: 3,
    score: 92,
  },
  {
    name: 'Diya Demo',
    campus: 1,
    skills: ['React', 'TypeScript', 'JavaScript', 'Git'],
    cgpa: 8.8,
    verified: 4,
    projects: 3,
    score: 86,
  },
  {
    name: 'Rohan Demo',
    campus: 1,
    skills: ['React', 'TypeScript', 'HTML'],
    cgpa: 7.4,
    verified: 1,
    projects: 1,
    score: 60,
  },
  {
    name: 'Meera Demo',
    campus: 1,
    skills: ['Python', 'SQL'],
    cgpa: 8.1,
    verified: 1,
    projects: 2,
    score: 70,
  },
  {
    name: 'Kabir Demo',
    campus: 1,
    skills: ['HTML', 'CSS'],
    cgpa: 6.2,
    verified: 0,
    projects: 0,
    score: 35,
  },
];
const makeAccount = (
  name: string,
  email: string,
  role: Account['role'],
  campus?: Campus,
): Account => ({
  id: `${prefix}-${email.split('@')[0]}`,
  name,
  email,
  role,
  campusId: campus?.id || '',
  organization: campus?.name || 'Demo Talent Labs',
  passwordHash: hashPassword(password),
  approved: true,
  verified: true,
  onboardingComplete: true,
  createdAt: at(0),
});
const teams = campuses.map((campus, i) =>
  makeAccount(
    campus.name + ' Placement Team',
    `college${i + 1}@campuslink-demo.test`,
    'campus',
    campus,
  ),
);
const recruiter = makeAccount('Demo Recruiter', 'recruiter@campuslink-demo.test', 'recruiter');
const students = specs.map((spec, i) =>
  makeAccount(spec.name, `student${i + 1}@campuslink-demo.test`, 'student', campuses[spec.campus]),
);
const accounts = [...teams, recruiter, ...students];
const drives: StoredDrive[] = campuses.map((campus, i) => ({
  ...defaultDrive({
    id: `${prefix}-drive-${i + 1}`,
    opportunityId: `${prefix}-drive-${i + 1}`,
    campusId: campus.id,
    campus: campus.name,
    company: recruiter.organization,
    role: i ? 'Frontend Developer - Eligibility Demo' : 'Software Engineer - Offer Tracking Demo',
    description: 'Synthetic placement for hands-on testing. No real recruitment commitment.',
    responsibilities:
      'Build accessible interfaces, write maintainable code, and collaborate with the team.',
    location: campus.location,
    ctc: i ? '6 LPA' : '8 LPA',
    vacancies: i ? 2 : 1,
    skills: 'React, TypeScript',
    preferredSkills: 'Git, SQL',
    requireSkills: true,
    courses: 'B.Tech',
    branches: 'CSE, IT',
    graduationYear: '2027',
    cgpa: 7,
    deadline: date(i ? 7 : -10),
    preferredDates: [date(i ? 10 : -7)],
    status: i ? 'ACTIVE' : 'COMPLETED',
    applicants: i ? 0 : 1,
    schedule: {
      date: date(i ? 10 : -7),
      reporting: '09:00',
      talk: '09:30',
      assessment: '10:00',
      interviews: '11:00',
      end: '17:00',
      venue: `${campus.name} Hall`,
      lab: 'Lab A',
      rooms: 'Room 101',
      systems: 20,
    },
    rounds: ['Technical Interview', 'HR Interview'].map((name, round) => ({
      id: `${prefix}-round-${i}-${round}`,
      name,
      type: name as 'Technical Interview' | 'HR Interview',
      duration: 30,
      capacity: 10,
      requirements: '',
      cleared: i ? 0 : 1,
      maximumScore: 100,
      passingScore: 60,
    })),
    audit: (i
      ? (['SUBMITTED', 'SCHEDULING', 'CONFIRMED', 'ACTIVE'] as const)
      : (['SUBMITTED', 'SCHEDULING', 'CONFIRMED', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED'] as const)
    ).map((status) => ({ status, note: 'Synthetic demo setup', date: at(i ? -1 : -8) })),
  }),
  recruiterId: recruiter.id,
}));
const profiles: WorkspaceData[] = students.map((actor, i) => {
  const spec = specs[i];
  const workspace = emptyWorkspace(actor, campuses[spec.campus].name);
  Object.assign(workspace.student, {
    course: 'B.Tech',
    branch: 'CSE',
    year: '2027',
    cgpa: spec.cgpa,
    activeBacklogs: 0,
    bio: 'Synthetic demo student for placement testing.',
    skills: spec.skills.map((name, n) => ({
      id: `${actor.id}-skill-${n}`,
      name,
      level: n < spec.verified ? 'Advanced' : 'Beginner',
      verified: n < spec.verified,
    })),
    projects: [
      'React TypeScript placement portal',
      'SQL analytics dashboard',
      'Team capstone',
    ].slice(0, spec.projects),
  });
  workspace.history = ['Aptitude', 'Communication', 'Interview'].map((type, n) => ({
    id: `${actor.id}-assessment-${n}`,
    assessmentId: `${prefix}-${type}`,
    name: `Demo ${type}`,
    type,
    score: spec.score - n * 3,
    points: 0,
    date: date(-12),
    seconds: 600,
  }));
  workspace.notifications.push({
    id: `${actor.id}-notice`,
    title: i ? 'Placement applications open' : 'Your demo offer is ready',
    body: i
      ? 'Check your match and skill gaps in the placements page.'
      : 'Selection is complete. Review and respond to your offer.',
    type: i ? 'Recruitment' : 'Offer',
    read: false,
  });
  return workspace;
});
const application = {
  id: `${prefix}-application`,
  opportunityId: drives[0].id,
  stage: 'Selected',
  date: date(-10),
  currentRoundId: drives[0].rounds![1].id,
};
profiles[0].applications.push(application);
profiles[0].interviews.push({
  id: `${prefix}-interview`,
  company: recruiter.organization,
  role: drives[0].role,
  date: date(-7),
  time: '11:00',
  mode: 'Offline',
  round: 'HR Interview',
  status: 'Completed',
});
profiles[0].offers.push({
  id: `${prefix}-offer`,
  applicationId: application.id,
  company: recruiter.organization,
  role: drives[0].role,
  ctc: '8 LPA',
  location: campuses[0].location,
  date: date(0),
  joining: date(30),
  deadline: date(14),
  status: 'Offer Sent',
  kind: 'Full-time',
  ...{ recruiterId: recruiter.id },
});

async function main() {
  await db.migrate();
  await db.transaction(async () => {
    for (const account of accounts)
      assert.equal(
        await db.get('account', account.email),
        undefined,
        `Demo account ${account.email} already exists; refusing to overwrite test progress.`,
      );
    for (const campus of campuses) assert.equal(await db.get('campus', campus.id), undefined);
    for (const drive of drives) assert.equal(await db.get('drive', drive.id), undefined);
    for (const campus of campuses) await db.put('campus', campus.id, campus, campus.id);
    for (const account of accounts)
      await db.put('account', account.email, account, account.campusId, account.id);
    for (const team of teams) {
      const id = `${team.campusId}:${recruiter.id}`;
      await db.put(
        'campus-recruiter',
        id,
        {
          id,
          campusId: team.campusId,
          recruiterId: recruiter.id,
          company: recruiter.organization,
          status: 'Accepted',
          reason: 'Demo partnership',
        },
        team.campusId,
        recruiter.id,
      );
    }
    await db.put(
      'organization',
      recruiter.id,
      {
        website: '',
        industry: 'Software',
        description: 'Synthetic demo employer',
        headquarters: 'Bhubaneswar',
        size: '50-100',
        logo: '',
      },
      '',
      recruiter.id,
    );
    for (const drive of drives)
      await db.put('drive', drive.id, drive, drive.campusId, recruiter.id);
    for (const [i, profile] of profiles.entries()) {
      await db.put('workspace', students[i].id, profile, students[i].campusId, students[i].id);
      for (const notification of profile.notifications)
        await db.put(
          'notification',
          notification.id,
          notification,
          students[i].campusId,
          students[i].id,
        );
    }
    await db.put(
      'application',
      application.id,
      { ...application, driveId: drives[0].id, studentId: students[0].id },
      campuses[0].id,
      students[0].id,
    );
    for (const [i, round] of drives[0].rounds!.entries()) {
      const id = `${application.id}:${round.id}`;
      await db.put(
        'candidate-round',
        id,
        {
          id,
          driveId: drives[0].id,
          applicationId: application.id,
          studentId: students[0].id,
          roundId: round.id,
          status: 'Qualified',
          score: 92 - i * 2,
          feedback: 'Synthetic interview passed; selection complete.',
          published: true,
        },
        campuses[0].id,
        students[0].id,
      );
    }
    await db.put('audit', `${prefix}-seed`, {
      id: `${prefix}-seed`,
      user_id: 'demo-seed',
      role: 'system',
      action: 'seed-demo-accounts',
      entity: 'demo',
      entity_id: prefix,
      timestamp: at(0),
      new_value: { accounts: accounts.map((a) => a.id), drives: drives.map((d) => d.id) },
    });
    assert.equal(
      profiles.slice(1).filter((w) => checkEligibility(w.student, drives[1]).passed).length,
      2,
    );
    assert.ok(drives.every(studentVisible));
    for (const account of accounts)
      assert.ok(
        verifyPassword(password, (await db.get<Account>('account', account.email))!.passwordHash),
      );
    for (const student of students) {
      const data = (await runWorkspace(db, student, undefined, () =>
        dispatch('studentService', 'getDashboard', []),
      )) as WorkspaceData;
      assert.equal(
        data.opportunities.length,
        1,
        'Student must see exactly their demo college placement',
      );
      if (student.id === students[0].id) assert.equal(data.offers[0]?.status, 'Offer Sent');
    }
    for (const actor of [...teams, recruiter]) {
      const dashboard = (await runWorkspace(db, actor, undefined, () =>
        dispatch('recruitmentService', 'dashboard', []),
      )) as { offers: unknown[]; matching: { eligible: number; total: number }[] };
      if (actor.id !== teams[1].id) assert.equal(dashboard.offers.length, 1);
      if (actor.id !== teams[0].id) {
        assert.equal(dashboard.matching[0]?.eligible, 2);
        assert.equal(dashboard.matching[0]?.total, 4);
      }
    }
  });
  console.log(
    JSON.stringify(
      {
        accounts: accounts.map(({ name, email, role, organization }) => ({
          name,
          email,
          role,
          organization,
        })),
        password,
        students: profiles.map((w, i) => ({
          email: students[i].email,
          campus: w.student.campus,
          skills: w.student.skills.map((s) => s.name),
          readiness: readiness(w.student, w.history).score,
          eligible: checkEligibility(w.student, drives[specs[i].campus]).passed,
          reasons: checkEligibility(w.student, drives[specs[i].campus])
            .checks.filter((c) => !c.passed)
            .map((c) => c.detail),
        })),
        scenarios: [
          'College A: selection complete; individual offer awaiting response (14 days), joining in 30 days.',
          'College B: published, no applications; two eligible and two ineligible.',
        ],
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
