import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { Database } from '../server/db';
import type { Account } from '../server/auth';
import { emptyWorkspace, runWorkspace, studentProfiles, type StoredDrive } from '../server/workspace';
import { analytics, dispatch, rankedCandidates } from '../server/services';
import { runReminders } from '../server/reminders';
import { defaultDrive } from '../src/services/drive.defaults';
import { scheduleConflicts, scheduleSchema } from '../src/services/drive.validation';
import { checkEligibility } from '../src/utils/placement';
import { readiness } from '../src/utils/scoring';
import type { DriveSchedule, WorkspaceData } from '../src/types';

// Synthetic demonstration only. No application database or delivery workers are used.
const db = new Database('', ':memory:');
const account = (id: string, role: Account['role'], campusId = 'demo-campus'): Account => ({
  id, role, campusId, name: id, email: `${id}@example.test`, organization: `Demo ${id}`,
  approved: true, verified: true, passwordHash: '', createdAt: new Date().toISOString(),
});
const team = account('placement-team', 'campus');
const students = [
  { id: 'web-strong', skills: ['React', 'TypeScript'], evidence: true },
  { id: 'web-developing', skills: ['React', 'TypeScript'], evidence: false },
  { id: 'backend-strong', skills: ['Java', 'SQL'], evidence: true },
  { id: 'backend-developing', skills: ['Java', 'SQL'], evidence: false },
  { id: 'data-strong', skills: ['Python', 'SQL'], evidence: true },
  { id: 'data-developing', skills: ['Python', 'SQL'], evidence: false },
  { id: 'all-rounder', skills: ['React', 'TypeScript', 'Java', 'SQL', 'Python'], evidence: false },
  { id: 'missing-skills', skills: [], evidence: false },
  { id: 'below-cgpa', skills: ['React', 'TypeScript', 'Java', 'SQL', 'Python'], evidence: true, cgpa: 5 },
  { id: 'wrong-branch', skills: ['React', 'TypeScript', 'Java', 'SQL', 'Python'], evidence: true, branch: 'Mechanical' },
  { id: 'wrong-year', skills: ['React', 'TypeScript', 'Java', 'SQL', 'Python'], evidence: true, year: '2026' },
  { id: 'active-backlogs', skills: ['React', 'TypeScript', 'Java', 'SQL', 'Python'], evidence: true, activeBacklogs: 2 },
  { id: 'other-campus', skills: ['React', 'TypeScript', 'Java', 'SQL', 'Python'], evidence: true, campusId: 'other-campus' },
];
const specifications = [
  { role: 'Frontend Developer', skills: 'React, TypeScript', expected: ['web-strong', 'web-developing', 'all-rounder'], best: 'web-strong' },
  { role: 'Backend Developer', skills: 'Java, SQL', expected: ['backend-strong', 'backend-developing', 'all-rounder'], best: 'backend-strong' },
  { role: 'Data Analyst', skills: 'Python, SQL', expected: ['data-strong', 'data-developing', 'all-rounder'], best: 'data-strong' },
];
const accounts = new Map(students.map((row) => [row.id, account(row.id, 'student', row.campusId)]));
const call = (actor: Account, service: string, method: string, args: unknown[] = [], target?: string) =>
  runWorkspace(db, actor, target, () => dispatch(service, method, args));
const date = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
const schedule = (day: string): DriveSchedule => ({
  date: day, reporting: '09:00', talk: '09:30', assessment: '10:00', interviews: '11:00', end: '17:00',
  venue: 'Main Hall', lab: 'Lab A', rooms: 'Room 101, Room 102', systems: 20,
});
const checkBlocked = async (operation: () => Promise<unknown>, reason: RegExp) => {
  await assert.rejects(operation, reason);
  return true;
};

