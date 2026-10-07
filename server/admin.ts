import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Database } from './db';
import { Authentication, Account, publicUser } from './auth';
import { requireCondition } from './errors';
import { config } from './config';
import type { AdminAssessment, AdminQuestion } from '../src/types/admin';
import { checkMlConnection, mlConfigured } from './ml-client';

const text = z.string().trim().min(1).max(2000);
const status = z.enum(['draft', 'published', 'archived']);
const common = {
  id: z.string().uuid().optional(),
  name: text,
  campusId: z.string().max(100).default(''),
};
const questionSchema = z
  .object({
    id: z.string().uuid().optional(),
    prompt: text,
    topic: text,
    options: z.array(text).min(2).max(6),
    answer: z.number().int().min(0),
  })
  .strict()
  .refine((q) => q.answer < q.options.length, 'Select a valid correct answer.')
  .refine((q) => new Set(q.options).size === q.options.length, 'Answer options must be distinct.');
const assessmentSchema = z
  .object({
    ...common,
    type: z.enum(['Skill', 'Aptitude', 'Technical', 'Communication']),
    duration: z.number().int().min(1).max(120),
    skill: z.string().trim().max(100).default(''),
    color: z.enum(['lavender', 'yellow', 'pink']).default('lavender'),
    status,
    questionIds: z.array(z.string().uuid()).max(100),
  })
  .strict()
  .refine(
    (a) => a.status !== 'published' || a.questionIds.length > 0,
    'Add questions before publishing.',
  )
  .refine(
    (a) => new Set(a.questionIds).size === a.questionIds.length,
    'Each question can only be selected once.',
  );
const contestSchema = z
  .object({
    ...common,
    type: text,
    duration: z.number().int().min(1).max(120),
    points: z.number().int().min(0).max(1000),
    difficulty: z.enum(['Easy', 'Medium', 'Hard']),
    prompt: text,
    answer: text,
    status,
  })
  .strict();
const campusSchema = z
  .object({
    id: z.string().max(100).optional(),
    name: text,
    location: text,
    courses: z.array(text).min(1).max(30),
    branches: z.array(text).min(1).max(50),
    studentPool: z.number().int().min(0).max(1000000).default(0),
  })
  .strict();

export function mountAdmin(app: Express, db: Database, auth: Authentication) {
  const base = '/api/v1/admin';
  app.use(base, (_req, res, next) => {
    const actor: Account = res.locals.account;
    requireCondition(
      actor.isAdmin === true && actor.approved,
      403,
      'Administrator access required.',
    );
    next();
  });
  const audit = (actor: Account, event: string, targetId: string) =>
    db.put(
      'audit',
      randomUUID(),
      { event, actorId: actor.id, targetId, time: new Date().toISOString() },
      '',
      actor.id,
    );
  app.get(base, async (_req, res) => {
    const accounts = await db.list<Account>('account');
    const events = await db.list<{ time: string }>('audit');
    res.json({
      accounts: accounts.map(publicUser),
      questions: await db.list('admin-question'),
      assessments: await db.list('admin-assessment'),
      contests: await db.list('admin-contest'),
      campuses: await db.list('campus'),
      audit: events.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 200),
      integrations: {
        database: config.database ? 'PostgreSQL' : 'SQLite',
        storage: config.storage,
        email: config.email,
        ai: config.ai,
        ml: mlConfigured() ? 'Configured' : 'API token missing',
      },
    });
  });
  app.get(`${base}/ml-status`, async (_req, res) => res.json(await checkMlConnection(true)));
  app.patch(`${base}/accounts/:id`, async (req, res) => {
    const { approved } = z.object({ approved: z.boolean() }).strict().parse(req.body);
    const actor: Account = res.locals.account;
    const result = await db.transaction(async () => {
      const account = await auth.byId(String(req.params.id));
      requireCondition(account, 404, 'Account not found.');
      requireCondition(
        !account.isAdmin,
        403,
        'Administrator accounts must be managed by the project operator.',
      );
      account.approved = approved;
      await auth.save(account);
      await audit(
        actor,
        approved ? 'admin-account-approved' : 'admin-account-access-revoked',
        account.id,
      );
      return publicUser(account);
    });
    res.json(result);
  });
  for (const [route, kind, schema] of [
    ['questions', 'admin-question', questionSchema],
    ['assessments', 'admin-assessment', assessmentSchema],
    ['contests', 'admin-contest', contestSchema],
    ['campuses', 'campus', campusSchema],
  ] as const) {
    app.post(`${base}/${route}`, async (req, res) => {
      const input = schema.parse(req.body);
      const result = await db.transaction(async () => {
        if (input.id) requireCondition(await db.get(kind, input.id), 404, 'Record not found.');
        if ('campusId' in input && input.campusId)
          requireCondition(
            await db.get('campus', input.campusId),
            400,
            'Choose an existing campus.',
          );
        if ('questionIds' in input)
          for (const id of input.questionIds)
            requireCondition(
              await db.get('admin-question', id),
              400,
              'A selected question no longer exists.',
            );
        const id = input.id || randomUUID();
        const row = {
          ...input,
          id,
          updatedAt: new Date().toISOString(),
          ...(kind === 'admin-contest' ? { participants: 0, joined: false, completed: false } : {}),
        };
        await db.put(kind, id, row);
        await audit(res.locals.account, `admin-${route}-${input.id ? 'updated' : 'created'}`, id);
        return row;
      });
      res.json(result);
    });
  }
}

export async function assessmentQuestions(db: Database, id: string) {
  const assessment = await db.get<AdminAssessment>('admin-assessment', id);
  if (!assessment) return undefined;
  requireCondition(assessment.status === 'published', 404, 'Assessment is unavailable.');
  const questions = await Promise.all(
    assessment.questionIds.map((id) => db.get<AdminQuestion>('admin-question', id)),
  );
  requireCondition(
    questions.length > 0 && questions.every(Boolean),
    409,
    'This assessment needs valid questions.',
  );
  return questions as AdminQuestion[];
}
