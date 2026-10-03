import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { DirectoryOption, DirectoryResponse } from '../src/types/directory';

const universitiesUrl =
  'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json';
const companiesUrl = 'https://autocomplete.clearbit.com/v1/companies/suggest';
const university = z.object({
  name: z.string().min(1).max(300),
  country: z.string(),
  domains: z.array(z.string()),
  web_pages: z.array(z.string()),
  'state-province': z.string().nullable().optional(),
});
const company = z.object({ name: z.string().min(1).max(300), domain: z.string().max(254) });
let snapshot: { rows: z.infer<typeof university>[]; expires: number } | undefined;
let loading: Promise<z.infer<typeof university>[]> | undefined;
const companyCache = new Map<string, { rows: DirectoryOption[]; expires: number }>();
const validDomain = (value: string) => /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(value);
async function fetchJson(url: string, maxSize: number) {
  const response = await fetch(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Directory unavailable');
  const raw = await response.text();
  if (raw.length > maxSize) throw new Error('Directory response too large');
  return JSON.parse(raw);
}
async function universityRows() {
  if (snapshot && snapshot.expires > Date.now()) return snapshot.rows;
  if (!loading)
    loading = (async () => {
      const rows = z
        .array(university)
        .max(40000)
        .parse(await fetchJson(universitiesUrl, 8000000));
      snapshot = { rows, expires: Date.now() + 86400000 };
      return rows;
    })().finally(() => {
      loading = undefined;
    });
  return loading;
}
export async function searchDirectory(
  kind: 'universities' | 'companies',
  query: string,
  country = 'India',
): Promise<DirectoryResponse> {
  try {
    let results: DirectoryOption[];
    if (kind === 'universities') {
      const words = query.toLowerCase().split(/\s+/);
      results = (await universityRows())
        .filter(
          (r) =>
            (!country || r.country.toLowerCase() === country.toLowerCase()) &&
            words.every(
              (w) =>
                r.name.toLowerCase().includes(w) ||
                r.domains.some((d) => d.toLowerCase().includes(w)),
            ),
        )
        .sort(
          (a, b) =>
            Number(!a.name.toLowerCase().startsWith(query.toLowerCase())) -
              Number(!b.name.toLowerCase().startsWith(query.toLowerCase())) ||
            a.name.localeCompare(b.name),
        )
        .slice(0, 12)
        .map((r) => ({
          id: `${r.name}:${r.domains[0]}`,
          name: r.name.slice(0, 150),
          domain: r.domains.find(validDomain),
          country: r.country,
          region: r['state-province'] || undefined,
          website: r.web_pages[0],
          source: 'Hipo',
        }));
    } else {
      const key = query.toLowerCase(),
        cached = companyCache.get(key);
      if (cached && cached.expires > Date.now()) results = cached.rows;
      else {
        const url = new URL(companiesUrl);
        url.searchParams.set('query', query);
        results = z
          .array(company)
          .max(100)
          .parse(await fetchJson(url.toString(), 262144))
          .filter((r) => validDomain(r.domain))
          .slice(0, 12)
          .map((r) => ({
            id: r.domain,
            name: r.name.slice(0, 150),
            domain: r.domain,
            website: `https://${r.domain}`,
            source: 'Clearbit',
          }));
        if (companyCache.size >= 500) companyCache.delete(companyCache.keys().next().value!);
        companyCache.set(key, { rows: results, expires: Date.now() + 1800000 });
      }
    }
    return {
      results,
      unavailable: false,
      message: results.length
        ? 'Choose a suggestion or enter the name manually.'
        : 'No matches found. You can enter the name manually.',
    };
  } catch {
    return {
      results: [],
      unavailable: true,
      message: 'The directory is unavailable. You can enter the name manually.',
    };
  }
}
export function mountDirectory(app: Express) {
  app.get(
    '/api/v1/directory/:kind',
    rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }),
    async (req, res) => {
      const kind = z.enum(['universities', 'companies']).parse(req.params.kind);
      const input = z
        .object({
          q: z.string().trim().min(2).max(100),
          country: z.string().trim().max(80).optional(),
        })
        .parse(req.query);
      res.json(await searchDirectory(kind, input.q, input.country));
    },
  );
}
