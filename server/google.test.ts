import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { Database } from './db';
import { config } from './config';
import { digest, type Account } from './auth';

describe('Google sign-in and dashboard onboarding', () => {
  let db: Database, runtime: Awaited<ReturnType<typeof createApp>>;
  const original = { supabaseUrl: config.supabaseUrl, supabaseKey: config.supabaseKey };
  let enabled: boolean, verified: boolean, providers: string[];
  const fetchMock = vi.fn();
  beforeEach(async () => {
    config.supabaseUrl = 'https://oauth-test.supabase.co';
    config.supabaseKey = 'sb_secret_test_only';
    enabled = true;
    verified = true;
    providers = ['google'];
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) => {
      expect(options?.headers).toBeDefined();
      if (url.endsWith('/settings')) return Response.json({ external: { google: enabled } });
      if (url.includes('/token?grant_type=pkce')) {
        const body = JSON.parse(String(options?.body));
        expect(body.auth_code).toBe('valid-test-code-123');
        expect(body.code_verifier.length).toBeGreaterThanOrEqual(43);
        return Response.json({ access_token: 'test-access-token-only' });
      }
      if (url.endsWith('/user'))
        return Response.json({
          id: 'supabase-user-id',
          email: 'google@test.invalid',
          email_confirmed_at: verified ? '2026-01-01' : null,
          user_metadata: { full_name: 'Google Test User', role: 'campus', approved: true },
          identities: providers.map((provider) => ({
            provider,
            id: 'provider-subject',
            identity_data: { email_verified: verified },
          })),
        });
      throw new Error('Unexpected external request in test.');
    });
    vi.stubGlobal('fetch', fetchMock);
    db = new Database('', ':memory:');
    runtime = await createApp(db);
    await db.put(
      'campus',
      'campus-test',
      { id: 'campus-test', name: 'Test Institute', courses: ['B.Tech'], branches: ['CSE'] },
      'campus-test',
    );
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    Object.assign(config, original);
    await db.close();
  });
  async function begin(role = 'student') {
    const agent = request.agent(runtime.app);
    const start = await agent.get(`/api/v1/auth/google?role=${role}`);
    expect(start.status).toBe(302);
    const destination = new URL(start.headers.location);
    expect(destination.hostname).toBe('oauth-test.supabase.co');
    expect(destination.searchParams.get('code_challenge_method')).toBe('s256');
    const callback = new URL(destination.searchParams.get('redirect_to')!);
    const state = callback.searchParams.get('state')!;
    return {
      agent,
      state,
      callback: callback.pathname + callback.search + '&code=valid-test-code-123',
    };
  }
  it('reports disabled providers and does not redirect to a broken Google flow', async () => {
    enabled = false;
    expect((await request(runtime.app).get('/api/v1/auth/google/status')).body.enabled).toBe(false);
    expect((await request(runtime.app).get('/api/v1/auth/google')).headers.location).toContain(
      'google_error=setup',
    );
    expect(await db.list('oauth')).toHaveLength(0);
  });
  it('rejects callbacks without the matching browser cookie before token exchange', async () => {
    const flow = await begin();
    const response = await request(runtime.app).get(flow.callback);
    expect(response.headers.location).toContain('google_error=verification');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await db.list('account')).toHaveLength(0);
  });
  it('creates a verified account and blocks placement features until validated dashboard setup', async () => {
    const flow = await begin();
    const callback = await flow.agent.get(flow.callback);
    expect(callback.headers.location).toBe(`${config.origin}/student/dashboard`);
    expect(String(callback.headers['set-cookie'])).toContain('HttpOnly');
    const me = await flow.agent.get('/api/v1/auth/me');
    expect(me.body.user).toMatchObject({
      role: 'student',
      verified: true,
      onboardingComplete: false,
    });
    expect(me.body.user).not.toHaveProperty('passwordHash');
    expect(
      (
        await flow.agent
          .post('/api/v1/services/studentService/getDashboard')
          .set('X-CSRF-Token', me.body.csrf)
          .send({ args: [] })
      ).status,
    ).toBe(409);
    const details = {
      name: 'Updated Name',
      institution: 'Test Institute',
      campusId: 'campus-test',
      course: 'B.Tech',
      branch: 'CSE',
      year: '2027',
      cgpa: 8.2,
    };
    expect((await flow.agent.put('/api/v1/account/onboarding').send(details)).status).toBe(403);
    expect(
      (
        await flow.agent
          .put('/api/v1/account/onboarding')
          .set('X-CSRF-Token', me.body.csrf)
          .send({ ...details, role: 'campus' })
      ).status,
    ).toBe(400);
    expect(
      (
        await flow.agent
          .put('/api/v1/account/onboarding')
          .set('X-CSRF-Token', me.body.csrf)
          .send({ ...details, campusId: 'missing' })
      ).status,
    ).toBe(400);
    const completed = await flow.agent
      .put('/api/v1/account/onboarding')
      .set('X-CSRF-Token', me.body.csrf)
      .send(details);
    expect(completed.status).toBe(200);
    expect(completed.body.user).toMatchObject({
      onboardingComplete: true,
      campusId: 'campus-test',
      name: 'Updated Name',
    });
    const workspace = await db.get<{ student: { cgpa: number; xp: number; skills: unknown[] } }>(
      'workspace',
      me.body.user.id,
    );
    expect(workspace!.student).toMatchObject({ cgpa: 8.2, xp: 0, skills: [] });
    expect(
      (
        await flow.agent
          .put('/api/v1/account/onboarding')
          .set('X-CSRF-Token', me.body.csrf)
          .send(details)
      ).status,
    ).toBe(409);
    expect((await flow.agent.get(flow.callback)).headers.location).toContain(
      'google_error=verification',
    );
    expect(await db.list('account')).toHaveLength(1);
  });
  it('preserves an existing account role and approval when linking a verified Google email', async () => {
    await runtime.auth.create({
      name: 'Existing Campus',
      email: 'google@test.invalid',
      password: 'LocalTestPassword123',
      role: 'campus',
      campusId: 'campus-test',
      organization: 'Test Institute',
    });
    const flow = await begin('student');
    expect((await flow.agent.get(flow.callback)).headers.location).toBe(
      `${config.origin}/campus/dashboard`,
    );
    const me = await flow.agent.get('/api/v1/auth/me');
    expect(me.body.user).toMatchObject({
      role: 'campus',
      approved: false,
      onboardingComplete: true,
    });
    expect(await db.list('account')).toHaveLength(1);
  });
  it('rejects unverified Google email identities', async () => {
    verified = false;
    const flow = await begin();
    expect((await flow.agent.get(flow.callback)).headers.location).toContain(
      'google_error=verification',
    );
    expect(await db.list('account')).toHaveLength(0);
  });
  it('rejects identities from other providers', async () => {
    providers = ['github'];
    const flow = await begin();
    expect((await flow.agent.get(flow.callback)).headers.location).toContain(
      'google_error=verification',
    );
    expect(await db.list('account')).toHaveLength(0);
  });
  it('rejects expired sign-in attempts', async () => {
    const flow = await begin();
    const saved = await db.get<Record<string, unknown>>('oauth', digest(flow.state));
    await db.put('oauth', digest(flow.state), { ...saved, expires: 0 });
    expect((await flow.agent.get(flow.callback)).headers.location).toContain(
      'google_error=verification',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('keeps a new campus account pending approval after onboarding', async () => {
    const flow = await begin('campus');
    await flow.agent.get(flow.callback);
    const me = await flow.agent.get('/api/v1/auth/me');
    const result = await flow.agent
      .put('/api/v1/account/onboarding')
      .set('X-CSRF-Token', me.body.csrf)
      .send({ name: 'Campus Team', institution: 'New Institute' });
    expect(result.status).toBe(200);
    expect(result.body.user).toMatchObject({
      role: 'campus',
      approved: false,
      onboardingComplete: true,
    });
    expect((await db.list<Account>('account'))[0].campusId).not.toBe('');
  });
});
