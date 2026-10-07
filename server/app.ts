import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import { Database } from './db';
import { Authentication, Account, publicUser, digest } from './auth';
import { config } from './config';
import { requireCondition, HttpError } from './errors';
import {
  runWorkspace,
  emptyWorkspace,
  readWorkspace,
  notify,
  candidates,
  StoredDrive,
} from './workspace';
import { dispatch, analytics, rankedCandidates, policy } from './services';
import { uploadFile, downloadFile, detectFile } from './storage';
import { queueMail } from './mail';
import { mockAdapter } from '../src/mocks/adapter';
import { scheduleConflicts, scheduleSchema } from '../src/services/drive.domain';
import { loadModel } from './ml';
import type { Campus, WorkspaceData } from '../src/types';
import { checkEligibility as requireEligibility } from '../src/utils/placement';
import { mountGoogleAuth } from './google';
import { mountAdmin } from './admin';
import { mlConfigured, mlDestination } from './ml-client';
import { mountDirectory } from './directory';
import { DomainError } from '../src/utils/domain-error';
import { trustedOrigin } from './origin';
import { mountSpeech } from './speech';

const registration = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(10).max(128),
    role: z.enum(['student', 'recruiter', 'campus']),
    institution: z.string().trim().min(2).max(150),
    campusId: z.string().optional(),
    course: z.string().max(100).optional(),
    branch: z.string().max(80).optional(),
    year: z
      .string()
      .regex(/^20\d{2}$/)
      .optional(),
  })
  .strict();
