import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { Database } from './db';
import { config } from './config';

describe('email authentication flow', () => {
  const db = new Database('', ':memory:');
  const previousConfig = {
    email: config.email,
    origin: config.origin,
    production: config.production,
  };
  const password = 'AuthenticationTest123!';
  let runtime: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => {
    config.email = 'outbox';
    config.origin = 'http://localhost:3000';
    config.production = false;
    runtime = await createApp(db);
  });
  afterAll(async () => {
    Object.assign(config, previousConfig);
    await db.close();
  });
  it('registers a campus and student, restores the cookie, and logs in with normalized email', async () => {
    const campus = await request(runtime.app).post('/api/v1/auth/register').send({
      name: 'Test Campus Team',
      email: ' Campus@Example.edu ',
      password,
      role: 'campus',
      institution: 'Authentication Test College',
    });
    expect(campus.status).toBe(201);
    expect(campus.body.user).toMatchObject({ email: 'campus@example.edu', approved: false });
    const student = request.agent(runtime.app);
    const signup = await student.post('/api/v1/auth/register').send({
      name: 'Test Student',
      email: ' Student@Example.edu ',
      password,
      role: 'student',
      institution: 'Authentication Test College',
    });
    expect(signup.status).toBe(201);
    expect(signup.headers['set-cookie'][0]).toContain('HttpOnly');
    expect((await student.get('/api/v1/auth/me')).body.user.email).toBe('student@example.edu');
    expect(
      (await student.post('/api/v1/auth/logout').set('X-CSRF-Token', signup.body.csrf)).status,
    ).toBe(200);
    expect((await student.get('/api/v1/auth/me')).status).toBe(401);
    const login = await student
      .post('/api/v1/auth/login')
      .set('Origin', 'http://127.0.0.1:3000')
      .send({
        email: ' STUDENT@EXAMPLE.EDU ',
        password,
      });
    expect(login.status).toBe(200);
    expect((await student.get('/api/v1/auth/me')).body.user.id).toBe(signup.body.user.id);
    expect(
      (
        await student
          .post('/api/v1/services/studentService/getDashboard')
          .set('X-CSRF-Token', login.body.csrf)
          .send({ args: [] })
      ).status,
    ).toBe(200);
  });
  it('returns clear duplicate, password and unknown-campus errors', async () => {
    expect(
      (
        await request(runtime.app).post('/api/v1/auth/register').send({
          name: 'Test Student',
          email: ' STUDENT@EXAMPLE.EDU ',
          password,
          role: 'student',
          institution: 'Authentication Test College',
        })
      ).status,
    ).toBe(409);
    const wrong = await request(runtime.app).post('/api/v1/auth/login').send({
      email: 'student@example.edu',
      password: 'wrong',
    });
    expect(wrong.status).toBe(401);
    expect(wrong.body.message).toBe('Email or password is incorrect.');
    const missing = await request(runtime.app).post('/api/v1/auth/register').send({
      name: 'Test Student',
      email: 'missing@example.edu',
      password,
      role: 'student',
      institution: 'Not registered',
    });
    expect(missing.status).toBe(400);
    expect(missing.body.message).toContain('campus team must register');
    expect(
      (
        await request(runtime.app).post('/api/v1/auth/register').send({
          name: 'Test Student',
          email: 'short@example.edu',
          password: 'short',
          role: 'student',
          institution: 'Authentication Test College',
        })
      ).status,
    ).toBe(400);
  });
  it('keeps unrelated browser origins blocked before authentication', async () => {
    for (const origin of ['https://untrusted.example', 'http://localhost:3001']) {
      const response = await request(runtime.app)
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .send({ email: 'student@example.edu', password });
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Untrusted request origin.');
    }
  });
});
