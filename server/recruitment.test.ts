import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Database } from './db';
import type { Account } from './auth';
import { emptyWorkspace, runWorkspace, StoredDrive, readWorkspace } from './workspace';
import { dispatch } from './services';
import { defaultDrive } from '../src/services/drive.defaults';
import type { CampusAssessment, RecruitmentOverview } from '../src/types/recruitment';
import type { WorkspaceData } from '../src/types';

describe('campus recruitment scenario with individual student outcomes', () => {
  let db: Database;
  const account = (id: string, role: Account['role'], campusId = 'campus-a'): Account => ({
    id,
    role,
    campusId,
    name: id,
    email: `${id}@test.invalid`,
    organization: role === 'recruiter' ? 'Sample Company' : campusId,
    approved: true,
    verified: true,
    passwordHash: '',
    createdAt: new Date().toISOString(),
  });
  const recruiter = account('recruiter', 'recruiter', '');
  const campus = account('campus', 'campus');
  const a = account('qualified', 'student'),
    b = account('rejected', 'student'),
    c = account('absent', 'student'),
    low = account('ineligible', 'student'),
    other = account('other-campus', 'student', 'campus-b');
  const rpc = (
    actor: Account,
    service: string,
    method: string,
    args: unknown[] = [],
    target?: string,
  ) => db.transaction(() => runWorkspace(db, actor, target, () => dispatch(service, method, args)));
  const recruit = (actor: Account, method: string, args: unknown[] = []) =>
    rpc(actor, 'recruitmentService', method, args);
  beforeEach(async () => {
    db = new Database('', ':memory:');
    await db.migrate();
    for (const id of ['campus-a', 'campus-b'])
      await db.put(
        'campus',
        id,
        {
          id,
          name: id,
          location: 'Test City',
          courses: ['B.Tech'],
          branches: ['CSE'],
          studentPool: 4,
        },
        id,
      );
    for (const actor of [recruiter, campus, a, b, c, low, other]) {
      await db.put('account', actor.email, actor, actor.campusId, actor.id);
      if (actor.role === 'student') {
        const w = emptyWorkspace(actor, actor.campusId);
        Object.assign(w.student, {
          course: 'B.Tech',
          branch: 'CSE',
          year: '2027',
          cgpa: actor.id === low.id ? 5 : 8,
          activeBacklogs: 0,
          skills: [{ id: 'sql', name: 'SQL', level: 'Advanced', verified: true }],
        });
        w.documents.push({
          id: `resume-${actor.id}`,
          name: 'Resume.pdf',
          type: 'Resume',
          status: 'Uploaded',
          size: '2 KB',
        });
        await db.put('workspace', actor.id, w, actor.campusId, actor.id);
      }
    }
  });
  afterEach(async () => db.close());
  async function create() {
    const input = defaultDrive({
      campusId: 'campus-a',
      company: 'Sample Company',
      role: 'Engineer',
      location: 'Test City',
      ctc: '10 LPA',
      description: 'Build software with the engineering team.',
      responsibilities: 'Develop and maintain software.',
      courses: 'B.Tech',
      branches: 'CSE',
      graduationYear: '2027',
      skills: 'SQL',
      deadline: '2099-10-01',
      preferredDates: ['2099-10-02'],
      systems: 0,
      labs: 0,
      rooms: 0,
      rounds: [
        {
          id: 'aptitude',
          name: 'Aptitude',
          type: 'Aptitude Test',
          duration: 30,
          capacity: 10,
          requirements: '',
          cleared: 0,
          elimination: true,
          maximumScore: 100,
          passingScore: 50,
        },
        {
          id: 'assignment',
          name: 'Assignment',
          type: 'Assignment',
          duration: 60,
          capacity: 10,
          requirements: '',
          cleared: 0,
        },
        {
          id: 'interview',
          name: 'Interview',
          type: 'Technical Interview',
          duration: 30,
          capacity: 10,
          requirements: '',
          cleared: 0,
        },
      ],
    });
    await expect(rpc(recruiter, 'driveService', 'createDriveRequest', [input])).rejects.toThrow(
      'campus must accept',
    );
    await recruit(recruiter, 'requestCampus', ['campus-a']);
    await expect(
      recruit(account('wrong-campus', 'campus', 'campus-b'), 'reviewCampus', [
        `campus-a:${recruiter.id}`,
        'Accepted',
        '',
      ]),
    ).rejects.toThrow('unavailable');
    await recruit(campus, 'reviewCampus', [`campus-a:${recruiter.id}`, 'Accepted', '']);
    await rpc(recruiter, 'driveService', 'createDriveRequest', [input]);
    return (await db.list<StoredDrive>('drive'))[0];
  }
  async function publish(drive: StoredDrive) {
    await rpc(campus, 'driveService', 'transition', [drive.id, 'approve', 'recruiter']);
    await rpc(campus, 'driveService', 'proposeSchedule', [
      drive.id,
      {
        date: '2099-10-02',
        reporting: '09:00',
        talk: '10:00',
        assessment: '10:00',
        interviews: '10:00',
        end: '16:00',
        venue: 'Hall A',
        lab: '',
        rooms: 'Room 1',
        systems: 0,
      },
    ]);
    await expect(
      rpc(campus, 'driveService', 'transition', [drive.id, 'activate', 'campus']),
    ).rejects.toThrow();
    await rpc(recruiter, 'driveService', 'transition', [drive.id, 'confirm', 'campus']);
    await rpc(campus, 'driveService', 'transition', [drive.id, 'finalize', 'campus']);
    await rpc(campus, 'driveService', 'transition', [drive.id, 'activate', 'campus']);
  }
  it('reviews, schedules, publishes, applies, hides future assignments, rejects candidates, publishes results, and tracks an offer', async () => {
    const drive = await create();
    await expect(recruit(a, 'overview', [drive.id])).rejects.toThrow('unavailable');
    await publish(drive);
    await expect(recruit(low, 'overview', [drive.id])).rejects.toThrow('not eligible');
    await expect(recruit(other, 'overview', [drive.id])).rejects.toThrow('scope');
    await expect(recruit(a, 'apply', [drive.id, true])).rejects.toThrow('Show interest');
    const assignment = {
      roundId: 'assignment',
      title: 'Build API',
      description: 'Design a small API',
      tasks: 'Implement endpoint',
      instructions: 'Document the API',
      format: 'HTTPS document link',
      link: '',
      maximumMarks: 100,
      deadline: '2099-10-03T12:00:00.000Z',
      allowedTypes: 'PDF',
      criteria: 'Correctness',
    };
    await expect(
      recruit(recruiter, 'saveAssignment', [drive.id, { ...assignment, roundId: 'aptitude' }]),
    ).rejects.toThrow('only to Assignment');
    await recruit(recruiter, 'saveAssignment', [drive.id, assignment]);
    const overview = () =>
      recruit(recruiter, 'overview', [drive.id]) as Promise<RecruitmentOverview>;
    expect((await overview()).counts).toMatchObject({ total: 4, eligible: 3, applicants: 0 });
    for (const student of [a, b, c]) {
      await recruit(student, 'interest', [drive.id, 'Interested']);
      await recruit(student, 'apply', [drive.id, true]);
    }
    await expect(rpc(a, 'applicationService', 'apply', [drive.id])).rejects.toThrow(
      'show interest',
    );
    expect((await overview()).counts).toMatchObject({ interested: 3, applicants: 3 });
    expect(((await recruit(a, 'overview', [drive.id])) as RecruitmentOverview).assignments).toEqual(
      [],
    );
    await rpc(campus, 'driveService', 'transition', [drive.id, 'close', 'campus']);
    await rpc(campus, 'driveService', 'transition', [drive.id, 'start', 'campus']);
    await expect(
      recruit(a, 'submitAssignment', [drive.id, `${drive.id}:assignment`, 'early submission']),
    ).rejects.toThrow('not reached');
    const candidates = (await overview()).candidates;
    const ids = Object.fromEntries(candidates.map((c) => [c.studentId, c.applicationId]));
    await expect(
      recruit(recruiter, 'saveResults', [
        drive.id,
        'aptitude',
        [{ applicationId: ids[a.id], status: 'Qualified', feedback: '' }],
      ]),
    ).rejects.toThrow('passing score');
    await expect(
      rpc(recruiter, 'applicationService', 'advance', [ids[a.id]], a.id),
    ).rejects.toThrow('individual round');
    await recruit(recruiter, 'saveResults', [
      drive.id,
      'aptitude',
      candidates.map((c) => ({
        applicationId: c.applicationId,
        status: c.studentId === a.id ? 'Qualified' : c.studentId === b.id ? 'Rejected' : 'Absent',
        score: c.studentId === a.id ? 80 : 20,
        feedback: 'Recorded evidence',
      })),
    ]);
    expect(((await recruit(a, 'overview', [drive.id])) as RecruitmentOverview).results).toEqual([]);
    await recruit(recruiter, 'publishResults', [drive.id, 'aptitude']);
    expect(
      ((await recruit(a, 'overview', [drive.id])) as RecruitmentOverview).assignments,
    ).toHaveLength(1);
    expect(((await recruit(b, 'overview', [drive.id])) as RecruitmentOverview).assignments).toEqual(
      [],
    );
    await expect(
      recruit(b, 'submitAssignment', [drive.id, `${drive.id}:assignment`, 'submission']),
    ).rejects.toThrow('not reached');
    await recruit(a, 'submitAssignment', [
      drive.id,
      `${drive.id}:assignment`,
      'https://example.com/submission.pdf',
    ]);
    await expect(
      recruit(a, 'submitAssignment', [
        drive.id,
        `${drive.id}:assignment`,
        'submission',
        'another-student-file',
      ]),
    ).rejects.toThrow('own documents');
    await recruit(recruiter, 'saveResults', [
      drive.id,
      'assignment',
      [{ applicationId: ids[a.id], status: 'Qualified', feedback: 'Good implementation' }],
    ]);
    await recruit(recruiter, 'publishResults', [drive.id, 'assignment']);
    await recruit(recruiter, 'scheduleInterview', [
      drive.id,
      {
        roundId: 'interview',
        studentId: a.id,
        date: '2099-10-02',
        time: '14:00',
        duration: 60,
        venue: 'Hall A',
        room: 'Room 1',
        panel: 'Engineering',
        mode: 'Offline',
        meetingLink: '',
      },
    ]);
    await db.put(
      'interview-slot',
      'other-slot',
      {
        id: 'other-slot',
        driveId: 'other-drive',
        roundId: 'other',
        studentId: a.id,
        date: '2099-10-02',
        time: '14:30',
        duration: 60,
        venue: 'Other Hall',
        room: '2',
        panel: 'Other',
        mode: 'Offline',
        meetingLink: '',
        recruiterId: 'other',
      },
      'campus-a',
      a.id,
    );
    await expect(
      recruit(recruiter, 'scheduleInterview', [
        drive.id,
        {
          roundId: 'interview',
          studentId: a.id,
          date: '2099-10-02',
          time: '14:00',
          duration: 60,
          venue: 'Hall A',
          room: 'Room 1',
          panel: 'Engineering',
          mode: 'Offline',
          meetingLink: '',
        },
      ]),
    ).rejects.toThrow('Schedule Conflict');
    await expect(
      recruit(recruiter, 'scheduleInterview', [
        drive.id,
        {
          roundId: 'interview',
          studentId: a.id,
          date: '2099-10-02',
          time: '14:00',
          duration: 60,
          venue: 'Hall A',
          room: 'Room 1',
          panel: 'Engineering',
          mode: 'Offline',
          meetingLink: '',
          override: true,
          reason: 'Approved exception',
        },
      ]),
    ).rejects.toThrow('Only campus');
    await recruit(campus, 'scheduleInterview', [
      drive.id,
      {
        roundId: 'interview',
        studentId: a.id,
        date: '2099-10-02',
        time: '14:00',
        duration: 60,
        venue: 'Hall A',
        room: 'Room 1',
        panel: 'Engineering',
        mode: 'Offline',
        meetingLink: '',
        override: true,
        reason: 'Approved exception',
      },
    ]);
    await recruit(recruiter, 'saveResults', [
      drive.id,
      'interview',
      [{ applicationId: ids[a.id], status: 'Qualified', feedback: 'Selected' }],
    ]);
    await recruit(recruiter, 'publishResults', [drive.id, 'interview']);
    expect((await overview()).counts.selected).toBe(1);
    await rpc(
      recruiter,
      'offerService',
      'create',
      [
        {
          company: 'Sample Company',
          role: 'Engineer',
          ctc: '10 LPA',
          date: '2099-10-02',
          joining: '2099-11-01',
          deadline: '2099-10-10',
        },
      ],
      a.id,
    );
    const profile = await db.get<WorkspaceData>('workspace', a.id);
    await rpc(a, 'offerService', 'respond', [profile!.offers[0].id, 'Accepted']);
    expect((await db.get<WorkspaceData>('workspace', a.id))!.offers[0].status).toBe('Accepted');
    expect((await db.list('audit')).length).toBeGreaterThan(15);
    expect(
      (await db.list<{ action: string }>('audit', 'campus-a')).some(
        (a) => a.action === 'publishResults',
      ),
    ).toBe(true);
    expect((await db.list('notification', undefined, b.id)).length).toBeGreaterThan(0);
  });
  it('keeps campus assessments separate and never exposes answers or another campus assessment', async () => {
    const row = (await recruit(campus, 'createAssessment', [
      {
        title: 'Readiness',
        description: 'Campus preparation',
        type: 'Aptitude test',
        questions: [{ prompt: '2+2?', options: ['4', '5'], answer: 0 }],
        duration: 30,
        start: new Date(Date.now() - 60000).toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        maximumMarks: 100,
        passingMarks: 50,
        batch: '2027',
        branch: 'CSE',
        studentIds: [],
        instructions: 'Choose answer',
        visibleResults: true,
      },
    ])) as CampusAssessment;
    expect(
      ((await recruit(a, 'assessments')) as CampusAssessment[])[0].questions[0],
    ).not.toHaveProperty('answer');
    expect(await recruit(other, 'assessments')).toEqual([]);
    await expect(recruit(other, 'submitAssessment', [row.id, [0]])).rejects.toThrow('unavailable');
    await recruit(a, 'startAssessment', [row.id]);
    expect(await recruit(a, 'submitAssessment', [row.id, [0]])).toEqual({
      score: 100,
      passed: true,
    });
    await expect(recruit(a, 'submitAssessment', [row.id, [0]])).rejects.toThrow(
      'already submitted',
    );
    await expect(recruit(recruiter, 'createAssessment', [{}])).rejects.toThrow('role');
  });
  it('removes student visibility on schedule changes until agreement and republication', async () => {
    const drive = await create();
    await publish(drive);
    expect((await runWorkspace(db, a, undefined, readWorkspace)).drives).toHaveLength(1);
    await rpc(campus, 'driveService', 'transition', [
      drive.id,
      'reschedule',
      'campus',
      'Campus hall unavailable',
    ]);
    expect((await runWorkspace(db, a, undefined, readWorkspace)).drives).toHaveLength(0);
    await rpc(campus, 'driveService', 'proposeSchedule', [
      drive.id,
      {
        date: '2099-10-03',
        reporting: '09:00',
        talk: '10:00',
        assessment: '10:00',
        interviews: '10:00',
        end: '16:00',
        venue: 'Hall B',
        lab: '',
        rooms: 'Room 2',
        systems: 0,
      },
    ]);
    await rpc(recruiter, 'driveService', 'transition', [drive.id, 'confirm', 'recruiter']);
    await expect(
      rpc(campus, 'driveService', 'transition', [drive.id, 'activate', 'campus']),
    ).rejects.toThrow('Finalize');
    await rpc(campus, 'driveService', 'transition', [drive.id, 'finalize', 'campus']);
    await rpc(campus, 'driveService', 'transition', [drive.id, 'activate', 'campus']);
    expect((await runWorkspace(db, a, undefined, readWorkspace)).drives).toHaveLength(1);
  });
  it('lets campus verify additional conditions and prevents recruiters from forging academic eligibility', async () => {
    const drive = await create();
    await publish(drive);
    const stored = (await db.get<StoredDrive>('drive', drive.id))!;
    await db.put(
      'drive',
      drive.id,
      { ...stored, additionalEligibility: 'Must have a verified certificate' },
      'campus-a',
      recruiter.id,
    );
    await expect(recruit(a, 'overview', [drive.id])).rejects.toThrow('not eligible');
    await expect(
      recruit(recruiter, 'verifyEligibility', [drive.id, a.id, true, 'Has certificate']),
    ).rejects.toThrow('role');
    await recruit(campus, 'verifyEligibility', [
      drive.id,
      a.id,
      true,
      'Certificate verified by campus',
    ]);
    expect(((await recruit(a, 'overview', [drive.id])) as RecruitmentOverview).candidates).toEqual(
      [],
    );
    await expect(
      rpc(recruiter, 'driveService', 'updateDriveRequest', [
        drive.id,
        { eligibilityApprovals: [low.id] },
      ]),
    ).rejects.toThrow('cannot be edited');
    await expect(
      recruit(campus, 'verifyEligibility', [drive.id, other.id, true, 'Verified certificate']),
    ).rejects.toThrow('another campus');
  });
  it('supports an interview-only job with no assignment or assessment stage', async () => {
    const drive = await create();
    await rpc(campus, 'driveService', 'transition', [
      drive.id,
      'changes',
      'campus',
      'Use a single interview round',
    ]);
    await rpc(recruiter, 'driveService', 'updateDriveRequest', [
      drive.id,
      {
        rounds: [
          {
            id: 'only-interview',
            name: 'Interview',
            type: 'Technical Interview',
            mode: 'Offline',
            duration: 30,
            capacity: 10,
            requirements: '',
            cleared: 0,
          },
        ],
      },
    ]);
    await rpc(recruiter, 'driveService', 'transition', [drive.id, 'resubmit', 'recruiter']);
    await publish(drive);
    await recruit(a, 'interest', [drive.id, 'Interested']);
    const application = (await recruit(a, 'apply', [drive.id, true])) as { id: string };
    await rpc(campus, 'driveService', 'transition', [drive.id, 'start', 'campus']);
    await recruit(recruiter, 'saveResults', [
      drive.id,
      'only-interview',
      [{ applicationId: application.id, status: 'Qualified', feedback: 'Selected' }],
    ]);
    await recruit(recruiter, 'publishResults', [drive.id, 'only-interview']);
    const overview = (await recruit(a, 'overview', [drive.id])) as RecruitmentOverview;
    expect(overview.assignments).toEqual([]);
    expect(overview.candidates[0].stage).toBe('Selected');
    await rpc(campus, 'driveService', 'transition', [drive.id, 'complete', 'campus']);
  });
});
