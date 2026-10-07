import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { Database } from './db';
import { config } from './config';
import { transcribeAudio } from './speech';

describe('authenticated voice transcription', () => {
  const db = new Database('', ':memory:');
  const original = { speech: config.speech, aiKey: config.aiKey };
  let runtime: Awaited<ReturnType<typeof createApp>>;
  let agent: ReturnType<typeof request.agent>;
  let csrf: string;
  const audio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 1, 2, 3]);
  beforeAll(async () => {
    runtime = await createApp(db);
    await runtime.auth.create(
      {
        name: 'Voice student',
        email: 'voice@test.invalid',
        password: 'SpeechTestOnly!123',
        role: 'student',
        campusId: 'voice-campus',
        organization: 'Voice campus',
      },
      true,
    );
    agent = request.agent(runtime.app);
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: 'voice@test.invalid', password: 'SpeechTestOnly!123' });
    csrf = login.body.csrf;
  });
  afterEach(() => {
    Object.assign(config, original);
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    await db.close();
  });
  function enable() {
    config.speech = 'openai';
    config.aiKey = 'test-transcription-key';
  }
  const upload = () => agent.post('/api/v1/voice/transcriptions').set('X-CSRF-Token', csrf);
  it('requires authentication and a valid CSRF token', async () => {
    expect((await request(runtime.app).get('/api/v1/voice/capabilities')).status).toBe(401);
    expect((await agent.post('/api/v1/voice/transcriptions')).status).toBe(403);
  });
  it('reports unavailable voice when no provider is configured', async () => {
    config.speech = 'disabled';
    expect((await agent.get('/api/v1/voice/capabilities')).body.available).toBe(false);
    expect((await upload()).status).toBe(503);
  });
  it('rejects missing consent and unsupported files without calling the provider', async () => {
    enable();
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    expect((await upload().attach('file', audio, 'practice.webm')).status).toBe(400);
    expect(
      (
        await upload()
          .field('consent', 'true')
          .attach('file', Buffer.from('not audio'), 'practice.webm')
      ).status,
    ).toBe(415);
    expect(provider).not.toHaveBeenCalled();
  });
  it('transcribes submitted audio using the server key and does not save recordings', async () => {
    enable();
    const provider = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ text: 'I built and tested a campus project.' })),
      );
    vi.stubGlobal('fetch', provider);
    const response = await upload().field('consent', 'true').attach('file', audio, 'practice.webm');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ text: 'I built and tested a campus project.' });
    const [url, options] = provider.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    expect(options.headers.Authorization).toBe('Bearer test-transcription-key');
    expect(options.body.get('model')).toBe(config.speechModel);
    expect(await db.list('document')).toEqual([]);
  });
  it('does not expose upstream errors or credentials to students', async () => {
    enable();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private provider detail', { status: 401 })),
    );
    await expect(transcribeAudio(audio)).rejects.toMatchObject({
      status: 503,
      message:
        'Voice transcription is temporarily unavailable. Please try again or type your response.',
    });
  });
});