export async function createApp(db = new Database()) {
  await db.migrate();
  const auth = new Authentication(db),
    app = express();
  app.disable('x-powered-by');
  if (config.production) app.set('trust proxy', 1);
  app.use(helmet());
  // Workspace records, auth links, and private files must never enter shared caches.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    cors({
      origin: (origin, callback) => callback(null, trustedOrigin(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '3mb' }));
  app.use(cookieParser());
  const general = rateLimit({
    windowMs: 60000,
    limit: 180,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const authLimit = rateLimit({
    windowMs: 900000,
    limit: 25,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  const aiLimit = rateLimit({
    windowMs: 60000,
    limit: 12,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  });
  app.use('/api', general);
  // Reject browser writes from unexpected origins even before authentication.
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !trustedOrigin(req.headers.origin))
      return next(new HttpError(403, 'Untrusted request origin.'));
    next();
  });
  const base = '/api/v1';
  mountDirectory(app);
  app.get(`${base}/health`, async (_req, res) => {
    await db.query('SELECT 1');
    res.json({
      status: 'ok',
      database: config.database ? 'postgresql' : 'sqlite-local',
      ai: config.ai,
    });
  });
  app.get(`${base}/capabilities`, (_req, res) =>
    res.json({
      aiProvider: config.ai,
      modelAvailable: loadModel()?.provenance === 'historical',
      emailDelivery: config.email,
      fileStorage: config.storage,
    }),
  );
  app.get(`${base}/campuses`, async (_req, res) => res.json(await db.list<Campus>('campus')));
  app.use(`${base}/auth/google`, authLimit);
  mountGoogleAuth(app, db, auth, setCookie);
  app.post(`${base}/auth/register`, authLimit, async (req, res) => {
    const input = registration.parse(req.body);
    const account = await db.transaction(async () => {
      const campuses = await db.list<Campus>('campus');
      let campus = campuses.find(
        (c) => c.id === input.campusId || c.name.toLowerCase() === input.institution.toLowerCase(),
      );
      if (input.role === 'campus' && !campus) {
        campus = {
          id: randomUUID(),
          name: input.institution,
          location: '',
          studentPool: 0,
          courses: ['B.Tech'],
          branches: ['CSE', 'IT', 'ECE'],
        };
        await db.put('campus', campus.id, campus, campus.id);
      }
      requireCondition(
        input.role === 'recruiter' || campus,
        400,
        'Choose an existing campus. A campus team must register its institution first.',
      );
      const user = await auth.create({
        ...input,
        campusId: campus?.id || '',
        organization: input.institution,
      });
      if (input.role === 'student') {
        const workspace = emptyWorkspace(user, campus!.name);
        workspace.student.course = `${input.course || 'B.Tech'} · ${input.branch || 'Computer Science'}`;
        workspace.student.branch = input.branch || 'Computer Science';
        workspace.student.year = input.year || '2027';
        await db.put('workspace', user.id, workspace, user.campusId, user.id);
      }
      const token = await auth.issueToken(user, 'verify');
      await queueMail(
        db,
        user.email,
        'Verify your CampusLink email',
        `${config.origin}/verify-email?token=${token}`,
      );
      return user;
    });
    const login = await auth.login(account.email, input.password, false);
    setCookie(res, login.token, login.session.expires);
    res.status(201).json({ user: publicUser(account), csrf: login.session.csrf });
  });
  app.post(`${base}/auth/login`, authLimit, async (req, res) => {
    const input = z
      .object({
        email: z.string().trim().email().max(254).toLowerCase(),
        password: z.string().min(1).max(128),
        remember: z.boolean().optional(),
      })
      .parse(req.body);
    const result = await auth.login(input.email, input.password, Boolean(input.remember));
    setCookie(res, result.token, result.session.expires);
    res.json({ user: publicUser(result.account), csrf: result.session.csrf });
  });
  app.post(`${base}/auth/forgot-password`, authLimit, async (req, res) => {
    const input = z
        .object({ email: z.string().trim().email().max(254).toLowerCase() })
        .parse(req.body),
      account = await auth.find(input.email);
    if (account) {
      const token = await auth.issueToken(account, 'reset');
      await queueMail(
        db,
        account.email,
        'Reset your CampusLink password',
        `${config.origin}/reset-password?token=${token}`,
      );
    }
    res.json({ message: 'If this email is registered, a reset link will be sent.' });
  });
  app.post(`${base}/auth/reset-password`, authLimit, async (req, res) => {
    const input = z
      .object({ token: z.string().min(20), password: z.string().min(10).max(128) })
      .parse(req.body);
    await auth.consumeToken(input.token, 'reset', input.password);
    res.json({ message: 'Password reset. Sign in with your new password.' });
  });
  app.post(`${base}/auth/verify-email`, authLimit, async (req, res) => {
    const { token } = z.object({ token: z.string().min(20) }).parse(req.body);
    await auth.consumeToken(token, 'verify');
    res.json({ message: 'Email verified.' });
  });
  app.use(base, async (req, res, next) => {
    try {
      const { account, session } = await auth.authenticate(req.cookies.campuslink_session);
      res.locals.account = account;
      res.locals.session = session;
      requireCondition(
        account.onboardingComplete !== false ||
          ['/auth/me', '/auth/logout', '/account/onboarding'].includes(req.path),
        409,
        'Complete your dashboard profile before using placement features.',
      );
      if (!['GET', 'HEAD'].includes(req.method))
        requireCondition(
          req.headers['x-csrf-token'] === session.csrf,
          403,
          'Refresh your session before making changes.',
        );
      next();
    } catch (error) {
      next(error);
    }
  });
  mountAdmin(app, db, auth);
  mountSpeech(app);
  app.get(`${base}/auth/me`, (req, res) =>
    res.json({ user: publicUser(res.locals.account), csrf: res.locals.session.csrf }),
  );
  app.post(`${base}/auth/logout`, async (req, res) => {
    await db.remove('session', digest(req.cookies.campuslink_session));
    res.clearCookie('campuslink_session', { path: '/' });
    res.json({ message: 'Signed out.' });
  });
  app.put(`${base}/account/onboarding`, async (req, res) => {
    const input = registration
      .omit({ email: true, password: true, role: true })
      .extend({
        cgpa: z.number().min(0).max(10).optional(),
        bio: z.string().max(1500).optional(),
      })
      .parse(req.body);
    const user = await db.transaction(async () => {
      const actor = await auth.byId(res.locals.account.id);
      requireCondition(
        actor && actor.onboardingComplete === false,
        409,
        'Your account setup is already complete.',
      );
      const campuses = await db.list<Campus>('campus');
      let campus = input.campusId
        ? campuses.find((c) => c.id === input.campusId)
        : campuses.find((c) => c.name.toLowerCase() === input.institution.toLowerCase());
      if (actor.role === 'campus' && !campus) {
        campus = {
          id: randomUUID(),
          name: input.institution,
          location: '',
          studentPool: 0,
          courses: ['B.Tech'],
          branches: ['CSE', 'IT', 'ECE'],
        };
        await db.put('campus', campus.id, campus, campus.id);
      }
      requireCondition(
        actor.role === 'recruiter' || campus,
        400,
        'Choose an existing campus. A campus team must register first.',
      );
      if (actor.role === 'student')
        requireCondition(
          input.course?.trim() && input.branch?.trim() && input.year && input.cgpa !== undefined,
          400,
          'Complete your course, branch, graduation year and CGPA.',
        );
      actor.name = input.name;
      actor.campusId = actor.role === 'recruiter' ? '' : campus!.id;
      actor.organization = actor.role === 'recruiter' ? input.institution : campus!.name;
      actor.onboardingComplete = true;
      await auth.save(actor);
      if (actor.role === 'student') {
        const workspace = emptyWorkspace(actor, campus!.name);
        Object.assign(workspace.student, {
          course: `${input.course} · ${input.branch}`,
          branch: input.branch,
          year: input.year,
          cgpa: input.cgpa,
          bio: input.bio || '',
        });
        await db.put('workspace', actor.id, workspace, actor.campusId, actor.id);
      }
      await db.put(
        'audit',
        randomUUID(),
        { event: 'account-onboarding', actorId: actor.id, time: new Date().toISOString() },
        actor.campusId,
        actor.id,
      );
      return publicUser(actor);
    });
    res.json({ user });
  });
  app.post(`${base}/auth/resend-verification`, authLimit, async (_req, res) => {
    const a: Account = res.locals.account;
    const token = await auth.issueToken(a, 'verify');
    await queueMail(
      db,
      a.email,
      'Verify your CampusLink email',
      `${config.origin}/verify-email?token=${token}`,
    );
    res.json({ message: 'Verification email queued.' });
  });
  app.put(`${base}/account/ai-consent`, async (req, res) => {
    const input = z.object({ consent: z.boolean() }).parse(req.body);
    const account = { ...res.locals.account, aiConsent: input.consent };
    await auth.save(account);
    res.json({ consent: input.consent });
  });
  app.get(`${base}/account/ai-consent`, (_req, res) =>
    res.json({
      consent: Boolean(res.locals.account.aiConsent),
      provider: config.ai,
      mlConsent: Boolean(res.locals.account.mlConsent),
      mlConfigured: mlConfigured(),
      mlDestination: mlDestination(),
    }),
  );
  app.put(`${base}/account/ml-consent`, async (req, res) => {
    requireCondition(res.locals.account.role === 'student', 403, 'Student access required.');
    const { consent } = z.object({ consent: z.boolean() }).strict().parse(req.body);
    await auth.save({ ...res.locals.account, mlConsent: consent });
    res.json({ consent });
  });
  app.get(`${base}/approvals`, async (_req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(
      actor.role === 'campus' && actor.approved,
      403,
      'Only an approved campus team can review accounts.',
    );
    res.json(
      (await db.list<Account>('account'))
        .filter((a) => !a.approved && a.role === 'recruiter')
        .map(publicUser),
    );
  });
  app.post(`${base}/approvals/:id`, async (req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(
      actor.role === 'campus' && actor.approved,
      403,
      'Only an approved campus team can review accounts.',
    );
    const a = await auth.byId(String(req.params.id));
    requireCondition(a && a.role === 'recruiter', 404, 'Recruiter account not found.');
    const { approved } = z.object({ approved: z.boolean() }).parse(req.body);
    a.approved = approved;
    await auth.save(a);
    await db.put(
      'audit',
      randomUUID(),
      {
        event: 'account-approval',
        actorId: actor.id,
        targetId: a.id,
        approved,
        time: new Date().toISOString(),
      },
      actor.campusId,
      actor.id,
    );
    res.json(publicUser(a));
  });
  app.use(`${base}/services/aiService`, aiLimit);
  app.use(`${base}/services/interviewService`, aiLimit);
  app.post(`${base}/services/:service/:method`, async (req, res) => {
    const { args } = z.object({ args: z.array(z.unknown()).max(8).default([]) }).parse(req.body);
    const actor: Account = res.locals.account;
    requireCondition(
      !config.production || actor.verified,
      403,
      'Verify your email before using the platform.',
    );
    const result = await db.transaction(() =>
      runWorkspace(db, actor, req.header('X-Student-ID'), () =>
        dispatch(
          String(req.params.service),
          String(req.params.method),
          args.map((a) => (a === null ? undefined : a)),
        ),
      ),
    );
    res.json(result ?? { ok: true });
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 2 },
  });
  app.post(`${base}/documents`, upload.single('file'), async (req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(
      actor.role === 'student' && actor.approved,
      403,
      'Only students can upload their documents.',
    );
    requireCondition(req.file, 400, 'Choose a file.');
    const mime = detectFile(req.file.buffer);
    requireCondition(mime, 400, 'Upload a PDF, PNG, JPEG, or WebP file.');
    const type = z
      .enum([
        'Resume',
        'Certificate',
        'Academic transcript',
        'Academic record',
        'Offer letter',
        'ID proof',
        'Other',
        'Marksheet',
        'College ID',
      ])
      .parse(req.body.type);
    const key = await uploadFile(actor.id, req.file.buffer, mime);
    const data = await runWorkspace(db, actor, undefined, () =>
      mockAdapter.update((d) => {
        d.documents.push({
          id: randomUUID(),
          name: req.file!.originalname.replace(/[\r\n]/g, '').slice(0, 150),
          type,
          status: 'Uploaded',
          size: `${Math.ceil(req.file!.size / 1024)} KB`,
          ...{ storageKey: key, mime },
        });
      }),
    );
    res.status(201).json(data);
  });
  app.get(`${base}/documents/:id/download`, async (req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(actor.approved, 403, 'Account approval required.');
    await runWorkspace(db, actor, req.header('X-Student-ID'), async () => {
      const data = await readWorkspace();
      const file = data.documents.find(
        (d) => d.id === req.params.id,
      ) as (typeof data.documents)[number] & { storageKey?: string; mime?: string };
      requireCondition(file?.storageKey, 404, 'Document not found.');
      const buffer = await downloadFile(file.storageKey);
      res.setHeader('Content-Type', file.mime || 'application/octet-stream');
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      );
      res.send(buffer);
    });
  });
  app.get(`${base}/photos/:id`, async (req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(actor.approved, 403, 'Account approval required.');
    const authorized = await candidates(db, actor);
    requireCondition(
      authorized.some((a) => a.id === req.params.id),
      403,
      'Portrait access denied.',
    );
    const photo = await db.get<{ key: string; mime: string }>('photo', String(req.params.id));
    requireCondition(photo, 404, 'Portrait not found.');
    res.setHeader('Content-Type', photo.mime);
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.send(await downloadFile(photo.key));
  });
  app.get(`${base}/analytics`, async (_req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(actor.approved && actor.role !== 'student', 403, 'Team access required.');
    res.json(
      await analytics(db, actor.campusId, actor.role === 'recruiter' ? actor.id : undefined),
    );
  });
  app.get(`${base}/organization`, async (_req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(
      actor.role === 'recruiter' && actor.approved,
      403,
      'Recruiter access required.',
    );
    res.json(
      (await db.get('organization', actor.id)) || {
        name: actor.organization,
        description: '',
        industry: '',
        headquarters: '',
      },
    );
  });
  app.put(`${base}/organization`, async (req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(
      actor.role === 'recruiter' && actor.approved,
      403,
      'Recruiter access required.',
    );
    const input = z
      .object({
        name: z.string().trim().min(2).max(150),
        description: z.string().max(5000),
        industry: z.string().max(150),
        headquarters: z.string().max(150),
      })
      .strict()
      .parse(req.body);
    await db.transaction(async () => {
      actor.organization = input.name;
      await auth.save(actor);
      await db.put('organization', actor.id, input, actor.campusId, actor.id);
    });
    res.json(input);
  });
  app.post(`${base}/assistant`, aiLimit, async (req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(actor.role === 'student' && actor.approved, 403, 'Student access required.');
    const { question } = z.object({ question: z.string().trim().min(3).max(1000) }).parse(req.body);
    await runWorkspace(db, actor, undefined, async () => {
      const data = await readWorkspace();
      const q = question.toLowerCase();
      let answer: string;
      if (/offer|joining/.test(q))
        answer = data.offers.length
          ? data.offers.map((o) => `${o.company}: ${o.status}; joining ${o.joining}.`).join(' ')
          : 'You have no recorded offers yet. Follow your applications for selection updates.';
      else if (/document|resume/.test(q))
        answer = `You have ${data.documents.length} documents, ${data.documents.filter((d) => d.status === 'Verified').length} verified. Upload a text-based PDF resume in Documents for analysis.`;
      else if (/interview|schedule/.test(q))
        answer = data.interviews.length
          ? data.interviews.map((i) => `${i.company}: ${i.date}, ${i.time}, ${i.mode}.`).join(' ')
          : 'No interviews are scheduled yet. You can practise in the Interview hub.';
      else if (/eligib|drive|opportun|apply/.test(q)) {
        const matches = data.drives
          .filter((d) => ['ACTIVE', 'IN_PROGRESS'].includes(d.status))
          .map((d) => ({ drive: d, eligible: requireEligibility(data.student, d) }));
        answer = matches.length
          ? matches
              .map(
                ({ drive, eligible }) =>
                  `${drive.company} — ${drive.role}: ${
                    eligible.passed
                      ? 'eligible'
                      : eligible.checks
                          .filter((c) => !c.passed)
                          .map((c) => `${c.name}: ${c.detail}`)
                          .join('; ')
                  }. Deadline ${drive.deadline}.`,
              )
              .join('\n')
          : 'No active campus drives are recorded yet.';
      } else
        answer =
          'Build your career profile, verify skills, check campus opportunities, and use the Interview hub for preparation. Ask about your eligibility, interviews, documents, or offers.';
      res.json({
        answer,
        label: 'Record-grounded local assistant',
        source: 'Your authorized placement records',
      });
    });
  });
  app.get(`${base}/drives/:id/matches`, async (req, res) => {
    const actor: Account = res.locals.account,
      drive = await db.get<StoredDrive>('drive', String(req.params.id));
    requireCondition(
      actor.approved &&
        drive &&
        (actor.role === 'campus'
          ? drive.campusId === actor.campusId
          : actor.role === 'recruiter' && drive.recruiterId === actor.id),
      403,
      'Drive access denied.',
    );
    res.json(await runWorkspace(db, actor, undefined, () => rankedCandidates(drive)));
  });
  app.post(`${base}/drives/:id/schedule-suggestions`, async (req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(actor.role === 'campus' && actor.approved, 403, 'Campus access required.');
    const drive = await db.get<StoredDrive>('drive', String(req.params.id));
    requireCondition(drive && drive.campusId === actor.campusId, 403, 'Drive access denied.');
    const input = scheduleSchema.parse(req.body),
      drives = await db.list<StoredDrive>('drive', actor.campusId),
      suggestions = [];
    for (let offset = 0; offset < 14; offset++) {
      const date = new Date(`${input.date}T12:00:00Z`);
      date.setUTCDate(date.getUTCDate() + offset);
      const slot = { ...input, date: date.toISOString().slice(0, 10) };
      if (
        !scheduleConflicts(drives, drive.id, slot).length &&
        (!drive.deadline || slot.date > drive.deadline)
      )
        suggestions.push(slot);
      if (suggestions.length === 3) break;
    }
    res.json({
      suggestions,
      message: 'Suggestions must be confirmed; availability is rechecked when reserved.',
    });
  });
  app.get(`${base}/audit`, async (_req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(actor.role === 'campus' && actor.approved, 403, 'Campus access required.');
    res.json((await db.list('audit', actor.campusId)).slice(-200));
  });
  app.get(`${base}/integration-status`, (_req, res) => {
    const actor: Account = res.locals.account;
    requireCondition(actor.role === 'campus' && actor.approved, 403, 'Campus access required.');
    res.json({
      database: config.database ? 'postgresql' : 'sqlite-local',
      storage: config.storage,
      email: config.email,
      ai: config.ai,
      ml: loadModel()?.provenance === 'historical' ? 'historical' : 'not-trained',
      endpoints: Object.entries(policy).flatMap(([s, methods]) =>
        Object.keys(methods).map((m) => `${s}/${m}`),
      ),
    });
  });
  app.use((_req, _res, next) => next(new HttpError(404, 'Endpoint not found.')));
  app.use(
    (error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof ZodError)
        return res.status(400).json({ message: error.issues[0]?.message || 'Invalid input.' });
      if (error instanceof multer.MulterError)
        return res
          .status(400)
          .json({
            message: req.path.startsWith('/api/v1/voice/')
              ? 'Upload one audio recording under 12 MB.'
              : 'Upload one supported file under 10 MB.',
          });
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof SyntaxError
            ? 400
            : error instanceof DomainError
              ? 422
              : 500;
      res.status(status).json({
        message:
          error instanceof HttpError || error instanceof DomainError
            ? error.message
            : error instanceof SyntaxError
              ? 'Invalid request body.'
              : 'Unable to complete this request. Please try again.',
      });
    },
  );
  return { app, db, auth };
}
function setCookie(res: express.Response, token: string, expires: number) {
  res.cookie('campuslink_session', token, {
    httpOnly: true,
    secure: config.production,
    sameSite: 'lax',
    path: '/',
    expires: new Date(expires),
  });
}
