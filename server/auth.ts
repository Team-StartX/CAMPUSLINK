import { randomBytes, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { Database } from './db';
import { HttpError, requireCondition } from './errors';
import type { Role, User } from '../src/types';
export interface Account extends User {
  aiConsent?: boolean;
  aiConsentProvider?: string;
  mlConsent?: boolean;
  passwordHash: string;
  campusId: string;
  organization: string;
  approved: boolean;
  verified: boolean;
  createdAt: string;
  googleSubject?: string;
  onboardingComplete?: boolean;
}
export interface SessionRecord {
  id: string;
  userId: string;
  csrf: string;
  expires: number;
}
export const digest = (text: string) => createHash('sha256').update(text).digest('hex');
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
const dummyHash = hashPassword('not-a-real-account-password');
export function verifyPassword(password: string, encoded: string) {
  const [salt, hex] = encoded.split(':');
  const stored = Buffer.from(hex, 'hex');
  const actual = scryptSync(password, salt, 64);
  return actual.length === stored.length && timingSafeEqual(actual, stored);
}
export const publicUser = (account: Account) => ({
  isAdmin: account.isAdmin === true,
  id: account.id,
  name: account.name,
  email: account.email,
  role: account.role,
  approved: account.approved,
  verified: account.verified,
  campusId: account.campusId,
  organization: account.organization,
  onboardingComplete: account.onboardingComplete !== false,
});
export class Authentication {
  constructor(private db: Database) {}
  async find(email: string) {
    return this.db.get<Account>('account', email.trim().toLowerCase());
  }
  async byId(id: string) {
    return (await this.db.list<Account>('account')).find((a) => a.id === id);
  }
  async save(account: Account) {
    await this.db.put('account', account.email, account, account.campusId, account.id);
  }
  async login(email: string, password: string, remember: boolean) {
    const account = await this.find(email);
    const valid = verifyPassword(password, account?.passwordHash || dummyHash);
    requireCondition(account && valid, 401, 'Email or password is incorrect.');
    return this.createSession(account, remember);
  }
  async createSession(account: Account, remember = false) {
    const token = randomBytes(32).toString('base64url');
    const session: SessionRecord = {
      id: digest(token),
      userId: account.id,
      csrf: randomBytes(24).toString('base64url'),
      expires: Date.now() + (remember ? 30 : 1) * 86400000,
    };
    await this.db.put('session', session.id, session, account.campusId, account.id);
    return { token, session, account };
  }
  async authenticate(token?: string) {
    if (!token) throw new HttpError(401, 'Sign in to continue.');
    const session = await this.db.get<SessionRecord>('session', digest(token));
    requireCondition(
      session && session.expires > Date.now(),
      401,
      'Your session has expired. Sign in again.',
    );
    const account = await this.byId(session.userId);
    requireCondition(account, 401, 'Account is unavailable.');
    return { account, session };
  }
  async issueToken(account: Account, purpose: 'reset') {
    const token = randomBytes(32).toString('base64url');
    await this.db.put(
      'token',
      digest(token),
      {
        userId: account.id,
        purpose,
        expires: Date.now() + 1800000,
      },
      account.campusId,
      account.id,
    );
    return token;
  }
  async consumeToken(token: string, purpose: 'reset', password?: string) {
    return this.db.transaction(async () => {
      const record = await this.db.get<{ userId: string; purpose: string; expires: number }>(
        'token',
        digest(token),
      );
      requireCondition(
        record && record.purpose === purpose && record.expires > Date.now(),
        400,
        'This link is invalid or expired.',
      );
      const account = await this.byId(record.userId);
      requireCondition(account, 400, 'Account is unavailable.');
      requireCondition(password && password.length >= 10, 400, 'Use at least 10 characters.');
      account.passwordHash = hashPassword(password);
      for (const session of await this.db.list<SessionRecord>('session', undefined, account.id))
        await this.db.remove('session', session.id);
      await this.save(account);
      await this.db.remove('token', digest(token));
      return publicUser(account);
    });
  }
  async create(
    input: {
      name: string;
      email: string;
      password: string;
      role: Role;
      campusId: string;
      organization: string;
    },
    approved = false,
  ) {
    requireCondition(
      !(await this.find(input.email)),
      409,
      'An account with this email already exists.',
    );
    const account: Account = {
      id: randomUUID(),
      name: input.name,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      passwordHash: hashPassword(input.password),
      campusId: input.campusId,
      organization: input.organization,
      approved: approved || input.role === 'student',
      verified: false,
      createdAt: new Date().toISOString(),
    };
    await this.save(account);
    return account;
  }
}
