import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { Database } from './db';
import { emptyWorkspace, StoredDrive } from './workspace';
import { defaultDrive } from '../src/mocks/placement';
import { Account } from './auth';
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
    const data = await db.get<import('../src/types').DemoData>('workspace', response.body.user.id);
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
    const data = await db.get<import('../src/types').DemoData>('workspace', student.id);
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
    const updated = await db.get<import('../src/types').DemoData>('workspace', student.id),
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
