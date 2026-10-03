import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { Database } from './db';
import { config } from './config';
import { emptyWorkspace } from './workspace';
import type { Account } from './auth';
import { defaultDrive } from '../src/mocks/placement';
import type { DemoData } from '../src/types';

describe('consented ML workflows', () => {
  const db = new Database('', ':memory:');
  let runtime: Awaited<ReturnType<typeof createApp>>;
  const clients: Record<
    string,
    { agent: ReturnType<typeof request.agent>; csrf: string; account: Account }
  > = {};
  const original = {
    mlApiToken: config.mlApiToken,
    mlApiUrl: config.mlApiUrl,
    ai: config.ai,
    email: config.email,
  };
  beforeAll(async () => {
    config.mlApiToken = 'test-only-token';
    config.mlApiUrl = 'https://campuslink-ml-demo.onrender.com';
    config.ai = 'local';
    config.email = 'outbox';
    runtime = await createApp(db);
    for (const role of ['student', 'campus'] as const) {
      const account = await runtime.auth.create(
        {
          name: 'Sample',
          email: `${role}@ml-test.invalid`,
          password: 'TestOnlyPassword!123',
          role,
          campusId: 'test-campus',
          organization: 'Sample',
        },
        true,
      );
      account.verified = true;
      account.isAdmin = role === 'campus';
      await runtime.auth.save(account);
      if (role === 'student')
        await db.put(
          'workspace',
          account.id,
          emptyWorkspace(account),
          account.campusId,
          account.id,
        );
      const agent = request.agent(runtime.app);
      const login = await agent
        .post('/api/v1/auth/login')
        .send({ email: account.email, password: 'TestOnlyPassword!123' });
      clients[role] = { agent, csrf: login.body.csrf, account };
    }
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    Object.assign(config, original);
    await db.close();
  });
  const consent = (value: boolean) =>
    clients.student.agent
      .put('/api/v1/account/ml-consent')
      .set('X-CSRF-Token', clients.student.csrf)
      .send({ consent: value });
  const rpc = (method: string, args: unknown[] = []) =>
    clients.student.agent
      .post(`/api/v1/services/${method}`)
      .set('X-CSRF-Token', clients.student.csrf)
      .send({ args });
  const answers = async () => {
    const started = await rpc('interviewService/startAIInterview', [
      null,
      'Frontend Developer',
      'Mixed',
      'Intermediate',
    ]);
    expect(started.status).toBe(200);
    return started.body.questions.map(
      () => 'I built and tested a project. Contact sample@example.invalid or +91 9876543210.',
    );
  };
  it('only the student may change consent, with CSRF protection', async () => {
    expect(
      (await clients.student.agent.put('/api/v1/account/ml-consent').send({ consent: true }))
        .status,
    ).toBe(403);
    expect(
      (
        await clients.campus.agent
          .put('/api/v1/account/ml-consent')
          .set('X-CSRF-Token', clients.campus.csrf)
          .send({ consent: true })
      ).status,
    ).toBe(403);
    expect((await consent(true)).status).toBe(200);
    const account = await runtime.auth.byId(clients.student.account.id);
    expect(account?.mlConsent).toBe(true);
    expect(account?.aiConsent).not.toBe(true);
    await consent(false);
  });
  it('adds keyword matching without changing eligibility or evidence-based fit', async () => {
    const account = clients.student.account;
    const workspace = await db.get<DemoData>('workspace', account.id);
    workspace!.student.cgpa = 8;
    workspace!.student.campus = 'Test campus';
    workspace!.student.skills = [
      { id: 'react', name: 'React', level: 'Advanced', verified: false },
    ];
    await db.put('workspace', account.id, workspace, account.campusId, account.id);
    await db.put('campus', account.campusId, {
      id: account.campusId,
      name: 'Test campus',
      location: 'Test',
      courses: ['B.Tech'],
      branches: ['CSE'],
      studentPool: 1,
    });
    await db.put('drive', 'test-drive', {
      ...defaultDrive({
        id: 'test-drive',
        status: 'ACTIVE',
        campusId: account.campusId,
        campus: 'Test campus',
      }),
      recruiterId: 'sample-recruiter',
    });
    await consent(false);
    const local = await rpc('matchingService/getMatchExplanation', ['test-drive']);
    expect(local.status, JSON.stringify(local.body)).toBe(200);
    await consent(true);
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            relevanceScore: 99,
            matchedSkills: ['React'],
            skillGaps: ['SQL'],
            method: 'tfidf-keyword-v1',
            trained: false,
          }),
        ),
      );
    vi.stubGlobal('fetch', fetch);
    const remote = await rpc('matchingService/getMatchExplanation', ['test-drive']);
    expect(remote.status).toBe(200);
    expect(remote.body.score).toBe(local.body.score);
    expect(remote.body.eligibility).toEqual(local.body.eligibility);
    expect(remote.body.lexicalMatch.relevanceScore).toBe(99);
    expect(JSON.parse(fetch.mock.calls[0][1].body).job.requiredSkills).toEqual([
      'React',
      'SQL',
      'JavaScript',
    ]);
  });
  it('uses local feedback with consent off and makes no external request', async () => {
    await consent(false);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await rpc('interviewService/completePractice', [await answers(), 10]);
    expect(result.status).toBe(200);
    expect(result.body.ml.status).toBe('consent-required');
    expect(result.body.label).toBe('Local text-analysis feedback');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('uses consented rubric feedback and redacts contact details', async () => {
    await consent(true);
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          criteria: [{ name: 'Evidence', score: 75 }],
          generatedPreparationAdvice: ['Explain the result.'],
          method: 'rubric-keyword-heuristic-v1',
          trained: false,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await rpc('interviewService/completePractice', [await answers(), 10]);
    expect(result.status).toBe(200);
    expect(result.body.categories).toEqual([{ name: 'Evidence', score: 75 }]);
    expect(result.body.advice).toBe('Explain the result.');
    expect(result.body.ml.status).toBe('remote');
    expect(fetch.mock.calls[0][1].body).not.toContain('sample@example.invalid');
    expect(fetch.mock.calls[0][1].body).not.toContain('9876543210');
    expect(JSON.stringify(result.body)).not.toContain('test-only-token');
    expect((await rpc('interviewService/getInterviewFeedback')).body.ml.status).toBe('remote');
  });
  it('withdrawal stops subsequent external requests', async () => {
    await consent(false);
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await rpc('interviewService/completePractice', [await answers(), 10]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps local preparation guidance on network failure', async () => {
    await consent(true);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private error')));
    const result = await rpc('interviewService/completePractice', [await answers(), 10]);
    expect(result.status).toBe(200);
    expect(result.body.ml.status).toBe('unavailable');
    expect(result.body.categories).toHaveLength(4);
  });
  it('protects admin model diagnostics from student access', async () => {
    expect((await clients.student.agent.get('/api/v1/admin/ml-status')).status).toBe(403);
  });
  it('rejects demo placement output and sends only the six scores', async () => {
    await consent(true);
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          outcomeProbability: 0.99,
          modelVersion: 'demo',
          provenance: 'unverified_demo',
          metrics: {},
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const result = await rpc('aiService/predictPlacementRisk', [clients.student.account.id]);
    expect(result.status).toBe(200);
    expect(result.body.ml.status).toBe('unverified-model');
    expect(result.body.model.probability).not.toBe(99);
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(Object.keys(payload.evidence).sort()).toEqual([
      'academics',
      'aptitude',
      'communication',
      'interview',
      'projects',
      'verifiedSkills',
    ]);
    expect(JSON.stringify(payload)).not.toContain(clients.student.account.email);
  });
});
