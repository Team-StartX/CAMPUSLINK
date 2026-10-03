import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('./config', () => ({
  config: { mlApiUrl: 'https://campuslink-ml-demo.onrender.com', mlApiToken: 'test-only-token' },
}));
import { config } from './config';
import { checkMlConnection, jobResponse, placementResponse, requestMl } from './ml-client';

const fixture = {
  relevanceScore: 80,
  matchedSkills: ['React'],
  skillGaps: [],
  method: 'tfidf-keyword-v1',
  trained: false,
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  config.mlApiToken = 'test-only-token';
  config.mlApiUrl = 'https://campuslink-ml-demo.onrender.com';
});
describe('ML connection boundary', () => {
  it('allows admin cold starts while keeping student requests at seven seconds', async () => {
    const timer = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => new Response(JSON.stringify(fixture))),
    );
    await requestMl('jobs', {}, jobResponse, true);
    expect(timer).toHaveBeenLastCalledWith(7000);
    await checkMlConnection();
    expect(timer).toHaveBeenLastCalledWith(65000);
  });
  it('distinguishes timeouts from non-JSON responses and network errors', async () => {
    const timeout = new Error('private upstream details');
    timeout.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    expect((await requestMl('jobs', {}, jobResponse, true)).message).toContain(
      'before the timeout',
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Starting</html>')));
    expect((await requestMl('jobs', {}, jobResponse, true)).status).toBe('invalid-response');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network details')));
    const result = await requestMl('jobs', {}, jobResponse, true);
    expect(result.message).toContain('could not reach');
    expect(result.message).not.toContain('private network');
  });
  it('does not send requests without configuration or consent', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await requestMl('jobs', {}, jobResponse, false)).status).toBe('consent-required');
    config.mlApiToken = '';
    expect((await requestMl('jobs', {}, jobResponse, true)).status).toBe('not-configured');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('checks a fixed authenticated endpoint with generic data only', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture)));
    vi.stubGlobal('fetch', fetch);
    const result = await checkMlConnection();
    expect(result.connected).toBe(true);
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toBe('https://campuslink-ml-demo.onrender.com/v1/models/jobs/match');
    expect(options.redirect).toBe('error');
    expect(options.headers.Authorization).toBe('Bearer test-only-token');
    expect(JSON.parse(options.body).studentProfile.skills).toEqual(['React']);
    expect(JSON.stringify(result)).not.toContain('test-only-token');
  });
  it.each([401, 403, 500])('returns a safe fallback for HTTP %s', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private upstream details', { status })),
    );
    const result = await requestMl('jobs', {}, jobResponse, true);
    expect(result.data).toBeNull();
    expect(result.status).toBe(status === 500 ? 'unavailable' : 'unauthorized');
    expect(result.message).not.toContain('private upstream');
  });
  it('rejects incompatible scores and handles network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...fixture, relevanceScore: 101 }))),
    );
    expect((await requestMl('jobs', {}, jobResponse, true)).status).toBe('invalid-response');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('secret details')));
    expect((await requestMl('jobs', {}, jobResponse, true)).status).toBe('unavailable');
  });
  it('rejects a demo placement prediction', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            outcomeProbability: 0.9,
            modelVersion: 'demo',
            provenance: 'unverified_demo',
            metrics: {},
          }),
        ),
      ),
    );
    const result = await requestMl('placement', {}, placementResponse, true);
    expect(result.status).toBe('unverified-model');
    expect(result.data).toBeNull();
  });
  it('rejects insecure remote origins before sending a token', async () => {
    config.mlApiUrl = 'http://example.com';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await requestMl('jobs', {}, jobResponse, true)).status).toBe('not-configured');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reports all model contracts separately without accepting demo probabilities', async () => {
    const fetch = vi.fn().mockImplementation(async (url: URL) => {
      const path = url.pathname;
      const value = path.includes('/jobs/')
        ? fixture
        : path.includes('/resume/')
          ? { skills: [{ name: 'React' }], method: 'rules', reviewRequired: true }
          : path.includes('/interviews/')
            ? {
                criterionScores: [{ name: 'Evidence', score: 80 }],
                generatedPreparationAdvice: 'Describe the outcome.',
                method: 'rubric-keyword-heuristic-v1',
                trained: false,
              }
            : {
                outcomeProbability: 0.8,
                modelVersion: 'demo',
                provenance: 'unverified_demo',
                metrics: {},
              };
      return new Response(JSON.stringify(value));
    });
    vi.stubGlobal('fetch', fetch);
    const result = await checkMlConnection(true);
    expect(result.checks).toHaveLength(4);
    expect(result.checks.map((c) => c.ready)).toEqual([true, true, true, false]);
    expect(result.checks[3].status).toBe('unverified-model');
    expect(JSON.stringify(result)).not.toContain('outcomeProbability');
  });
  it('blocks a configured destination that differs from student consent', async () => {
    config.mlApiUrl = 'https://other-service.example';
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect((await requestMl('jobs', {}, jobResponse, true)).status).toBe('not-configured');
    expect(fetch).not.toHaveBeenCalled();
  });
});
