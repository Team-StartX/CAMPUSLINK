import assert from 'node:assert/strict';
import { Database } from '../server/db';
import type { Account } from '../server/auth';
import { emptyWorkspace, readWorkspace, runWorkspace, type StoredDrive } from '../server/workspace';
import { recruitmentDispatch } from '../server/recruitment';
import { defaultDrive } from '../src/services/drive.defaults';
import type { InterviewSlot, RecruitmentOverview } from '../src/types/recruitment';

async function main() {
  const db = new Database('', ':memory:');
  const account = (id: string, role: Account['role']): Account => ({
    id,
    role,
    campusId: 'campus',
    name: id,
    email: `${id}@example.test`,
    organization: 'Test campus',
    approved: true,
    verified: true,
    passwordHash: '',
    createdAt: new Date().toISOString(),
  });
  const staff = account('staff', 'campus');
  const students = [
    account('one', 'student'),
    account('two', 'student'),
    account('waiting', 'student'),
  ];
  const round = {
    id: 'interview',
    name: 'Technical Interview',
    duration: 30,
    capacity: 20,
    requirements: '',
    cleared: 0,
  };
  const drive: StoredDrive = {
    ...defaultDrive({
      id: 'drive',
      company: 'Test company',
      campusId: 'campus',
      campus: 'Test campus',
      courses: 'BTech',
      branches: 'CSE',
      graduationYear: '2027',
      cgpa: 0,
      workflowVersion: 1,
      status: 'ACTIVE',
      rounds: [round],
    }),
    recruiterId: 'recruiter',
  };
  const input = {
    roundId: round.id,
    audience: 'round' as const,
    date: '2026-11-01',
    time: '10:00',
    duration: 60,
    venue: 'Hall',
    room: 'A',
    panel: 'Panel A',
    mode: 'Offline',
    meetingLink: '',
  };
  const call = (actor: Account, method: string, args: unknown[]) =>
    db.transaction(() =>
      runWorkspace(db, actor, undefined, () => recruitmentDispatch(method, args)),
    );
  try {
    await db.migrate();
    await db.put('campus', 'campus', { id: 'campus', name: 'Test campus', location: '' });
    const recruiter = account('recruiter', 'recruiter');
    await db.put('account', recruiter.email, recruiter, recruiter.campusId, recruiter.id);
    for (const actor of [staff, ...students]) {
      await db.put('account', actor.email, actor, actor.campusId, actor.id);
      const workspace = emptyWorkspace(actor, 'Test campus');
      Object.assign(workspace.student, { course: 'BTech', branch: 'CSE', year: '2027' });
      await db.put('workspace', actor.id, workspace, actor.campusId, actor.id);
    }
    await db.put('drive', drive.id, drive, 'campus', drive.recruiterId);
    // A round can be scheduled before any students arrive.
    await call(staff, 'scheduleInterview', [drive.id, input]);
    assert.equal((await db.list<InterviewSlot>('interview-slot')).length, 1);
    for (const student of students.slice(0, 2)) {
      const workspace = emptyWorkspace(student, 'Test campus');
      Object.assign(workspace.student, { course: 'BTech', branch: 'CSE', year: '2027' });
      workspace.applications.push({
        id: `app-${student.id}`,
        opportunityId: drive.id,
        stage: 'Technical Interview',
        currentRoundId: round.id,
        date: '2026-10-09',
      });
      await db.put('workspace', student.id, workspace, 'campus', student.id);
      await db.put(
        'candidate-round',
        `result-${student.id}`,
        {
          id: `result-${student.id}`,
          driveId: drive.id,
          studentId: student.id,
          applicationId: `app-${student.id}`,
          roundId: round.id,
          status: 'Pending',
          feedback: '',
          published: false,
        },
        'campus',
        student.id,
      );
    }
    for (const student of students) {
      const overview = (await call(student, 'overview', [drive.id])) as RecruitmentOverview;
      assert.equal(overview.slots.length, student.id === 'waiting' ? 0 : 1);
      const workspace = await runWorkspace(db, student, undefined, readWorkspace);
      assert.equal(workspace.interviews.length, student.id === 'waiting' ? 0 : 1);
    }
    // Updating a shared schedule does not conflict with itself or duplicate it.
    await call(staff, 'scheduleInterview', [drive.id, { ...input, time: '11:00' }]);
    assert.equal((await db.list<InterviewSlot>('interview-slot')).length, 1);
    const another = { ...drive, id: 'another' };
    await db.put('drive', another.id, another, 'campus', another.recruiterId);
    await assert.rejects(
      () => call(staff, 'scheduleInterview', [another.id, { ...input, time: '11:00' }]),
      /Schedule Conflict/,
    );
    await assert.rejects(
      () => call(students[0], 'scheduleInterview', [drive.id, input]),
      /Your role/,
    );
    await assert.rejects(
      () => call(staff, 'scheduleInterview', [drive.id, { ...input, mode: 'Online' }]),
      /HTTPS/,
    );
    assert.equal((await db.list<InterviewSlot>('interview-slot')).length, 1);
    // A named legacy interview can be scheduled for one student, overriding their shared slot.
    const individual = {
      ...input,
      audience: undefined,
      studentId: 'one',
      time: '11:00',
      panel: 'Individual panel',
    };
    await call(recruiter, 'scheduleInterview', [drive.id, individual]);
    const ownSlot = await runWorkspace(db, students[0], undefined, readWorkspace);
    assert.equal(ownSlot.interviews.length, 1);
    assert.equal(ownSlot.interviews[0].time, '11:00');
    const ownOverview = (await call(students[0], 'overview', [drive.id])) as RecruitmentOverview;
    assert.equal(ownOverview.slots.length, 1);
    assert.equal(ownOverview.slots[0].studentId, 'one');
    const otherOverview = (await call(students[1], 'overview', [drive.id])) as RecruitmentOverview;
    assert.equal(otherOverview.slots.length, 1);
    assert.equal(otherOverview.slots[0].audience, 'round');
    await db.put(
      'drive',
      drive.id,
      { ...drive, status: 'IN_PROGRESS', skills: 'React, SQL' },
      'campus',
      recruiter.id,
    );
    for (const [index, student] of students.slice(0, 2).entries()) {
      const profile = (await db.get<import('../src/types').WorkspaceData>(
        'workspace',
        student.id,
      ))!;
      profile.student.skills = (index ? ['React', 'SQL'] : ['React']).map((name) => ({
        id: name,
        name,
        level: 'Intermediate',
        verified: false,
      }));
      await db.put('workspace', student.id, profile, 'campus', student.id);
    }
    const ranked = (await call(recruiter, 'dashboard', [])) as {
      applicantRankings: import('../src/types/recruitment').ApplicantRanking[];
    };
    const rankings = ranked.applicantRankings.filter((row) => row.driveId === drive.id);
    assert.equal(rankings.length, 2, 'Only applicants are ranked.');
    assert.equal(rankings[0].studentId, 'two');
    assert.equal(rankings[0].skillMatch, 100);
    assert.equal(rankings[1].skillMatch, 50);
    assert.deepEqual(rankings[1].missingSkills, ['SQL']);
    await assert.rejects(
      () =>
        call(recruiter, 'saveResults', [
          drive.id,
          round.id,
          [{ applicationId: 'app-one', status: 'Qualified', score: 85, feedback: '' }],
        ]),
      /feedback/,
    );
    await call(recruiter, 'saveResults', [
      drive.id,
      round.id,
      [
        {
          applicationId: 'app-one',
          status: 'Qualified',
          score: 85,
          feedback: 'Strong implementation',
          strengths: 'React',
          gaps: '',
          nextSteps: 'Prepare for the next round',
        },
        {
          applicationId: 'app-two',
          status: 'Rejected',
          score: 40,
          feedback: 'Needs more practical experience',
          strengths: 'SQL basics',
          gaps: 'Debugging',
          nextSteps: 'Practise debugging exercises',
        },
      ],
    ]);
    assert.equal(
      (await runWorkspace(db, students[0], undefined, readWorkspace)).recruiterFeedback?.length,
      0,
      'Draft feedback remains private.',
    );
    await call(recruiter, 'publishResults', [drive.id, round.id]);
    for (const [index, student] of students.slice(0, 2).entries()) {
      const profile = await runWorkspace(db, student, undefined, readWorkspace);
      assert.equal(profile.recruiterFeedback?.length, 1);
      assert.equal(profile.recruiterFeedback?.[0].studentId, student.id);
      assert.equal(profile.recruiterFeedback?.[0].risk, index ? 'High' : 'Low');
      assert.equal(profile.recruiterFeedback?.[0].gaps, index ? 'Debugging' : '');
      assert.equal(profile.interviews[0].status, 'Completed');
    }
    assert.equal(
      (await runWorkspace(db, students[2], undefined, readWorkspace)).recruiterFeedback?.length,
      0,
    );
    console.log(
      'Interview scheduling, individual overrides, conflicts, applicant ranking, feedback publication, student isolation and risk summaries passed.',
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