async function main() {
  await db.migrate();
  await db.put('campus', team.campusId, { id: team.campusId, name: 'Demo College', location: 'Demo city', courses: ['MCA'], branches: ['CSE'], studentPool: 12 });
  await db.put('campus', 'other-campus', { id: 'other-campus', name: 'Other College', location: 'Other city', courses: ['MCA'], branches: ['CSE'], studentPool: 1 });
  await db.put('account', team.email, team, team.campusId, team.id);
  for (const row of students) {
    const actor = accounts.get(row.id)!;
    await db.put('account', actor.email, actor, actor.campusId, actor.id);
    const workspace = emptyWorkspace(actor, actor.campusId === team.campusId ? 'Demo College' : 'Other College');
    Object.assign(workspace.student, {
      course: 'MCA', branch: row.branch || 'CSE', year: row.year || '2027', cgpa: row.cgpa ?? 9,
      activeBacklogs: row.activeBacklogs || 0,
      skills: row.skills.map((name, index) => ({ id: `skill-${index}`, name, level: 'Intermediate', verified: row.evidence })),
      projects: row.evidence ? [`${row.skills.join(' ')} placement project`, 'Capstone project', 'Team project'] : [],
    });
    workspace.documents = [{ id: 'resume', name: 'Simulated resume.pdf', type: 'Resume', status: 'Pending', date: date(0) }];
    if (row.evidence) workspace.history = ['Aptitude', 'Communication', 'Interview'].map((type, index) => ({
      id: `attempt-${index}`, assessmentId: type, name: `Simulated ${type}`, type, score: 85, points: 0, date: date(0), seconds: 600,
    }));
    await db.put('workspace', actor.id, workspace, actor.campusId, actor.id);
  }
  assert.equal((await studentProfiles(db, team)).length, 12);
  const drives: StoredDrive[] = [];
  const recruiters: Account[] = [];
  const demonstrations = [];
  let correct = 0, pairs = 0, rankingHits = 0;
  const started = performance.now();
  for (const [index, spec] of specifications.entries()) {
    const recruiter = account(`recruiter-${index + 1}`, 'recruiter', '');
    recruiters.push(recruiter);
    await db.put('account', recruiter.email, recruiter, '', recruiter.id);
    const request = await call(recruiter, 'recruitmentService', 'requestCampus', [team.campusId]) as { id: string };
    await call(team, 'recruitmentService', 'reviewCampus', [request.id, 'Accepted', 'Demonstration partnership']);
    const input = defaultDrive({ campusId: team.campusId, role: spec.role, description: `Recruit ${spec.role} candidates with ${spec.skills}.`,
      skills: spec.skills, requireSkills: true, courses: 'MCA', branches: 'CSE', graduationYear: '2027', cgpa: 7,
      location: 'Demo city', ctc: `${8 + index} LPA`, vacancies: 2, deadline: date(7), preferredDates: [date(10 + index)],
      rounds: [{ id: `round-${index}`, name: 'Technical Interview', type: 'Technical Interview', duration: 30, capacity: 12, requirements: '', cleared: 0, maximumScore: 100, passingScore: 60 }],
    });
    const created = await call(recruiter, 'driveService', 'createDriveRequest', [input, false]) as { createdDriveId: string };
    await call(team, 'driveService', 'transition', [created.createdDriveId, 'approve', 'campus']);
    if (index === 1) await checkBlocked(() => call(team, 'driveService', 'proposeSchedule', [created.createdDriveId, schedule(date(10))]), /conflict/i);
    await call(team, 'driveService', 'proposeSchedule', [created.createdDriveId, schedule(date(10 + index))]);
    await call(recruiter, 'driveService', 'transition', [created.createdDriveId, 'confirm', 'recruiter']);
    await call(team, 'driveService', 'transition', [created.createdDriveId, 'finalize', 'campus']);
    await call(team, 'driveService', 'transition', [created.createdDriveId, 'activate', 'campus']);
    const drive = (await db.get<StoredDrive>('drive', created.createdDriveId))!;
    drives.push(drive);
    for (const actor of accounts.values()) {
      const profile = (await db.get<WorkspaceData>('workspace', actor.id))!;
      const expected = spec.expected.includes(actor.id);
      const actual = checkEligibility(profile.student, drive).passed;
      if (expected === actual) correct++;
      pairs++;
      if (expected) {
        await call(actor, 'recruitmentService', 'interest', [drive.id, 'Interested']);
        await call(actor, 'recruitmentService', 'apply', [drive.id, true, 'resume']);
      }
    }
    const ranking = await runWorkspace(db, recruiter, undefined, () => rankedCandidates(drive));
    if (ranking[0]?.student.id === spec.best) rankingHits++;
    demonstrations.push({ role: spec.role, applicants: ranking.length, expectedBest: spec.best,
      ranking: ranking.map((row) => ({ student: row.student.id, score: row.hybridScore, level: row.label, readiness: row.readiness.score, factors: row.explanation, skillGaps: row.gaps })),
    });
  }
  const elapsedMs = Math.round((performance.now() - started) * 100) / 100;
  assert.equal(correct, pairs, 'Synthetic eligibility labels must agree.');
  assert.equal(rankingHits, 3, 'Strong evidence should lead each drive ranking.');
  const ineligible = accounts.get('below-cgpa')!;
  const posts = await call(ineligible, 'studentService', 'getDashboard') as WorkspaceData;
  assert.equal(posts.opportunities.length, 3);
  assert.ok(posts.opportunities.every((post) => post.eligibility?.passed === false));
  await checkBlocked(() => call(ineligible, 'recruitmentService', 'apply', [drives[0].id, true, 'resume']), /not eligible/i);
  await checkBlocked(() => call(accounts.get('other-campus')!, 'recruitmentService', 'overview', [drives[0].id]), /scope/i);
  assert.equal(scheduleSchema.safeParse({ ...schedule(date(10)), interviews: '08:00' }).success, false);
  assert.ok(scheduleConflicts([drives[0], { ...drives[1], branches: 'EE' }], drives[1].id, { ...schedule(date(10)), venue: 'Other Hall', lab: 'Other Lab', rooms: 'Room 102' })[0]?.reasons.includes('rooms'));

  const selected = accounts.get('web-strong')!;
  const recruiter = recruiters[0];
  const drive = drives[0];
  await call(team, 'driveService', 'transition', [drive.id, 'start', 'campus']);
  const overview = await call(recruiter, 'recruitmentService', 'overview', [drive.id]) as { candidates: { applicationId: string; studentId: string }[] };
  const application = overview.candidates.find((candidate) => candidate.studentId === selected.id)!;
  await call(recruiter, 'recruitmentService', 'scheduleInterview', [drive.id, {
    roundId: drive.rounds![0].id, studentId: selected.id, date: date(10), time: '11:00', duration: 30,
    venue: 'Main Hall', room: 'Room 101', panel: 'Panel A', mode: 'Offline', meetingLink: '',
  }]);
  await checkBlocked(() => call(recruiter, 'recruitmentService', 'scheduleInterview', [drive.id, {
    roundId: drive.rounds![0].id, studentId: 'web-developing', date: date(10), time: '11:00', duration: 30,
    venue: 'Main Hall', room: 'Room 101', panel: 'Panel A', mode: 'Offline', meetingLink: '',
  }]), /conflict/i);
  await call(recruiter, 'recruitmentService', 'saveResults', [drive.id, drive.rounds![0].id, overview.candidates.map((candidate) => ({
    applicationId: candidate.applicationId, status: candidate.studentId === selected.id ? 'Qualified' : 'Rejected', score: candidate.studentId === selected.id ? 90 : 40, feedback: 'Recorded demonstration interview result',
  }))]);
  await call(recruiter, 'recruitmentService', 'publishResults', [drive.id, drive.rounds![0].id]);
  await call(recruiter, 'offerService', 'create', [{ company: recruiter.organization, role: drive.role, ctc: '8 LPA', date: date(0), joining: date(1), deadline: date(7), applicationId: application.applicationId, kind: 'PPO' }], selected.id);
  let profile = (await db.get<WorkspaceData>('workspace', selected.id))!;
  const offer = profile.offers[0];
  await call(selected, 'offerService', 'respond', [offer.id, 'Deferred']);
  await call(selected, 'offerService', 'respond', [offer.id, 'Accepted']);
  await runReminders(db);
  const reminders = await db.list<{ title: string }>('notification', team.campusId, selected.id);
  assert.ok(reminders.some((row) => row.title === 'Placement documents need attention'));
  const count = reminders.length;
  await runReminders(db);
  assert.equal((await db.list('notification', team.campusId, selected.id)).length, count);
  await checkBlocked(() => call(team, 'offerService', 'respond', [offer.id, 'Joined'], selected.id), /documents/i);
  await call(team, 'documentService', 'verify', ['resume'], selected.id);
  await call(team, 'offerService', 'respond', [offer.id, 'Joined'], selected.id);
  const summary = await analytics(db, team.campusId);
  assert.equal(summary.joined, 1); assert.equal(summary.offers, 1);
  assert.equal(summary.recruiters.find((row) => row.name === recruiters[1].organization)?.placed, 0);
  profile = (await db.get<WorkspaceData>('workspace', selected.id))!;
  const report = {
    dataset: '13 synthetic student profiles in two colleges; three simulated drives; manually specified eligibility labels and best candidates.',
    workflow: ['Profiling', 'Matching', 'Scheduling', 'Notification', 'Offer Tracking', 'Analytics'],
    evaluation: { pairs, correct, eligibilityAccuracy: correct / pairs, topOneRankingAccuracy: rankingHits / 3, elapsedMs,
      limitation: 'Small scripted synthetic benchmark. Measures rule conformance and ranking examples, not real placement prediction accuracy. Includes database and workflow time; not a concurrency benchmark.' },
    readiness: readiness(profile.student, profile.history), drives: demonstrations,
    verified: { conflictDetection: true, interviewConflictDetection: true, explanations: true, campusIsolation: true, documentVerificationBeforeJoining: true, offerDeferral: true, deduplicatedReminders: true },
    outcome: { status: profile.offers[0].status, kind: profile.offers[0].kind, notifications: (await db.list('notification')).length, analytics: summary },
    predictiveModel: 'Optional historical logistic regression is not trained by this demonstration. Genuine labelled outcome cohorts are required.',
  };
  await fs.mkdir('output', { recursive: true });
  await fs.writeFile('output/placement-demo-report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`Three-drive workflow complete. Eligibility: ${correct}/${pairs}; top ranked candidate: ${rankingHits}/3; offers joined: ${summary.joined}.`);
  console.log('Report: output/placement-demo-report.json. All records used an isolated in-memory database.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
