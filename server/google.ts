import type { Express, Response } from 'express';
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { Database } from './db';
import { Authentication, digest } from './auth';
import { config } from './config';
import { requireCondition } from './errors';

interface GoogleFlow {
  verifier: string;
  role: 'student' | 'recruiter' | 'campus';
  expires: number;
}
const cookieName = 'campuslink_oauth';
const cookieOptions = () => ({
  httpOnly: true,
  secure: config.production,
  sameSite: 'lax' as const,
  path: '/api/v1/auth/google',
});
function headers(): Record<string, string> {
  return {
    apikey: config.supabaseKey,
    ...(config.supabaseKey.startsWith('eyJ')
      ? { Authorization: `Bearer ${config.supabaseKey}` }
      : {}),
  };
}
async function providerEnabled() {
  if (!config.supabaseUrl || !config.supabaseKey) return false;
  const response = await fetch(`${config.supabaseUrl}/auth/v1/settings`, {
    headers: headers(),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return false;
  const settings = (await response.json()) as { external?: { google?: boolean } };
  return settings.external?.google === true;
}
export function mountGoogleAuth(
  app: Express,
  db: Database,
  auth: Authentication,
  setSessionCookie: (res: Response, token: string, expires: number) => void,
) {
  const base = '/api/v1/auth/google';
  app.get(`${base}/status`, async (_req, res) => {
    const enabled = await providerEnabled().catch(() => false);
    res.json({
      enabled,
      message: enabled ? 'Continue with Google' : 'Google sign-in is awaiting provider setup.',
    });
  });
  app.get(base, async (req, res) => {
    try {
      const role = z.enum(['student', 'recruiter', 'campus']).parse(req.query.role || 'student');
      requireCondition(await providerEnabled(), 503, 'Google provider is not enabled.');
      const state = randomBytes(32).toString('base64url'),
        verifier = randomBytes(48).toString('base64url');
      await db.put('oauth', digest(state), {
        verifier,
        role,
        expires: Date.now() + 600000,
      } satisfies GoogleFlow);
      res.cookie(cookieName, state, { ...cookieOptions(), maxAge: 600000 });
      const callback = new URL(`${config.origin}/api/v1/auth/google/callback`);
      callback.searchParams.set('state', state);
      const destination = new URL(`${config.supabaseUrl}/auth/v1/authorize`);
      destination.searchParams.set('provider', 'google');
      destination.searchParams.set('redirect_to', callback.toString());
      destination.searchParams.set(
        'code_challenge',
        createHash('sha256').update(verifier).digest('base64url'),
      );
      destination.searchParams.set('code_challenge_method', 's256');
      destination.searchParams.set('scopes', 'email profile');
      res.setHeader('Cache-Control', 'no-store');
      res.redirect(destination.toString());
    } catch {
      res.redirect(`${config.origin}/login?google_error=setup`);
    }
  });
  app.get(`${base}/callback`, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const { code, state } = z
        .object({ code: z.string().min(10).max(2000), state: z.string().min(32).max(100) })
        .parse(req.query);
      requireCondition(req.cookies[cookieName] === state, 400, 'Invalid Google sign-in state.');
      const flow = await db.transaction(async () => {
        const record = await db.get<GoogleFlow>('oauth', digest(state));
        requireCondition(record && record.expires > Date.now(), 400, 'Google sign-in expired.');
        await db.remove('oauth', digest(state));
        return record;
      });
      const exchange = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
        headers: { ...headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ auth_code: code, code_verifier: flow.verifier }),
        signal: AbortSignal.timeout(15000),
      });
      requireCondition(exchange.ok, 401, 'Google sign-in could not be verified.');
      const tokens = z.object({ access_token: z.string().min(10) }).parse(await exchange.json());
      const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
        headers: { apikey: config.supabaseKey, Authorization: `Bearer ${tokens.access_token}` },
        signal: AbortSignal.timeout(15000),
      });
      requireCondition(response.ok, 401, 'Google identity could not be verified.');
      const identity = z
        .object({
          id: z.string().min(1),
          email: z.string().email(),
          email_confirmed_at: z.string().nullable().optional(),
          user_metadata: z
            .object({ full_name: z.string().optional(), name: z.string().optional() })
            .passthrough()
            .optional(),
          identities: z.array(
            z.object({
              provider: z.string(),
              id: z.string(),
              identity_data: z
                .object({ email_verified: z.boolean().optional() })
                .passthrough()
                .optional(),
            }),
          ),
        })
        .parse(await response.json());
      const google = identity.identities.find((i) => i.provider === 'google');
      requireCondition(
        google && identity.email_confirmed_at && google.identity_data?.email_verified === true,
        401,
        'A verified Google email is required.',
      );
      const account = await db.transaction(async () => {
        let existing = await auth.find(identity.email);
        requireCondition(
          !existing?.googleSubject || existing.googleSubject === identity.id,
          409,
          'This email is linked to another identity.',
        );
        if (!existing) {
          existing = await auth.create({
            name: (
              identity.user_metadata?.full_name ||
              identity.user_metadata?.name ||
              identity.email.split('@')[0]
            ).slice(0, 120),
            email: identity.email,
            password: randomBytes(48).toString('base64url'),
            role: flow.role,
            campusId: '',
            organization: '',
          });
          existing.onboardingComplete = false;
        }
        existing.googleSubject = identity.id;
        existing.verified = true;
        await auth.save(existing);
        return existing;
      });
      const session = await auth.createSession(account);
      setSessionCookie(res, session.token, session.session.expires);
      res.clearCookie(cookieName, cookieOptions());
      res.redirect(
        account.isAdmin
          ? `${config.origin}/admin/dashboard`
          : `${config.origin}/${account.role}/dashboard`,
      );
    } catch {
      res.clearCookie(cookieName, cookieOptions());
      res.redirect(`${config.origin}/login?google_error=verification`);
    }
  });
}
