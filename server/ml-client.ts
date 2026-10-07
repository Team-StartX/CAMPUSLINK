import { z } from 'zod';
import { config } from './config';

const score = z.number().finite().min(0).max(100);
const latency = z.number().finite().nonnegative().optional();
const item = z.union([z.string().max(5000), z.record(z.unknown())]);
export const placementResponse = z.object({
  outcomeProbability: z.number().finite().min(0).max(1),
  modelVersion: z.string().min(1),
  provenance: z.string().min(1),
  metrics: z.record(z.unknown()),
  limitations: z.array(z.string()).default([]),
  latencyMs: latency,
});
export const resumeResponse = z.object({
  skills: z.array(item).max(200),
  education: z.array(item).default([]),
  experience: z.array(item).default([]),
  projects: z.array(item).default([]),
  method: z.string().min(1),
  reviewRequired: z.boolean(),
  latencyMs: latency,
});
export const jobResponse = z.object({
  relevanceScore: score,
  matchedSkills: z.array(z.string()).max(200),
  skillGaps: z.array(z.string()).max(200),
  method: z.literal('tfidf-keyword-v1'),
  trained: z.literal(false),
  latencyMs: latency,
});
const criterion = z.object({ name: z.string().min(1), score });
export const interviewResponse = z
  .object({
    criteria: z.array(criterion).optional(),
    criterionScores: z.array(criterion).optional(),
    generatedPreparationAdvice: z.union([z.string(), z.array(z.string())]),
    method: z.literal('rubric-keyword-heuristic-v1'),
    trained: z.literal(false),
    latencyMs: latency,
  })
  .refine((r) => (r.criteria || r.criterionScores || []).length > 0, 'Missing rubric scores.');
export type MlStatus =
  | 'remote'
  | 'not-configured'
  | 'consent-required'
  | 'unauthorized'
  | 'unavailable'
  | 'invalid-response'
  | 'unverified-model';
export interface MlResult<T> {
  data: T | null;
  status: MlStatus;
  message: string;
}
export function mlDestination() {
  try {
    const url = new URL(config.mlApiUrl);
    if (url.hostname === 'campuslink-ml-demo.onrender.com') return '';
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        !config.production &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      )
    )
      return '';
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return '';
    return url.origin;
  } catch {
    return '';
  }
}
export const mlConfigured = () => Boolean(mlDestination() && config.mlApiToken);
export function redactMlText(text: string) {
  return text
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email removed]')
    .replace(/\+?\d[\d\s()-]{9,}\d/g, '[phone removed]');
}
const paths = {
  placement: '/v1/models/placement/predict',
  resume: '/v1/models/resume/extract',
  jobs: '/v1/models/jobs/match',
  interview: '/v1/models/interviews/score',
} as const;
export async function requestMl<T>(
  operation: keyof typeof paths,
  payload: unknown,
  schema: z.ZodType<T>,
  consent: boolean,
  timeoutMs = 7000,
): Promise<MlResult<T>> {
  const fail = (status: MlStatus, message: string): MlResult<T> => ({
    data: null,
    status,
    message,
  });
  if (!mlConfigured())
    return fail('not-configured', 'ML service is not configured. Local analysis is being used.');
  if (!consent)
    return fail('consent-required', 'External ML consent is off. Local analysis is being used.');
  try {
    const base = new URL(config.mlApiUrl);
    if (
      (base.protocol !== 'https:' &&
        !(base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname))) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return fail('not-configured', 'Use an HTTPS ML service origin.');
    const response = await fetch(new URL(paths[operation], base), {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.mlApiToken}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status === 401 || response.status === 403)
      return fail(
        'unauthorized',
        'ML service rejected the backend API token. Local analysis is being used.',
      );
    if (!response.ok)
      return fail(
        'unavailable',
        'ML service is unavailable for this request. Local analysis is being used.',
      );
    const raw = await response.text();
    if (raw.length > 262144)
      return fail(
        'invalid-response',
        'ML service response was too large. Local analysis is being used.',
      );
    const parsed = schema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      return fail(
        'invalid-response',
        'ML service returned an incompatible response. Local analysis is being used.',
      );
    if (
      operation === 'placement' &&
      (parsed.data as z.infer<typeof placementResponse>).provenance !== 'historical'
    )
      return fail(
        'unverified-model',
        'The deployed placement artifact is an unverified demo. Local preparation guidance is being used.',
      );
    return { data: parsed.data, status: 'remote', message: 'Connected ML service response.' };
  } catch (error) {
    if (error instanceof SyntaxError)
      return fail(
        'invalid-response',
        'ML service returned non-JSON data. It may still be starting; retry the connection check. Local analysis is being used.',
      );
    if (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
      return fail(
        'unavailable',
        'ML service did not respond before the timeout. It may be starting after inactivity; retry the connection check. Local analysis is being used.',
      );
    return fail(
      'unavailable',
      'The backend could not reach the ML service. Check the ML service status and backend network settings. Local analysis is being used.',
    );
  }
}
export function mlIntegration(result: MlResult<unknown>) {
  return { status: result.status, message: result.message };
}
export function extractedNames(items: z.infer<typeof item>[]) {
  return items.flatMap((value) => {
    if (typeof value === 'string') return [value];
    const name = value.name ?? value.skill ?? value.text ?? value.value;
    return typeof name === 'string' ? [name] : [];
  });
}
export async function checkMlConnection(allModels = false) {
  // Generic fixtures only: no student or account records enter diagnostics.
  async function check<T>(
    name: string,
    operation: keyof typeof paths,
    payload: unknown,
    schema: z.ZodType<T>,
  ) {
    // Admin diagnostics allow a sleeping service time to start. Student requests stay fast.
    const result = await requestMl(operation, payload, schema, true, 65000);
    return { name, ...mlIntegration(result), ready: result.status === 'remote' };
  }
  const pending = [
    check(
      'Job keyword matching',
      'jobs',
      {
        studentProfile: {
          skills: ['React'],
          education: [],
          experience: [],
          projects: ['React dashboard'],
        },
        job: {
          title: 'Frontend developer',
          description: 'Build web interfaces',
          requiredSkills: ['React'],
        },
      },
      jobResponse,
    ),
  ];
  if (allModels)
    pending.push(
      check(
        'Resume extraction',
        'resume',
        {
          resumeText:
            'Sample candidate built a React dashboard project and tested JavaScript components.',
          language: 'en',
        },
        resumeResponse,
      ),
      check(
        'Interview preparation',
        'interview',
        {
          responses: [
            {
              question: 'Describe a project challenge',
              answer: 'I built and tested the change and measured the result.',
            },
          ],
          rubric: [{ name: 'Evidence', expectedTerms: ['tested', 'measured'] }],
        },
        interviewResponse,
      ),
      check(
        'Historical placement model',
        'placement',
        {
          evidence: {
            verifiedSkills: 70,
            academics: 82,
            projects: 65,
            aptitude: 74,
            communication: 68,
            interview: 72,
          },
        },
        placementResponse,
      ),
    );
  const checks = await Promise.all(pending);
  return {
    configured: mlConfigured(),
    connected: checks[0].ready,
    status: checks[0].status,
    message: checks[0].message,
    checkedEndpoint: paths.jobs,
    checks,
    note: 'Checks use sample data only. Student analysis requires separate consent. Demo placement estimates are never displayed.',
  };
}
