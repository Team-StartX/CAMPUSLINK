import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { Database } from './db';
import { emptyWorkspace, StoredDrive } from './workspace';
import { defaultDrive } from '../src/mocks/placement';
import { Account } from './auth';
import type { WorkspaceData } from '../src/types';
import { similarity, parseRequirements, interviewFeedback } from './nlp';
import { train, predict, features, OutcomeRow } from './ml';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { config } from './config';

describe('Express placement backend', () => {
  const db = new Database('', ':memory:');
  let runtime: Awaited<ReturnType<typeof createApp>>;
  const password = 'BackendTestOnly!123';
  let student: Account, other: Account, recruiter: Account, campus: Account;
  const clients: Record<string, { agent: ReturnType<typeof request.agent>; csrf: string }> = {};
  let tempDir: string;
  const originalProviders = {
    storage: config.storage,
    ai: config.ai,
    email: config.email,
    storageDir: config.storageDir,
  };
  beforeAll(async () => {
    config.storage = 'local';
    config.ai = 'local';
    config.email = 'outbox';
    runtime = await createApp(db);
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'campuslink-api-'));
    config.storageDir = tempDir;
    for (const id of ['campus-a', 'campus-b'])
      await db.put('campus', id, { id, name: id, courses: ['B.Tech'], branches: ['CSE'] }, id);
    async function account(role: Account['role'], email: string, campusId: string) {
      const a = await runtime.auth.create(
        {
          role,
          email,
          name: email.split('@')[0],
          password,
          campusId,
          organization: role === 'recruiter' ? 'Test Company' : campusId,
        },
        true,
      );
      a.verified = true;
      await runtime.auth.save(a);
      if (role === 'student') {
        const w = emptyWorkspace(a, campusId);
        w.student.course = 'B.Tech · Computer Science';
        w.student.branch = 'CSE';
        w.student.year = '2027';
        w.student.cgpa = 8;
        w.student.skills = [{ id: 'react', name: 'React', level: 'Advanced', verified: false }];
        await db.put('workspace', a.id, w, campusId, a.id);
      }
      return a;
    }
    student = await account('student', 'student@test.invalid', 'campus-a');
    other = await account('student', 'other@test.invalid', 'campus-b');
    recruiter = await account('recruiter', 'recruiter@test.invalid', '');
    campus = await account('campus', 'campus@test.invalid', 'campus-a');
    for (const [key, a] of Object.entries({ student, other, recruiter, campus })) {
      const agent = request.agent(runtime.app),
        response = await agent.post('/api/v1/auth/login').send({ email: a.email, password });
      clients[key] = { agent, csrf: response.body.csrf };
    }
  });
  afterAll(async () => {
    await db.close();
    await fs.rm(tempDir, { recursive: true, force: true });
    Object.assign(config, originalProviders);
  });
  const rpc = (
    who: string,
    service: string,
    method: string,
    args: unknown[] = [],
    target?: string,
  ) => {
    let req = clients[who].agent
      .post(`/api/v1/services/${service}/${method}`)
      .set('X-CSRF-Token', clients[who].csrf);
    if (target) req = req.set('X-Student-ID', target);
    return req.send({ args });
  };
  it('prevents caching of public, authenticated, and rejected API responses', async () => {
    const responses = await Promise.all([
      request(runtime.app).get('/api/v1/health'),
      clients.student.agent.get('/api/v1/auth/me'),
      request(runtime.app).get('/api/v1/analytics'),
    ]);
    for (const response of responses) expect(response.headers['cache-control']).toBe('no-store');
  });
  it('lets an institute edit its own student, preserves progress, and records the actor', async () => {
    const before = (await db.get<WorkspaceData>('workspace', student.id))!;
    const response = await rpc('campus', 'campusService', 'updateStudent', [
      student.id,
      {
        name: 'Updated Student',
        cgpa: 8.75,
        branch: 'CSE',
        activeBacklogs: 1,
      },
    ]);
    expect(response.status).toBe(200);
    const dashboard = await rpc('student', 'studentService', 'getDashboard');
    expect(dashboard.body.student).toMatchObject({
      name: 'Updated Student',
      cgpa: 8.75,
      branch: 'CSE',
      activeBacklogs: 1,
    });
    expect(dashboard.body.student.xp).toBe(before.student.xp);
    expect(dashboard.body.student.skills).toEqual(before.student.skills);
    expect(dashboard.body.history).toEqual(before.history);
    expect((await clients.student.agent.get('/api/v1/auth/me')).body.user.name).toBe(
      'Updated Student',
    );
    const audit = await db.list<{
      event: string;
      actorId: string;
      targetId: string;
      fields: string[];
    }>('audit');
    expect(audit).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'institute-student-update',
          actorId: campus.id,
          targetId: student.id,
          fields: expect.arrayContaining(['cgpa', 'name']),
        }),
      ]),
    );
    await db.put('workspace', student.id, before, student.campusId, student.id);
    await runtime.auth.save(student);
  });
  it('blocks institute edits and achievements outside its campus, other roles, and protected fields', async () => {
    const before = await db.get<WorkspaceData>('workspace', other.id);
    expect(
      (await rpc('campus', 'campusService', 'updateStudent', [other.id, { cgpa: 10 }])).status,
    ).toBe(403);
    expect(
      (await rpc('campus', 'campusService', 'getStudentAchievements', [other.id])).status,
    ).toBe(403);
    for (const who of ['student', 'recruiter'])
      expect(
        (await rpc(who, 'campusService', 'updateStudent', [student.id, { cgpa: 10 }])).status,
      ).toBe(403);
    for (const patch of [
      { xp: 999 },
      { campusId: 'campus-b' },
      { email: 'changed@test.invalid' },
      { skills: [] },
      { cgpa: 11 },
      {},
    ])
      expect(
        (await rpc('campus', 'campusService', 'updateStudent', [student.id, patch])).status,
      ).toBe(400);
    expect(await db.get('workspace', other.id)).toEqual(before);
  });
  it('shows institute edits on the selected student rather than the default student', async () => {
    const sibling = await runtime.auth.create(
      {
        role: 'student',
        email: 'sibling@test.invalid',
        name: 'Sibling Student',
        password,
        campusId: 'campus-a',
        organization: 'campus-a',
      },
      true,
    );
    const response = await rpc('campus', 'campusService', 'updateStudent', [
      sibling.id,
      { cgpa: 9.25 },
    ]);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: sibling.id, cgpa: 9.25 });
    expect((await db.get<WorkspaceData>('workspace', student.id))?.student.cgpa).toBe(8);
    expect((await rpc('campus', 'campusService', 'getStudents')).body).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: sibling.id, cgpa: 9.25 })]),
    );
    await db.remove('account', sibling.email);
    await db.remove('workspace', sibling.id);
  });
  it('unlocks a contest badge on correct completion and prevents concurrent award replay', async () => {
    await db.put(
      'admin-contest',
      'test-published-contest',
      {
        id: 'test-published-contest',
        name: 'Campus challenge',
        type: 'Aptitude',
        campusId: student.campusId,
        status: 'published',
        duration: 15,
        points: 150,
        difficulty: 'Easy',
        prompt: 'Double 16.',
        answer: '32',
      },
      student.campusId,
    );
    const before = (await rpc('student', 'studentService', 'getDashboard')).body as WorkspaceData;
    const contest = before.contests.find((c) => c.id === 'test-published-contest')!;
    expect((await rpc('student', 'contestService', 'joinContest', [contest.id])).status).toBe(200);
    expect(
      (await rpc('student', 'contestService', 'submitContest', [contest.id, 'wrong'])).status,
    ).toBe(400);
    expect(
      (await rpc('campus', 'campusService', 'getStudentAchievements', [student.id])).body.completed,
    ).toBe(0);
    const results = await Promise.all(
      [1, 2].map(() => rpc('student', 'contestService', 'submitContest', [contest.id, '32'])),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    const updated = (await db.get<WorkspaceData>('workspace', student.id))!;
    expect(updated.student.xp).toBe(before.student.xp + contest.points);
    expect(updated.history.filter((h) => h.activity === 'contest')).toHaveLength(1);
    const progress = await rpc('campus', 'campusService', 'getStudentAchievements', [student.id]);
    expect(progress.body).toMatchObject({ completed: 1, currentStreak: 1 });
    expect(
      progress.body.badges.find((b: { id: string }) => b.id === 'first-finish').earnedOn,
    ).toBeTruthy();
    const dashboard = await rpc('student', 'studentService', 'getDashboard');
    expect(dashboard.body.pointsSummary.participation).toBe(contest.points);
    await db.put('workspace', student.id, before, student.campusId, student.id);
  });
  it('saves communication feedback only in the submitting student history', async () => {
    const response = await rpc('student', 'interviewService', 'analyzeCommunication', [
      {
        promptId: 'project',
        transcript:
          'Um I am agree that we should discuss about this project because the result improved teamwork.',
        mode: 'text',
        seconds: null,
      },
    ]);
    expect(response.status).toBe(200);
    expect(response.body.metrics.wordsPerMinute).toBeNull();
    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ quote: 'I am agree', correction: 'I agree' }),
      ]),
    );
    const own = await rpc('student', 'interviewService', 'getCommunicationHistory');
    const unrelated = await rpc('other', 'interviewService', 'getCommunicationHistory');
    expect(own.body.some((item: { id: string }) => item.id === response.body.id)).toBe(true);
    expect(unrelated.body).toEqual([]);
    expect((await rpc('recruiter', 'interviewService', 'getCommunicationHistory')).status).toBe(
      403,
    );
  });
  it('validates communication input before saving feedback', async () => {
    const bad = await rpc('student', 'interviewService', 'analyzeCommunication', [
      { promptId: 'project', transcript: 'A short response', mode: 'text', seconds: 20 },
    ]);
    expect(bad.status).toBe(400);
    expect(
      (
        await rpc('student', 'interviewService', 'analyzeCommunication', [
          {
            promptId: 'project',
            transcript: 'A complete project response with at least eight words here.',
            mode: 'voice',
            seconds: 999,
          },
        ])
      ).status,
    ).toBe(400);
  });
  it('respects AI consent and preserves transcript feedback when coaching fails', async () => {
    const originalAi = config.ai,
      originalKey = config.aiKey,
      originalConsent = student.aiConsent;
    const provider = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          output: [
            {
              content: [
                {
                  type: 'output_text',
                  text: JSON.stringify({
                    summary: 'Explain your contribution before the result.',
                    suggestions: ['Give one clear example.'],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const input = {
      promptId: 'project',
      transcript:
        'I am agree that we should discuss about this project because the result improved teamwork.',
      mode: 'text',
      seconds: null,
    };
    try {
      config.ai = 'openai';
      config.aiKey = 'test-only-provider-key';
      student.aiConsent = false;
      await runtime.auth.save(student);
      const local = await rpc('student', 'interviewService', 'analyzeCommunication', [input]);
      expect(local.body.source).toBe('Transcript checks');
      expect(provider).not.toHaveBeenCalled();
      student.aiConsent = true;
      await runtime.auth.save(student);
      const coached = await rpc('student', 'interviewService', 'analyzeCommunication', [input]);
      expect(coached.status).toBe(200);
      expect(coached.body.source).toBe('Transcript checks + AI coaching');
      expect(coached.body.coaching.suggestions).toEqual(['Give one clear example.']);
      expect(coached.body.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ quote: 'I am agree' })]),
      );
      provider.mockRejectedValueOnce(new Error('Test provider unavailable'));
      const fallback = await rpc('student', 'interviewService', 'analyzeCommunication', [input]);
      expect(fallback.status).toBe(200);
      expect(fallback.body.coachingStatus).toBe('unavailable');
      expect(fallback.body.issues.length).toBeGreaterThan(0);
    } finally {
      provider.mockRestore();
      config.ai = originalAi;
      config.aiKey = originalKey;
      student.aiConsent = originalConsent;
      await runtime.auth.save(student);
    }
  });
  it('hides unexpected infrastructure errors from API responses', async () => {
    const query = vi
      .spyOn(db, 'query')
      .mockRejectedValueOnce(new Error('private database connection detail'));
    try {
      const response = await request(runtime.app).get('/api/v1/health');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Unable to complete this request. Please try again.');
      expect(JSON.stringify(response.body)).not.toContain('private database');
    } finally {
      query.mockRestore();
    }
  });
  it('rejects guessed passwords and unauthenticated requests', async () => {
    expect(
      (
        await request(runtime.app)
          .post('/api/v1/auth/login')
          .send({ email: student.email, password: 'wrong-password' })
      ).status,
    ).toBe(401);
    expect((await request(runtime.app).get('/api/v1/analytics')).status).toBe(401);
  });
  it('enforces CSRF, role permissions and profile field protection', async () => {
    expect(
      (
        await clients.student.agent
          .post('/api/v1/services/studentService/updateStudent')
          .send({ args: [{ cgpa: 9 }] })
      ).status,
    ).toBe(403);
    expect((await rpc('student', 'driveService', 'createDriveRequest', [{}])).status).toBe(403);
    expect(
      (
        await rpc('student', 'studentService', 'updateStudent', [
          { xp: 99999, skills: [{ verified: true }] },
        ])
      ).status,
    ).toBe(400);
    expect(
      (
        await rpc('student', 'studentService', 'updateStudent', [
          { cgpa: 8.5, bio: 'My real profile' },
        ])
      ).status,
    ).toBe(200);
  });
  it('isolates students and campus records', async () => {
    expect((await rpc('student', 'studentService', 'getDashboard', [], other.id)).status).toBe(403);
    expect((await rpc('campus', 'studentService', 'getDashboard', [], other.id)).status).toBe(403);
    expect((await rpc('recruiter', 'recruiterService', 'getCandidates')).body).toEqual([]);
  });
  it('registers empty profiles and keeps staff pending approval', async () => {
    const registration = {
      name: 'New Student',
      email: 'new@test.invalid',
      password,
      role: 'student',
      institution: 'campus-a',
    };
    const response = await request(runtime.app).post('/api/v1/auth/register').send(registration);
    expect(response.status).toBe(201);
    const data = await db.get<import('../src/types').WorkspaceData>(
      'workspace',
      response.body.user.id,
    );
    expect(data?.student.skills).toEqual([]);
    expect(data?.student.xp).toBe(0);
    const staff = await request(runtime.app)
      .post('/api/v1/auth/register')
      .send({ ...registration, email: 'new-staff@test.invalid', role: 'recruiter' });
    expect(staff.body.user.approved).toBe(false);
  });
  it('runs request, review, scheduling, confirmation and activation with role-bound transitions', async () => {
    const input = defaultDrive({
      campusId: 'campus-a',
      company: 'Spoofed',
      role: 'Frontend Engineer',
      skills: 'React',
      deadline: '2090-01-01',
      preferredDates: ['2090-01-05'],
      cgpa: 7,
      graduationYear: '2027',
      branches: 'CSE',
      courses: 'B.Tech',
      systems: 0,
    });
    const created = await rpc('recruiter', 'driveService', 'createDriveRequest', [input, false]);
    expect(created.status).toBe(200);
    const drives = await db.list<StoredDrive>('drive');
    const drive = drives.find((d) => d.role === 'Frontend Engineer')!;
    expect(drive.company).toBe('Test Company');
    expect(
      (await rpc('recruiter', 'driveService', 'transition', [drive.id, 'approve', 'campus', '']))
        .status,
    ).toBe(422);
    expect(
      (
        await rpc('campus', 'driveService', 'transition', [
          drive.id,
          'approve',
          'campus',
          'Approved',
        ])
      ).status,
    ).toBe(200);
    const schedule = {
      date: '2090-01-05',
      reporting: '08:30',
      talk: '09:00',
      assessment: '10:00',
      interviews: '12:00',
      end: '17:00',
      venue: 'Hall A',
      lab: '',
      rooms: 'Room 1',
      systems: 0,
    };
    expect(
      (await rpc('campus', 'driveService', 'proposeSchedule', [drive.id, schedule])).status,
    ).toBe(200);
    expect(
      (await rpc('recruiter', 'driveService', 'transition', [drive.id, 'confirm', 'recruiter', '']))
        .status,
    ).toBe(200);
    expect(
      (await rpc('campus', 'driveService', 'transition', [drive.id, 'activate', 'campus', '']))
        .status,
    ).toBe(422);
    expect(
      (await rpc('campus', 'driveService', 'transition', [drive.id, 'finalize', 'campus', '']))
        .status,
    ).toBe(200);
    expect(
      (await rpc('campus', 'driveService', 'transition', [drive.id, 'activate', 'campus', '']))
        .status,
    ).toBe(200);
    expect((await rpc('student', 'applicationService', 'apply', [drive.id])).status).toBe(200);
    expect((await rpc('student', 'applicationService', 'apply', [drive.id])).status).toBe(422);
    expect(
      (await rpc('recruiter', 'recruiterService', 'getCandidates')).body.some(
        (s: { id: string }) => s.id === student.id,
      ),
    ).toBe(true);
    const ranked = await clients.recruiter.agent.get(`/api/v1/drives/${drive.id}/matches`);
    expect(ranked.body[0].eligibility.passed).toBe(true);
    expect(ranked.body[0].hybridScore).toBeGreaterThan(0);
  });
  it('serializes simultaneous conflicting reservations', async () => {
    const schedule = {
      date: '2091-01-05',
      reporting: '08:30',
      talk: '09:00',
      assessment: '10:00',
      interviews: '12:00',
      end: '17:00',
      venue: 'Shared Hall',
      lab: '',
      rooms: '',
      systems: 0,
    };
    for (const id of ['race-a', 'race-b']) {
      const drive = {
        ...defaultDrive({
          id,
          campusId: 'campus-a',
          campus: 'campus-a',
          company: 'Test Company',
          status: 'SCHEDULING',
          deadline: '2091-01-01',
          systems: 0,
        }),
        recruiterId: recruiter.id,
      };
      await db.put('drive', id, drive, 'campus-a', recruiter.id);
    }
    const results = await Promise.all(
      ['race-a', 'race-b'].map((id) =>
        rpc('campus', 'driveService', 'proposeSchedule', [id, schedule]),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
  });
  it('grades server-side and prevents replaying a submitted assessment', async () => {
    const started = await rpc('student', 'assessmentService', 'startAssessment', ['skill-react']);
    // Use the dynamically generated skill assessment identifier if the baseline differs.
    const dashboard = await rpc('student', 'studentService', 'getDashboard');
    const assessment = dashboard.body.assessments[0];
    const session =
      started.status === 200
        ? started
        : await rpc('student', 'assessmentService', 'startAssessment', [assessment.id]);
    expect(session.body.questions[0].answer).toBeUndefined();
    const id = session.body.assessment.id,
      answers = session.body.questions.map(() => 0);
    expect(
      (await rpc('student', 'assessmentService', 'submitAssessment', [id, answers, 0])).status,
    ).toBe(200);
    expect(
      (await rpc('student', 'assessmentService', 'submitAssessment', [id, answers, 0])).status,
    ).toBe(409);
  });
  it('stores real files, checks signatures, and blocks another student download', async () => {
    const response = await clients.student.agent
      .post('/api/v1/documents')
      .set('X-CSRF-Token', clients.student.csrf)
      .field('type', 'Resume')
      .attach('file', Buffer.from('%PDF-1.4\nfixture'), 'resume.pdf');
    expect(response.status).toBe(201);
    const id = response.body.documents[0].id;
    expect((await clients.student.agent.get(`/api/v1/documents/${id}/download`)).status).toBe(200);
    expect((await clients.other.agent.get(`/api/v1/documents/${id}/download`)).status).toBe(404);
    expect(
      (
        await clients.student.agent
          .post('/api/v1/documents')
          .set('X-CSRF-Token', clients.student.csrf)
          .field('type', 'Resume')
          .attach('file', Buffer.from('executable disguised as PDF'), 'fake.pdf')
      ).status,
    ).toBe(400);
  });
  it('uses submitted practice answers and prevents completion replay', async () => {
    const started = await rpc('student', 'interviewService', 'startAIInterview', [
      null,
      'Frontend Developer',
      'Mixed',
      'Intermediate',
    ]);
    expect(started.status).toBe(200);
    const answers = started.body.questions.map(
      () =>
        'First I built a React application because the team needed it. Then I tested 30 cases and measured the result.',
    );
    const result = await rpc('student', 'interviewService', 'completePractice', [answers, 100]);
    expect(result.status).toBe(200);
    expect(result.body.label).toBe('Local text-analysis feedback');
    expect(result.body.categories.length).toBe(4);
    expect(
      (await rpc('student', 'interviewService', 'completePractice', [answers, 100])).status,
    ).toBe(409);
  });
  it('tracks offers and requires campus verification before joining', async () => {
    const data = await db.get<import('../src/types').WorkspaceData>('workspace', student.id);
    const application = data!.applications[0];
    for (let i = 0; i < 5; i++)
      expect(
        (await rpc('recruiter', 'applicationService', 'advance', [application.id], student.id))
          .status,
      ).toBe(200);
    expect(
      (
        await rpc(
          'recruiter',
          'offerService',
          'create',
          [
            {
              company: 'Spoofed',
              role: 'Frontend Engineer',
              ctc: '12 LPA',
              date: '2090-01-06',
              joining: '2090-07-15',
              kind: 'PPO',
            },
          ],
          student.id,
        )
      ).status,
    ).toBe(200);
    const updated = await db.get<import('../src/types').WorkspaceData>('workspace', student.id),
      offer = updated!.offers[0];
    expect(offer.company).toBe('Test Company');
    expect(offer.kind).toBe('PPO');
    expect((await rpc('student', 'offerService', 'respond', [offer.id, 'Joined'])).status).toBe(
      403,
    );
    expect((await rpc('student', 'offerService', 'respond', [offer.id, 'Accepted'])).status).toBe(
      200,
    );
    expect(
      (await rpc('campus', 'offerService', 'respond', [offer.id, 'Joined'], student.id)).status,
    ).toBe(409);
    expect(
      (await rpc('campus', 'documentService', 'verify', [updated!.documents[0].id], student.id))
        .status,
    ).toBe(200);
    expect(
      (await rpc('campus', 'offerService', 'respond', [offer.id, 'Joined'], student.id)).status,
    ).toBe(200);
    const result = await clients.campus.agent.get('/api/v1/analytics');
    expect(result.body.placed).toBe(1);
    expect(result.body.joined).toBe(1);
  });
  it('invalidates all sessions when a single-use reset token is consumed', async () => {
    const token = await runtime.auth.issueToken(other, 'reset');
    await runtime.auth.consumeToken(token, 'reset', 'A-new-test-password!');
    expect((await clients.other.agent.get('/api/v1/auth/me')).status).toBe(401);
    await expect(
      runtime.auth.consumeToken(token, 'reset', 'A-new-test-password!'),
    ).rejects.toThrow();
  });
});
describe('NLP and learned model evaluation', () => {
  it('extracts aliases without matching embedded words', () => {
    const result = parseRequirements(
      'ReactJS, Node.js, PostgreSQL and AWS. CGPA >= 7.5, CSE, 2027. No active backlogs.',
    );
    expect(result.skills).toEqual(expect.arrayContaining(['React', 'Node.js', 'SQL', 'AWS']));
    expect(result.cgpa).toBe(7.5);
    expect(result.allowedBacklogs).toBe(0);
    expect(parseRequirements('expressions and reactive paintings').skills).toEqual([]);
  });
  it('ranks relevant text and changes feedback with actual answer evidence', () => {
    const scores = similarity('React JavaScript frontend', [
      'ReactJS JavaScript frontend projects',
      'Python data cleaning',
    ]);
    expect(scores[0]).toBeGreaterThan(scores[1]);
    const weak = interviewFeedback(['React state'], ['I am not sure.']),
      strong = interviewFeedback(
        ['React state'],
        [
          'First I built React state because users needed it. Then I tested 30 cases and measured the result.',
        ],
      );
    expect(strong.categories[0].score).toBeGreaterThan(weak.categories[0].score);
  });
  it('holds out an entire cohort and predicts from learned weights', () => {
    const rows: OutcomeRow[] = Array.from(
      { length: 180 },
      (_, i) =>
        ({
          cohort: String(2023 + Math.floor(i / 60)),
          ...Object.fromEntries(features.map((f) => [f, i % 2 ? 95 : 10])),
          placed: i % 2,
        }) as OutcomeRow,
    );
    const model = train(rows, 'synthetic');
    expect(model.testCohorts).toEqual(['2025']);
    expect(model.metrics.testCount).toBe(60);
    expect(model.metrics.accuracy).toBeGreaterThan(0.9);
    expect(predict(model, rows[1])).toBeGreaterThan(predict(model, rows[0]));
  });
});
