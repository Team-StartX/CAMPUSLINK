import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it('filters universities by country, supports worldwide search and caches the dataset', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          name: 'National Technology University',
          country: 'India',
          domains: ['ntu.edu.in'],
          web_pages: ['https://ntu.edu.in'],
          'state-province': 'Odisha',
        },
        {
          name: 'National Technology College',
          country: 'Canada',
          domains: ['ntc.ca'],
          web_pages: [],
        },
      ]),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  const { searchDirectory } = await import('./directory');
  const local = await searchDirectory('universities', 'National Technology');
  expect(local.results).toHaveLength(1);
  expect(local.results[0]).toMatchObject({
    country: 'India',
    region: 'Odisha',
    domain: 'ntu.edu.in',
  });
  expect((await searchDirectory('universities', 'National', '')).results).toHaveLength(2);
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('encodes company queries, filters unsafe domains and caches suggestions', async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify([
        { name: 'Example & Co', domain: 'example.com' },
        { name: 'Invalid', domain: 'javascript:alert(1)' },
      ]),
    ),
  );
  vi.stubGlobal('fetch', fetcher);
  const { searchDirectory } = await import('./directory');
  expect((await searchDirectory('companies', 'Example & Co')).results).toEqual([
    {
      id: 'example.com',
      name: 'Example & Co',
      domain: 'example.com',
      website: 'https://example.com',
      source: 'Clearbit',
    },
  ]);
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('query')).toBe('Example & Co');
  await searchDirectory('companies', 'Example & Co');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('preserves manual entry when the provider fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')));
  const { searchDirectory } = await import('./directory');
  expect(await searchDirectory('companies', 'Example')).toMatchObject({
    results: [],
    unavailable: true,
    message: expect.stringContaining('manually'),
  });
});

it('makes registration search public but rejects invalid queries before fetching', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response('[]'));
  vi.stubGlobal('fetch', fetcher);
  const { mountDirectory } = await import('./directory');
  const app = express();
  mountDirectory(app);
  app.use(
    (
      _error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      res.status(400).json({ message: 'Invalid search' });
    },
  );
  await request(app).get('/api/v1/directory/companies?q=A').expect(400);
  await request(app).get('/api/v1/directory/other?q=Example').expect(400);
  expect(fetcher).not.toHaveBeenCalled();
  await request(app).get('/api/v1/directory/companies?q=Example').expect(200);
});
