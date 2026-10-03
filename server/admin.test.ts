import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { Database } from './db';
import type { Account } from './auth';

describe('administrator management and student publishing', () => {
  const db = new Database('', ':memory:');
  let runtime: Awaited<ReturnType<typeof createApp>>;
  const clients: Record<
    string,
    { agent: ReturnType<typeof request.agent>; csrf: string; account: Account }
  > = {};
  beforeAll(async () => {
    runtime = await createApp(db);
    await db.put('campus', 'test-campus', {
      id: 'test-campus',
      name: 'Test University',
      location: 'Test',
      courses: ['B.Tech'],
      branches: ['CSE'],
      studentPool: 0,
    });
    for (const [key, role, approved, isAdmin, verified] of [
      ['admin', 'campus', true, true, true],
      ['campus', 'campus', false, false, true],
      ['recruiter', 'recruiter', false, false, true],
      ['student', 'student', true, false, true],
      ['unverified', 'campus', true, true, false],
    ] as const) {
      const account = await runtime.auth.create(
        {
          name: key,
          email: `${key}@admin-test.invalid`,
          password: 'AdminTestPassword!123',
          role,
          campusId: 'test-campus',
          organization: 'Test',
        },
        approved,
      );
      account.isAdmin = isAdmin;
      account.verified = verified;
      await runtime.auth.save(account);
      const agent = request.agent(runtime.app);
      const login = await agent
        .post('/api/v1/auth/login')
        .send({ email: account.email, password: 'AdminTestPassword!123' });
      clients[key] = { agent, csrf: login.body.csrf, account };
    }
  });
  afterAll(async () => {
    await db.close();
  });
  const post = (route: string, body: object) =>
    clients.admin.agent
      .post(`/api/v1/admin/${route}`)
      .set('X-CSRF-Token', clients.admin.csrf)
      .send(body);
  const rpc = (method: string, args: unknown[]) =>
    clients.student.agent
      .post(`/api/v1/services/${method}`)
      .set('X-CSRF-Token', clients.student.csrf)
      .send({ args });

  it('requires authenticated, verified administrator access and CSRF', async () => {
    expect((await request(runtime.app).get('/api/v1/admin')).status).toBe(401);
    for (const key of ['student', 'campus', 'recruiter', 'unverified']) {
      expect((await clients[key].agent.get('/api/v1/admin')).status).toBe(403);
      expect(
        (
          await clients[key].agent
            .patch(`/api/v1/admin/accounts/${clients.campus.account.id}`)
            .set('X-CSRF-Token', clients[key].csrf)
            .send({ approved: true })
        ).status,
      ).toBe(403);
    }
    expect((await clients.admin.agent.post('/api/v1/admin/questions').send({})).status).toBe(403);
  });
  it('does not permit admin self-registration or expose password hashes', async () => {
    const registration = await request(runtime.app).post('/api/v1/auth/register').send({
      name: 'Intruder',
      email: 'intruder@admin-test.invalid',
      password: 'SomePassword!123',
      role: 'campus',
      institution: 'Test',
      isAdmin: true,
    });
    expect(registration.status).toBe(400);
    const result = await clients.admin.agent.get('/api/v1/admin');
    expect(result.status).toBe(200);
    expect(JSON.stringify(result.body)).not.toContain('passwordHash');
  });
  it('approves campus and recruiter accounts and records the action', async () => {
    for (const key of ['campus', 'recruiter']) {
      const result = await clients.admin.agent
        .patch(`/api/v1/admin/accounts/${clients[key].account.id}`)
        .set('X-CSRF-Token', clients.admin.csrf)
        .send({ approved: true });
      expect(result.status).toBe(200);
      expect(result.body.approved).toBe(true);
      expect((await runtime.auth.byId(clients[key].account.id))?.approved).toBe(true);
    }
    expect(
      (await db.list<{ event: string }>('audit')).filter(
        (a) => a.event === 'admin-account-approved',
      ),
    ).toHaveLength(2);
    expect(
      (
        await clients.admin.agent
          .patch(`/api/v1/admin/accounts/${clients.admin.account.id}`)
          .set('X-CSRF-Token', clients.admin.csrf)
          .send({ approved: false })
      ).status,
    ).toBe(403);
  });
  it('rejects role and admin privilege changes through the approval endpoint', async () => {
    expect(
      (
        await clients.admin.agent
          .patch(`/api/v1/admin/accounts/${clients.student.account.id}`)
          .set('X-CSRF-Token', clients.admin.csrf)
          .send({ approved: true, isAdmin: true })
      ).status,
    ).toBe(400);
  });
  it('publishes contests, keeps solutions private, and awards points once', async () => {
    const body = {
      name: 'Admin challenge',
      type: 'Weekly',
      duration: 15,
      points: 75,
      difficulty: 'Easy',
      prompt: 'What is 6 × 7?',
      answer: '42',
      status: 'draft',
      campusId: '',
    };
    const created = await post('contests', body);
    expect(created.status).toBe(200);
    const id = created.body.id;
    expect(
      (await rpc('contestService/getContests', [])).body.some((c: { id: string }) => c.id === id),
    ).toBe(false);
    expect((await post('contests', { ...body, id, status: 'published' })).status).toBe(200);
    const published = (await rpc('contestService/getContests', [])).body.find(
      (c: { id: string }) => c.id === id,
    );
    expect(published.prompt).toBe(body.prompt);
    expect(published.answer).toBeUndefined();
    expect((await rpc('contestService/submitContest', [id, '42'])).status).toBe(409);
    expect((await rpc('contestService/joinContest', [id])).status).toBe(200);
    expect((await rpc('contestService/submitContest', [id, 'wrong'])).status).toBe(400);
    expect((await rpc('contestService/submitContest', [id, '42'])).status).toBe(200);
    const first = await rpc('studentService/getDashboard', []);
    await rpc('contestService/submitContest', [id, '42']);
    const second = await rpc('studentService/getDashboard', []);
    expect(second.body.student.xp).toBe(first.body.student.xp);
    expect(
      second.body.history.filter((h: { assessmentId: string }) => h.assessmentId === id),
    ).toHaveLength(1);
    await post('contests', { ...body, id, status: 'archived' });
    expect((await rpc('contestService/joinContest', [id])).status).toBe(404);
  });
  it('scores published assessments using private, frozen question snapshots', async () => {
    const question = { prompt: '2 + 2?', topic: 'Arithmetic', options: ['3', '4'], answer: 1 };
    expect((await post('questions', { ...question, answer: 3 })).status).toBe(400);
    const createdQuestion = await post('questions', question);
    const body = {
      name: 'Arithmetic',
      type: 'Aptitude',
      duration: 5,
      skill: '',
      status: 'published',
      campusId: 'test-campus',
      questionIds: [createdQuestion.body.id],
    };
    const assessment = await post('assessments', body);
    expect(assessment.status).toBe(200);
    const start = await rpc('assessmentService/startAssessment', [assessment.body.id]);
    expect(start.status).toBe(200);
    expect(start.body.questions).toHaveLength(1);
    expect(start.body.questions[0].answer).toBeUndefined();
    await post('questions', { ...question, id: createdQuestion.body.id, answer: 0 });
    const submit = await rpc('assessmentService/submitAssessment', [assessment.body.id, [1], 1]);
    expect(submit.status).toBe(200);
    expect(submit.body.score).toBe(100);
    expect(submit.body.topicScores.Arithmetic).toBe(100);
    expect(
      (await rpc('assessmentService/submitAssessment', [assessment.body.id, [1], 1])).status,
    ).toBe(409);
    await post('assessments', { ...body, id: assessment.body.id, campusId: '' });
    const other = await post('assessments', {
      ...body,
      name: 'Other campus',
      campusId: 'missing-campus',
    });
    expect(other.status).toBe(400);
  });
  it('does not expose drafts or another campus’s assessments', async () => {
    await db.put('campus', 'other-campus', { id: 'other-campus', name: 'Other' });
    const q = await post('questions', {
      prompt: 'Choose A',
      topic: 'Test',
      options: ['A', 'B'],
      answer: 0,
    });
    const body = {
      name: 'Hidden',
      type: 'Aptitude',
      duration: 5,
      skill: '',
      questionIds: [q.body.id],
    };
    for (const audience of [
      { status: 'draft', campusId: '' },
      { status: 'published', campusId: 'other-campus' },
    ]) {
      const created = await post('assessments', { ...body, ...audience });
      expect(created.status).toBe(200);
      expect((await rpc('assessmentService/startAssessment', [created.body.id])).status).toBe(404);
    }
  });
});
